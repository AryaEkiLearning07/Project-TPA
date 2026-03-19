import { createHash, randomBytes } from 'node:crypto'
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise'
import { dbPool } from '../config/database.js'
import { env } from '../config/env.js'
import type {
  ActivityLogEntry,
  ActivityLogListResult,
  AuthSessionPayload,
  AuthUser,
  LoginInput,
  RequestMeta,
  UserRole,
} from '../types/auth.js'
import { verifyPassword, hashPassword, PasswordError } from '../utils/password.js'

type SqlExecutor = Pick<Pool, 'execute'> | Pick<PoolConnection, 'execute'>
type DbStaffRole = 'PETUGAS' | 'STAFF'
type DbUserRole = 'ADMIN' | 'SUPER_ADMIN' | 'PETUGAS' | 'STAFF'
const JAKARTA_UTC_OFFSET_MS = 7 * 60 * 60 * 1000
const ACTIVITY_LOG_BACKWARD_SHIFT_THRESHOLD_MS = 2 * 60 * 60 * 1000
const LOGIN_MAX_FAILED_ATTEMPTS = 5
const LOGIN_LOCKOUT_BASE_SECONDS = 60
const LOGIN_LOCKOUT_MAX_SECONDS = 60 * 60

const toText = (value: unknown): string => (typeof value === 'string' ? value : '')

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

const toIsoJakartaDateTime = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value !== 'string') {
    return new Date().toISOString()
  }

  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const withTimezone = /Z|[+-]\d{2}:\d{2}$/.test(normalized)
    ? normalized
    : `${normalized}+07:00`

  const parsed = new Date(withTimezone)
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString()
  }

  return parsed.toISOString()
}

const toUtcEpochMs = (value: unknown): number | null => {
  if (value instanceof Date) {
    const time = value.getTime()
    return Number.isNaN(time) ? null : time
  }
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const withTimezone = /Z|[+-]\d{2}:\d{2}$/.test(normalized)
    ? normalized
    : `${normalized}Z`
  const parsed = new Date(withTimezone)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.getTime()
}

const toDbDateTime = (value: Date): string => {
  const yyyy = String(value.getUTCFullYear())
  const mm = String(value.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(value.getUTCDate()).padStart(2, '0')
  const hh = String(value.getUTCHours()).padStart(2, '0')
  const mi = String(value.getUTCMinutes()).padStart(2, '0')
  const ss = String(value.getUTCSeconds()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}

const parseBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    return value === 1
  }
  if (typeof value === 'string') {
    return value === '1' || value.toLowerCase() === 'true'
  }
  return false
}

const normalizeEmail = (value: string): string => value.trim().toLowerCase()

const normalizeRole = (value: unknown): UserRole | null => {
  const normalized = toText(value).trim().toUpperCase()
  if (normalized === 'ADMIN' || normalized === 'SUPER_ADMIN') {
    return 'ADMIN'
  }
  if (normalized === 'PETUGAS' || normalized === 'STAFF') {
    return 'PETUGAS'
  }
  return null
}

const mapDbRoleToAppRole = (value: unknown): UserRole | null => {
  const normalized = toText(value).trim().toUpperCase() as DbUserRole
  if (normalized === 'ADMIN' || normalized === 'SUPER_ADMIN') {
    return 'ADMIN'
  }
  if (normalized === 'PETUGAS' || normalized === 'STAFF') {
    return 'PETUGAS'
  }
  return null
}

const nowPlusHours = (hours: number): Date => {
  const now = Date.now()
  return new Date(now + hours * 60 * 60 * 1000)
}

const hashSessionToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex')

const toSafeDetail = (value: unknown): string => {
  if (typeof value === 'string') {
    return value
  }
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

const toNonEmptyText = (value: unknown, fallback: string): string => {
  const normalized = toText(value).trim()
  return normalized.length > 0 ? normalized : fallback
}

const toRequestMeta = (meta?: RequestMeta): RequestMeta => ({
  ipAddress: meta?.ipAddress ?? null,
  userAgent: meta?.userAgent ?? null,
})

const mapActivityRow = (row: RowDataPacket): ActivityLogEntry => ({
  id: String(row.id),
  eventAt: toIsoJakartaDateTime(row.event_at),
  gmail: toText(row.gmail),
  role: toText(row.role),
  action: toText(row.action),
  target: toText(row.target),
  detail: toText(row.detail),
  status: toText(row.status),
})

const isSqlErrorWithCode = (error: unknown, code: string): boolean => {
  if (!error || typeof error !== 'object') {
    return false
  }

  return (error as { code?: unknown }).code === code
}

export class AuthServiceError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'AuthServiceError'
    this.status = status
  }
}

