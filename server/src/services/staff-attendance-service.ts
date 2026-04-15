import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise'
import { dbPool } from '../config/database.js'
import { ensureAuthSchema } from './auth-service.js'

type SqlExecutor = Pick<Pool, 'execute'> | Pick<PoolConnection, 'execute'>

const PRODUCTIVE_ACTIVITY_ACTIONS = [
  'REPLACE_APP_DATA',
  'IMPORT_APP_DATA',
  'CREATE_PARENT_ACCOUNT',
  'UPDATE_PARENT_ACCOUNT',
  'DELETE_PARENT_ACCOUNT',
] as const
const JAKARTA_UTC_OFFSET_MS = 7 * 60 * 60 * 1000

const toText = (value: unknown): string => (typeof value === 'string' ? value : '')

const toIsoDateTime = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value !== 'string') {
    return ''
  }

  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const withTimezone = /Z|[+-]\d{2}:\d{2}$/.test(normalized)
    ? normalized
    : `${normalized}Z`
  const parsed = new Date(withTimezone)

  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return parsed.toISOString()
}

const normalizeEmail = (value: string): string => value.trim().toLowerCase()

const toDbDateTime = (value: Date): string => {
  const yyyy = String(value.getUTCFullYear())
  const mm = String(value.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(value.getUTCDate()).padStart(2, '0')
  const hh = String(value.getUTCHours()).padStart(2, '0')
  const mi = String(value.getUTCMinutes()).padStart(2, '0')
  const ss = String(value.getUTCSeconds()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown error'

const getJakartaDateKey = (value: Date = new Date()): string => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(value)
  const year = parts.find((part) => part.type === 'year')?.value ?? ''
  const month = parts.find((part) => part.type === 'month')?.value ?? ''
  const day = parts.find((part) => part.type === 'day')?.value ?? ''

  if (!year || !month || !day) {
    const fallback = new Date()
    return [
      fallback.getUTCFullYear(),
      String(fallback.getUTCMonth() + 1).padStart(2, '0'),
      String(fallback.getUTCDate()).padStart(2, '0'),
    ].join('-')
  }

  return `${year}-${month}-${day}`
}

const normalizeAttendanceDate = (value?: string): string => {
  const normalized = toText(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized
  }

  return getJakartaDateKey()
}

const ensureStaffAttendanceTable = async (executor: SqlExecutor): Promise<void> => {
  await executor.execute(
    `CREATE TABLE IF NOT EXISTS staff_daily_attendance (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      staff_user_id BIGINT NOT NULL,
      attendance_date DATE NOT NULL,
      check_in_at DATETIME NULL,
      check_out_at DATETIME NULL,
      check_in_ip VARCHAR(64) NULL,
      check_in_user_agent VARCHAR(255) NULL,
      check_out_ip VARCHAR(64) NULL,
      check_out_user_agent VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_staff_daily_attendance_user_date (staff_user_id, attendance_date),
      INDEX idx_staff_daily_attendance_user (staff_user_id),
      INDEX idx_staff_daily_attendance_date (attendance_date)
    )`,
  )
}

interface ColumnMetaRow extends RowDataPacket {
  column_type: string
  is_nullable: 'YES' | 'NO'
}

const normalizeColumnTypeForCompare = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^integer\b/, 'int')

const loadColumnMeta = async (
  executor: SqlExecutor,
  tableName: string,
  columnName: string,
): Promise<ColumnMetaRow | null> => {
  const [rows] = (await executor.execute<ColumnMetaRow[]>(
    `SELECT
      COLUMN_TYPE AS column_type,
      IS_NULLABLE AS is_nullable
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    LIMIT 1`,
    [tableName, columnName],
  )) as [ColumnMetaRow[], unknown]

  return rows[0] ?? null
}

const resolveReferencedColumnType = async (
  executor: SqlExecutor,
  tableName: string,
  columnName: string,
  fallbackType: string,
): Promise<string> => {
  const meta = await loadColumnMeta(executor, tableName, columnName)
  const rawType = toText(meta?.column_type).trim()
  return rawType ? rawType.toUpperCase() : fallbackType
}

const ensureColumnType = async (
  executor: SqlExecutor,
  input: {
    tableName: string
    columnName: string
    targetType: string
    nullable: boolean
  },
): Promise<void> => {
  const meta = await loadColumnMeta(executor, input.tableName, input.columnName)
  if (!meta) {
    return
  }

  const currentType = normalizeColumnTypeForCompare(toText(meta.column_type))
  const targetType = normalizeColumnTypeForCompare(input.targetType)
  const nullableMatches = (meta.is_nullable === 'YES') === input.nullable

  if (currentType === targetType && nullableMatches) {
    return
  }

  await executor.execute(
    `ALTER TABLE ${input.tableName}
    MODIFY COLUMN ${input.columnName} ${input.targetType} ${input.nullable ? 'NULL' : 'NOT NULL'}`,
  )
}

const hasForeignKeyOnColumn = async (
  executor: SqlExecutor,
  tableName: string,
  columnName: string,
): Promise<boolean> => {
  const [rows] = (await executor.execute(
    `SELECT 1
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
      AND REFERENCED_TABLE_NAME IS NOT NULL
    LIMIT 1`,
    [tableName, columnName],
  )) as [RowDataPacket[], unknown]

  return rows.length > 0
}

const ensureStaffAttendanceColumnType = async (
  executor: SqlExecutor,
): Promise<void> => {
  const usersIdType = await resolveReferencedColumnType(executor, 'users', 'id', 'BIGINT')
  await ensureColumnType(executor, {
    tableName: 'staff_daily_attendance',
    columnName: 'staff_user_id',
    targetType: usersIdType,
    nullable: false,
  })
}

const reconcileStaffAttendanceReferences = async (
  executor: SqlExecutor,
): Promise<void> => {
  await executor.execute(
    `DELETE sda
    FROM staff_daily_attendance sda
    LEFT JOIN users u ON u.id = sda.staff_user_id
    WHERE u.id IS NULL`,
  )
}

const ensureStaffAttendanceForeignKey = async (
  executor: SqlExecutor,
): Promise<void> => {
  const exists = await hasForeignKeyOnColumn(
    executor,
    'staff_daily_attendance',
    'staff_user_id',
  )
  if (exists) {
    return
  }

  await executor.execute(
    `ALTER TABLE staff_daily_attendance
    ADD CONSTRAINT fk_staff_daily_attendance_staff_user
    FOREIGN KEY (staff_user_id)
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE`,
  )
}

interface StaffAttendanceRow extends RowDataPacket {
  attendance_date: string
  check_in_at: string | null
  check_out_at: string | null
}

interface ProductiveActivitySummaryRow extends RowDataPacket {
  total: number
  latest_event: string | null
}

interface StaffAttendanceRecapDbRow extends RowDataPacket {
  staff_user_id: number
  full_name: string | null
  email: string | null
  attendance_date: string
  check_in_at: string | Date | null
  check_out_at: string | Date | null
  monthly_attendance_count: number
}

const EMPTY_PRODUCTIVE_ACTIVITY_SUMMARY = {
  total: 0,
  latest_event: null,
} as ProductiveActivitySummaryRow

const normalizeAttendanceMonth = (value?: string): string => {
  const normalized = toText(value).trim()
  if (/^\d{4}-\d{2}$/.test(normalized)) {
    return normalized
  }

  return getJakartaDateKey().slice(0, 7)
}

const getMonthDateRange = (month: string): {
  startDate: string
  endDateExclusive: string
} => {
  const [yyyyRaw, mmRaw] = month.split('-')
  const yyyy = Number(yyyyRaw)
  const mm = Number(mmRaw)

  if (
    !Number.isInteger(yyyy) ||
    !Number.isInteger(mm) ||
    mm < 1 ||
    mm > 12
  ) {
    const fallbackMonth = getJakartaDateKey().slice(0, 7)
    return getMonthDateRange(fallbackMonth)
  }

  const startDate = `${yyyyRaw}-${mmRaw}-01`
  const nextMonthYear = mm === 12 ? yyyy + 1 : yyyy
  const nextMonthValue = mm === 12 ? 1 : mm + 1
  const nextMonth = String(nextMonthValue).padStart(2, '0')

  return {
    startDate,
    endDateExclusive: `${nextMonthYear}-${nextMonth}-01`,
  }
}

const getJakartaUtcDateRange = (
  attendanceDate: string,
): { startUtc: string; endUtc: string } => {
  const [yyyy, mm, dd] = attendanceDate.split('-').map((value) => Number(value))

  if (
    !Number.isInteger(yyyy) ||
    !Number.isInteger(mm) ||
    !Number.isInteger(dd) ||
    mm < 1 ||
    mm > 12 ||
    dd < 1 ||
    dd > 31
  ) {
    const fallbackStart = new Date()
    const fallbackEnd = new Date(fallbackStart.getTime() + 24 * 60 * 60 * 1000)
    return {
      startUtc: toDbDateTime(fallbackStart),
      endUtc: toDbDateTime(fallbackEnd),
    }
  }

  const localMidnightUtcMs =
    Date.UTC(yyyy, mm - 1, dd, 0, 0, 0) - JAKARTA_UTC_OFFSET_MS
  const localNextMidnightUtcMs = localMidnightUtcMs + 24 * 60 * 60 * 1000

  return {
    startUtc: toDbDateTime(new Date(localMidnightUtcMs)),
    endUtc: toDbDateTime(new Date(localNextMidnightUtcMs)),
  }
}

const loadAttendanceRow = async (
  executor: SqlExecutor,
  input: { staffUserId: number; attendanceDate: string },
): Promise<StaffAttendanceRow | null> => {
  const [rows] = (await executor.execute(
    `SELECT
      attendance_date,
      check_in_at,
      check_out_at
    FROM staff_daily_attendance
    WHERE staff_user_id = ?
      AND attendance_date = ?
    LIMIT 1`,
    [input.staffUserId, input.attendanceDate],
  )) as [StaffAttendanceRow[], unknown]

  return rows[0] ?? null
}

const loadProductiveActivitySummary = async (
  executor: SqlExecutor,
  input: { email: string; attendanceDate: string },
): Promise<ProductiveActivitySummaryRow> => {
  const placeholders = PRODUCTIVE_ACTIVITY_ACTIONS.map(() => '?').join(', ')
  const { startUtc, endUtc } = getJakartaUtcDateRange(input.attendanceDate)
  const [rows] = (await executor.execute(
    `SELECT
      COUNT(*) AS total,
      MAX(event_at) AS latest_event
    FROM activity_logs
    WHERE gmail = ?
      AND role IN ('PETUGAS', 'STAFF')
      AND status = 'SUCCESS'
      AND action IN (${placeholders})
      AND event_at >= ?
      AND event_at < ?`,
    [
      normalizeEmail(input.email),
      ...PRODUCTIVE_ACTIVITY_ACTIONS,
      startUtc,
      endUtc,
    ],
  )) as [ProductiveActivitySummaryRow[], unknown]

  return rows[0] ?? EMPTY_PRODUCTIVE_ACTIVITY_SUMMARY
}

const loadProductiveActivitySummarySafely = async (
  executor: SqlExecutor,
  input: { email: string; attendanceDate: string },
): Promise<ProductiveActivitySummaryRow> => {
  try {
    return await loadProductiveActivitySummary(executor, input)
  } catch (error) {
    // Productive summary is informational only; attendance status should still load.
    console.warn(
      `[staff-attendance] Skip productive summary (${input.attendanceDate} ${normalizeEmail(input.email)}): ${toErrorMessage(error)}`,
    )
    return EMPTY_PRODUCTIVE_ACTIVITY_SUMMARY
  }
}

export interface StaffAttendanceStatus {
  attendanceDate: string
  checkInAt: string
  checkOutAt: string
  hasCheckedIn: boolean
  hasCheckedOut: boolean
  productiveActivityCount: number
  lastProductiveActivityAt: string
  productivityStatus: 'aktif' | 'perlu-konfirmasi'
}

export interface StaffAttendanceRecapRow {
  key: string
  staffUserId: string
  fullName: string
  account: string
  attendanceDate: string
  checkInAt: string
  checkOutAt: string
  monthlyAttendanceCount: number
}

const buildStatus = (
  attendanceDate: string,
  attendanceRow: StaffAttendanceRow | null,
  productiveSummary: ProductiveActivitySummaryRow,
): StaffAttendanceStatus => {
  const checkInAt = toIsoDateTime(attendanceRow?.check_in_at)
  const checkOutAt = toIsoDateTime(attendanceRow?.check_out_at)
  const productiveActivityCount = Number(productiveSummary.total ?? 0)
  const lastProductiveActivityAt = toIsoDateTime(productiveSummary.latest_event)

  return {
    attendanceDate,
    checkInAt,
    checkOutAt,
    hasCheckedIn: Boolean(checkInAt),
    hasCheckedOut: Boolean(checkOutAt),
    productiveActivityCount,
    lastProductiveActivityAt,
    productivityStatus: productiveActivityCount > 0 ? 'aktif' : 'perlu-konfirmasi',
  }
}

export class StaffAttendanceServiceError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'StaffAttendanceServiceError'
  }
}

