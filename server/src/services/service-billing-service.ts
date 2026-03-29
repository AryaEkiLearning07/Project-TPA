
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise'
import { dbPool } from '../config/database.js'
import {
  ensureServiceRateSchema,
  getServicePackageRates,
  type ServicePackageRates,
} from './service-rate-service.js'

type SqlExecutor = Pick<Pool, 'execute'> | Pick<PoolConnection, 'execute'>

export type ServicePackageKey = 'harian' | '2-mingguan' | 'bulanan'
export type ServiceBillingBucket = 'period' | 'arrears'
export type ServiceBillingTransactionType = 'period-start' | 'payment' | 'refund'
export type ServiceBillingPeriodStatus =
  | 'active'
  | 'upgrade_pending'
  | 'upgrade_confirmed'
  | 'completed'

export type ServiceBillingStatus =
  | 'belum-periode'
  | 'aktif-lancar'
  | 'aktif-menunggak'
  | 'upgrade-pending'
  | 'periode-berakhir-menunggak'

interface ChildRow extends RowDataPacket {
  id: number
  full_name: string
  service_package: string
}

interface AttendanceRow extends RowDataPacket {
  child_id: number
  attendance_date: string
}

interface BillingPeriodRow extends RowDataPacket {
  id: number
  child_id: number
  package_key: ServicePackageKey
  start_date: string
  end_date: string
  status: ServiceBillingPeriodStatus
  notes: string | null
  created_at: string
  updated_at: string
}

interface BillingTransactionRow extends RowDataPacket {
  id: number
  child_id: number
  period_id: number | null
  transaction_type: 'PERIOD_START' | 'PAYMENT' | 'REFUND'
  bucket: 'PERIOD' | 'ARREARS'
  amount: number
  notes: string | null
  payment_proof_data_url: string | null
  payment_proof_name: string | null
  transacted_at: string
  created_at: string
  updated_at: string
}

interface CountRow extends RowDataPacket {
  total: number
}

interface ColumnTypeRow extends RowDataPacket {
  column_type: string
}

const dbToServicePackage: Record<string, ServicePackageKey> = {
  DAILY: 'harian',
  BIWEEKLY: '2-mingguan',
  MONTHLY: 'bulanan',
  HARIAN: 'harian',
  BULANAN: 'bulanan',
}

const servicePackageToDb: Record<ServicePackageKey, string> = {
  harian: 'DAILY',
  '2-mingguan': 'BIWEEKLY',
  bulanan: 'MONTHLY',
}

const toText = (value: unknown): string => (typeof value === 'string' ? value : '')

const toOptionalPaymentProofDataUrl = (value: unknown): string => {
  const normalized = toText(value).trim()
  if (!normalized) {
    return ''
  }

  if (!normalized.startsWith('data:image/')) {
    return ''
  }

  return normalized
}

const toOptionalPaymentProofName = (value: unknown): string => {
  const normalized = toText(value).trim()
  if (!normalized) {
    return ''
  }

  return normalized.slice(0, 255)
}

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

const toDateKey = (value: Date): string => {
  const yyyy = String(value.getUTCFullYear())
  const mm = String(value.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(value.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const addDays = (dateKey: string, days: number): string => {
  const base = new Date(`${dateKey}T00:00:00.000Z`)
  if (Number.isNaN(base.getTime())) {
    return dateKey
  }

  base.setUTCDate(base.getUTCDate() + days)
  return toDateKey(base)
}

const normalizeDateKey = (value: unknown): string => {
  const normalized = toText(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized
  }

  return toDateKey(new Date())
}

const normalizeOptionalDateKey = (value: unknown): string | null => {
  const normalized = toText(value).trim()
  if (!normalized) {
    return null
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null
  }

  return normalized
}

const toSafeAmount = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.round(value))
}

const parseNumericId = (value: unknown): number => {
  const parsed = Number.parseInt(toText(value), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0
  }

  return parsed
}

const normalizePackageKey = (value: unknown): ServicePackageKey | null => {
  const normalized = toText(value).trim().toLowerCase()
  if (
    normalized === 'harian' ||
    normalized === '2-mingguan' ||
    normalized === 'bulanan'
  ) {
    return normalized
  }

  return null
}

const normalizeBucket = (value: unknown): ServiceBillingBucket | null => {
  const normalized = toText(value).trim().toLowerCase()
  if (normalized === 'period' || normalized === 'arrears') {
    return normalized
  }

  return null
}

const normalizeTransactionType = (value: unknown): ServiceBillingTransactionType => {
  const normalized = toText(value).trim().toUpperCase()
  if (normalized === 'PERIOD_START') {
    return 'period-start'
  }
  if (normalized === 'REFUND') {
    return 'refund'
  }
  return 'payment'
}

const normalizePeriodStatus = (value: unknown): ServiceBillingPeriodStatus => {
  const normalized = toText(value).trim().toLowerCase()
  if (
    normalized === 'active' ||
    normalized === 'upgrade_pending' ||
    normalized === 'upgrade_confirmed' ||
    normalized === 'completed'
  ) {
    return normalized
  }

  return 'active'
}

const mapDbServicePackage = (value: unknown): ServicePackageKey => {
  const normalized = toText(value).trim().toUpperCase()
  return dbToServicePackage[normalized] ?? 'harian'
}

const mapStatusLabel = (status: ServiceBillingStatus): string => {
  if (status === 'aktif-lancar') return 'Aktif - Lancar'
  if (status === 'aktif-menunggak') return 'Aktif - Menunggak'
  if (status === 'upgrade-pending') return 'Perlu Konfirmasi Upgrade'
  if (status === 'periode-berakhir-menunggak') return 'Periode Berakhir - Menunggak'
  return 'Belum Mulai Periode'
}

const BIWEEKLY_BASE_ATTENDANCE_LIMIT = 10
const BIWEEKLY_DAILY_CHARGE_MAX_DAYS = 5
const BIWEEKLY_AUTO_MIGRATION_ATTENDANCE = 16
const BIWEEKLY_MIGRATION_SETTLEMENT_AMOUNT = 650_000
const AUTO_MIGRATION_NOTE_MARKER = '[AUTO_MIGRASI_2M_BULANAN]'

const getBillingPeriodDurationDays = (packageKey: ServicePackageKey): number => {
  if (packageKey === '2-mingguan') {
    return 10
  }
  if (packageKey === 'bulanan') {
    return 30
  }
  return 1
}

const formatRupiahLabel = (amount: number): string =>
  `Rp${new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
  }).format(toSafeAmount(amount))}`

const appendNote = (existing: unknown, next: string): string => {
  const current = toText(existing).trim()
  if (!next.trim()) {
    return current
  }
  if (!current) {
    return next
  }
  if (current.includes(next)) {
    return current
  }
  return `${current} | ${next}`
}

const isDateInRange = (value: string, start: string, end: string): boolean =>
  value >= start && value <= end

const toSignedTransactionAmount = (transaction: {
  transactionType: ServiceBillingTransactionType
  amount: number
}): number => (transaction.transactionType === 'refund' ? -transaction.amount : transaction.amount)

const calculateBiweeklyDailyChargeDays = (attendanceCount: number): number => {
  if (attendanceCount <= BIWEEKLY_BASE_ATTENDANCE_LIMIT) {
    return 0
  }

  return Math.min(
    BIWEEKLY_DAILY_CHARGE_MAX_DAYS,
    Math.max(0, attendanceCount - BIWEEKLY_BASE_ATTENDANCE_LIMIT),
  )
}

const calculatePeriodDue = (
  packageKey: ServicePackageKey,
  attendanceCount: number,
  rates: ServicePackageRates,
  shouldUseMonthlyDueForBiweekly = false,
): number => {
  if (packageKey === 'harian') {
    return attendanceCount * rates.harian
  }

  if (packageKey === 'bulanan') {
    return rates.bulanan
  }

  if (attendanceCount <= 10) {
    return rates['2-mingguan']
  }

  const biweeklyDailyChargeDays = calculateBiweeklyDailyChargeDays(attendanceCount)

  if (attendanceCount < BIWEEKLY_AUTO_MIGRATION_ATTENDANCE || !shouldUseMonthlyDueForBiweekly) {
    return rates['2-mingguan'] + biweeklyDailyChargeDays * rates.harian
  }

  return BIWEEKLY_MIGRATION_SETTLEMENT_AMOUNT
}
const selectCurrentPeriod = (
  periods: ServiceBillingPeriod[],
  todayKey: string,
): ServiceBillingPeriod | null => {
  const startedPeriods = periods.filter((period) => period.startDate <= todayKey)
  if (startedPeriods.length === 0) {
    return null
  }

  const activeNow = startedPeriods
    .filter((period) => todayKey <= period.endDate)
    .sort((left, right) => right.startDate.localeCompare(left.startDate))[0]

  if (activeNow) {
    return activeNow
  }

  return startedPeriods.sort((left, right) => right.startDate.localeCompare(left.startDate))[0]
}

const countAttendanceInRange = (
  sortedDates: string[],
  startDate: string,
  endDate: string,
): number => {
  let total = 0
  for (const date of sortedDates) {
    if (date < startDate) {
      continue
    }
    if (date > endDate) {
      break
    }
    total += 1
  }

  return total
}

export class ServiceBillingError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ServiceBillingError'
  }
}

