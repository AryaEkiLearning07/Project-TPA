import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { dbPool } from '../config/database.js'
import {
    ensureParentRelationshipSchema,
    resolveParentProfileId,
    type SqlExecutor,
} from './parent-relations-service.js'
import type { ChildProfile, ChildProfileInput } from '../types/index.js'
import {
    toDbDateTime,
    toDbDate,
    parseStringArrayJson,
    toDbGender,
    toDbReligion,
    toDbServicePackage,
} from '../utils/data-mappers.js'
import { toText } from '../utils/string-utils.js'
import { saveBase64ToDisk } from '../utils/base64-storage.js'

import { ServiceError } from '../utils/service-error.js'
export { ServiceError }

const nowIso = (): string => new Date().toISOString()

const toDateOnly = (value: unknown): string => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10)
    }
    return toDbDate(value)
}

const hasChildrenColumn = async (
    executor: SqlExecutor,
    columnName: string,
): Promise<boolean> => {
    const [rows] = (await executor.execute(
        `SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'children'
          AND COLUMN_NAME = ?
        LIMIT 1`,
        [columnName],
    )) as [RowDataPacket[], unknown]

    return rows.length > 0
}

const ensureChildrenServiceStartDateColumn = async (
    executor: SqlExecutor,
): Promise<void> => {
    const hasServiceStartDate = await hasChildrenColumn(executor, 'service_start_date')
    if (!hasServiceStartDate) {
        await executor.execute(
            `ALTER TABLE children
             ADD COLUMN service_start_date DATE NULL AFTER service_package`,
        )
    }
}

/**
 * Migrate the religion ENUM so it matches the DbReligion type used by
 * toDbReligion():  CHRISTIAN, CATHOLIC, BUDDHIST, CONFUCIAN.
 *
 * Older schemas created the column with the Indonesian labels
 * (KRISTEN, KATOLIK, BUDHA, KONGHUCU).  This helper:
 *   1. Widens the ENUM to accept both old and new values.
 *   2. Converts existing rows with the old values to the new ones.
 *   3. Narrows the ENUM to only the canonical values.
 */
const ensureChildrenReligionEnum = async (
    executor: SqlExecutor,
): Promise<void> => {
    const [rows] = (await executor.execute(
        `SELECT COLUMN_TYPE
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'children'
           AND COLUMN_NAME = 'religion'
         LIMIT 1`,
    )) as [RowDataPacket[], unknown]

    if (rows.length === 0) {
        return // table or column does not exist yet
    }

    const columnType = String(rows[0].COLUMN_TYPE ?? '').toUpperCase()

    // If the column already contains 'CHRISTIAN' it has been migrated.
    if (columnType.includes("'CHRISTIAN'")) {
        return
    }

    // Step 1 – widen ENUM to accept both old and new identifiers
    await executor.execute(
        `ALTER TABLE children
         MODIFY COLUMN religion
         ENUM('ISLAM','KRISTEN','KATOLIK','HINDU','BUDHA','KONGHUCU','OTHER',
              'CHRISTIAN','CATHOLIC','BUDDHIST','CONFUCIAN')
         NOT NULL DEFAULT 'OTHER'`,
    )

    // Step 2 – convert old values to canonical DbReligion values
    await executor.execute(`UPDATE children SET religion = 'CHRISTIAN'  WHERE religion = 'KRISTEN'`)
    await executor.execute(`UPDATE children SET religion = 'CATHOLIC'   WHERE religion = 'KATOLIK'`)
    await executor.execute(`UPDATE children SET religion = 'BUDDHIST'   WHERE religion = 'BUDHA'`)
    await executor.execute(`UPDATE children SET religion = 'CONFUCIAN'  WHERE religion = 'KONGHUCU'`)

    // Step 3 – narrow ENUM to only the canonical values
    await executor.execute(
        `ALTER TABLE children
         MODIFY COLUMN religion
         ENUM('ISLAM','CHRISTIAN','CATHOLIC','HINDU','BUDDHIST','CONFUCIAN','OTHER')
         NOT NULL DEFAULT 'OTHER'`,
    )
}

