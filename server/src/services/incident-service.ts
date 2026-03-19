import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { dbPool } from '../config/database.js'
import type { IncidentReport, IncidentReportInput, IncidentCarriedItem, IncidentCategoryKey, MealEquipment } from '../types/index.js'
import {
    parseIncidentItemsJson,
    parseMealEquipmentJson,
    toDbDate,
    toDbDateTime,
    toDbEmotionalCondition,
    toDbPhysicalCondition,
    toDbSupplyInventoryJson,
    toIncidentCategoryKey,
    toIsoDateTime,
    toDate,
    toNullable
} from '../utils/data-mappers.js'
import { toText } from '../utils/string-utils.js'
import { saveBase64ToDisk } from '../utils/base64-storage.js'

// Helper to sanitize incident carried items
const INCIDENT_CATEGORY_KEYS: IncidentCategoryKey[] = [
    'DRINKING_BOTTLE',
    'MILK_CONTAINER',
    'MEAL_CONTAINER',
    'SNACK_CONTAINER',
    'BATH_SUPPLIES',
    'MEDICINE_VITAMIN',
    'BAG',
    'HELMET',
    'SHOES',
    'JACKET',
    'OTHER',
]
const INCIDENT_CATEGORY_KEY_SET = new Set<IncidentCategoryKey>(INCIDENT_CATEGORY_KEYS)

const createIncidentItemId = (index: number): string => `incident-item-${index}`

const sanitizeIncidentCarriedItem = (
    value: unknown,
    index: number,
): IncidentCarriedItem => {
    const isObject = (val: unknown): val is Record<string, unknown> => typeof val === 'object' && val !== null

    if (!isObject(value)) {
        return {
            id: createIncidentItemId(index),
            categoryKey: 'OTHER',
            description: '',
        }
    }

    return {
        id: toText(value.id) || createIncidentItemId(index),
        categoryKey: toIncidentCategoryKey(value.categoryKey),
        description: toText(value.description),
    }
}

const sanitizeIncidentCarriedItems = (
    items: IncidentCarriedItem[],
): IncidentCarriedItem[] =>
    (Array.isArray(items) ? items : [])
        .map((item, index) => sanitizeIncidentCarriedItem(item, index))
        .map((item, index) => ({
            ...item,
            id: item.id || createIncidentItemId(index),
            description: item.description.trim(),
        }))
        .filter((item) => item.description.length > 0)


// Mapping function
const defaultMealEquipment = (): MealEquipment => ({
    drinkingBottle: { brand: '', imageDataUrl: '', imageName: '', description: '' },
    milkBottle: { brand: '', imageDataUrl: '', imageName: '', description: '' },
    mealContainer: { brand: '', imageDataUrl: '', imageName: '', description: '' },
    snackContainer: { brand: '', imageDataUrl: '', imageName: '', description: '' },
})

const splitLegacyText = (value: string): string[] =>
    value
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean)

const buildLegacyMealDescription = (item: {
    brand: string
    description: string
}): string => {
    const brand = toText(item.brand).trim()
    const description = toText(item.description).trim()
    if (!brand) {
        return description
    }
    if (!description || brand.toLowerCase() === description.toLowerCase()) {
        return brand
    }
    return `${brand} (${description})`
}

const buildIncidentItemsFromLegacy = (
    mealEquipment: MealEquipment,
    bathEquipment: string,
    medicines: string,
    bagItems: string,
): IncidentCarriedItem[] => {
    const nextItems: IncidentCarriedItem[] = []

    const pushItems = (
        categoryKey: IncidentCategoryKey,
        rawValues: string[],
    ) => {
        for (const rawValue of rawValues) {
            const description = rawValue.trim()
            if (!description) {
                continue
            }
            nextItems.push({
                id: createIncidentItemId(nextItems.length),
                categoryKey,
                description,
            })
        }
    }

    pushItems('DRINKING_BOTTLE', [
        buildLegacyMealDescription(mealEquipment.drinkingBottle),
    ])
    pushItems('MILK_CONTAINER', [buildLegacyMealDescription(mealEquipment.milkBottle)])
    pushItems('MEAL_CONTAINER', [buildLegacyMealDescription(mealEquipment.mealContainer)])
    pushItems('SNACK_CONTAINER', [buildLegacyMealDescription(mealEquipment.snackContainer)])
    pushItems('BATH_SUPPLIES', splitLegacyText(toText(bathEquipment)))
    pushItems('MEDICINE_VITAMIN', splitLegacyText(toText(medicines)))
    pushItems('BAG', splitLegacyText(toText(bagItems)))

    return nextItems
}