export interface ServiceBillingPeriod {
  id: string
  childId: string
  packageKey: ServicePackageKey
  startDate: string
  endDate: string
  status: ServiceBillingPeriodStatus
  notes: string
  attendanceCount: number
  dailyChargeDays: number
  dailyChargeAmount: number
  dueAmount: number
  paidAmount: number
  outstandingAmount: number
  overpaymentAmount: number
  isAutoMigratedToMonthly: boolean
  migrationTopUpAmount: number
  needsUpgradeConfirmation: boolean
  createdAt: string
  updatedAt: string
}

export interface ServiceBillingTransaction {
  id: string
  childId: string
  periodId: string
  transactionType: ServiceBillingTransactionType
  bucket: ServiceBillingBucket
  amount: number
  notes: string
  paymentProofDataUrl: string
  paymentProofName: string
  transactedAt: string
  createdAt: string
  updatedAt: string
}

export type ServiceBillingPaymentStatus = 'lunas' | 'belum-bayar'

export interface ServiceBillingMigrationInfo {
  fromPackage: ServicePackageKey
  toPackage: ServicePackageKey
  triggerAttendance: number
  additionalAmount: number
  notes: string
}

export interface ServiceBillingSummaryRow {
  childId: string
  childName: string
  currentServicePackage: ServicePackageKey
  displayServicePackage: ServicePackageKey
  goLiveDate: string
  status: ServiceBillingStatus
  statusLabel: string
  activePeriod: ServiceBillingPeriod | null
  attendanceInActivePeriod: number
  dailyChargeDays: number
  dailyChargeAmount: number
  duePeriod: number
  paidPeriod: number
  outstandingPeriod: number
  arrearsAttendanceDays: number
  dueArrears: number
  paidArrears: number
  outstandingArrears: number
  totalOutstanding: number
  totalOverpayment: number
  overpaymentPeriod: number
  overpaymentArrears: number
  paymentStatus: ServiceBillingPaymentStatus
  hasPaymentAlert: boolean
  paymentAlertMessage: string
  migrationInfo: ServiceBillingMigrationInfo | null
  needsUpgradeConfirmation: boolean
  lastPaymentAt: string
  lastTransactionAt: string
}

export interface ServiceBillingSummaryResponse {
  goLiveDate: string
  generatedAt: string
  rates: ServicePackageRates
  rows: ServiceBillingSummaryRow[]
}

export interface ServiceBillingHistoryResponse {
  goLiveDate: string
  generatedAt: string
  rates: ServicePackageRates
  summary: ServiceBillingSummaryRow | null
  periods: ServiceBillingPeriod[]
  transactions: ServiceBillingTransaction[]
}

interface BillingSnapshot {
  goLiveDate: string
  rates: ServicePackageRates
  children: Array<{
    id: string
    fullName: string
    currentServicePackage: ServicePackageKey
  }>
  periods: ServiceBillingPeriod[]
  transactions: ServiceBillingTransaction[]
  attendanceByChild: Map<string, string[]>
}

