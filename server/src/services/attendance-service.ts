import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { dbPool } from '../config/database.js'
import type { AttendanceRecord, AttendanceRecordInput } from '../types/index.js'
import {
    parseAttendanceNotesJson,
    toDate,
    toDbAttendanceNotesJson,
    toDbDate,
    toDbDateTime,
    toDbTime,
    toIsoDateTime,
    toTime,
} from '../utils/data-mappers.js'
import { toText } from '../utils/string-utils.js'
import { saveBase64ToDisk } from '../utils/base64-storage.js'
import { getAuthorizedPersons } from './child-service.js'

const mapAttendanceRow = (row: RowDataPacket): AttendanceRecord => {
    const noteData = parseAttendanceNotesJson(row.notes)

    return {
        id: String(row.id),
        createdAt: toIsoDateTime(row.created_at),
        updatedAt: toIsoDateTime(row.updated_at),
        childId: String(row.child_id),
        date: toDate(row.attendance_date),
        escortName: typeof row.escort_name === 'string' ? row.escort_name : '',
        pickupName: typeof row.pickup_name === 'string' ? row.pickup_name : '',
        parentMessage: noteData.parentMessage || '',
        messageForParent: noteData.messageForParent || '',
        departureNotes: noteData.departureNotes || '',
        arrivalTime: toTime(row.arrival_time),
        departureTime: toTime(row.departure_time),
        arrivalPhysicalCondition:
            noteData.arrivalPhysicalCondition || 'sehat',
        arrivalEmotionalCondition:
            noteData.arrivalEmotionalCondition || 'senang',
        departurePhysicalCondition:
            noteData.departurePhysicalCondition || 'sehat',
        departureEmotionalCondition:
            noteData.departureEmotionalCondition || 'senang',
        carriedItems: noteData.carriedItems,
        escortSignatureDataUrl:
            typeof row.escort_signature_data === 'string' ? row.escort_signature_data : '',
        pickupSignatureDataUrl:
            typeof row.pickup_signature_data === 'string' ? row.pickup_signature_data : '',
    }
}

const serializeAttendance = (record: AttendanceRecord, childId: number) => ({
    childId,
    date: toDbDate(record.date),
    escortName: toText(record.escortName).trim(),
    pickupName: toText(record.pickupName).trim(),
    arrivalTime: toDbTime(record.arrivalTime),
    departureTime: toDbTime(record.departureTime),
    notes: toDbAttendanceNotesJson(record),
    escortSignatureData: toText(record.escortSignatureDataUrl).trim(),
    pickupSignatureData: toText(record.pickupSignatureDataUrl).trim(),
    createdAt: toDbDateTime(record.createdAt),
    updatedAt: toDbDateTime(record.updatedAt),
})

import { ServiceError } from '../utils/service-error.js'
export { ServiceError }

const nowIso = (): string => new Date().toISOString()

export const getAttendanceRecords = async (month?: string): Promise<AttendanceRecord[]> => {
    let query = 'SELECT * FROM attendance_records'
    const params: unknown[] = []

    if (month) {
        query += ' WHERE attendance_date LIKE ?'
        params.push(`${month}%`)
    }

    query += ' ORDER BY attendance_date DESC, created_at DESC'

    const [rows] = await dbPool.query<RowDataPacket[]>(query, params)
    return rows.map(mapAttendanceRow)
}

export const getAttendanceRecordById = async (id: string): Promise<AttendanceRecord | null> => {
    const [rows] = await dbPool.query<RowDataPacket[]>(
        'SELECT * FROM attendance_records WHERE id = ?',
        [id],
    )
    if (rows.length === 0) return null
    return mapAttendanceRow(rows[0])
}