const normalizeAssetUrl = (value: string): string => {
    const normalized = toText(value).trim()
    if (!normalized) return ''
    if (normalized.startsWith('data:image/')) return normalized
    if (/^https?:\/\//i.test(normalized)) return normalized
    if (normalized.startsWith('/uploads/')) return normalized
    if (normalized.startsWith('uploads/')) return `/${normalized}`
    return normalized
}

const toChildReligion = (value: unknown): ChildProfile['religion'] => {
    const normalized = toText(value).trim().toLowerCase()
    if (
        normalized === 'islam' ||
        normalized === 'kristen' ||
        normalized === 'christian' ||
        normalized === 'katolik' ||
        normalized === 'catholic' ||
        normalized === 'hindu' ||
        normalized === 'buddha' ||
        normalized === 'buddhist' ||
        normalized === 'konghucu' ||
        normalized === 'confucian'
    ) {
        if (normalized === 'christian') return 'kristen'
        if (normalized === 'catholic') return 'katolik'
        if (normalized === 'buddhist') return 'buddha'
        if (normalized === 'confucian') return 'konghucu'
        return normalized
    }
    return 'lainnya'
}

const supportedChildPhotoMimeTypes = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
])

const parseDataUrlMimeType = (value: string): string | null => {
    const matched = toText(value).trim().match(/^data:(image\/[a-z0-9.+-]+);base64,/i)
    if (!matched) {
        return null
    }
    return matched[1].toLowerCase()
}

const ensureSupportedChildPhotoMimeType = (value: string): void => {
    const mimeType = parseDataUrlMimeType(value)
    if (!mimeType) {
        return
    }
    if (supportedChildPhotoMimeTypes.has(mimeType)) {
        return
    }
    throw new ServiceError(
        400,
        'Foto anak tidak didukung. Gunakan format JPG, JPEG, PNG, WEBP, GIF, atau AVIF.',
    )
}

const mapChildPhotoProcessingError = (error: unknown): ServiceError | null => {
    const message = error instanceof Error ? error.message : ''
    if (!message) {
        return null
    }

    if (/(unsupported image|input buffer|corrupt|heif|bad seek|invalid input)/i.test(message)) {
        return new ServiceError(
            400,
            'Foto anak tidak dapat diproses. Gunakan format JPG, JPEG, PNG, WEBP, GIF, atau AVIF.',
        )
    }

    return null
}

const resolveChildPhotoPath = async (photoDataUrl: string): Promise<string> => {
    ensureSupportedChildPhotoMimeType(photoDataUrl)
    try {
        return await saveBase64ToDisk(photoDataUrl, 'child')
    } catch (error) {
        const mappedError = mapChildPhotoProcessingError(error)
        if (mappedError) {
            throw mappedError
        }
        throw error
    }
}

const mapChildRow = (row: RowDataPacket): ChildProfile => ({
    id: String(row.id),
    createdAt: toText(row.created_at),
    updatedAt: toText(row.updated_at),
    fullName: toText(row.full_name),
    nickName: toText(row.nick_name),
    isActive: Number(row.is_active) !== 0,
    gender: row.gender === 'FEMALE' ? 'P' : 'L',
    photoDataUrl: normalizeAssetUrl(toText(row.photo_path)),
    birthPlace: toText(row.birth_place),
    birthDate: toDateOnly(row.birth_date),
    childOrder: toText(row.child_order),
    religion: toChildReligion(row.religion),
    outsideActivities: toText(row.outside_activities),
    // Parent data comes from JOIN with parent_profiles
    fatherName: toText(row.profile_father_name),
    motherName: toText(row.profile_mother_name),
    homeAddress: toText(row.profile_home_address),
    homePhone: toText(row.profile_home_phone),
    officeAddress: toText(row.profile_office_address),
    otherPhone: toText(row.profile_other_phone),
    email: toText(row.profile_email),
    whatsappNumber: toText(row.profile_whatsapp_number),
    allergy: toText(row.allergy),
    servicePackage: row.service_package === 'DAILY' ? 'harian' : row.service_package === 'BIWEEKLY' ? '2-mingguan' : 'bulanan',
    serviceStartDate: toDateOnly(row.service_start_date ?? row.created_at),
    arrivalTime: toText(row.planned_arrival_time),
    departureTime: toText(row.planned_departure_time),
    pickupPersons: parseStringArrayJson(row.pickup_persons_json),
    depositPurpose: toText(row.deposit_purpose),
    prenatalPeriod: toText(row.prenatal_period),
    partusPeriod: toText(row.partus_period),
    postNatalPeriod: toText(row.post_natal_period),
    motorSkill: toText(row.motor_skill),
    languageSkill: toText(row.language_skill),
    healthHistory: toText(row.health_history),
    toiletTrainingBab: toText(row.toilet_training_bab),
    toiletTrainingBak: toText(row.toilet_training_bak),
    toiletTrainingBath: toText(row.toilet_training_bath),
    brushingTeeth: toText(row.brushing_teeth),
    eating: toText(row.eating_habit),
    drinkingMilk: toText(row.drinking_milk_habit),
    whenCrying: toText(row.when_crying),
    whenPlaying: toText(row.when_playing),
    sleeping: toText(row.sleeping_habit),
    otherHabits: toText(row.other_habits),
})