const ensureUsersTable = async (executor: SqlExecutor): Promise<void> => {
  console.log('ensureUsersTable...')
  await executor.execute(
    `CREATE TABLE IF NOT EXISTS users (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(160) NOT NULL,
      email VARCHAR(191) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('ADMIN', 'SUPER_ADMIN', 'PETUGAS', 'STAFF') NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_users_email (email),
      INDEX idx_users_role_active (role, is_active)
    )`,
  )
}

const ensureSessionsTable = async (executor: SqlExecutor): Promise<void> => {
  console.log('ensureSessionsTable...')
  await executor.execute(
    `CREATE TABLE IF NOT EXISTS auth_sessions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      session_token CHAR(64) NOT NULL,
      session_token_hash CHAR(64) NOT NULL,
      subject_role ENUM('ADMIN', 'SUPER_ADMIN', 'PETUGAS', 'ORANG_TUA') NOT NULL,
      subject_id BIGINT NOT NULL,
      email VARCHAR(191) NOT NULL,
      display_name VARCHAR(191) NOT NULL DEFAULT '',
      expires_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_auth_sessions_token (session_token),
      UNIQUE KEY uq_auth_sessions_token_hash (session_token_hash),
      INDEX idx_auth_sessions_expires (expires_at),
      INDEX idx_auth_sessions_subject (subject_role, subject_id)
    )`,
  )
}

const ensureSessionTokenHashColumn = async (executor: SqlExecutor): Promise<void> => {
  await executor.execute(
    `ALTER TABLE auth_sessions
    ADD COLUMN session_token_hash CHAR(64) NULL
    AFTER session_token`,
  ).catch((error) => {
    if (!isSqlErrorWithCode(error, 'ER_DUP_FIELDNAME')) {
      throw error
    }
  })

  await executor.execute(
    `UPDATE auth_sessions
    SET session_token_hash = SHA2(session_token, 256)
    WHERE session_token_hash IS NULL
      OR session_token_hash = ''`,
  )

  await executor.execute(
    `UPDATE auth_sessions
    SET session_token = session_token_hash
    WHERE session_token_hash IS NOT NULL
      AND session_token <> session_token_hash`,
  )

  await executor.execute(
    `ALTER TABLE auth_sessions
    MODIFY COLUMN session_token_hash CHAR(64) NOT NULL`,
  )

  await executor.execute(
    `ALTER TABLE auth_sessions
    ADD UNIQUE KEY uq_auth_sessions_token_hash (session_token_hash)`,
  ).catch((error) => {
    if (!isSqlErrorWithCode(error, 'ER_DUP_KEYNAME')) {
      throw error
    }
  })
}

const ensureLoginAttemptsTable = async (executor: SqlExecutor): Promise<void> => {
  console.log('ensureLoginAttemptsTable...')
  await executor.execute(
    `CREATE TABLE IF NOT EXISTS auth_login_attempts (
      email VARCHAR(191) NOT NULL PRIMARY KEY,
      failed_count INT NOT NULL DEFAULT 0,
      locked_until DATETIME NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_auth_login_attempts_locked_until (locked_until)
    )`,
  )
}

const ensureActivityLogsTable = async (executor: SqlExecutor): Promise<void> => {
  console.log('ensureActivityLogsTableReady...')
  await executor.execute(
    `CREATE TABLE IF NOT EXISTS activity_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      event_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      gmail VARCHAR(191) NOT NULL DEFAULT '',
      role VARCHAR(40) NOT NULL DEFAULT '',
      action VARCHAR(80) NOT NULL,
      target VARCHAR(191) NOT NULL,
      detail TEXT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'SUCCESS',
      ip_address VARCHAR(64) NULL,
      user_agent VARCHAR(255) NULL,
      INDEX idx_activity_logs_event (event_at),
      INDEX idx_activity_logs_role (role),
      INDEX idx_activity_logs_gmail (gmail)
    )`,
  )
}