export const ensureStaffAttendanceSchema = async (
  executor: SqlExecutor = dbPool,
): Promise<void> => {
  await ensureAuthSchema(executor)
  await ensureStaffAttendanceTable(executor)
  await ensureStaffAttendanceColumnType(executor)
  await reconcileStaffAttendanceReferences(executor)
  await ensureStaffAttendanceForeignKey(executor)
}

let staffAttendanceSchemaReadyPromise: Promise<void> | null = null

const ensureStaffAttendanceSchemaReady = async (): Promise<void> => {
  if (!staffAttendanceSchemaReadyPromise) {
    staffAttendanceSchemaReadyPromise = ensureStaffAttendanceSchema(dbPool).catch(
      (error) => {
        staffAttendanceSchemaReadyPromise = null
        throw error
      },
    )
  }

  await staffAttendanceSchemaReadyPromise
}

export const getStaffAttendanceStatus = async (input: {
  staffUserId: number
  email: string
  attendanceDate?: string
}): Promise<StaffAttendanceStatus> => {
  const attendanceDate = normalizeAttendanceDate(input.attendanceDate)
  await ensureStaffAttendanceSchemaReady()

  const [attendanceRow, productiveSummary] = await Promise.all([
    loadAttendanceRow(dbPool, {
      staffUserId: input.staffUserId,
      attendanceDate,
    }),
    loadProductiveActivitySummarySafely(dbPool, {
      email: input.email,
      attendanceDate,
    }),
  ])

  return buildStatus(attendanceDate, attendanceRow, productiveSummary)
}

