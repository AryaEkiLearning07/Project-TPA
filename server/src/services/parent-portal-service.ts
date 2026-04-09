import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2/promise'
import { dbPool } from '../config/database.js'
import {
  createAuthSessionPayload,
  ensureAuthSchemaReady,
} from './auth-service.js'
import {
  claimChildRegistrationCode,
  ChildRegistrationCodeServiceError,
  ensureChildRegistrationCodeSchema,
} from './child-registration-code-service.js'
import { getChildrenByParentProfileId } from './child-service.js'
import { ensureParentRelationshipSchema } from './parent-relations-service.js'
import { hashPassword, PasswordError } from '../utils/password.js'
import {
  parseAttendanceNotesJson,
  parseIncidentItemsJson,
  parseMealEquipmentJson,
  toAttendanceNotesJson,
  toDate,
  toTime,
} from '../utils/data-mappers.js'
import type { CarriedItem, IncidentReport, SupplyInventoryItem } from '../types/index.js'
import {
  getServiceBillingHistory,
  type ServiceBillingHistoryResponse,
} from './service-billing-service.js'

const toText = (value: unknown): string => (typeof value === 'string' ? value : '')

const normalizeEmail = (value: string): string => value.trim().toLowerCase()

const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

const isGmailAddress = (value: string): boolean =>
  normalizeEmail(value).endsWith('@gmail.com')

const parseAccountId = (value: string): number => {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ParentPortalServiceError(401, 'Sesi akun orang tua tidak valid.')
  }
  return parsed
}

const normalizeRegistrationCode = (value: string): string =>
  value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')

const toIsoDateTime = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value !== 'string') {
    return new Date().toISOString()
  }

  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const withTimezone = /Z|[+-]\d{2}:\d{2}$/.test(normalized)
    ? normalized
    : `${normalized}Z`
  const parsed = new Date(withTimezone)
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString()
  }
  return parsed.toISOString()
}

const parseBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    return value === 1
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === '1' || normalized === 'true'
  }
  return false
}

export class ParentPortalServiceError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ParentPortalServiceError'
    this.status = status
  }
}

interface ParentTodayDateRow extends RowDataPacket {
  today_date: string | Date
}

interface ParentDailyAttendanceRow extends RowDataPacket {
  id: number | string
  child_id: number | string
  child_full_name: string | null
  attendance_date: string | Date
  escort_name: string | null
  pickup_name: string | null
  arrival_time: string | null
  departure_time: string | null
  notes: string | null
  created_at: string | Date
  updated_at: string | Date
}

interface ParentDailyIncidentRow extends RowDataPacket {
  id: number | string
  child_id: number | string
  report_date: string | Date
  arrival_physical_condition: string | null
  arrival_emotional_condition: string | null
  departure_physical_condition: string | null
  departure_emotional_condition: string | null
  meal_equipment_json: string | null
  items_json: string | null
  bath_equipment: string | null
  medicines: string | null
  bag_items: string | null
  parent_message: string | null
  message_for_parent: string | null
  notes: string | null
  arrival_signature_data: string | null
  departure_signature_data: string | null
  created_at: string | Date
  updated_at: string | Date
}

interface ParentDailyReport {
  attendanceId: string
  childId: string
  childName: string
  date: string
  arrivalTime: string
  departureTime: string
  escortName: string
  pickupName: string
  arrivalPhysicalCondition: string
  arrivalEmotionalCondition: string
  departurePhysicalCondition: string
  departureEmotionalCondition: string
  parentMessage: string
  messageForParent: string
  departureNotes: string
  carriedItems: CarriedItem[]
  createdAt: string
  updatedAt: string
}

interface ParentBillingSnapshot {
  summary: ServiceBillingHistoryResponse['summary']
  periods: ServiceBillingHistoryResponse['periods']
  transactions: ServiceBillingHistoryResponse['transactions']
}

const dbPhysicalToUi: Record<string, string> = {
  HEALTHY: 'sehat',
  SICK: 'sakit',
}

const dbEmotionalToUi: Record<string, string> = {
  HAPPY: 'senang',
  SAD: 'sedih',
}