let activityLogsTableReadyPromise: Promise<void> | null = null
let activityLogsTimezoneNormalizedPromise: Promise<void> | null = null
let loginAttemptsTableReadyPromise: Promise<void> | null = null

const normalizeActivityLogTimezones = async (executor: SqlExecutor): Promise<void> => {
  const [rows] = await executor.execute<RowDataPacket[]>(
    `SELECT
      id,
      event_at
    FROM activity_logs
    ORDER BY id ASC`,
  )

  if (rows.length <= 1) {
    return
  }

  const updates: Array<{ id: number; eventAt: string }> = []
  let previousEventAtMs: number | null = null

  for (const row of rows) {
    const rowId = Number(row.id)
    if (!Number.isFinite(rowId)) {
      continue
    }

    const rawEventAtMs = toUtcEpochMs(row.event_at)
    if (rawEventAtMs === null) {
      continue
    }

    let normalizedEventAtMs = rawEventAtMs
    if (
      previousEventAtMs !== null &&
      normalizedEventAtMs < previousEventAtMs - ACTIVITY_LOG_BACKWARD_SHIFT_THRESHOLD_MS
    ) {
      normalizedEventAtMs += JAKARTA_UTC_OFFSET_MS
    }

    if (normalizedEventAtMs !== rawEventAtMs) {
      updates.push({
        id: rowId,
        eventAt: toDbDateTime(new Date(normalizedEventAtMs)),
      })
    }

    previousEventAtMs = normalizedEventAtMs
  }

  for (const update of updates) {
    await executor.execute('UPDATE activity_logs SET event_at = ? WHERE id = ?', [
      update.eventAt,
      update.id,
    ])
  }
}

const ensureActivityLogsTimezoneNormalized = async (executor: SqlExecutor): Promise<void> => {
  if (!activityLogsTimezoneNormalizedPromise) {
    activityLogsTimezoneNormalizedPromise = normalizeActivityLogTimezones(executor).catch((error) => {
      activityLogsTimezoneNormalizedPromise = null
      throw error
    })
  }

  await activityLogsTimezoneNormalizedPromise
}

const ensureActivityLogsTableReady = async (executor: SqlExecutor): Promise<void> => {
  if (!activityLogsTableReadyPromise) {
    activityLogsTableReadyPromise = (async () => {
      await ensureActivityLogsTable(executor)
      await ensureActivityLogsTimezoneNormalized(executor)
    })().catch((error) => {
      activityLogsTableReadyPromise = null
      throw error
    })
  }

  await activityLogsTableReadyPromise
}

const ensureLoginAttemptsTableReady = async (executor: SqlExecutor): Promise<void> => {
  if (!loginAttemptsTableReadyPromise) {
    loginAttemptsTableReadyPromise = ensureLoginAttemptsTable(executor).catch((error) => {
      loginAttemptsTableReadyPromise = null
      throw error
    })
  }

  await loginAttemptsTableReadyPromise
}

let hasMigratedLegacyRoles = false
let hasEnsuredDefaultAdmin = false
let authSchemaReadyPromise: Promise<void> | null = null

const migrateLegacyRoles = async (executor: SqlExecutor): Promise<void> => {
  console.log('migrateLegacyRoles...')
  if (hasMigratedLegacyRoles) {
    return
  }

  await executor.execute(
    `ALTER TABLE users
    MODIFY COLUMN role ENUM('ADMIN', 'SUPER_ADMIN', 'PETUGAS', 'STAFF') NOT NULL`,
  )

  await executor.execute(
    `ALTER TABLE auth_sessions
    MODIFY COLUMN subject_role ENUM('ADMIN', 'SUPER_ADMIN', 'PETUGAS', 'ORANG_TUA') NOT NULL`,
  )

  await executor.execute(
    `UPDATE users
    SET role = 'ADMIN'
    WHERE role = 'SUPER_ADMIN'`,
  )

  await executor.execute(
    `UPDATE auth_sessions
    SET subject_role = 'ADMIN'
    WHERE subject_role = 'SUPER_ADMIN'`,
  )

  await executor.execute(
    `DELETE FROM auth_sessions
    WHERE subject_role = 'ORANG_TUA'`,
  )

  hasMigratedLegacyRoles = true
}