export const listStaffAttendanceRecap = async (input: {
  attendanceDate?: string
  attendanceMonth?: string
}): Promise<StaffAttendanceRecapRow[]> => {
  const attendanceDate = normalizeAttendanceDate(input.attendanceDate)
  const attendanceMonth = normalizeAttendanceMonth(input.attendanceMonth)
  const monthRange = getMonthDateRange(attendanceMonth)

  await ensureStaffAttendanceSchemaReady()

  const [rows] = (await dbPool.execute(
    `SELECT
      sda.staff_user_id,
      u.full_name,
      u.email,
      DATE_FORMAT(sda.attendance_date, '%Y-%m-%d') AS attendance_date,
      sda.check_in_at,
      sda.check_out_at,
      COALESCE(monthly.monthly_attendance_count, 0) AS monthly_attendance_count
    FROM staff_daily_attendance sda
    LEFT JOIN users u
      ON u.id = sda.staff_user_id
    LEFT JOIN (
      SELECT
        staff_user_id,
        COUNT(*) AS monthly_attendance_count
      FROM staff_daily_attendance
      WHERE attendance_date >= ?
        AND attendance_date < ?
        AND check_in_at IS NOT NULL
      GROUP BY staff_user_id
    ) monthly
      ON monthly.staff_user_id = sda.staff_user_id
    WHERE sda.attendance_date = ?
      AND sda.check_in_at IS NOT NULL
    ORDER BY
      COALESCE(u.full_name, ''),
      COALESCE(u.email, ''),
      sda.staff_user_id ASC`,
    [
      monthRange.startDate,
      monthRange.endDateExclusive,
      attendanceDate,
    ],
  )) as [StaffAttendanceRecapDbRow[], unknown]

  return rows.map((row) => {
    const staffUserId = String(row.staff_user_id)
    const account = normalizeEmail(toText(row.email))
    const fullName =
      toText(row.full_name).trim() ||
      (account ? account : `Petugas #${staffUserId}`)

    return {
      key: `${staffUserId}-${attendanceDate}`,
      staffUserId,
      fullName,
      account,
      attendanceDate: toText(row.attendance_date),
      checkInAt: toIsoDateTime(row.check_in_at),
      checkOutAt: toIsoDateTime(row.check_out_at),
      monthlyAttendanceCount: Math.max(
        0,
        Number(row.monthly_attendance_count ?? 0),
      ),
    }
  })
}