export const ensureChildrenTable = async (executor: SqlExecutor): Promise<void> => {
    await executor.execute(
        `CREATE TABLE IF NOT EXISTS children (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            full_name VARCHAR(160) NOT NULL,
            nick_name VARCHAR(80) NOT NULL,
            gender ENUM('MALE', 'FEMALE') NOT NULL,
            photo_path TEXT NULL,
            birth_place VARCHAR(160) NOT NULL,
            birth_date DATE NOT NULL,
            child_order VARCHAR(40) NOT NULL,
            religion ENUM('ISLAM', 'CHRISTIAN', 'CATHOLIC', 'HINDU', 'BUDDHIST', 'CONFUCIAN', 'OTHER') NOT NULL,
            outside_activities TEXT NULL,
            allergy TEXT NULL,
            service_package ENUM('DAILY', 'BIWEEKLY', 'MONTHLY') NOT NULL DEFAULT 'MONTHLY',
            service_start_date DATE NULL,
            planned_arrival_time VARCHAR(10) NULL,
            planned_departure_time VARCHAR(10) NULL,
            deposit_purpose TEXT NULL,
            prenatal_period TEXT NULL,
            partus_period TEXT NULL,
            post_natal_period TEXT NULL,
            motor_skill TEXT NULL,
            language_skill TEXT NULL,
            health_history TEXT NULL,
            toilet_training_bab TEXT NULL,
            toilet_training_bak TEXT NULL,
            toilet_training_bath TEXT NULL,
            brushing_teeth TEXT NULL,
            eating_habit TEXT NULL,
            drinking_milk_habit TEXT NULL,
            when_crying TEXT NULL,
            when_playing TEXT NULL,
            sleeping_habit TEXT NULL,
            other_habits TEXT NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_children_name (full_name),
            INDEX idx_children_active (is_active)
        )`,
    )
    await ensureChildrenServiceStartDateColumn(executor)
    await ensureChildrenReligionEnum(executor)
}

const childWithParentProfileQuery = `
    SELECT
        c.*,
        p.father_name AS profile_father_name,
        p.mother_name AS profile_mother_name,
        p.email AS profile_email,
        p.whatsapp_number AS profile_whatsapp_number,
        p.home_phone AS profile_home_phone,
        p.other_phone AS profile_other_phone,
        p.home_address AS profile_home_address,
        p.office_address AS profile_office_address
    FROM children c
    LEFT JOIN parent_profiles p ON p.id = c.parent_profile_id
`

export const getChildren = async (executor: SqlExecutor = dbPool): Promise<ChildProfile[]> => {
    await ensureChildrenTable(executor)
    await ensureParentRelationshipSchema(executor)
    const [rows] = await executor.query<RowDataPacket[]>(
        `${childWithParentProfileQuery}
        ORDER BY c.full_name ASC`,
    )
    return rows.map(mapChildRow)
}

export const getChildById = async (id: string, executor: SqlExecutor = dbPool): Promise<ChildProfile | null> => {
    await ensureChildrenTable(executor)
    await ensureParentRelationshipSchema(executor)
    const [rows] = await executor.query<RowDataPacket[]>(
        `${childWithParentProfileQuery}
        WHERE c.id = ?
        LIMIT 1`,
        [id],
    )
    if (rows.length === 0) return null
    return mapChildRow(rows[0])
}