const ensureBillingSettingsTable = async (executor: SqlExecutor): Promise<void> => {
  await executor.execute(
    `CREATE TABLE IF NOT EXISTS service_billing_settings (
      id TINYINT NOT NULL PRIMARY KEY,
      go_live_date DATE NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
  )

  await executor.execute(
    `INSERT INTO service_billing_settings (
      id,
      go_live_date
    ) VALUES (
      1,
      DATE(UTC_TIMESTAMP())
    )
    ON DUPLICATE KEY UPDATE
      id = VALUES(id)`,
  )
}

const hasTableColumn = async (
  executor: SqlExecutor,
  tableName: string,
  columnName: string,
): Promise<boolean> => {
  const [rows] = (await executor.execute(
    `SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    LIMIT 1`,
    [tableName, columnName],
  )) as [RowDataPacket[], unknown]

  return Array.isArray(rows) && rows.length > 0
}

const resolveChildrenIdColumnType = async (executor: SqlExecutor): Promise<string> => {
  const [rows] = (await executor.execute<ColumnTypeRow[]>(
    `SELECT
      COLUMN_TYPE AS column_type
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'children'
      AND COLUMN_NAME = 'id'
    LIMIT 1`,
  )) as [ColumnTypeRow[], unknown]

  const rawColumnType = toText(rows[0]?.column_type).trim().toLowerCase()
  if (!rawColumnType) {
    return 'BIGINT'
  }

  const compact = rawColumnType.replace(/\s+/g, ' ')
  const normalized = compact.replace(/\(\d+\)/g, '')

  if (normalized === 'bigint unsigned') return 'BIGINT UNSIGNED'
  if (normalized === 'bigint') return 'BIGINT'
  if (normalized === 'integer unsigned' || normalized === 'int unsigned') {
    return 'INT UNSIGNED'
  }
  if (normalized === 'integer' || normalized === 'int') {
    return 'INT'
  }

  // Fallback for compatible integer variants from existing schema.
  return compact.toUpperCase()
}

const ensureBillingPeriodsTable = async (
  executor: SqlExecutor,
  childIdColumnType: string,
): Promise<void> => {
  await executor.execute(
    `CREATE TABLE IF NOT EXISTS service_billing_periods (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      child_id ${childIdColumnType} NOT NULL,
      package_key ENUM('harian', '2-mingguan', 'bulanan') NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status ENUM('active', 'upgrade_pending', 'upgrade_confirmed', 'completed') NOT NULL DEFAULT 'active',
      notes TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_service_billing_periods_child (child_id),
      INDEX idx_service_billing_periods_dates (start_date, end_date),
      CONSTRAINT fk_service_billing_periods_child
        FOREIGN KEY (child_id) REFERENCES children (id)
        ON DELETE CASCADE
    )`,
  )
}

const ensureBillingTransactionsTable = async (
  executor: SqlExecutor,
  childIdColumnType: string,
): Promise<void> => {
  await executor.execute(
    `CREATE TABLE IF NOT EXISTS service_billing_transactions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      child_id ${childIdColumnType} NOT NULL,
      period_id BIGINT NULL,
      transaction_type ENUM('PERIOD_START', 'PAYMENT', 'REFUND') NOT NULL,
      bucket ENUM('PERIOD', 'ARREARS') NOT NULL,
      amount BIGINT NOT NULL DEFAULT 0,
      notes TEXT NULL,
      payment_proof_data_url LONGTEXT NULL,
      payment_proof_name VARCHAR(255) NULL,
      transacted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_service_billing_transactions_child (child_id),
      INDEX idx_service_billing_transactions_period (period_id),
      INDEX idx_service_billing_transactions_time (transacted_at),
      CONSTRAINT fk_service_billing_transactions_child
        FOREIGN KEY (child_id) REFERENCES children (id)
        ON DELETE CASCADE,
      CONSTRAINT fk_service_billing_transactions_period
        FOREIGN KEY (period_id) REFERENCES service_billing_periods (id)
        ON DELETE SET NULL
    )`,
  )
}

const ensureBillingTransactionProofColumns = async (
  executor: SqlExecutor,
): Promise<void> => {
  const hasProofDataUrl = await hasTableColumn(
    executor,
    'service_billing_transactions',
    'payment_proof_data_url',
  )
  if (!hasProofDataUrl) {
    await executor.execute(
      'ALTER TABLE service_billing_transactions ADD COLUMN payment_proof_data_url LONGTEXT NULL AFTER notes',
    )
  }

  const hasProofName = await hasTableColumn(
    executor,
    'service_billing_transactions',
    'payment_proof_name',
  )
  if (!hasProofName) {
    await executor.execute(
      'ALTER TABLE service_billing_transactions ADD COLUMN payment_proof_name VARCHAR(255) NULL AFTER payment_proof_data_url',
    )
  }
}

export const ensureServiceBillingSchema = async (
  executor: SqlExecutor = dbPool,
): Promise<void> => {
  await ensureServiceRateSchema(executor)
  await ensureBillingSettingsTable(executor)
  const childIdColumnType = await resolveChildrenIdColumnType(executor)
  await ensureBillingPeriodsTable(executor, childIdColumnType)
  await ensureBillingTransactionsTable(executor, childIdColumnType)
  await ensureBillingTransactionProofColumns(executor)
}

const getGoLiveDate = async (executor: SqlExecutor): Promise<string> => {
  const [rows] = (await executor.execute(
    `SELECT
      go_live_date
    FROM service_billing_settings
    WHERE id = 1
    LIMIT 1`,
  )) as [RowDataPacket[], unknown]

  return normalizeDateKey(rows[0]?.go_live_date)
}

const buildPeriodPaymentMap = (
  transactionRows: BillingTransactionRow[],
): Map<number, number> => {
  const paymentByPeriod = new Map<number, number>()

  for (const row of transactionRows) {
    const bucket = toText(row.bucket).trim().toUpperCase()
    if (bucket !== 'PERIOD') {
      continue
    }

    const periodId = Number(row.period_id ?? 0)
    if (!Number.isFinite(periodId) || periodId <= 0) {
      continue
    }

    const amount = toSafeAmount(Number(row.amount))
    const transactionType = toText(row.transaction_type).trim().toUpperCase()
    const signedAmount = transactionType === 'REFUND' ? -amount : amount
    paymentByPeriod.set(periodId, (paymentByPeriod.get(periodId) ?? 0) + signedAmount)
  }

  return paymentByPeriod
}

interface AutoMigrationCandidate {
  periodId: number
  childId: number
  note: string
}

const resolveAutoMigrationCandidates = (input: {
  periods: BillingPeriodRow[]
  attendanceByChild: Map<string, string[]>
  periodPaymentMap: Map<number, number>
  rates: ServicePackageRates
}): AutoMigrationCandidate[] => {
  const candidates: AutoMigrationCandidate[] = []
  const todayKey = toDateKey(new Date())
  const migrationNote = `${AUTO_MIGRATION_NOTE_MARKER} Migrasi otomatis paket 2 Mingguan ke Bulanan pada kehadiran ke-${BIWEEKLY_AUTO_MIGRATION_ATTENDANCE} karena pembayaran paket 2 mingguan belum lunas. Pelunasan migrasi bulanan ${formatRupiahLabel(BIWEEKLY_MIGRATION_SETTLEMENT_AMOUNT)}.`

  for (const periodRow of input.periods) {
    const periodId = Number(periodRow.id ?? 0)
    const childId = Number(periodRow.child_id ?? 0)
    if (!Number.isFinite(periodId) || periodId <= 0 || !Number.isFinite(childId) || childId <= 0) {
      continue
    }

    const packageKey = normalizePackageKey(periodRow.package_key)
    if (packageKey !== '2-mingguan') {
      continue
    }

    const periodStatus = normalizePeriodStatus(periodRow.status)
    if (
      periodStatus === 'upgrade_confirmed' ||
      toText(periodRow.notes).includes(AUTO_MIGRATION_NOTE_MARKER)
    ) {
      continue
    }

    const startDate = normalizeDateKey(periodRow.start_date)
    const endDate = normalizeDateKey(periodRow.end_date)
    if (todayKey < startDate || todayKey > endDate) {
      continue
    }

    const attendanceDates = input.attendanceByChild.get(String(childId)) ?? []
    const attendanceCount = countAttendanceInRange(
      attendanceDates,
      startDate,
      endDate,
    )
    if (attendanceCount < BIWEEKLY_AUTO_MIGRATION_ATTENDANCE) {
      continue
    }

    const paidAmount = input.periodPaymentMap.get(periodId) ?? 0
    if (paidAmount >= input.rates['2-mingguan']) {
      continue
    }

    candidates.push({
      periodId,
      childId,
      note: migrationNote,
    })
  }

  return candidates
}

const applyAutomaticBiweeklyMigrations = async (input: {
  children: ChildRow[]
  periods: BillingPeriodRow[]
  transactions: BillingTransactionRow[]
  attendanceByChild: Map<string, string[]>
  rates: ServicePackageRates
}): Promise<void> => {
  const periodPaymentMap = buildPeriodPaymentMap(input.transactions)
  const candidates = resolveAutoMigrationCandidates({
    periods: input.periods,
    attendanceByChild: input.attendanceByChild,
    periodPaymentMap,
    rates: input.rates,
  })

  if (candidates.length === 0) {
    return
  }

  const connection = await dbPool.getConnection()
  try {
    await connection.beginTransaction()

    for (const candidate of candidates) {
      await connection.execute(
        `UPDATE service_billing_periods
        SET
          status = 'upgrade_confirmed',
          notes = CASE
            WHEN ? = '' THEN notes
            WHEN notes IS NULL OR notes = '' THEN ?
            WHEN notes LIKE CONCAT('%', ?, '%') THEN notes
            ELSE CONCAT(notes, ' | ', ?)
          END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          candidate.note,
          candidate.note,
          AUTO_MIGRATION_NOTE_MARKER,
          candidate.note,
          candidate.periodId,
        ],
      )

      await connection.execute(
        `UPDATE children
        SET
          service_package = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [servicePackageToDb.bulanan, candidate.childId],
      )
    }

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  const periodById = new Map<number, BillingPeriodRow>()
  for (const row of input.periods) {
    const key = Number(row.id ?? 0)
    if (Number.isFinite(key) && key > 0) {
      periodById.set(key, row)
    }
  }

  const childById = new Map<number, ChildRow>()
  for (const row of input.children) {
    const key = Number(row.id ?? 0)
    if (Number.isFinite(key) && key > 0) {
      childById.set(key, row)
    }
  }

  for (const candidate of candidates) {
    const periodRow = periodById.get(candidate.periodId)
    if (periodRow) {
      periodRow.status = 'upgrade_confirmed'
      periodRow.notes = appendNote(periodRow.notes, candidate.note)
    }

    const childRow = childById.get(candidate.childId)
    if (childRow) {
      childRow.service_package = servicePackageToDb.bulanan
    }
  }
}

const loadSnapshot = async (): Promise<BillingSnapshot> => {
  await ensureServiceBillingSchema(dbPool)

  const [goLiveDate, rates] = await Promise.all([
    getGoLiveDate(dbPool),
    getServicePackageRates(),
  ])

  const [childrenRows, periodRows, transactionRows, attendanceRows] = await Promise.all([
    dbPool.execute<ChildRow[]>(
      `SELECT
        id,
        full_name,
        service_package
      FROM children
      WHERE is_active = 1
      ORDER BY full_name ASC`,
    ),
    dbPool.execute<BillingPeriodRow[]>(
      `SELECT
        id,
        child_id,
        package_key,
        start_date,
        end_date,
        status,
        notes,
        created_at,
        updated_at
      FROM service_billing_periods
      ORDER BY start_date DESC, id DESC`,
    ),
    dbPool.execute<BillingTransactionRow[]>(
      `SELECT
        id,
        child_id,
        period_id,
        transaction_type,
        bucket,
        amount,
        notes,
        payment_proof_data_url,
        payment_proof_name,
        transacted_at,
        created_at,
        updated_at
      FROM service_billing_transactions
      ORDER BY transacted_at DESC, id DESC`,
    ),
    dbPool.execute<AttendanceRow[]>(
      `SELECT
        child_id,
        attendance_date
      FROM attendance_records
      WHERE attendance_date >= ?
      ORDER BY attendance_date ASC`,
      [goLiveDate],
    ),
  ])

  const rawChildren = childrenRows[0] ?? []
  const rawPeriods = periodRows[0] ?? []
  const rawTransactions = transactionRows[0] ?? []
  const rawAttendance = attendanceRows[0] ?? []

  const attendanceByChild = new Map<string, string[]>()
  for (const row of rawAttendance) {
    const childId = String(row.child_id)
    const dateKey = normalizeDateKey(row.attendance_date)
    const list = attendanceByChild.get(childId) ?? []
    if (list[list.length - 1] !== dateKey) {
      list.push(dateKey)
    }
    attendanceByChild.set(childId, list)
  }

  await applyAutomaticBiweeklyMigrations({
    children: rawChildren,
    periods: rawPeriods,
    transactions: rawTransactions,
    attendanceByChild,
    rates,
  })

  const children = rawChildren.map((row) => ({
    id: String(row.id),
    fullName: toText(row.full_name),
    currentServicePackage: mapDbServicePackage(row.service_package),
  }))

  const periods = rawPeriods.map<ServiceBillingPeriod>((row) => ({
    id: String(row.id),
    childId: String(row.child_id),
    packageKey: normalizePackageKey(row.package_key) ?? 'harian',
    startDate: normalizeDateKey(row.start_date),
    endDate: normalizeDateKey(row.end_date),
    status: normalizePeriodStatus(row.status),
    notes: toText(row.notes),
    attendanceCount: 0,
    dailyChargeDays: 0,
    dailyChargeAmount: 0,
    dueAmount: 0,
    paidAmount: 0,
    outstandingAmount: 0,
    overpaymentAmount: 0,
    isAutoMigratedToMonthly: false,
    migrationTopUpAmount: 0,
    needsUpgradeConfirmation: false,
    createdAt: toIsoDateTime(row.created_at),
    updatedAt: toIsoDateTime(row.updated_at),
  }))

  const transactions = rawTransactions.map<ServiceBillingTransaction>((row) => ({
    id: String(row.id),
    childId: String(row.child_id),
    periodId: row.period_id ? String(row.period_id) : '',
    transactionType: normalizeTransactionType(row.transaction_type),
    bucket: normalizeBucket(toText(row.bucket).toLowerCase()) ?? 'period',
    amount: toSafeAmount(Number(row.amount)),
    notes: toText(row.notes),
    paymentProofDataUrl: toOptionalPaymentProofDataUrl(row.payment_proof_data_url),
    paymentProofName: toOptionalPaymentProofName(row.payment_proof_name),
    transactedAt: toIsoDateTime(row.transacted_at),
    createdAt: toIsoDateTime(row.created_at),
    updatedAt: toIsoDateTime(row.updated_at),
  }))

  return {
    goLiveDate,
    rates,
    children,
    periods,
    transactions,
    attendanceByChild,
  }
}

interface EnrichedChildBilling {
  summary: ServiceBillingSummaryRow
  periods: ServiceBillingPeriod[]
  transactions: ServiceBillingTransaction[]
}

const computeChildBilling = (
  child: BillingSnapshot['children'][number],
  snapshot: BillingSnapshot,
  todayKey: string,
): EnrichedChildBilling => {
  const attendanceDates = snapshot.attendanceByChild.get(child.id) ?? []

  const childPeriods = snapshot.periods
    .filter((period) => period.childId === child.id)
    .slice()
    .sort((left, right) => left.startDate.localeCompare(right.startDate))

  const childTransactions = snapshot.transactions
    .filter((transaction) => transaction.childId === child.id)

  const periodMap = new Map<string, ServiceBillingPeriod>()
  const coveredAttendance = new Set<string>()

  for (const period of childPeriods) {
    const attendanceCount = countAttendanceInRange(
      attendanceDates,
      period.startDate,
      period.endDate,
    )

    for (const dateKey of attendanceDates) {
      if (isDateInRange(dateKey, period.startDate, period.endDate)) {
        coveredAttendance.add(dateKey)
      }
    }

    const paidAmount = childTransactions
      .filter(
        (transaction) =>
          transaction.bucket === 'period' &&
          transaction.periodId === period.id,
      )
      .reduce((total, transaction) => total + toSignedTransactionAmount(transaction), 0)

    const biweeklyBaseUnpaid =
      period.packageKey === '2-mingguan' &&
      paidAmount < snapshot.rates['2-mingguan']

    const shouldUseMonthlyDueForBiweekly =
      period.packageKey === '2-mingguan' &&
      attendanceCount >= BIWEEKLY_AUTO_MIGRATION_ATTENDANCE &&
      biweeklyBaseUnpaid

    const dailyChargeDays =
      period.packageKey === '2-mingguan' && !shouldUseMonthlyDueForBiweekly
        ? calculateBiweeklyDailyChargeDays(attendanceCount)
        : 0
    const dailyChargeAmount = dailyChargeDays * snapshot.rates.harian

    const dueAmount = calculatePeriodDue(
      period.packageKey,
      attendanceCount,
      snapshot.rates,
      shouldUseMonthlyDueForBiweekly,
    )

    const outstandingAmount = Math.max(0, dueAmount - paidAmount)
    const overpaymentAmount = Math.max(0, paidAmount - dueAmount)

    const isAutoMigratedToMonthly =
      period.packageKey === '2-mingguan' &&
      attendanceCount >= BIWEEKLY_AUTO_MIGRATION_ATTENDANCE &&
      (
        period.notes.includes(AUTO_MIGRATION_NOTE_MARKER) ||
        (period.status === 'upgrade_confirmed' && biweeklyBaseUnpaid)
      )

    const migrationTopUpAmount = isAutoMigratedToMonthly
      ? Math.max(0, dueAmount - paidAmount)
      : 0
    const needsUpgradeConfirmation = false

    let status = period.status
    if (todayKey > period.endDate && status === 'active') {
      status = 'completed'
    }

    periodMap.set(period.id, {
      ...period,
      status,
      attendanceCount,
      dailyChargeDays,
      dailyChargeAmount,
      dueAmount,
      paidAmount,
      outstandingAmount,
      overpaymentAmount,
      isAutoMigratedToMonthly,
      migrationTopUpAmount,
      needsUpgradeConfirmation,
    })
  }

  const normalizedPeriods = childPeriods
    .map((period) => periodMap.get(period.id) ?? period)
    .sort((left, right) => right.startDate.localeCompare(left.startDate))

  const currentPeriod = selectCurrentPeriod(normalizedPeriods, todayKey)

  const duePeriod = currentPeriod?.dueAmount ?? 0
  const paidPeriod = currentPeriod?.paidAmount ?? 0
  const outstandingPeriod = Math.max(0, duePeriod - paidPeriod)
  const overpaymentPeriod = Math.max(0, paidPeriod - duePeriod)

  const arrearsAttendanceDays = attendanceDates.filter((dateKey) => !coveredAttendance.has(dateKey)).length
  const dueArrears = arrearsAttendanceDays * snapshot.rates.harian

  const paidArrears = childTransactions
    .filter((transaction) => transaction.bucket === 'arrears')
    .reduce((total, transaction) => total + toSignedTransactionAmount(transaction), 0)

  const outstandingArrears = Math.max(0, dueArrears - paidArrears)
  const overpaymentArrears = Math.max(0, paidArrears - dueArrears)
  const totalOutstanding = outstandingPeriod + outstandingArrears
  const totalOverpayment = overpaymentPeriod + overpaymentArrears

  const needsUpgradeConfirmation = false
  const hasPaymentAlert = totalOutstanding > 0
  const paymentStatus: ServiceBillingPaymentStatus = hasPaymentAlert
    ? 'belum-bayar'
    : 'lunas'
  const paymentAlertMessage = hasPaymentAlert
    ? 'Tagihan layanan belum lunas. Mohon follow-up ke orang tua.'
    : 'Tagihan layanan sudah lunas.'

  const migrationInfo: ServiceBillingMigrationInfo | null = currentPeriod?.isAutoMigratedToMonthly
    ? {
      fromPackage: '2-mingguan',
      toPackage: 'bulanan',
      triggerAttendance: BIWEEKLY_AUTO_MIGRATION_ATTENDANCE,
      additionalAmount:
          currentPeriod.migrationTopUpAmount > 0
            ? currentPeriod.migrationTopUpAmount
            : BIWEEKLY_MIGRATION_SETTLEMENT_AMOUNT,
      notes: currentPeriod.notes,
    }
    : null

  const displayServicePackage: ServicePackageKey = migrationInfo
    ? 'bulanan'
    : child.currentServicePackage

  let status: ServiceBillingStatus = 'belum-periode'
  if (currentPeriod) {
    if (totalOutstanding > 0) {
      status = todayKey > currentPeriod.endDate ? 'periode-berakhir-menunggak' : 'aktif-menunggak'
    } else {
      status = 'aktif-lancar'
    }
  } else if (totalOutstanding > 0) {
    status = 'aktif-menunggak'
  }

  const lastPaymentAt = childTransactions
    .find(
      (transaction) =>
        (transaction.transactionType === 'period-start' || transaction.transactionType === 'payment') &&
        transaction.amount > 0,
    )?.transactedAt ?? ''

  const lastTransactionAt = childTransactions[0]?.transactedAt ?? ''

  return {
    summary: {
      childId: child.id,
      childName: child.fullName,
      currentServicePackage: child.currentServicePackage,
      displayServicePackage,
      goLiveDate: snapshot.goLiveDate,
      status,
      statusLabel: mapStatusLabel(status),
      activePeriod: currentPeriod ?? null,
      attendanceInActivePeriod: currentPeriod?.attendanceCount ?? 0,
      dailyChargeDays: currentPeriod?.dailyChargeDays ?? 0,
      dailyChargeAmount: currentPeriod?.dailyChargeAmount ?? 0,
      duePeriod,
      paidPeriod,
      outstandingPeriod,
      arrearsAttendanceDays,
      dueArrears,
      paidArrears,
      outstandingArrears,
      totalOutstanding,
      totalOverpayment,
      overpaymentPeriod,
      overpaymentArrears,
      paymentStatus,
      hasPaymentAlert,
      paymentAlertMessage,
      migrationInfo,
      needsUpgradeConfirmation,
      lastPaymentAt,
      lastTransactionAt,
    },
    periods: normalizedPeriods,
    transactions: childTransactions,
  }
}

const buildBillingSummary = (snapshot: BillingSnapshot): {
  rows: ServiceBillingSummaryRow[]
  periodByChild: Map<string, ServiceBillingPeriod[]>
  transactionByChild: Map<string, ServiceBillingTransaction[]>
} => {
  const todayKey = toDateKey(new Date())
  const rows: ServiceBillingSummaryRow[] = []
  const periodByChild = new Map<string, ServiceBillingPeriod[]>()
  const transactionByChild = new Map<string, ServiceBillingTransaction[]>()

  for (const child of snapshot.children) {
    const result = computeChildBilling(child, snapshot, todayKey)
    rows.push(result.summary)
    periodByChild.set(child.id, result.periods)
    transactionByChild.set(child.id, result.transactions)
  }

  rows.sort((left, right) => left.childName.localeCompare(right.childName, 'id-ID'))

  return {
    rows,
    periodByChild,
    transactionByChild,
  }
}

const assertChildExists = async (
  executor: SqlExecutor,
  childId: number,
): Promise<void> => {
  const [rows] = (await executor.execute(
    `SELECT id
    FROM children
    WHERE id = ?
    LIMIT 1`,
    [childId],
  )) as [RowDataPacket[], unknown]

  if (!rows[0]) {
    throw new ServiceBillingError(404, 'Data anak tidak ditemukan.')
  }
}

const assertNoPeriodOverlap = async (
  executor: SqlExecutor,
  input: {
    childId: number
    startDate: string
    endDate: string
  },
): Promise<void> => {
  const [rows] = (await executor.execute(
    `SELECT id
    FROM service_billing_periods
    WHERE child_id = ?
      AND NOT (end_date < ? OR start_date > ?)
    LIMIT 1`,
    [input.childId, input.startDate, input.endDate],
  )) as [RowDataPacket[], unknown]

  if (rows[0]) {
    throw new ServiceBillingError(
      409,
      'Periode layanan bertabrakan dengan periode yang sudah ada.',
    )
  }
}

const resolvePeriodForTransaction = async (
  executor: SqlExecutor,
  input: {
    childId: number
    periodId?: number | null
  },
): Promise<number> => {
  if (input.periodId && input.periodId > 0) {
    const [rows] = (await executor.execute(
      `SELECT id
      FROM service_billing_periods
      WHERE id = ?
        AND child_id = ?
      LIMIT 1`,
      [input.periodId, input.childId],
    )) as [RowDataPacket[], unknown]

    if (!rows[0]) {
      throw new ServiceBillingError(404, 'Periode layanan tidak ditemukan untuk anak ini.')
    }

    return input.periodId
  }

  const todayKey = toDateKey(new Date())
  const [activeRows] = (await executor.execute(
    `SELECT id
    FROM service_billing_periods
    WHERE child_id = ?
      AND start_date <= ?
      AND end_date >= ?
    ORDER BY start_date DESC
    LIMIT 1`,
    [input.childId, todayKey, todayKey],
  )) as [RowDataPacket[], unknown]

  if (activeRows[0]?.id) {
    return Number(activeRows[0].id)
  }

  const [lastRows] = (await executor.execute(
    `SELECT id
    FROM service_billing_periods
    WHERE child_id = ?
      AND start_date <= ?
    ORDER BY start_date DESC
    LIMIT 1`,
    [input.childId, todayKey],
  )) as [RowDataPacket[], unknown]

  const periodId = Number(lastRows[0]?.id ?? 0)
  if (!Number.isFinite(periodId) || periodId <= 0) {
    throw new ServiceBillingError(
      400,
      'Belum ada periode layanan aktif. Mulai periode terlebih dahulu.',
    )
  }

  return periodId
}

const getAttendanceCountForPeriod = async (
  executor: SqlExecutor,
  input: {
    childId: number
    startDate: string
    endDate: string
    goLiveDate: string
  },
): Promise<number> => {
  const effectiveStart = input.startDate >= input.goLiveDate ? input.startDate : input.goLiveDate

  if (effectiveStart > input.endDate) {
    return 0
  }

  const [rows] = (await executor.execute<CountRow[]>(
    `SELECT COUNT(*) AS total
    FROM attendance_records
    WHERE child_id = ?
      AND attendance_date BETWEEN ? AND ?`,
    [input.childId, effectiveStart, input.endDate],
  )) as [CountRow[], unknown]

  const total = Number(rows[0]?.total ?? 0)
  if (!Number.isFinite(total) || total < 0) {
    return 0
  }

  return Math.round(total)
}

export const getServiceBillingSummary = async (): Promise<ServiceBillingSummaryResponse> => {
  const snapshot = await loadSnapshot()
  const summary = buildBillingSummary(snapshot)

  return {
    goLiveDate: snapshot.goLiveDate,
    generatedAt: new Date().toISOString(),
    rates: snapshot.rates,
    rows: summary.rows,
  }
}

export const getServiceBillingHistory = async (
  childIdValue: string,
): Promise<ServiceBillingHistoryResponse> => {
  const childId = parseNumericId(childIdValue)
  if (!childId) {
    throw new ServiceBillingError(400, 'ID anak tidak valid.')
  }

  const snapshot = await loadSnapshot()
  const summary = buildBillingSummary(snapshot)

  const childIdKey = String(childId)
  const row = summary.rows.find((item) => item.childId === childIdKey) ?? null
  const periods = summary.periodByChild.get(childIdKey) ?? []
  const transactions = summary.transactionByChild.get(childIdKey) ?? []

  if (!row) {
    throw new ServiceBillingError(404, 'Data billing anak tidak ditemukan.')
  }

  return {
    goLiveDate: snapshot.goLiveDate,
    generatedAt: new Date().toISOString(),
    rates: snapshot.rates,
    summary: row,
    periods,
    transactions,
  }
}

export interface ServiceBillingPeriodInput {
  childId: string
  packageKey: ServicePackageKey
  startDate?: string
  amount?: number
  notes?: string
}

export interface ServiceBillingPaymentInput {
  childId: string
  amount: number
  bucket: ServiceBillingBucket
  periodId?: string
  notes?: string
  paymentProofDataUrl?: string
  paymentProofName?: string
}

export interface ServiceBillingRefundInput {
  childId: string
  amount: number
  bucket: ServiceBillingBucket
  periodId?: string
  notes?: string
}

export interface ServiceBillingConfirmUpgradeInput {
  childId: string
  periodId: string
  notes?: string
}

export const createServiceBillingPeriod = async (
  input: ServiceBillingPeriodInput,
): Promise<ServiceBillingHistoryResponse> => {
  const childId = parseNumericId(input.childId)
  if (!childId) {
    throw new ServiceBillingError(400, 'ID anak tidak valid.')
  }

  const packageKey = normalizePackageKey(input.packageKey)
  if (!packageKey) {
    throw new ServiceBillingError(400, 'Paket layanan tidak valid.')
  }

  const startDate = normalizeOptionalDateKey(input.startDate) ?? toDateKey(new Date())
  const durationDays = getBillingPeriodDurationDays(packageKey)
  const endDate = addDays(startDate, Math.max(0, durationDays - 1))
  const amount = toSafeAmount(input.amount)
  const notes = toText(input.notes).trim()

  const connection = await dbPool.getConnection()

  try {
    await connection.beginTransaction()
    await ensureServiceBillingSchema(connection)
    await assertChildExists(connection, childId)
    await assertNoPeriodOverlap(connection, {
      childId,
      startDate,
      endDate,
    })

    const [insertResult] = (await connection.execute(
      `INSERT INTO service_billing_periods (
        child_id,
        package_key,
        start_date,
        end_date,
        status,
        notes
      ) VALUES (?, ?, ?, ?, 'active', ?)`,
      [childId, packageKey, startDate, endDate, notes || null],
    )) as [RowDataPacket, unknown]

    const periodId = Number((insertResult as { insertId?: number }).insertId ?? 0)
    if (!Number.isFinite(periodId) || periodId <= 0) {
      throw new ServiceBillingError(500, 'Gagal membuat periode layanan baru.')
    }

    await connection.execute(
      `INSERT INTO service_billing_transactions (
        child_id,
        period_id,
        transaction_type,
        bucket,
        amount,
        notes
      ) VALUES (?, ?, 'PERIOD_START', 'PERIOD', ?, ?)`,
      [
        childId,
        periodId,
        amount,
        notes || 'Mulai periode layanan',
      ],
    )

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  return getServiceBillingHistory(String(childId))
}

export const createServiceBillingPayment = async (
  input: ServiceBillingPaymentInput,
): Promise<ServiceBillingHistoryResponse> => {
  const childId = parseNumericId(input.childId)
  if (!childId) {
    throw new ServiceBillingError(400, 'ID anak tidak valid.')
  }

  const amount = toSafeAmount(input.amount)
  if (amount <= 0) {
    throw new ServiceBillingError(400, 'Nominal pembayaran harus lebih dari 0.')
  }

  const bucket = normalizeBucket(input.bucket)
  if (!bucket) {
    throw new ServiceBillingError(400, 'Bucket pembayaran tidak valid.')
  }

  const periodIdInput = parseNumericId(input.periodId)
  const notes = toText(input.notes).trim()
  const paymentProofDataUrl = toOptionalPaymentProofDataUrl(input.paymentProofDataUrl)
  const paymentProofName = toOptionalPaymentProofName(input.paymentProofName)

  const connection = await dbPool.getConnection()

  try {
    await connection.beginTransaction()
    await ensureServiceBillingSchema(connection)
    await assertChildExists(connection, childId)

    const periodId =
      bucket === 'period'
        ? await resolvePeriodForTransaction(connection, {
          childId,
          periodId: periodIdInput || null,
        })
        : null

    await connection.execute(
      `INSERT INTO service_billing_transactions (
        child_id,
        period_id,
        transaction_type,
        bucket,
        amount,
        notes,
        payment_proof_data_url,
        payment_proof_name
      ) VALUES (?, ?, 'PAYMENT', ?, ?, ?, ?, ?)`,
      [
        childId,
        periodId,
        bucket.toUpperCase(),
        amount,
        notes || 'Pembayaran layanan',
        paymentProofDataUrl || null,
        paymentProofName || null,
      ],
    )

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  return getServiceBillingHistory(String(childId))
}

export const createServiceBillingRefund = async (
  input: ServiceBillingRefundInput,
): Promise<ServiceBillingHistoryResponse> => {
  const childId = parseNumericId(input.childId)
  if (!childId) {
    throw new ServiceBillingError(400, 'ID anak tidak valid.')
  }

  const amount = toSafeAmount(input.amount)
  if (amount <= 0) {
    throw new ServiceBillingError(400, 'Nominal refund harus lebih dari 0.')
  }

  const bucket = normalizeBucket(input.bucket)
  if (!bucket) {
    throw new ServiceBillingError(400, 'Bucket refund tidak valid.')
  }

  const periodIdInput = parseNumericId(input.periodId)
  const notes = toText(input.notes).trim()

  const connection = await dbPool.getConnection()

  try {
    await connection.beginTransaction()
    await ensureServiceBillingSchema(connection)
    await assertChildExists(connection, childId)

    const periodId =
      bucket === 'period'
        ? await resolvePeriodForTransaction(connection, {
          childId,
          periodId: periodIdInput || null,
        })
        : null

    await connection.execute(
      `INSERT INTO service_billing_transactions (
        child_id,
        period_id,
        transaction_type,
        bucket,
        amount,
        notes
      ) VALUES (?, ?, 'REFUND', ?, ?, ?)`,
      [
        childId,
        periodId,
        bucket.toUpperCase(),
        amount,
        notes || 'Refund manual',
      ],
    )

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  return getServiceBillingHistory(String(childId))
}

export const confirmServiceBillingUpgrade = async (
  input: ServiceBillingConfirmUpgradeInput,
): Promise<ServiceBillingHistoryResponse> => {
  const childId = parseNumericId(input.childId)
  const periodId = parseNumericId(input.periodId)

  if (!childId || !periodId) {
    throw new ServiceBillingError(400, 'ID anak/periode tidak valid.')
  }

  const notes = toText(input.notes).trim()

  const connection = await dbPool.getConnection()

  try {
    await connection.beginTransaction()
    await ensureServiceBillingSchema(connection)

    const [periodRows] = (await connection.execute(
      `SELECT
        id,
        child_id,
        package_key,
        start_date,
        end_date,
        status
      FROM service_billing_periods
      WHERE id = ?
      LIMIT 1
      FOR UPDATE`,
      [periodId],
    )) as [BillingPeriodRow[], unknown]

    const period = periodRows[0]
    if (!period) {
      throw new ServiceBillingError(404, 'Periode layanan tidak ditemukan.')
    }

    if (Number(period.child_id) !== childId) {
      throw new ServiceBillingError(400, 'Periode layanan tidak sesuai dengan anak yang dipilih.')
    }

    const packageKey = normalizePackageKey(period.package_key)
    if (packageKey !== '2-mingguan') {
      throw new ServiceBillingError(400, 'Konfirmasi upgrade hanya berlaku untuk paket 2 mingguan.')
    }

    const goLiveDate = await getGoLiveDate(connection)
    const attendanceCount = await getAttendanceCountForPeriod(connection, {
      childId,
      startDate: normalizeDateKey(period.start_date),
      endDate: normalizeDateKey(period.end_date),
      goLiveDate,
    })

    if (attendanceCount < BIWEEKLY_AUTO_MIGRATION_ATTENDANCE) {
      throw new ServiceBillingError(
        400,
        `Upgrade bulanan belum dapat dikonfirmasi karena kehadiran belum mencapai ${BIWEEKLY_AUTO_MIGRATION_ATTENDANCE} hari.`,
      )
    }

    await connection.execute(
      `UPDATE service_billing_periods
      SET
        status = 'upgrade_confirmed',
        notes = CASE
          WHEN ? = '' THEN notes
          WHEN notes IS NULL OR notes = '' THEN ?
          ELSE CONCAT(notes, ' | ', ?)
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [notes, notes, notes, periodId],
    )

    await connection.execute(
      `UPDATE children
      SET
        service_package = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [servicePackageToDb.bulanan, childId],
    )

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  return getServiceBillingHistory(String(childId))
}