export const createAttendanceRecord = async (input: AttendanceRecordInput): Promise<AttendanceRecord> => {
    const connection = await dbPool.getConnection()
    try {
        await connection.beginTransaction()
        const timestamp = nowIso()

        // Save signatures
        const escortSigPath = await saveBase64ToDisk(input.escortSignatureDataUrl || '', 'sig_escort')
        const pickupSigPath = await saveBase64ToDisk(input.pickupSignatureDataUrl || '', 'sig_pickup')

        // Save carried items photos
        const processedCarriedItems = await Promise.all(
            (input.carriedItems || []).map(async (item) => ({
                ...item,
                imageDataUrl: await saveBase64ToDisk(item.imageDataUrl || '', 'item')
            }))
        )

        // Resolving child_id from string to number (assuming input.childId is the string ID)
        // We need to look up the numeric ID. If it doesn't exist, we can't insert.
        // However, existing app logic seems to treat string ID and numeric ID interchangeably or mapped.
        // Let's check how app-data-service handles it. It maps using `childIdMap`.
        // Here we need to query `children` table to get numeric ID if our input uses string UUIDs.

        // Check if input.childId is numeric or uuid. 
        // The current system uses string IDs for everything in frontend, but numeric AI in DB.
        // We need to find the child's numeric ID using their string ID (if stored) or just trust the input if we migrate to consistent IDs.
        // Wait, the `children` table has `id` as integer AI? Let's check the schema.
        // Based on `app-data-service`, `insertChild` preserves IDs if possible.
        // Let's assume for now we look up numeric ID by the string ID if possible, or error out.

        // For this refactor, I will reuse the `toNumericDbId` logic if applicable or just query.
        // Actually, looking at `app-data-service.ts` L1639: `const childId = childIdMap.get(record.childId)`.
        // It seems `children` table `id` is the numeric join key.

        // We need a helper to get numeric child ID from the public string ID? 
        // Or is the public string ID actually the numeric ID turned into string?
        // `mapChildRow` does `id: String(row.id)`. So public ID "123" corresponds to DB ID 123.
        // So we can just parse it.

        const childIdInt = parseInt(input.childId, 10)
        if (isNaN(childIdInt)) {
            throw new ServiceError(400, 'ID Anak tidak valid.')
        }

        // Validate Authorized Persons
        const authorized = await getAuthorizedPersons(input.childId, connection)
        if (input.escortName && !authorized.includes(input.escortName.trim())) {
            throw new ServiceError(400, `Pengantar "${input.escortName}" tidak terdaftar.`)
        }
        if (input.pickupName && !authorized.includes(input.pickupName.trim())) {
            throw new ServiceError(400, `Penjemput "${input.pickupName}" tidak terdaftar.`)
        }

        const record: AttendanceRecord = {
            id: "0", // Placeholder, will be AI
            ...input,
            escortSignatureDataUrl: escortSigPath,
            pickupSignatureDataUrl: pickupSigPath,
            carriedItems: processedCarriedItems,
            createdAt: timestamp,
            updatedAt: timestamp,
            // Ensure defaults
            parentMessage: input.parentMessage || '',
            messageForParent: input.messageForParent || '',
            departureNotes: input.departureNotes || '',
            arrivalPhysicalCondition: input.arrivalPhysicalCondition || 'sehat',
            arrivalEmotionalCondition: input.arrivalEmotionalCondition || 'senang',
            departurePhysicalCondition: input.departurePhysicalCondition || 'sehat',
            departureEmotionalCondition: input.departureEmotionalCondition || 'senang',
        }

        const payload = serializeAttendance(record, childIdInt)

        const [result] = await connection.execute<ResultSetHeader>(
            `INSERT INTO attendance_records (
        child_id,
        attendance_date,
        escort_name,
        pickup_name,
        arrival_time,
        departure_time,
        escort_signature_data,
        pickup_signature_data,
        notes,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                payload.childId,
                payload.date,
                payload.escortName,
                payload.pickupName,
                payload.arrivalTime,
                payload.departureTime,
                payload.escortSignatureData,
                payload.pickupSignatureData,
                payload.notes,
                payload.createdAt,
                payload.updatedAt,
            ],
        )

        await connection.commit()
        record.id = String(result.insertId)
        return record
    } catch (e) {
        await connection.rollback()
        throw e
    } finally {
        connection.release()
    }
}

export const updateAttendanceRecord = async (id: string, input: AttendanceRecordInput): Promise<AttendanceRecord> => {
    const connection = await dbPool.getConnection()
    try {
        await connection.beginTransaction()
        const recordIdInt = parseInt(id, 10)
        const childIdInt = parseInt(input.childId, 10)

        if (isNaN(recordIdInt)) throw new ServiceError(400, 'ID Kehadiran tidak valid.')
        if (isNaN(childIdInt)) throw new ServiceError(400, 'ID Anak tidak valid.')

        const timestamp = nowIso()

        // Validate Authorized Persons
        const authorized = await getAuthorizedPersons(input.childId, connection)
        if (input.escortName && !authorized.includes(input.escortName.trim())) {
            throw new ServiceError(400, `Pengantar "${input.escortName}" tidak terdaftar.`)
        }
        if (input.pickupName && !authorized.includes(input.pickupName.trim())) {
            throw new ServiceError(400, `Penjemput "${input.pickupName}" tidak terdaftar.`)
        }

        // Save signatures
        const escortSigPath = await saveBase64ToDisk(input.escortSignatureDataUrl || '', 'sig_escort')
        const pickupSigPath = await saveBase64ToDisk(input.pickupSignatureDataUrl || '', 'sig_pickup')

        // Save carried items photos
        const processedCarriedItems = await Promise.all(
            (input.carriedItems || []).map(async (item) => ({
                ...item,
                imageDataUrl: await saveBase64ToDisk(item.imageDataUrl || '', 'item')
            }))
        )

        // We reconstruct the record object to serialize it
        const record: AttendanceRecord = {
            id: id,
            ...input,
            escortSignatureDataUrl: escortSigPath,
            pickupSignatureDataUrl: pickupSigPath,
            carriedItems: processedCarriedItems,
            createdAt: "", // Not used in update usually, but needed for type
            updatedAt: timestamp
        }

        const payload = serializeAttendance(record, childIdInt)

        await connection.execute(
            `UPDATE attendance_records SET
        child_id = ?,
        attendance_date = ?,
        escort_name = ?,
        pickup_name = ?,
        arrival_time = ?,
        departure_time = ?,
        escort_signature_data = ?,
        pickup_signature_data = ?,
        notes = ?,
        updated_at = ?
       WHERE id = ?`,
            [
                payload.childId,
                payload.date,
                payload.escortName,
                payload.pickupName,
                payload.arrivalTime,
                payload.departureTime,
                payload.escortSignatureData,
                payload.pickupSignatureData,
                payload.notes,
                payload.updatedAt,
                recordIdInt
            ],
        )

        // Fetch updated
        await connection.commit()
        const updated = await getAttendanceRecordById(id)
        if (!updated) throw new ServiceError(404, 'Data kehadiran tidak ditemukan setelah pembaruan.')
        return updated
    } catch (e) {
        await connection.rollback()
        throw e
    } finally {
        connection.release()
    }
}

export const deleteAttendanceRecord = async (id: string): Promise<void> => {
    const recordIdInt = parseInt(id, 10)
    if (isNaN(recordIdInt)) throw new ServiceError(400, 'ID Kehadiran tidak valid.')

    await dbPool.execute('DELETE FROM attendance_records WHERE id = ?', [recordIdInt])
}