export const getChildrenByParentProfileId = async (
    parentProfileId: number,
    executor: SqlExecutor = dbPool,
): Promise<ChildProfile[]> => {
    await ensureChildrenTable(executor)
    await ensureParentRelationshipSchema(executor)
    const [rows] = await executor.query<RowDataPacket[]>(
        `${childWithParentProfileQuery}
        WHERE c.parent_profile_id = ?
          AND c.is_active = 1
        ORDER BY c.full_name ASC`,
        [parentProfileId],
    )
    return rows.map(mapChildRow)
}

export const createChild = async (input: ChildProfileInput): Promise<ChildProfile> => {
    const connection = await dbPool.getConnection()
    let transactionStarted = false
    try {
        await ensureChildrenTable(connection)
        await ensureParentRelationshipSchema(connection)
        await connection.beginTransaction()
        transactionStarted = true

        const parentProfileId = await resolveParentProfileId(connection, {
            fatherName: input.fatherName,
            motherName: input.motherName,
            email: input.email,
            whatsappNumber: input.whatsappNumber,
            homePhone: input.homePhone,
            otherPhone: input.otherPhone,
            homeAddress: input.homeAddress,
            officeAddress: input.officeAddress,
        })

        const timestamp = nowIso()
        const photoPath = await resolveChildPhotoPath(input.photoDataUrl)

        const [result] = await connection.execute<ResultSetHeader>(
            `INSERT INTO children (
        full_name, nick_name, gender, photo_path, birth_place, birth_date,
        child_order, religion, outside_activities, allergy, service_package, service_start_date,
        planned_arrival_time, planned_departure_time, deposit_purpose,
        prenatal_period, partus_period, post_natal_period,
        motor_skill, language_skill, health_history,
        toilet_training_bab, toilet_training_bak, toilet_training_bath,
        brushing_teeth, eating_habit, drinking_milk_habit,
        when_crying, when_playing, sleeping_habit, other_habits,
        pickup_persons_json,
        parent_profile_id, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
            [
                toText(input.fullName).trim(),
                toText(input.nickName).trim(),
                toDbGender(input.gender),
                photoPath || null,
                toText(input.birthPlace).trim(),
                toDbDate(input.birthDate),
                toText(input.childOrder).trim(),
                toDbReligion(input.religion),
                toText(input.outsideActivities).trim(),
                toText(input.allergy).trim(),
                toDbServicePackage(input.servicePackage),
                toDbDate(input.serviceStartDate),
                toText(input.arrivalTime).trim() || null,
                toText(input.departureTime).trim() || null,
                toText(input.depositPurpose).trim(),
                toText(input.prenatalPeriod).trim(),
                toText(input.partusPeriod).trim(),
                toText(input.postNatalPeriod).trim(),
                toText(input.motorSkill).trim(),
                toText(input.languageSkill).trim(),
                toText(input.healthHistory).trim(),
                toText(input.toiletTrainingBab).trim(),
                toText(input.toiletTrainingBak).trim(),
                toText(input.toiletTrainingBath).trim(),
                toText(input.brushingTeeth).trim(),
                toText(input.eating).trim(),
                toText(input.drinkingMilk).trim(),
                toText(input.whenCrying).trim(),
                toText(input.whenPlaying).trim(),
                toText(input.sleeping).trim(),
                toText(input.otherHabits).trim(),
                JSON.stringify(input.pickupPersons || []),
                parentProfileId,
                toDbDateTime(timestamp),
                toDbDateTime(timestamp),
            ],
        )

        await connection.commit()

        const child = await getChildById(String(result.insertId))
        if (!child) throw new ServiceError(500, 'Gagal membaca child setelah insert')
        return child
    } catch (e) {
        if (transactionStarted) {
            await connection.rollback()
        }
        throw e
    } finally {
        connection.release()
    }
}

export const updateChild = async (id: string, input: ChildProfileInput): Promise<ChildProfile> => {
    const connection = await dbPool.getConnection()
    let transactionStarted = false
    try {
        const recordIdInt = parseInt(id, 10)
        if (isNaN(recordIdInt)) throw new ServiceError(400, 'ID Anak tidak valid.')

        await ensureChildrenTable(connection)
        await ensureParentRelationshipSchema(connection)
        await connection.beginTransaction()
        transactionStarted = true

        const parentProfileId = await resolveParentProfileId(connection, {
            fatherName: input.fatherName,
            motherName: input.motherName,
            email: input.email,
            whatsappNumber: input.whatsappNumber,
            homePhone: input.homePhone,
            otherPhone: input.otherPhone,
            homeAddress: input.homeAddress,
            officeAddress: input.officeAddress,
        })

        const timestamp = nowIso()
        const photoPath = await resolveChildPhotoPath(input.photoDataUrl)

        await connection.execute(
            `UPDATE children SET
        full_name=?, nick_name=?, gender=?, photo_path=?, birth_place=?, birth_date=?,
        child_order=?, religion=?, outside_activities=?, allergy=?, service_package=?, service_start_date=?,
        planned_arrival_time=?, planned_departure_time=?, deposit_purpose=?,
        prenatal_period=?, partus_period=?, post_natal_period=?,
        motor_skill=?, language_skill=?, health_history=?,
        toilet_training_bab=?, toilet_training_bak=?, toilet_training_bath=?,
        brushing_teeth=?, eating_habit=?, drinking_milk_habit=?,
        when_crying=?, when_playing=?, sleeping_habit=?, other_habits=?,
        pickup_persons_json=?,
        parent_profile_id=?, updated_at=?
      WHERE id=?`,
            [
                toText(input.fullName).trim(),
                toText(input.nickName).trim(),
                toDbGender(input.gender),
                photoPath || null,
                toText(input.birthPlace).trim(),
                toDbDate(input.birthDate),
                toText(input.childOrder).trim(),
                toDbReligion(input.religion),
                toText(input.outsideActivities).trim(),
                toText(input.allergy).trim(),
                toDbServicePackage(input.servicePackage),
                toDbDate(input.serviceStartDate),
                toText(input.arrivalTime).trim() || null,
                toText(input.departureTime).trim() || null,
                toText(input.depositPurpose).trim(),
                toText(input.prenatalPeriod).trim(),
                toText(input.partusPeriod).trim(),
                toText(input.postNatalPeriod).trim(),
                toText(input.motorSkill).trim(),
                toText(input.languageSkill).trim(),
                toText(input.healthHistory).trim(),
                toText(input.toiletTrainingBab).trim(),
                toText(input.toiletTrainingBak).trim(),
                toText(input.toiletTrainingBath).trim(),
                toText(input.brushingTeeth).trim(),
                toText(input.eating).trim(),
                toText(input.drinkingMilk).trim(),
                toText(input.whenCrying).trim(),
                toText(input.whenPlaying).trim(),
                toText(input.sleeping).trim(),
                toText(input.otherHabits).trim(),
                JSON.stringify(input.pickupPersons || []),
                parentProfileId,
                toDbDateTime(timestamp),
                recordIdInt,
            ],
        )

        await connection.commit()

        const updated = await getChildById(id)
        if (!updated) throw new ServiceError(404, 'Data anak tidak ditemukan setelah pembaruan.')
        return updated
    } catch (e) {
        if (transactionStarted) {
            await connection.rollback()
        }
        throw e
    } finally {
        connection.release()
    }
}

export const deleteChild = async (id: string): Promise<void> => {
    const recordIdInt = parseInt(id, 10)
    if (isNaN(recordIdInt)) throw new ServiceError(400, 'ID Anak tidak valid.')
    await dbPool.execute('DELETE FROM children WHERE id = ?', [recordIdInt])
}

export const getAuthorizedPersons = async (childId: string, executor: SqlExecutor = dbPool): Promise<string[]> => {
    const child = await getChildById(childId, executor)
    if (!child) return []

    const authorized = new Set<string>()
    if (child.fatherName) authorized.add(child.fatherName.trim())
    if (child.motherName) authorized.add(child.motherName.trim())
    
    if (Array.isArray(child.pickupPersons)) {
        child.pickupPersons.forEach(name => {
            if (name && name.trim()) authorized.add(name.trim())
        })
    }

    return Array.from(authorized).filter(Boolean)
}