let cachedStaffDbRole: DbStaffRole | null = null

const readUsersRoleColumnType = async (executor: SqlExecutor): Promise<string> => {
  const [rows] = (await executor.execute(
    `SELECT COLUMN_TYPE AS column_type
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'role'
    LIMIT 1`,
  )) as [RowDataPacket[], unknown]

  return toText(rows[0]?.column_type).toLowerCase()
}

export const resolveStaffDbRoleLabel = async (
  executor: SqlExecutor,
): Promise<DbStaffRole> => {
  if (cachedStaffDbRole) {
    return cachedStaffDbRole
  }

  const columnType = await readUsersRoleColumnType(executor)
  if (columnType.includes("'petugas'")) {
    cachedStaffDbRole = 'PETUGAS'
    return cachedStaffDbRole
  }

  if (columnType.includes("'staff'")) {
    cachedStaffDbRole = 'STAFF'
    return cachedStaffDbRole
  }

  cachedStaffDbRole = 'PETUGAS'
  return cachedStaffDbRole
}

const ensureDefaultAdmin = async (executor: SqlExecutor): Promise<void> => {
  console.log('ensureDefaultAdmin...')
  if (hasEnsuredDefaultAdmin) {
    return
  }

  const allowProductionBootstrap =
    process.env.ENABLE_ADMIN_BOOTSTRAP_IN_PRODUCTION === 'true'
  if (env.nodeEnv === 'production' && !allowProductionBootstrap) {
    if (executor === dbPool) {
      hasEnsuredDefaultAdmin = true
    }
    return
  }

  const canCacheResult = executor === dbPool

  const adminEmail = normalizeEmail(env.admin.email)
  const adminName = toNonEmptyText(env.admin.name, 'Admin')
  if (!adminEmail || !env.admin.password.trim()) {
    if (canCacheResult) {
      hasEnsuredDefaultAdmin = true
    }
    return
  }

  let passwordHash = ''
  try {
    passwordHash = await hashPassword(env.admin.password)
  } catch (error) {
    if (error instanceof PasswordError) {
      throw new AuthServiceError(error.status, error.message)
    }
    throw error
  }

  const [rows] = (await executor.execute(
    `SELECT id
    FROM users
    WHERE LOWER(email) = ?
    LIMIT 1`,
    [adminEmail],
  )) as [RowDataPacket[], unknown]

  if (rows.length > 0) {
    const existingId = Number(rows[0].id)
    if (env.nodeEnv !== 'production') {
      await executor.execute(
        `UPDATE users
        SET
          full_name = ?,
          password_hash = ?,
          role = 'ADMIN',
          is_active = 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [adminName, passwordHash, existingId],
      )
    }
    if (canCacheResult) {
      hasEnsuredDefaultAdmin = true
    }
    return
  }

  await executor.execute(
    `INSERT INTO users (
      full_name,
      email,
      password_hash,
      role,
      is_active
    ) VALUES (?, ?, ?, 'ADMIN', 1)`,
    [adminName, adminEmail, passwordHash],
  )
  if (canCacheResult) {
    hasEnsuredDefaultAdmin = true
  }
}

export const ensureAuthSchema = async (executor: SqlExecutor): Promise<void> => {
  await ensureUsersTable(executor)
  await ensureSessionsTable(executor)
  await ensureSessionTokenHashColumn(executor)
  await ensureLoginAttemptsTableReady(executor)
  await ensureActivityLogsTableReady(executor)
  await migrateLegacyRoles(executor)
  await ensureDefaultAdmin(executor)
}

export const ensureAuthSchemaReady = async (): Promise<void> => {
  if (!authSchemaReadyPromise) {
    authSchemaReadyPromise = ensureAuthSchema(dbPool).catch((error) => {
      authSchemaReadyPromise = null
      throw error
    })
  }

  await authSchemaReadyPromise
}

export interface ActivityLogInput {
  gmail: string
  role: string
  action: string
  target: string
  detail?: string
  status?: string
  meta?: RequestMeta
}

export const writeActivityLog = async (
  executor: SqlExecutor,
  input: ActivityLogInput,
): Promise<void> => {
  await ensureActivityLogsTableReady(executor)

  const meta = toRequestMeta(input.meta)
  await executor.execute(
    `INSERT INTO activity_logs (
      event_at,
      gmail,
      role,
      action,
      target,
      detail,
      status,
      ip_address,
      user_agent
    ) VALUES (CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00'), ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      normalizeEmail(input.gmail),
      toNonEmptyText(input.role, 'UNKNOWN'),
      toNonEmptyText(input.action, 'UNKNOWN_ACTION'),
      toNonEmptyText(input.target, 'UNKNOWN_TARGET'),
      toSafeDetail(input.detail),
      toNonEmptyText(input.status, 'SUCCESS'),
      meta.ipAddress,
      meta.userAgent,
    ],
  )
}

const loadStaffUsersByEmail = async (email: string): Promise<RowDataPacket[]> => {
  const [rows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT
      id,
      full_name,
      email,
      role,
      is_active,
      password_hash
    FROM users
    WHERE LOWER(email) = ?
      AND role IN ('ADMIN', 'SUPER_ADMIN', 'PETUGAS', 'STAFF')`,
    [email],
  )

  return rows
}

export const revokeSessionsBySubject = async (
  params: { role: UserRole; subjectId: number },
  executor: SqlExecutor = dbPool,
): Promise<void> => {
  await executor.execute(
    `DELETE FROM auth_sessions
    WHERE subject_role = ?
      AND subject_id = ?`,
    [params.role, params.subjectId],
  )
}

const createSession = async (params: {
  role: UserRole
  subjectId: number
  email: string
  displayName: string
}): Promise<{ token: string; expiresAt: string }> => {
  const token = randomBytes(32).toString('hex')
  const tokenHash = hashSessionToken(token)
  const expiresDate = nowPlusHours(env.sessionHours)
  const expiresAt = toDbDateTime(expiresDate)

  await revokeSessionsBySubject({
    role: params.role,
    subjectId: params.subjectId,
  })

  await dbPool.execute(
    `INSERT INTO auth_sessions (
      session_token,
      session_token_hash,
      subject_role,
      subject_id,
      email,
      display_name,
      expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      tokenHash,
      tokenHash,
      params.role,
      params.subjectId,
      normalizeEmail(params.email),
      params.displayName,
      expiresAt,
    ],
  )

  return { token, expiresAt: expiresDate.toISOString() }
}

const assertEmailPassword = (input: LoginInput): {
  email: string
  password: string
} => {
  const email = normalizeEmail(input.email)
  const password = toText(input.password)

  if (!email) {
    throw new AuthServiceError(400, 'Email wajib diisi.')
  }
  if (!password.trim()) {
    throw new AuthServiceError(400, 'Password wajib diisi.')
  }

  return { email, password }
}

const mapAuthUser = (params: {
  id: number
  email: string
  role: UserRole
  displayName: string
}): AuthUser => ({
  id: String(params.id),
  email: normalizeEmail(params.email),
  role: params.role,
  displayName: params.displayName,
})

interface LoginAttemptState {
  failedCount: number
  lockedUntilMs: number | null
  retryAfterSeconds: number
  isLocked: boolean
}

const formatLoginLockoutMessage = (retryAfterSeconds: number): string =>
  `Terlalu banyak percobaan login gagal. Coba lagi dalam ${retryAfterSeconds} detik.`

const calculateLoginLockoutSeconds = (failedCount: number): number => {
  if (failedCount < LOGIN_MAX_FAILED_ATTEMPTS) {
    return 0
  }

  const stage = failedCount - LOGIN_MAX_FAILED_ATTEMPTS
  const duration = LOGIN_LOCKOUT_BASE_SECONDS * (2 ** stage)
  return Math.min(duration, LOGIN_LOCKOUT_MAX_SECONDS)
}

const mapLoginAttemptState = (row: RowDataPacket | null): LoginAttemptState => {
  if (!row) {
    return {
      failedCount: 0,
      lockedUntilMs: null,
      retryAfterSeconds: 0,
      isLocked: false,
    }
  }

  const failedCountRaw = Number(row.failed_count)
  const failedCount = Number.isFinite(failedCountRaw) ? Math.max(0, Math.trunc(failedCountRaw)) : 0
  const lockedUntilMs = row.locked_until === null ? null : toUtcEpochMs(row.locked_until)
  const nowMs = Date.now()
  const isLocked = lockedUntilMs !== null && lockedUntilMs > nowMs
  const retryAfterSeconds = isLocked
    ? Math.max(1, Math.ceil((lockedUntilMs - nowMs) / 1000))
    : 0

  return {
    failedCount,
    lockedUntilMs,
    retryAfterSeconds,
    isLocked,
  }
}

const readLoginAttemptState = async (email: string): Promise<LoginAttemptState> => {
  const [rows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT
      failed_count,
      locked_until
    FROM auth_login_attempts
    WHERE email = ?
    LIMIT 1`,
    [email],
  )

  return mapLoginAttemptState(rows[0] ?? null)
}

const assertLoginRateLimit = async (email: string): Promise<void> => {
  const loginAttemptState = await readLoginAttemptState(email)
  if (!loginAttemptState.isLocked) {
    return
  }

  throw new AuthServiceError(
    429,
    formatLoginLockoutMessage(loginAttemptState.retryAfterSeconds),
  )
}

const registerFailedLoginAttempt = async (email: string): Promise<LoginAttemptState> => {
  const currentState = await readLoginAttemptState(email)
  const nowMs = Date.now()
  const baseFailedCount = Math.max(0, currentState.failedCount)
  const nextFailedCount = Math.min(baseFailedCount + 1, 1000)
  const lockoutSeconds = calculateLoginLockoutSeconds(nextFailedCount)
  const shouldLock = lockoutSeconds > 0
  const lockedUntilMs = shouldLock ? nowMs + lockoutSeconds * 1000 : null
  const lockedUntilDb = lockedUntilMs === null ? null : toDbDateTime(new Date(lockedUntilMs))

  await dbPool.execute(
    `INSERT INTO auth_login_attempts (
      email,
      failed_count,
      locked_until
    ) VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE
      failed_count = VALUES(failed_count),
      locked_until = VALUES(locked_until)`,
    [email, nextFailedCount, lockedUntilDb],
  )

  return {
    failedCount: nextFailedCount,
    lockedUntilMs,
    retryAfterSeconds: lockoutSeconds,
    isLocked: shouldLock,
  }
}

const clearFailedLoginAttempts = async (email: string): Promise<void> => {
  await dbPool.execute('DELETE FROM auth_login_attempts WHERE email = ?', [email])
}

export const login = async (
  input: LoginInput,
  meta?: RequestMeta,
): Promise<AuthSessionPayload> => {
  await ensureAuthSchemaReady()

  const normalizedMeta = toRequestMeta(meta)
  const { email, password } = assertEmailPassword(input)
  let loginRoleForLog = 'UNKNOWN'

  try {
    await assertLoginRateLimit(email)

    const staffUsers = await loadStaffUsersByEmail(email)
    const sortedStaffUsers = [...staffUsers].sort((left, right) => {
      const leftRole = mapDbRoleToAppRole(left.role)
      const rightRole = mapDbRoleToAppRole(right.role)
      const leftPriority = leftRole === 'ADMIN' ? 0 : 1
      const rightPriority = rightRole === 'ADMIN' ? 0 : 1
      return leftPriority - rightPriority
    })

    for (const staffUser of sortedStaffUsers) {
      const role = mapDbRoleToAppRole(staffUser.role)
      if (role !== 'ADMIN' && role !== 'PETUGAS') {
        continue
      }

      const matched = await verifyPassword(password, toText(staffUser.password_hash))
      if (!matched) {
        continue
      }

      loginRoleForLog = role
      if (!parseBoolean(staffUser.is_active)) {
        throw new AuthServiceError(403, 'Akun non-aktif, silakan hubungi admin.')
      }

      const user = mapAuthUser({
        id: Number(staffUser.id),
        email: toText(staffUser.email),
        role,
        displayName: toText(staffUser.full_name) || 'Pengguna',
      })

      const session = await createSession({
        role,
        subjectId: Number(staffUser.id),
        email: user.email,
        displayName: user.displayName,
      })
      await clearFailedLoginAttempts(email)

      await writeActivityLog(dbPool, {
        gmail: user.email,
        role,
        action: 'LOGIN',
        target: 'auth',
        detail: 'Login berhasil',
        status: 'SUCCESS',
        meta: normalizedMeta,
      })

      return {
        token: session.token,
        expiresAt: session.expiresAt,
        user,
      }
    }

    throw new AuthServiceError(401, 'Email atau password salah.')
  } catch (error) {
    const normalizedError =
      error instanceof AuthServiceError
        ? error
        : error instanceof PasswordError
          ? new AuthServiceError(error.status, error.message)
          : error instanceof Error
            ? new AuthServiceError(500, error.message)
            : new AuthServiceError(500, 'Terjadi kesalahan server saat login.')

    let finalError = normalizedError
    if (normalizedError.status === 401) {
      const loginAttemptState = await registerFailedLoginAttempt(email)
      if (loginAttemptState.isLocked) {
        finalError = new AuthServiceError(
          429,
          formatLoginLockoutMessage(loginAttemptState.retryAfterSeconds),
        )
      }
    }

    await writeActivityLog(dbPool, {
      gmail: email,
      role: loginRoleForLog,
      action: 'LOGIN',
      target: 'auth',
      detail: finalError.message,
      status: 'FAILED',
      meta: normalizedMeta,
    })
    throw finalError
  }
}

export interface AuthContext {
  token: string
  user: AuthUser
  expiresAt: string
}

const loadSession = async (token: string): Promise<RowDataPacket | null> => {
  const tokenHash = hashSessionToken(token)
  const [rows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT
      session_token,
      session_token_hash,
      subject_role,
      subject_id,
      email,
      display_name,
      expires_at
    FROM auth_sessions
    WHERE session_token_hash = ?
    LIMIT 1`,
    [tokenHash],
  )
  return rows[0] ?? null
}

const loadActiveStaffUserById = async (
  subjectId: number,
): Promise<RowDataPacket | null> => {
  const [rows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT
      id,
      full_name,
      email,
      role,
      is_active
    FROM users
    WHERE id = ?
      AND role IN ('ADMIN', 'SUPER_ADMIN', 'PETUGAS', 'STAFF')
    LIMIT 1`,
    [subjectId],
  )

  const row = rows[0]
  if (!row || !parseBoolean(row.is_active)) {
    return null
  }

  return row
}

const syncSessionSnapshot = async (params: {
  token: string
  role: UserRole
  email: string
  displayName: string
}): Promise<void> => {
  const tokenHash = hashSessionToken(params.token)
  await dbPool.execute(
    `UPDATE auth_sessions
    SET
      subject_role = ?,
      email = ?,
      display_name = ?
    WHERE session_token_hash = ?`,
    [params.role, normalizeEmail(params.email), params.displayName, tokenHash],
  )
}

const deleteSessionByToken = async (
  token: string,
  executor: SqlExecutor = dbPool,
): Promise<void> => {
  const tokenHash = hashSessionToken(token)
  await executor.execute(
    `DELETE FROM auth_sessions
    WHERE session_token_hash = ?`,
    [tokenHash],
  )
}

export const resolveAuthContext = async (
  token: string,
): Promise<AuthContext | null> => {
  await ensureAuthSchemaReady()

  const normalizedToken = toText(token).trim()
  if (!normalizedToken) {
    return null
  }

  const session = await loadSession(normalizedToken)
  if (!session) {
    return null
  }

  const expiresAtIso = toIsoDateTime(session.expires_at)
  if (new Date(expiresAtIso).getTime() <= Date.now()) {
    await deleteSessionByToken(normalizedToken)
    return null
  }

  const sessionRole = normalizeRole(session.subject_role)
  if (!sessionRole) {
    return null
  }

  if (sessionRole === 'ADMIN' || sessionRole === 'PETUGAS') {
    const subjectId = Number(session.subject_id)
    if (!Number.isFinite(subjectId) || subjectId <= 0) {
      await deleteSessionByToken(normalizedToken)
      return null
    }

    const staffRow = await loadActiveStaffUserById(subjectId)
    if (!staffRow) {
      await deleteSessionByToken(normalizedToken)
      return null
    }

    const nextRole = mapDbRoleToAppRole(staffRow.role)
    if (nextRole !== 'ADMIN' && nextRole !== 'PETUGAS') {
      await deleteSessionByToken(normalizedToken)
      return null
    }

    const nextUser = mapAuthUser({
      id: Number(staffRow.id),
      email: toText(staffRow.email),
      role: nextRole,
      displayName: toText(staffRow.full_name) || 'Pengguna',
    })

    const sessionEmail = normalizeEmail(toText(session.email))
    const sessionDisplayName = toText(session.display_name)
    if (
      nextRole !== sessionRole ||
      nextUser.email !== sessionEmail ||
      nextUser.displayName !== sessionDisplayName
    ) {
      await syncSessionSnapshot({
        token: normalizedToken,
        role: nextRole,
        email: nextUser.email,
        displayName: nextUser.displayName,
      })
    }

    return {
      token: normalizedToken,
      expiresAt: expiresAtIso,
      user: nextUser,
    }
  }

  return null
}

export const logout = async (
  token: string,
  meta?: RequestMeta,
): Promise<void> => {
  await ensureAuthSchemaReady()

  const session = await resolveAuthContext(token)
  await deleteSessionByToken(token)

  if (session) {
    await writeActivityLog(dbPool, {
      gmail: session.user.email,
      role: session.user.role,
      action: 'LOGOUT',
      target: 'auth',
      detail: 'Logout berhasil',
      status: 'SUCCESS',
      meta,
    })
  }
}

export const listActivityLogs = async (options?: {
  limit?: number
  search?: string
  cursor?: string
  eventDate?: string
}): Promise<ActivityLogListResult> => {
  await ensureAuthSchemaReady()

  const rawLimit = Number(options?.limit ?? 200)
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), 1000)
    : 200
  const limitWithLookahead = limit + 1
  const search = toText(options?.search).trim().toLowerCase()
  const rawCursor = toText(options?.cursor).trim()
  const cursor = /^\d+$/.test(rawCursor) ? Number.parseInt(rawCursor, 10) : null
  const rawEventDate = toText(options?.eventDate).trim()
  const eventDate = /^\d{4}-\d{2}-\d{2}$/.test(rawEventDate) ? rawEventDate : ''

  const whereClauses: string[] = []
  const params: Array<string | number> = []

  if (search) {
    const wildcard = `%${search}%`
    whereClauses.push(`(
      LOWER(gmail) LIKE ?
      OR LOWER(role) LIKE ?
      OR LOWER(action) LIKE ?
      OR LOWER(target) LIKE ?
      OR LOWER(COALESCE(detail, '')) LIKE ?
      OR LOWER(status) LIKE ?
    )`)
    params.push(wildcard, wildcard, wildcard, wildcard, wildcard, wildcard)
  }

  if (cursor !== null) {
    whereClauses.push('id < ?')
    params.push(cursor)
  }

  if (eventDate) {
    whereClauses.push('DATE(event_at) = ?')
    params.push(eventDate)
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''
  const [rows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT
      id,
      event_at,
      gmail,
      role,
      action,
      target,
      detail,
      status
    FROM activity_logs
    ${whereSql}
    ORDER BY id DESC
    LIMIT ?`,
    [...params, limitWithLookahead],
  )

  const hasMore = rows.length > limit
  const entries = (hasMore ? rows.slice(0, limit) : rows).map(mapActivityRow)
  const nextCursor = hasMore && entries.length > 0 ? entries[entries.length - 1].id : null
  return { entries, hasMore, nextCursor }
}

export const parseBearerToken = (
  authorizationHeader: string | undefined,
): string | null => {
  if (!authorizationHeader) {
    return null
  }

  const [scheme, token] = authorizationHeader.split(' ')
  if (!scheme || !token) {
    return null
  }

  if (scheme.toLowerCase() !== 'bearer') {
    return null
  }

  return token.trim() || null
}
