import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { dbPool } from '../config/database.js' // Fixed import with extension
import type { CommunicationBookEntry, CommunicationBookEntryInput } from '../types/index.js' // Fixed import with extension
import {
    toDbDate,
    toDbDateTime,
    toIsoDateTime,
    toDate,
    toNullable
} from '../utils/data-mappers.js'
import { toText } from '../utils/string-utils.js'

import { ServiceError } from '../utils/service-error.js'
export { ServiceError }

const nowIso = (): string => new Date().toISOString()

const mapCommunicationRow = (row: RowDataPacket): CommunicationBookEntry => ({
    id: String(row.id),
    createdAt: toIsoDateTime(row.created_at),
    updatedAt: toIsoDateTime(row.updated_at),
    childId: String(row.child_id),
    date: toDate(row.entry_date),
    inventoryItems: parseStringArrayJson(row.inventory_items_json),
    notes: typeof row.notes === 'string' ? row.notes : '',
})

const parseStringArrayJson = (value: unknown): string[] => {
    if (typeof value !== 'string' || value.length === 0) {
        return []
    }
    try {
        const parsed = JSON.parse(value) as unknown
        if (!Array.isArray(parsed)) {
            return []
        }
        return parsed.filter((item): item is string => typeof item === 'string')
    } catch {
        return []
    }
}

const serializeCommunication = (entry: CommunicationBookEntry, childId: number) => ({
    childId,
    date: toDbDate(entry.date),
    inventoryItemsJson: JSON.stringify(
        (Array.isArray(entry.inventoryItems) ? entry.inventoryItems : [])
            .map((item) => toText(item).trim())
            .filter(Boolean),
    ),
    notes: toNullable(entry.notes),
    createdAt: toDbDateTime(entry.createdAt),
    updatedAt: toDbDateTime(entry.updatedAt),
})


export const getCommunicationEntries = async (month?: string): Promise<CommunicationBookEntry[]> => {
    let query = 'SELECT * FROM communication_books'
    const params: unknown[] = []

    if (month) {
        query += ' WHERE entry_date LIKE ?'
        params.push(`${month}%`)
    }

    query += ' ORDER BY entry_date DESC, created_at DESC'

    const [rows] = await dbPool.query<RowDataPacket[]>(query, params)
    return rows.map(mapCommunicationRow)
}

export const getCommunicationEntryById = async (id: string): Promise<CommunicationBookEntry | null> => {
    const [rows] = await dbPool.query<RowDataPacket[]>(
        'SELECT * FROM communication_books WHERE id = ?',
        [id],
    )
    if (rows.length === 0) return null
    return mapCommunicationRow(rows[0])
}


export const createCommunicationEntry = async (input: CommunicationBookEntryInput): Promise<CommunicationBookEntry> => {
    const connection = await dbPool.getConnection()
    try {
        const timestamp = nowIso()
        const childIdInt = parseInt(input.childId, 10)
        if (isNaN(childIdInt)) {
            throw new ServiceError(400, 'ID Anak tidak valid.')
        }

        const record: CommunicationBookEntry = {
            id: "0",
            ...input,
            createdAt: timestamp,
            updatedAt: timestamp,
            inventoryItems: input.inventoryItems || [],
            notes: input.notes || '',
        }

        const payload = serializeCommunication(record, childIdInt)

        const [result] = await connection.execute<ResultSetHeader>(
            `INSERT INTO communication_books (
      child_id,
      entry_date,
      inventory_items_json,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
                payload.childId,
                payload.date,
                payload.inventoryItemsJson,
                payload.notes,
                payload.createdAt,
                payload.updatedAt,
            ],
        )

        record.id = String(result.insertId)
        return record
    } finally {
        connection.release()
    }
}

export const updateCommunicationEntry = async (id: string, input: CommunicationBookEntryInput): Promise<CommunicationBookEntry> => {
    const connection = await dbPool.getConnection()
    try {
        const recordIdInt = parseInt(id, 10)
        const childIdInt = parseInt(input.childId, 10)

        if (isNaN(recordIdInt)) throw new ServiceError(400, 'ID Rekam tidak valid.')
        if (isNaN(childIdInt)) throw new ServiceError(400, 'ID Anak tidak valid.')

        const timestamp = nowIso()

        const record: CommunicationBookEntry = {
            id: id,
            ...input,
            createdAt: "",
            updatedAt: timestamp
        }

        const payload = serializeCommunication(record, childIdInt)

        await connection.execute(
            `UPDATE communication_books SET
       child_id = ?,
       entry_date = ?,
       inventory_items_json = ?,
       notes = ?,
       updated_at = ?
       WHERE id = ?`,
            [
                payload.childId,
                payload.date,
                payload.inventoryItemsJson,
                payload.notes,
                payload.updatedAt,
                recordIdInt
            ],
        )

        // Fetch updated
        const updated = await getCommunicationEntryById(id)
        if (!updated) throw new ServiceError(404, 'Data komunikasi tidak ditemukan setelah pembaruan.')
        return updated
    } finally {
        connection.release()
    }
}

export const deleteCommunicationEntry = async (id: string): Promise<void> => {
    const recordIdInt = parseInt(id, 10)
    if (isNaN(recordIdInt)) throw new ServiceError(400, 'ID Rekam tidak valid.')

    await dbPool.execute('DELETE FROM communication_books WHERE id = ?', [recordIdInt])
}