const ensureEmailAvailable = async (
  connection: PoolConnection,
  email: string,
): Promise<void> => {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT pa.id
    FROM parent_accounts pa
    JOIN parent_profiles pp ON pp.id = pa.parent_profile_id
    WHERE LOWER(pp.email) = ?
    LIMIT 1`,
    [email],
  )

  if (rows.length > 0) {
    throw new ParentPortalServiceError(
      409,
      'Email orang tua sudah terdaftar. Silakan login untuk menambah anak.',
    )
  }
}

const loadChildProfileSeedByCode = async (
  connection: PoolConnection,
  registrationCode: string,
): Promise<RowDataPacket | null> => {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT
      c.id AS child_id,
      c.full_name AS child_full_name,
      c.parent_profile_id,
      pp.father_name,
      pp.mother_name,
      pp.email,
      pp.whatsapp_number,
      pp.home_phone,
      pp.other_phone,
      pp.home_address,
      pp.office_address
    FROM child_registration_codes crc
    JOIN children c ON c.id = crc.child_id
    LEFT JOIN parent_profiles pp ON pp.id = c.parent_profile_id
    WHERE UPPER(crc.code) = ?
    LIMIT 1
    FOR UPDATE`,
    [registrationCode.toUpperCase()],
  )

  return rows[0] ?? null
}

const createParentProfileForRegistration = async (
  connection: PoolConnection,
  seed: RowDataPacket | null,
  email: string,
): Promise<number> => {
  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO parent_profiles (
      father_name,
      mother_name,
      email,
      whatsapp_number,
      home_phone,
      other_phone,
      home_address,
      office_address
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      toText(seed?.father_name),
      toText(seed?.mother_name),
      email,
      toText(seed?.whatsapp_number) || null,
      toText(seed?.home_phone) || null,
      toText(seed?.other_phone) || null,
      toText(seed?.home_address) || null,
      toText(seed?.office_address) || null,
    ],
  )

  return Number(result.insertId)
}

const createParentAccount = async (
  connection: PoolConnection,
  params: {
    parentProfileId: number
    email: string
    passwordHash: string
  },
): Promise<number> => {
  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO parent_accounts (
      parent_profile_id,
      username,
      password_hash,
      is_active
    ) VALUES (?, ?, ?, 1)`,
    [params.parentProfileId, params.email, params.passwordHash],
  )

  return Number(result.insertId)
}

const loadParentAccountMeta = async (
  connection: PoolConnection,
  parentAccountId: number,
): Promise<RowDataPacket | null> => {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT
      pa.id AS account_id,
      pa.username,
      pa.is_active,
      pa.created_at AS account_created_at,
      pa.updated_at AS account_updated_at,
      pp.id AS parent_profile_id,
      pp.father_name,
      pp.mother_name,
      pp.email,
      pp.whatsapp_number,
      pp.home_phone,
      pp.other_phone,
      pp.home_address,
      pp.office_address
    FROM parent_accounts pa
    JOIN parent_profiles pp ON pp.id = pa.parent_profile_id
    WHERE pa.id = ?
    LIMIT 1`,
    [parentAccountId],
  )

  return rows[0] ?? null
}

const getParentAccountContext = async (
  connection: PoolConnection,
  parentAccountId: number,
): Promise<{ accountId: number; parentProfileId: number }> => {
  const row = await loadParentAccountMeta(connection, parentAccountId)
  if (!row || !parseBoolean(row.is_active)) {
    throw new ParentPortalServiceError(404, 'Akun orang tua tidak ditemukan.')
  }

  return {
    accountId: Number(row.account_id),
    parentProfileId: Number(row.parent_profile_id),
  }
}