export const hasCheckedInForDate = async (input: {
  staffUserId: number
  attendanceDate?: string
}): Promise<boolean> => {
  const attendanceDate = normalizeAttendanceDate(input.attendanceDate)
  await ensureStaffAttendanceSchemaReady()

  const [rows] = (await dbPool.execute<RowDataPacket[]>(
    `SELECT id
    FROM staff_daily_attendance
    WHERE staff_user_id = ?
      AND attendance_date = ?
      AND check_in_at IS NOT NULL
    LIMIT 1`,
    [input.staffUserId, attendanceDate],
  )) as [RowDataPacket[], unknown]

  return rows.length > 0
}

export const checkInStaffForDate = async (input: {
  staffUserId: number
  email: string
  attendanceDate?: string
  ipAddress?: string | null
  userAgent?: string | null
}): Promise<{ status: StaffAttendanceStatus; alreadyCheckedIn: boolean }> => {
  const attendanceDate = normalizeAttendanceDate(input.attendanceDate)
  await ensureStaffAttendanceSchemaReady()
  const nowDbDateTime = toDbDateTime(new Date())
  const connection = await dbPool.getConnection()
  let alreadyCheckedIn = false

  try {
    await connection.beginTransaction()

    const [rows] = (await connection.execute(
      `SELECT
        check_in_at
      FROM staff_daily_attendance
      WHERE staff_user_id = ?
        AND attendance_date = ?
      LIMIT 1
      FOR UPDATE`,
      [input.staffUserId, attendanceDate],
    )) as [RowDataPacket[], unknown]

    const existing = rows[0]
    if (!existing) {
      await connection.execute(
        `INSERT INTO staff_daily_attendance (
          staff_user_id,
          attendance_date,
          check_in_at,
          check_in_ip,
          check_in_user_agent
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          input.staffUserId,
          attendanceDate,
          nowDbDateTime,
          input.ipAddress ?? null,
          input.userAgent ?? null,
        ],
      )
    } else if (existing.check_in_at) {
      alreadyCheckedIn = true
    } else {
      await connection.execute(
        `UPDATE staff_daily_attendance
        SET
          check_in_at = ?,
          check_in_ip = ?,
          check_in_user_agent = ?
        WHERE staff_user_id = ?
          AND attendance_date = ?`,
        [
          nowDbDateTime,
          input.ipAddress ?? null,
          input.userAgent ?? null,
          input.staffUserId,
          attendanceDate,
        ],
      )
    }

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  const status = await getStaffAttendanceStatus({
    staffUserId: input.staffUserId,
    email: input.email,
    attendanceDate,
  })

  return { status, alreadyCheckedIn }
}

export const checkOutStaffForDate = async (input: {
  staffUserId: number
  email: string
  attendanceDate?: string
  ipAddress?: string | null
  userAgent?: string | null
}): Promise<{ status: StaffAttendanceStatus; alreadyCheckedOut: boolean }> => {
  const attendanceDate = normalizeAttendanceDate(input.attendanceDate)
  await ensureStaffAttendanceSchemaReady()
  const nowDbDateTime = toDbDateTime(new Date())
  const connection = await dbPool.getConnection()
  let alreadyCheckedOut = false

  try {
    await connection.beginTransaction()

    const [rows] = (await connection.execute(
      `SELECT
        check_in_at,
        check_out_at
      FROM staff_daily_attendance
      WHERE staff_user_id = ?
        AND attendance_date = ?
      LIMIT 1
      FOR UPDATE`,
      [input.staffUserId, attendanceDate],
    )) as [RowDataPacket[], unknown]

    const existing = rows[0]
    if (!existing || !existing.check_in_at) {
      throw new StaffAttendanceServiceError(
        400,
        'Absensi datang belum dilakukan untuk hari ini.',
      )
    }

    if (existing.check_out_at) {
      alreadyCheckedOut = true
    } else {
      await connection.execute(
        `UPDATE staff_daily_attendance
        SET
          check_out_at = ?,
          check_out_ip = ?,
          check_out_user_agent = ?
        WHERE staff_user_id = ?
          AND attendance_date = ?`,
        [
          nowDbDateTime,
          input.ipAddress ?? null,
          input.userAgent ?? null,
          input.staffUserId,
          attendanceDate,
        ],
      )
    }

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  const status = await getStaffAttendanceStatus({
    staffUserId: input.staffUserId,
    email: input.email,
    attendanceDate,
  })

  return { status, alreadyCheckedOut }
}