const dbToPhysical: Record<string, string> = {
    HEALTHY: 'sehat',
    SICK: 'sakit',
}

const dbToEmotional: Record<string, string> = {
    HAPPY: 'senang',
    SAD: 'sedih',
}


const mapIncidentRow = (row: RowDataPacket): IncidentReport => {
    const mealEquipment = parseMealEquipmentJson(row.meal_equipment_json)
    const bathEquipment = typeof row.bath_equipment === 'string' ? row.bath_equipment : ''
    const medicines = typeof row.medicines === 'string' ? row.medicines : ''
    const bag = typeof row.bag_items === 'string' ? row.bag_items : ''
    const parsedItemsJson = parseIncidentItemsJson(row.items_json)

    const carriedItems =
        parsedItemsJson.items.length > 0
            ? parsedItemsJson.items
            : buildIncidentItemsFromLegacy(mealEquipment, bathEquipment, medicines, bag)

    return {
        id: String(row.id),
        createdAt: toIsoDateTime(row.created_at),
        updatedAt: toIsoDateTime(row.updated_at),
        childId: String(row.child_id),
        date: toDate(row.report_date),
        arrivalPhysicalCondition:
            dbToPhysical[row.arrival_physical_condition as string] ?? 'sehat',
        arrivalEmotionalCondition:
            dbToEmotional[row.arrival_emotional_condition as string] ??
            'senang',
        departurePhysicalCondition:
            dbToPhysical[row.departure_physical_condition as string] ??
            'sehat',
        departureEmotionalCondition:
            dbToEmotional[row.departure_emotional_condition as string] ??
            'senang',
        carriedItemsPhotoDataUrl: parsedItemsJson.groupPhotoDataUrl,
        carriedItems,
        mealEquipment,
        bathEquipment,
        medicines,
        bag,
        parentMessage:
            typeof row.parent_message === 'string' ? row.parent_message : '',
        messageForParent:
            typeof row.message_for_parent === 'string' ? row.message_for_parent : '',
        notes: typeof row.notes === 'string' ? row.notes : '',
        arrivalSignatureDataUrl:
            typeof row.arrival_signature_data === 'string' ? row.arrival_signature_data : '',
        departureSignatureDataUrl:
            typeof row.departure_signature_data === 'string'
                ? row.departure_signature_data
                : '',
    }
}

// Logic for serialization
const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

const getIncidentDescriptionsByCategory = (
    items: IncidentCarriedItem[],
    categoryKey: IncidentCategoryKey,
): string[] =>
    items
        .filter((item) => item.categoryKey === categoryKey)
        .map((item) => item.description.trim())
        .filter(Boolean)

const getJoinedIncidentDescriptions = (
    items: IncidentCarriedItem[],
    categoryKey: IncidentCategoryKey,
): string => getIncidentDescriptionsByCategory(items, categoryKey).join('\n')