const buildParentDashboardData = async (
  connection: PoolConnection,
  parentAccountId: number,
) => {
  const accountRow = await loadParentAccountMeta(connection, parentAccountId)
  if (!accountRow || !parseBoolean(accountRow.is_active)) {
    throw new ParentPortalServiceError(404, 'Akun orang tua tidak ditemukan.')
  }

  const children = await getChildrenByParentProfileId(
    Number(accountRow.parent_profile_id),
    connection,
  )

  const [dateRows] = await connection.execute<ParentTodayDateRow[]>(
    `SELECT DATE_FORMAT(CURRENT_DATE(), '%Y-%m-%d') AS today_date`,
  )
  const todayDate = toDate(dateRows[0]?.today_date) || new Date().toISOString().slice(0, 10)

  const childIdSet = new Set(children.map((child) => child.id))
  const dailyReportsByChildId: Record<string, ParentDailyReport | null> = {}
  const allAttendanceReports: ParentDailyReport[] = []
  const allIncidentReports: IncidentReport[] = []
  children.forEach((child) => {
    dailyReportsByChildId[child.id] = null
  })
  const billingByChildId: Record<string, ParentBillingSnapshot | null> = {}
  children.forEach((child) => {
    billingByChildId[child.id] = null
  })
  const supplyInventoryByChildId: Record<string, SupplyInventoryItem[]> = {}
  children.forEach((child) => {
    supplyInventoryByChildId[child.id] = []
  })

  if (children.length > 0) {
    const [attendanceRows] = await connection.execute<ParentDailyAttendanceRow[]>(
      `SELECT
        ar.id,
        ar.child_id,
        c.full_name AS child_full_name,
        ar.attendance_date,
        ar.escort_name,
        ar.pickup_name,
        ar.arrival_time,
        ar.departure_time,
        ar.notes,
        ar.created_at,
        ar.updated_at
      FROM attendance_records ar
      JOIN children c ON c.id = ar.child_id
      WHERE c.parent_profile_id = ?
        AND c.is_active = 1
      ORDER BY ar.attendance_date DESC, ar.updated_at DESC, ar.id DESC`,
      [Number(accountRow.parent_profile_id)],
    )

    for (const row of attendanceRows) {
      const childId = String(row.child_id)
      if (!childIdSet.has(childId)) {
        continue
      }

      const noteData = parseAttendanceNotesJson(row.notes)
      const mappedReport: ParentDailyReport = {
        attendanceId: String(row.id),
        childId,
        childName: toText(row.child_full_name),
        date: toDate(row.attendance_date),
        arrivalTime: toTime(row.arrival_time),
        departureTime: toTime(row.departure_time),
        escortName: toText(row.escort_name),
        pickupName: toText(row.pickup_name),
        arrivalPhysicalCondition: noteData.arrivalPhysicalCondition,
        arrivalEmotionalCondition: noteData.arrivalEmotionalCondition,
        departurePhysicalCondition: noteData.departurePhysicalCondition,
        departureEmotionalCondition: noteData.departureEmotionalCondition,
        parentMessage: noteData.parentMessage,
        messageForParent: noteData.messageForParent,
        departureNotes: noteData.departureNotes,
        carriedItems: noteData.carriedItems,
        createdAt: toIsoDateTime(row.created_at),
        updatedAt: toIsoDateTime(row.updated_at),
      }
      allAttendanceReports.push(mappedReport)

      if (mappedReport.date === todayDate && !dailyReportsByChildId[childId]) {
        dailyReportsByChildId[childId] = mappedReport
      }
    }

    const [incidentRows] = await connection.execute<ParentDailyIncidentRow[]>(
      `SELECT
        ir.id,
        ir.child_id,
        ir.report_date,
        ir.arrival_physical_condition,
        ir.arrival_emotional_condition,
        ir.departure_physical_condition,
        ir.departure_emotional_condition,
        ir.meal_equipment_json,
        ir.items_json,
        ir.bath_equipment,
        ir.medicines,
        ir.bag_items,
        ir.parent_message,
        ir.message_for_parent,
        ir.notes,
        ir.arrival_signature_data,
        ir.departure_signature_data,
        ir.created_at,
        ir.updated_at
      FROM incident_reports ir
      JOIN children c ON c.id = ir.child_id
      WHERE c.parent_profile_id = ?
        AND c.is_active = 1
      ORDER BY ir.report_date DESC, ir.updated_at DESC, ir.id DESC`,
      [Number(accountRow.parent_profile_id)],
    )

    for (const row of incidentRows) {
      const childId = String(row.child_id)
      if (!childIdSet.has(childId)) {
        continue
      }

      const parsedIncidentItems = parseIncidentItemsJson(row.items_json)
      allIncidentReports.push({
        id: String(row.id),
        createdAt: toIsoDateTime(row.created_at),
        updatedAt: toIsoDateTime(row.updated_at),
        childId,
        date: toDate(row.report_date),
        arrivalPhysicalCondition:
          dbPhysicalToUi[toText(row.arrival_physical_condition).toUpperCase()] ?? 'sehat',
        arrivalEmotionalCondition:
          dbEmotionalToUi[toText(row.arrival_emotional_condition).toUpperCase()] ?? 'senang',
        departurePhysicalCondition:
          dbPhysicalToUi[toText(row.departure_physical_condition).toUpperCase()] ?? 'sehat',
        departureEmotionalCondition:
          dbEmotionalToUi[toText(row.departure_emotional_condition).toUpperCase()] ?? 'senang',
        carriedItemsPhotoDataUrl: parsedIncidentItems.groupPhotoDataUrl,
        carriedItems: parsedIncidentItems.items,
        mealEquipment: parseMealEquipmentJson(row.meal_equipment_json),
        bathEquipment: toText(row.bath_equipment),
        medicines: toText(row.medicines),
        bag: toText(row.bag_items),
        parentMessage: toText(row.parent_message),
        messageForParent: toText(row.message_for_parent),
        notes: toText(row.notes),
        arrivalSignatureDataUrl: toText(row.arrival_signature_data),
        departureSignatureDataUrl: toText(row.departure_signature_data),
      })
    }

    await Promise.all(
      children.map(async (child) => {
        try {
          const billingHistory = await getServiceBillingHistory(child.id)
          billingByChildId[child.id] = {
            summary: billingHistory.summary,
            periods: billingHistory.periods,
            transactions: billingHistory.transactions,
          }
        } catch {
          billingByChildId[child.id] = null
        }
      }),
    )

    const childIds = children
      .map((child) => Number.parseInt(child.id, 10))
      .filter((childId) => Number.isFinite(childId) && childId > 0)

    if (childIds.length > 0) {
      const placeholders = childIds.map(() => '?').join(', ')
      try {
        const [inventoryRows] = await connection.execute<RowDataPacket[]>(
          `SELECT
            id,
            child_id,
            product_name,
            category,
            quantity,
            description,
            image_path,
            image_name,
            created_at,
            updated_at
          FROM supply_inventory
          WHERE child_id IN (${placeholders})
          ORDER BY updated_at DESC`,
          childIds,
        )

        for (const row of inventoryRows) {
          const childId = String(row.child_id)
          if (!supplyInventoryByChildId[childId]) {
            continue
          }

          supplyInventoryByChildId[childId].push({
            id: String(row.id),
            childId,
            productName: toText(row.product_name),
            category: toText(row.category),
            quantity: Number(row.quantity) || 0,
            description: toText(row.description),
            imageDataUrl: toText(row.image_path),
            imageName: toText(row.image_name),
            createdAt: toIsoDateTime(row.created_at),
            updatedAt: toIsoDateTime(row.updated_at),
          })
        }
      } catch {
        // Silently ignore inventory read issues so parent portal tetap dapat dibuka.
      }
    }
  }

  return {
    parentAccount: {
      id: String(accountRow.account_id),
      createdAt: toIsoDateTime(accountRow.account_created_at),
      updatedAt: toIsoDateTime(accountRow.account_updated_at),
      username: toText(accountRow.username),
      isActive: parseBoolean(accountRow.is_active),
      parentProfile: {
        fatherName: toText(accountRow.father_name),
        motherName: toText(accountRow.mother_name),
        email: toText(accountRow.email),
        whatsappNumber: toText(accountRow.whatsapp_number),
        homePhone: toText(accountRow.home_phone),
        otherPhone: toText(accountRow.other_phone),
        homeAddress: toText(accountRow.home_address),
        officeAddress: toText(accountRow.office_address),
      },
    },
    children,
    todayDate,
    dailyReports: dailyReportsByChildId,
    attendanceRecords: allAttendanceReports,
    billingByChild: billingByChildId,
    supplyInventoryByChild: supplyInventoryByChildId,
    incidentReports: allIncidentReports,
    observationRecords: [],
    communicationEntries: [],
  }
}

