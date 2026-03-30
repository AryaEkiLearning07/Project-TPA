import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import { dbPool } from '../config/database.js'
import type { ObservationRecord, ObservationRecordInput, ObservationCategory, ObservationItem } from '../types/index.js'
import { toText } from '../utils/string-utils.js'

import { ServiceError } from '../utils/service-error.js'
export { ServiceError }

const toObservationCategory = (value: unknown): ObservationCategory => {
    const normalized = String(value).trim().toLowerCase()
    if (normalized === 'perlu-latihan') return 'perlu-latihan'
    if (normalized === 'sudah-baik') return 'sudah-baik'
    return 'perlu-arahan'
}

interface ObsRecordRow extends RowDataPacket {
    id: number
    child_id: number
    observation_date: string
    group_name: string
    observer_name: string
    created_at: string
    updated_at: string
}

interface ObsItemRow extends RowDataPacket {
    id: number
    observation_record_id: number
    activity: string
    indicator: string
    category: string
    notes: string | null
    sort_order: number
}

const mapRecordRow = (row: ObsRecordRow, items: ObservationItem[]): ObservationRecord => ({
    id: String(row.id),
    childId: String(row.child_id),
    date: String(row.observation_date).slice(0, 10),
    groupName: toText(row.group_name),
    observerName: toText(row.observer_name),
    items,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
})

const mapItemRow = (row: ObsItemRow): ObservationItem => ({
    id: String(row.id),
    activity: toText(row.activity),
    indicator: toText(row.indicator),
    category: toObservationCategory(row.category),
    notes: toText(row.notes),
})

const loadItemsForRecord = async (recordId: number): Promise<ObservationItem[]> => {
    const [rows] = await dbPool.query<ObsItemRow[]>(
        'SELECT * FROM observation_items WHERE observation_record_id = ? ORDER BY sort_order ASC',
        [recordId]
    )
    return rows.map((row) => mapItemRow(row))
}

export const getObservationRecords = async (month?: string): Promise<ObservationRecord[]> => {
    let query = 'SELECT * FROM observation_records'
    const params: string[] = []

    if (month) {
        query += ' WHERE DATE_FORMAT(observation_date, "%Y-%m") = ?'
        params.push(month)
    }

    query += ' ORDER BY observation_date DESC, created_at DESC'

    const [rows] = await dbPool.query<ObsRecordRow[]>(query, params)

    if (rows.length === 0) return []

    const recordIds = rows.map(r => r.id)
    const [allItems] = await dbPool.query<ObsItemRow[]>(
        `SELECT * FROM observation_items WHERE observation_record_id IN (${recordIds.map(() => '?').join(',')}) ORDER BY sort_order ASC`,
        recordIds
    )

    const itemsByRecord = new Map<number, ObservationItem[]>()
    for (const item of allItems) {
        const list = itemsByRecord.get(item.observation_record_id) || []
        list.push(mapItemRow(item))
        itemsByRecord.set(item.observation_record_id, list)
    }

    return rows.map(row => mapRecordRow(row, itemsByRecord.get(row.id) || []))
}

export const getObservationRecordById = async (id: string): Promise<ObservationRecord | null> => {
    const [rows] = await dbPool.query<ObsRecordRow[]>(
        'SELECT * FROM observation_records WHERE id = ? LIMIT 1',
        [id]
    )

    if (rows.length === 0) return null

    const items = await loadItemsForRecord(rows[0].id)
    return mapRecordRow(rows[0], items)
}

export const createObservationRecord = async (input: ObservationRecordInput): Promise<ObservationRecord> => {
    const connection = await dbPool.getConnection()
    try {
        await connection.beginTransaction()

        const childId = parseInt(input.childId, 10)
        if (!childId || isNaN(childId)) throw new ServiceError(400, 'ID Anak tidak valid.')

        const [result] = await connection.execute<ResultSetHeader>(
            `INSERT INTO observation_records (child_id, observation_date, group_name, observer_name)
             VALUES (?, ?, ?, ?)`,
            [childId, input.date, input.groupName || '', input.observerName || '']
        )

        const newId = result.insertId

        if (Array.isArray(input.items) && input.items.length > 0) {
            for (let i = 0; i < input.items.length; i++) {
                const item = input.items[i]
                await connection.execute(
                    `INSERT INTO observation_items (observation_record_id, activity, indicator, category, notes, sort_order)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [newId, item.activity || '', item.indicator || '', item.category || 'perlu-arahan', item.notes || '', i]
                )
            }
        }

        await connection.commit()

        const record = await getObservationRecordById(String(newId))
        if (!record) throw new ServiceError(500, 'Gagal membaca data observasi setelah disimpan.')
        return record
    } catch (e) {
        await connection.rollback()
        throw e
    } finally {
        connection.release()
    }
}

export const updateObservationRecord = async (id: string, input: ObservationRecordInput): Promise<ObservationRecord> => {
    const connection = await dbPool.getConnection()
    try {
        await connection.beginTransaction()

        const recordId = parseInt(id, 10)
        if (!recordId || isNaN(recordId)) throw new ServiceError(400, 'ID Observasi tidak valid.')

        const childId = parseInt(input.childId, 10)
        if (!childId || isNaN(childId)) throw new ServiceError(400, 'ID Anak tidak valid.')

        const [existing] = await connection.query<ObsRecordRow[]>(
            'SELECT id FROM observation_records WHERE id = ? LIMIT 1',
            [recordId]
        )
        if (existing.length === 0) throw new ServiceError(404, 'Data observasi tidak ditemukan.')

        await connection.execute(
            `UPDATE observation_records SET child_id = ?, observation_date = ?, group_name = ?, observer_name = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [childId, input.date, input.groupName || '', input.observerName || '', recordId]
        )

        // Delete existing items, re-insert
        await connection.execute('DELETE FROM observation_items WHERE observation_record_id = ?', [recordId])

        if (Array.isArray(input.items) && input.items.length > 0) {
            for (let i = 0; i < input.items.length; i++) {
                const item = input.items[i]
                await connection.execute(
                    `INSERT INTO observation_items (observation_record_id, activity, indicator, category, notes, sort_order)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [recordId, item.activity || '', item.indicator || '', item.category || 'perlu-arahan', item.notes || '', i]
                )
            }
        }

        await connection.commit()

        const record = await getObservationRecordById(id)
        if (!record) throw new ServiceError(500, 'Gagal membaca data observasi setelah diperbarui.')
        return record
    } catch (e) {
        await connection.rollback()
        throw e
    } finally {
        connection.release()
    }
}

export const deleteObservationRecord = async (id: string): Promise<void> => {
    const recordId = parseInt(id, 10)
    if (!recordId || isNaN(recordId)) throw new ServiceError(400, 'ID Observasi tidak valid.')

    // Delete child items first to prevent orphans
    await dbPool.execute('DELETE FROM observation_items WHERE observation_record_id = ?', [recordId])

    const [result] = await dbPool.execute<ResultSetHeader>(
        'DELETE FROM observation_records WHERE id = ?',
        [recordId]
    )

    if (result.affectedRows === 0) {
        throw new ServiceError(404, 'Data observasi tidak ditemukan.')
    }
}