const buildLegacyFieldsFromIncidentItems = (
    items: IncidentCarriedItem[],
): {
    mealEquipment: MealEquipment
    bathEquipment: string
    medicines: string
    bagItems: string
} => {
    const mealEquipment = defaultMealEquipment()

    const setMealField = (
        key: keyof MealEquipment,
        categoryKey: IncidentCategoryKey,
    ) => {
        const description = getJoinedIncidentDescriptions(items, categoryKey)
        mealEquipment[key] = {
            ...mealEquipment[key],
            brand: description,
            description,
        }
    }

    setMealField('drinkingBottle', 'DRINKING_BOTTLE')
    setMealField('milkBottle', 'MILK_CONTAINER')
    setMealField('mealContainer', 'MEAL_CONTAINER')
    setMealField('snackContainer', 'SNACK_CONTAINER')

    return {
        mealEquipment,
        bathEquipment: getJoinedIncidentDescriptions(items, 'BATH_SUPPLIES'),
        medicines: getJoinedIncidentDescriptions(items, 'MEDICINE_VITAMIN'),
        bagItems: getJoinedIncidentDescriptions(items, 'BAG'),
    }
}

const serializeIncident = (report: IncidentReport, childId: number) => {
    const normalizedItems = sanitizeIncidentCarriedItems(
        (Array.isArray(report.carriedItems) ? report.carriedItems : []) as IncidentCarriedItem[],
    )
    const carriedItems =
        normalizedItems.length > 0
            ? normalizedItems
            : buildIncidentItemsFromLegacy(
                report.mealEquipment || defaultMealEquipment(),
                toText(report.bathEquipment),
                toText(report.medicines),
                toText(report.bag),
            )

    const legacyFromItems = buildLegacyFieldsFromIncidentItems(carriedItems)
    const fallbackMealEquipment =
        report.mealEquipment && isObject(report.mealEquipment)
            ? report.mealEquipment
            : defaultMealEquipment()

    const mealEquipment =
        carriedItems.length > 0 ? legacyFromItems.mealEquipment : fallbackMealEquipment
    const bathEquipment =
        carriedItems.length > 0 ? legacyFromItems.bathEquipment : toText(report.bathEquipment)
    const medicines =
        carriedItems.length > 0 ? legacyFromItems.medicines : toText(report.medicines)
    const bagItems =
        carriedItems.length > 0 ? legacyFromItems.bagItems : toText(report.bag)

    return {
        childId,
        date: toDbDate(report.date),
        arrivalPhysicalCondition: toDbPhysicalCondition(report.arrivalPhysicalCondition),
        arrivalEmotionalCondition: toDbEmotionalCondition(report.arrivalEmotionalCondition),
        departurePhysicalCondition: toDbPhysicalCondition(
            report.departurePhysicalCondition,
        ),
        departureEmotionalCondition: toDbEmotionalCondition(
            report.departureEmotionalCondition,
        ),
        mealEquipmentJson: JSON.stringify(mealEquipment),
        itemsJson: JSON.stringify({
            version: 1,
            groupPhotoDataUrl: toText(report.carriedItemsPhotoDataUrl),
            items: carriedItems.map((item) => ({
                categoryKey: toIncidentCategoryKey(item.categoryKey),
                description: toText(item.description).trim(),
            })),
        }),
        bathEquipment: toNullable(bathEquipment),
        medicines: toNullable(medicines),
        bagItems: toNullable(bagItems),
        parentMessage: toNullable(report.parentMessage),
        messageForParent: toNullable(report.messageForParent),
        notes: toNullable(report.notes),
        arrivalSignatureData: toNullable(report.arrivalSignatureDataUrl),
        departureSignatureData: toNullable(report.departureSignatureDataUrl),
        createdAt: toDbDateTime(report.createdAt),
        updatedAt: toDbDateTime(report.updatedAt),
    }
}

import { ServiceError } from '../utils/service-error.js'
export { ServiceError }

const nowIso = (): string => new Date().toISOString()

export const getIncidentReports = async (month?: string): Promise<IncidentReport[]> => {
    let query = 'SELECT * FROM incident_reports'
    const params: unknown[] = []

    if (month) {
        query += ' WHERE report_date LIKE ?'
        params.push(`${month}%`)
    }

    query += ' ORDER BY report_date DESC, created_at DESC'

    const [rows] = await dbPool.query<RowDataPacket[]>(query, params)
    return rows.map(mapIncidentRow)
}