export const registerParentWithCode = async (input: {
  email: string
  password: string
  registrationCode: string
}) => {
  await ensureAuthSchemaReady()
  const email = normalizeEmail(input.email)
  const password = toText(input.password)
  const registrationCode = normalizeRegistrationCode(input.registrationCode)

  if (!email) {
    throw new ParentPortalServiceError(400, 'Email Gmail wajib diisi.')
  }
  if (!isValidEmail(email)) {
    throw new ParentPortalServiceError(400, 'Format email tidak valid.')
  }
  if (!isGmailAddress(email)) {
    throw new ParentPortalServiceError(400, 'Akun orang tua harus menggunakan Gmail.')
  }
  if (password.trim().length < 8) {
    throw new ParentPortalServiceError(400, 'Password minimal 8 karakter.')
  }
  if (!registrationCode) {
    throw new ParentPortalServiceError(400, 'Kode registrasi wajib diisi.')
  }

  const connection = await dbPool.getConnection()

  try {
    await connection.beginTransaction()
    await ensureParentRelationshipSchema(connection)
    await ensureChildRegistrationCodeSchema(connection)
    await ensureEmailAvailable(connection, email)

    const seedProfile = await loadChildProfileSeedByCode(connection, registrationCode)
    const passwordHash = await hashPassword(password)
    const parentProfileId = await createParentProfileForRegistration(
      connection,
      seedProfile,
      email,
    )
    const parentAccountId = await createParentAccount(connection, {
      parentProfileId,
      email,
      passwordHash,
    })

    await claimChildRegistrationCode(connection, {
      registrationCode,
      parentAccountId,
      parentProfileId,
    })

    const dashboard = await buildParentDashboardData(connection, parentAccountId)
    const firstChildName = dashboard.children[0]?.fullName || 'Orang Tua'
    await connection.commit()

    const session = await createAuthSessionPayload({
      id: parentAccountId,
      email,
      role: 'ORANG_TUA',
      displayName: firstChildName,
    })

    return {
      session,
      dashboard,
    }
  } catch (error) {
    await connection.rollback()
    if (error instanceof ChildRegistrationCodeServiceError) {
      throw new ParentPortalServiceError(error.status, error.message)
    }
    if (error instanceof PasswordError) {
      throw new ParentPortalServiceError(error.status, error.message)
    }
    throw error
  } finally {
    connection.release()
  }
}