export const getIncidentReportById = async (id: string): Promise<IncidentReport | null> => {
    const [rows] = await dbPool.query<RowDataPacket[]>(
        'SELECT * FROM incident_reports WHERE id = ?',
        [id],
    )
    if (rows.length === 0) return null
    return mapIncidentRow(rows[0])
}

export const createIncidentReport = async (input: IncidentReportInput): Promise<IncidentReport> => {
    const connection = await dbPool.getConnection()
    try {
        await connection.beginTransaction()
        const timestamp = nowIso()

        // Save group photo
        const groupPhotoPath = await saveBase64ToDisk(input.carriedItemsPhotoDataUrl || '', 'incident_group')

        // Save signatures
        const arrivalSigPath = await saveBase64ToDisk(input.arrivalSignatureDataUrl || '', 'sig_arrival')
        const departureSigPath = await saveBase64ToDisk(input.departureSignatureDataUrl || '', 'sig_departure')

        // Save meal equipment photos
        const mealEquipment = input.mealEquipment || defaultMealEquipment()
        const processedMealEquipment = {
            drinkingBottle: { ...mealEquipment.drinkingBottle, imageDataUrl: await saveBase64ToDisk(mealEquipment.drinkingBottle.imageDataUrl || '', 'meal_drinking') },
            milkBottle: { ...mealEquipment.milkBottle, imageDataUrl: await saveBase64ToDisk(mealEquipment.milkBottle.imageDataUrl || '', 'meal_milk') },
            mealContainer: { ...mealEquipment.mealContainer, imageDataUrl: await saveBase64ToDisk(mealEquipment.mealContainer.imageDataUrl || '', 'meal_container') },
            snackContainer: { ...mealEquipment.snackContainer, imageDataUrl: await saveBase64ToDisk(mealEquipment.snackContainer.imageDataUrl || '', 'meal_snack') },
        }

        const childIdNum = parseInt(input.childId, 10)
        if (isNaN(childIdNum)) {
            throw new ServiceError(400, 'ID Anak tidak valid.')
        }

        const record: IncidentReport = {
            id: "0",
            ...input,
            carriedItemsPhotoDataUrl: groupPhotoPath,
            arrivalSignatureDataUrl: arrivalSigPath,
            departureSignatureDataUrl: departureSigPath,
            mealEquipment: processedMealEquipment,
            createdAt: timestamp,
            updatedAt: timestamp,
            carriedItems: input.carriedItems || [],
            bathEquipment: input.bathEquipment || '',
            medicines: input.medicines || '',
            bag: input.bag || '',
            parentMessage: input.parentMessage || '',
            messageForParent: input.messageForParent || '',
            notes: input.notes || '',
            arrivalPhysicalCondition: input.arrivalPhysicalCondition || 'sehat',
            arrivalEmotionalCondition: input.arrivalEmotionalCondition || 'senang',
            departurePhysicalCondition: input.departurePhysicalCondition || 'sehat',
            departureEmotionalCondition: input.departureEmotionalCondition || 'senang',
        }

        const payload = serializeIncident(record, childIdNum)

        const [result] = await connection.execute<ResultSetHeader>(
            `INSERT INTO incident_reports (
        child_id,
        report_date,
        arrival_physical_condition,
        arrival_emotional_condition,
        departure_physical_condition,
        departure_emotional_condition,
        meal_equipment_json,
        items_json,
        bath_equipment,
        medicines,
        bag_items,
        parent_message,
        message_for_parent,
        notes,
        arrival_signature_data,
        departure_signature_data,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                childIdNum,
                payload.date,
                payload.arrivalPhysicalCondition,
                payload.arrivalEmotionalCondition,
                payload.departurePhysicalCondition,
                payload.departureEmotionalCondition,
                payload.mealEquipmentJson,
                payload.itemsJson,
                payload.bathEquipment,
                payload.medicines,
                payload.bagItems,
                payload.parentMessage,
                payload.messageForParent,
                payload.notes,
                payload.arrivalSignatureData,
                payload.departureSignatureData,
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

export const updateIncidentReport = async (id: string, input: IncidentReportInput): Promise<IncidentReport> => {
    const connection = await dbPool.getConnection()
    try {
        await connection.beginTransaction()
        const recordIdInt = parseInt(id, 10)
        const childIdInt = parseInt(input.childId, 10)

        if (isNaN(recordIdInt)) throw new ServiceError(400, 'ID Berita Acara tidak valid.')
        if (isNaN(childIdInt)) throw new ServiceError(400, 'ID Anak tidak valid.')

        const timestamp = nowIso()

        // Save group photo
        const groupPhotoPath = await saveBase64ToDisk(input.carriedItemsPhotoDataUrl || '', 'incident_group')

        // Save signatures
        const arrivalSigPath = await saveBase64ToDisk(input.arrivalSignatureDataUrl || '', 'sig_arrival')
        const departureSigPath = await saveBase64ToDisk(input.departureSignatureDataUrl || '', 'sig_departure')

        // Save meal equipment photos
        const mealEquipment = input.mealEquipment || defaultMealEquipment()
        const processedMealEquipment = {
            drinkingBottle: { ...mealEquipment.drinkingBottle, imageDataUrl: await saveBase64ToDisk(mealEquipment.drinkingBottle.imageDataUrl || '', 'meal_drinking') },
            milkBottle: { ...mealEquipment.milkBottle, imageDataUrl: await saveBase64ToDisk(mealEquipment.milkBottle.imageDataUrl || '', 'meal_milk') },
            mealContainer: { ...mealEquipment.mealContainer, imageDataUrl: await saveBase64ToDisk(mealEquipment.mealContainer.imageDataUrl || '', 'meal_container') },
            snackContainer: { ...mealEquipment.snackContainer, imageDataUrl: await saveBase64ToDisk(mealEquipment.snackContainer.imageDataUrl || '', 'meal_snack') },
        }

        const record: IncidentReport = {
            id: id,
            ...input,
            carriedItemsPhotoDataUrl: groupPhotoPath,
            arrivalSignatureDataUrl: arrivalSigPath,
            departureSignatureDataUrl: departureSigPath,
            mealEquipment: processedMealEquipment,
            createdAt: "",
            updatedAt: timestamp
        }

        const payload = serializeIncident(record, childIdInt)

        await connection.execute(
            `UPDATE incident_reports SET
        child_id = ?,
        report_date = ?,
        arrival_physical_condition = ?,
        arrival_emotional_condition = ?,
        departure_physical_condition = ?,
        departure_emotional_condition = ?,
        meal_equipment_json = ?,
        items_json = ?,
        bath_equipment = ?,
        medicines = ?,
        bag_items = ?,
        parent_message = ?,
        message_for_parent = ?,
        notes = ?,
        arrival_signature_data = ?,
        departure_signature_data = ?,
        updated_at = ?
       WHERE id = ?`,
            [
                payload.childId,
                payload.date,
                payload.arrivalPhysicalCondition,
                payload.arrivalEmotionalCondition,
                payload.departurePhysicalCondition,
                payload.departureEmotionalCondition,
                payload.mealEquipmentJson,
                payload.itemsJson,
                payload.bathEquipment,
                payload.medicines,
                payload.bagItems,
                payload.parentMessage,
                payload.messageForParent,
                payload.notes,
                payload.arrivalSignatureData,
                payload.departureSignatureData,
                payload.updatedAt,
                recordIdInt
            ],
        )

        // Fetch updated
        await connection.commit()
        const updated = await getIncidentReportById(id)
        if (!updated) throw new ServiceError(404, 'Data berita acara tidak ditemukan setelah pembaruan.')
        return updated
    } catch (e) {
        await connection.rollback()
        throw e
    } finally {
        connection.release()
    }
}

export const deleteIncidentReport = async (id: string): Promise<void> => {
    const recordIdInt = parseInt(id, 10)
    if (isNaN(recordIdInt)) throw new ServiceError(400, 'ID Berita Acara tidak valid.')

    await dbPool.execute('DELETE FROM incident_reports WHERE id = ?', [recordIdInt])
}