export const getParentDashboardData = async (parentAccountIdValue: string) => {
  const parentAccountId = parseAccountId(parentAccountIdValue)
  const connection = await dbPool.getConnection()

  try {
    await ensureParentRelationshipSchema(connection)
    return await buildParentDashboardData(connection, parentAccountId)
  } finally {
    connection.release()
  }
}

export const linkChildToParentByCode = async (params: {
  parentAccountId: string
  registrationCode: string
}) => {
  const parentAccountId = parseAccountId(params.parentAccountId)
  const registrationCode = normalizeRegistrationCode(params.registrationCode)
  if (!registrationCode) {
    throw new ParentPortalServiceError(400, 'Kode registrasi wajib diisi.')
  }

  const connection = await dbPool.getConnection()
  try {
    await connection.beginTransaction()
    await ensureParentRelationshipSchema(connection)
    await ensureChildRegistrationCodeSchema(connection)

    const context = await getParentAccountContext(connection, parentAccountId)
    await claimChildRegistrationCode(connection, {
      registrationCode,
      parentAccountId: context.accountId,
      parentProfileId: context.parentProfileId,
    })

    const dashboard = await buildParentDashboardData(connection, parentAccountId)
    await connection.commit()
    return dashboard
  } catch (error) {
    await connection.rollback()
    if (error instanceof ChildRegistrationCodeServiceError) {
      throw new ParentPortalServiceError(error.status, error.message)
    }
    throw error
  } finally {
    connection.release()
  }
}

export const updateParentMessageForAttendance = async (params: {
  parentAccountId: string
  attendanceId: string
  parentMessage: string
}) => {
  const parentAccountId = parseAccountId(params.parentAccountId)
  const attendanceId = Number.parseInt(toText(params.attendanceId), 10)
  const parentMessage = toText(params.parentMessage).trim()

  if (!Number.isFinite(attendanceId) || attendanceId <= 0) {
    throw new ParentPortalServiceError(400, 'Data kehadiran tidak valid.')
  }

  if (parentMessage.length > 2000) {
    throw new ParentPortalServiceError(400, 'Pesan maksimal 2000 karakter.')
  }

  const connection = await dbPool.getConnection()
  try {
    await ensureParentRelationshipSchema(connection)
    const context = await getParentAccountContext(connection, parentAccountId)

    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT
        ar.id,
        ar.notes
      FROM attendance_records ar
      JOIN children c ON c.id = ar.child_id
      WHERE ar.id = ?
        AND c.parent_profile_id = ?
        AND c.is_active = 1
      LIMIT 1`,
      [attendanceId, context.parentProfileId],
    )

    const attendanceRow = rows[0]
    if (!attendanceRow) {
      throw new ParentPortalServiceError(404, 'Data kehadiran anak tidak ditemukan.')
    }

    const currentNotes = parseAttendanceNotesJson(attendanceRow.notes)
    const nextNotesJson = toAttendanceNotesJson({
      arrivalPhysicalCondition: currentNotes.arrivalPhysicalCondition || 'sehat',
      arrivalEmotionalCondition: currentNotes.arrivalEmotionalCondition || 'senang',
      departurePhysicalCondition: currentNotes.departurePhysicalCondition || 'sehat',
      departureEmotionalCondition: currentNotes.departureEmotionalCondition || 'senang',
      parentMessage,
      messageForParent: currentNotes.messageForParent || '',
      departureNotes: currentNotes.departureNotes || '',
      carriedItems: Array.isArray(currentNotes.carriedItems)
        ? currentNotes.carriedItems.map((item) => ({
            id: toText(item.id),
            category: toText(item.category),
            imageDataUrl: toText(item.imageDataUrl),
            imageName: toText(item.imageName),
            description: toText(item.description),
          }))
        : [],
    })

    await connection.execute(
      `UPDATE attendance_records
      SET notes = ?, updated_at = UTC_TIMESTAMP()
      WHERE id = ?`,
      [nextNotesJson, attendanceId],
    )

    return {
      updated: true,
      attendanceId: String(attendanceId),
      parentMessage,
    }
  } finally {
    connection.release()
  }
}
