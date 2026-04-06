import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { dbPool } from '../config/database.js'
import type {
  StaffRegistrationInput,
  StaffRegistrationRequest,
  StaffRegistrationRequestStatus,
  StaffUser,
  StaffUserInput,
} from '../types/auth.js'
import {
  ensureAuthSchema,
  AuthServiceError,
  revokeSessionsBySubject,
  resolveStaffDbRoleLabel,
} from './auth-service.js'
import { hashPassword, PasswordError } from '../utils/password.js'

const toText = (value: unknown): string => (typeof value === 'string' ? value : '')

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

const parseStaffId = (value: string): number | null => {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}

const parseRequestId = (value: string): number | null => {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}

const normalizeEmail = (value: string): string => value.trim().toLowerCase()

const hasEmailFormat = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/

const normalizeDateKey = (value: string): string => {
  const normalized = value.trim()
  if (!dateKeyPattern.test(normalized)) {
    throw new AuthServiceError(400, 'Tanggal masuk petugas tidak valid.')
  }

  const parsed = new Date(`${normalized}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new AuthServiceError(400, 'Tanggal masuk petugas tidak valid.')
  }

  const now = new Date()
  const todayDateKey = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
  if (normalized > todayDateKey) {
    throw new AuthServiceError(400, 'Tanggal masuk petugas tidak boleh melebihi hari ini.')
  }

  return normalized
}

type SqlExecutor = Pick<PoolConnection, 'execute'>
let ensureStaffRegistrationSchemaReadyPromise: Promise<void> | null = null
let hasEnsuredStaffJoinDateColumn = false
let hasEnsuredStaffProfileColumns = false

const ensureStaffRegistrationRequestsTable = async (
  executor: SqlExecutor,
): Promise<void> => {
  await executor.execute(
    `CREATE TABLE IF NOT EXISTS staff_registration_requests (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(160) NOT NULL,
      email VARCHAR(191) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
      requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      decided_at DATETIME NULL,
      decided_by_user_id BIGINT NULL,
      approved_user_id BIGINT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_staff_registration_requests_email (email),
      INDEX idx_staff_registration_requests_status (status),
      INDEX idx_staff_registration_requests_requested_at (requested_at)
    )`,
  )
}

export const ensureStaffRegistrationSchemaReady = async (
  executor: SqlExecutor = dbPool,
): Promise<void> => {
  if (executor !== dbPool) {
    await ensureStaffRegistrationRequestsTable(executor)
    return
  }

  if (!ensureStaffRegistrationSchemaReadyPromise) {
    ensureStaffRegistrationSchemaReadyPromise = ensureStaffRegistrationRequestsTable(dbPool).catch((error) => {
      ensureStaffRegistrationSchemaReadyPromise = null
      throw error
    })
  }

  await ensureStaffRegistrationSchemaReadyPromise
}

const hasUsersColumn = async (
  executor: SqlExecutor,
  columnName: string,
): Promise<boolean> => {
  const [rows] = (await executor.execute<RowDataPacket[]>(
    `SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = ?
    LIMIT 1`,
    [columnName],
  )) as [RowDataPacket[], unknown]

  return rows.length > 0
}

const ensureStaffJoinDateColumn = async (
  executor: SqlExecutor = dbPool,
): Promise<void> => {
  if (hasEnsuredStaffJoinDateColumn) {
    return
  }

  const hasColumn = await hasUsersColumn(executor, 'tanggal_masuk')
  if (!hasColumn) {
    await executor.execute(
      `ALTER TABLE users
      ADD COLUMN tanggal_masuk DATE NULL AFTER is_active`,
    )
  }

  await executor.execute(
    `UPDATE users
    SET tanggal_masuk = DATE(created_at)
    WHERE tanggal_masuk IS NULL
      AND role IN ('PETUGAS', 'STAFF')`,
  )

  hasEnsuredStaffJoinDateColumn = true
}

const ensureStaffProfileColumns = async (
  executor: SqlExecutor = dbPool,
): Promise<void> => {
  if (hasEnsuredStaffProfileColumns) {
    return
  }

  await ensureStaffJoinDateColumn(executor)

  const hasPhotoDataUrlColumn = await hasUsersColumn(executor, 'staff_photo_data_url')
  if (!hasPhotoDataUrlColumn) {
    await executor.execute(
      `ALTER TABLE users
      ADD COLUMN staff_photo_data_url LONGTEXT NULL AFTER tanggal_masuk`,
    )
  }

  const hasPhotoNameColumn = await hasUsersColumn(executor, 'staff_photo_name')
  if (!hasPhotoNameColumn) {
    await executor.execute(
      `ALTER TABLE users
      ADD COLUMN staff_photo_name VARCHAR(255) NULL AFTER staff_photo_data_url`,
    )
  }

  const hasDescriptionColumn = await hasUsersColumn(executor, 'staff_description')
  if (!hasDescriptionColumn) {
    await executor.execute(
      `ALTER TABLE users
      ADD COLUMN staff_description TEXT NULL AFTER staff_photo_name`,
    )
  }

  hasEnsuredStaffProfileColumns = true
}

const normalizeRegistrationRequestStatus = (
  value: unknown,
): StaffRegistrationRequestStatus => {
  const normalized = toText(value).trim().toUpperCase()
  if (normalized === 'APPROVED') {
    return 'APPROVED'
  }
  if (normalized === 'REJECTED') {
    return 'REJECTED'
  }
  return 'PENDING'
}

const mapStaffRow = (row: RowDataPacket): StaffUser => ({
  id: String(row.id),
  fullName: toText(row.full_name),
  email: toText(row.email),
  role: 'PETUGAS',
  isActive: parseBoolean(row.is_active),
  tanggalMasuk: toText(row.tanggal_masuk) || toIsoDateTime(row.created_at).slice(0, 10),
  photoDataUrl: toText(row.staff_photo_data_url),
  photoName: toText(row.staff_photo_name),
  description: toText(row.staff_description),
  createdAt: toIsoDateTime(row.created_at),
  updatedAt: toIsoDateTime(row.updated_at),
})

const mapStaffRegistrationRequestRow = (
  row: RowDataPacket,
): StaffRegistrationRequest => {
  const status = normalizeRegistrationRequestStatus(row.status)
  return {
    id: String(row.id),
    fullName: toText(row.full_name),
    email: toText(row.email),
    status,
    registeredAt: toIsoDateTime(row.requested_at),
    approvedAt:
      status === 'APPROVED' && row.decided_at
        ? toIsoDateTime(row.decided_at)
        : null,
    rejectedAt:
      status === 'REJECTED' && row.decided_at
        ? toIsoDateTime(row.decided_at)
        : null,
  }
}

const validateInput = (
  input: StaffUserInput,
  options: { isCreate: boolean },
): StaffUserInput => {
  const fullName = toText(input.fullName).trim()
  const email = normalizeEmail(toText(input.email))
  const password = toText(input.password)
  const isActive = Boolean(input.isActive)
  const tanggalMasukRaw = toText(input.tanggalMasuk).trim()
  const photoDataUrl = toText(input.photoDataUrl).trim()
  const photoName = toText(input.photoName).trim().slice(0, 255)
  const description = toText(input.description).trim()

  if (!fullName) {
    throw new AuthServiceError(400, 'Nama petugas wajib diisi.')
  }

  if (!email) {
    throw new AuthServiceError(400, 'Email petugas wajib diisi.')
  }

  if (!hasEmailFormat(email)) {
    throw new AuthServiceError(400, 'Format email petugas tidak valid.')
  }

  if (options.isCreate && password.trim().length === 0) {
    throw new AuthServiceError(400, 'Password petugas wajib diisi.')
  }

  if (!options.isCreate && password.trim().length > 0 && password.trim().length < 8) {
    throw new AuthServiceError(400, 'Password baru minimal 8 karakter.')
  }

  if (!tanggalMasukRaw) {
    throw new AuthServiceError(400, 'Tanggal masuk petugas wajib diisi.')
  }

  const tanggalMasuk = normalizeDateKey(tanggalMasukRaw)

  return {
    fullName,
    email,
    password,
    isActive,
    tanggalMasuk,
    photoDataUrl,
    photoName,
    description,
  }
}

const validateRegistrationInput = (
  input: StaffRegistrationInput,
): StaffRegistrationInput => {
  const fullName = toText(input.fullName).trim()
  const email = normalizeEmail(toText(input.email))
  const password = toText(input.password)

  if (!fullName) {
    throw new AuthServiceError(400, 'Nama lengkap petugas wajib diisi.')
  }

  if (!email) {
    throw new AuthServiceError(400, 'Email petugas wajib diisi.')
  }

  if (!hasEmailFormat(email)) {
    throw new AuthServiceError(400, 'Format email petugas tidak valid.')
  }

  if (password.trim().length < 8) {
    throw new AuthServiceError(400, 'Password petugas minimal 8 karakter.')
  }

  return {
    fullName,
    email,
    password,
  }
}

const ensureUniqueEmail = async (
  connection: PoolConnection,
  email: string,
  excludeId?: number,
): Promise<void> => {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT id
    FROM users
    WHERE email = ?
    LIMIT 1`,
    [email],
  )

  if (rows.length === 0) {
    return
  }

  const existingId = Number(rows[0].id)
  if (!excludeId || existingId !== excludeId) {
    throw new AuthServiceError(409, 'Email petugas sudah digunakan.')
  }
}

const loadStaffRegistrationRequestByEmailWithConnection = async (
  connection: PoolConnection,
  email: string,
): Promise<RowDataPacket | null> => {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT
      id,
      full_name,
      email,
      password_hash,
      status,
      requested_at,
      decided_at,
      decided_by_user_id,
      approved_user_id,
      created_at,
      updated_at
    FROM staff_registration_requests
    WHERE email = ?
    LIMIT 1`,
    [email],
  )

  return rows[0] ?? null
}

const loadStaffRegistrationRequestByIdWithConnection = async (
  connection: PoolConnection,
  requestId: number,
): Promise<RowDataPacket | null> => {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT
      id,
      full_name,
      email,
      password_hash,
      status,
      requested_at,
      decided_at,
      decided_by_user_id,
      approved_user_id,
      created_at,
      updated_at
    FROM staff_registration_requests
    WHERE id = ?
    LIMIT 1`,
    [requestId],
  )

  return rows[0] ?? null
}

const markRegistrationRequestApproved = async (
  connection: PoolConnection,
  params: {
    requestId: number
    adminUserId: number | null
    approvedStaffUserId: number
  },
): Promise<void> => {
  await connection.execute(
    `UPDATE staff_registration_requests
    SET
      status = 'APPROVED',
      decided_at = CURRENT_TIMESTAMP,
      decided_by_user_id = ?,
      approved_user_id = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`,
    [params.adminUserId, params.approvedStaffUserId, params.requestId],
  )
}

const markRegistrationRequestRejected = async (
  connection: PoolConnection,
  params: {
    requestId: number
    adminUserId: number | null
  },
): Promise<void> => {
  await connection.execute(
    `UPDATE staff_registration_requests
    SET
      status = 'REJECTED',
      decided_at = CURRENT_TIMESTAMP,
      decided_by_user_id = ?,
      approved_user_id = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`,
    [params.adminUserId, params.requestId],
  )
}

const getStaffByIdWithConnection = async (
  connection: PoolConnection,
  staffId: number,
): Promise<StaffUser | null> => {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT
      id,
      full_name,
      email,
      role,
      is_active,
      DATE_FORMAT(COALESCE(tanggal_masuk, DATE(created_at)), '%Y-%m-%d') AS tanggal_masuk,
      staff_photo_data_url,
      staff_photo_name,
      staff_description,
      created_at,
      updated_at
    FROM users
    WHERE id = ?
      AND role IN ('PETUGAS', 'STAFF')
    LIMIT 1`,
    [staffId],
  )

  const row = rows[0]
  return row ? mapStaffRow(row) : null
}

export const getStaffUsers = async (): Promise<StaffUser[]> => {
  await ensureAuthSchema(dbPool)
  await ensureStaffJoinDateColumn(dbPool)
  await ensureStaffProfileColumns(dbPool)

  const [rows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT
      id,
      full_name,
      email,
      role,
      is_active,
      DATE_FORMAT(COALESCE(tanggal_masuk, DATE(created_at)), '%Y-%m-%d') AS tanggal_masuk,
      staff_photo_data_url,
      staff_photo_name,
      staff_description,
      created_at,
      updated_at
    FROM users
    WHERE role IN ('PETUGAS', 'STAFF')
    ORDER BY COALESCE(tanggal_masuk, DATE(created_at)) DESC, created_at DESC`,
  )

  return rows.map(mapStaffRow)
}

export const registerStaffRequest = async (
  input: StaffRegistrationInput,
): Promise<StaffRegistrationRequest> => {
  const validated = validateRegistrationInput(input)
  const connection = await dbPool.getConnection()

  try {
    await connection.beginTransaction()
    await ensureAuthSchema(connection)
    await ensureStaffRegistrationSchemaReady(connection)
    await ensureStaffJoinDateColumn(connection)
    await ensureUniqueEmail(connection, validated.email)

    const existingRequest = await loadStaffRegistrationRequestByEmailWithConnection(
      connection,
      validated.email,
    )

    if (existingRequest) {
      const existingStatus = normalizeRegistrationRequestStatus(existingRequest.status)
      if (existingStatus === 'PENDING') {
        throw new AuthServiceError(
          409,
          'Pendaftaran petugas Anda masih menunggu persetujuan admin.',
        )
      }
      if (existingStatus === 'APPROVED') {
        throw new AuthServiceError(
          409,
          'Pendaftaran petugas sudah disetujui. Silakan login menggunakan akun Anda.',
        )
      }
    }

    const passwordHash = await hashPassword(validated.password)

    if (!existingRequest) {
      await connection.execute(
        `INSERT INTO staff_registration_requests (
          full_name,
          email,
          password_hash,
          status,
          requested_at,
          decided_at,
          decided_by_user_id,
          approved_user_id
        ) VALUES (?, ?, ?, 'PENDING', CURRENT_TIMESTAMP, NULL, NULL, NULL)`,
        [validated.fullName, validated.email, passwordHash],
      )
    } else {
      await connection.execute(
        `UPDATE staff_registration_requests
        SET
          full_name = ?,
          password_hash = ?,
          status = 'PENDING',
          requested_at = CURRENT_TIMESTAMP,
          decided_at = NULL,
          decided_by_user_id = NULL,
          approved_user_id = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [validated.fullName, passwordHash, Number(existingRequest.id)],
      )
    }

    const savedRequest = await loadStaffRegistrationRequestByEmailWithConnection(
      connection,
      validated.email,
    )
    if (!savedRequest) {
      throw new AuthServiceError(
        500,
        'Pendaftaran petugas berhasil disimpan, tetapi data tidak dapat dimuat ulang.',
      )
    }

    await connection.commit()
    return mapStaffRegistrationRequestRow(savedRequest)
  } catch (error) {
    await connection.rollback()
    if (error instanceof PasswordError) {
      throw new AuthServiceError(error.status, error.message)
    }
    throw error
  } finally {
    connection.release()
  }
}

export const getPendingStaffRegistrationRequests = async (): Promise<StaffRegistrationRequest[]> => {
  await ensureAuthSchema(dbPool)
  await ensureStaffRegistrationSchemaReady()

  const [rows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT
      id,
      full_name,
      email,
      status,
      requested_at,
      decided_at
    FROM staff_registration_requests
    WHERE status = 'PENDING'
    ORDER BY requested_at DESC`,
  )

  return rows.map(mapStaffRegistrationRequestRow)
}

export const loadStaffRegistrationRequestByEmail = async (
  email: string,
): Promise<{
  id: string
  email: string
  fullName: string
  passwordHash: string
  status: StaffRegistrationRequestStatus
} | null> => {
  await ensureStaffRegistrationSchemaReady()
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) {
    return null
  }

  const [rows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT
      id,
      full_name,
      email,
      password_hash,
      status
    FROM staff_registration_requests
    WHERE email = ?
    LIMIT 1`,
    [normalizedEmail],
  )

  const row = rows[0]
  if (!row) {
    return null
  }

  return {
    id: String(row.id),
    email: toText(row.email),
    fullName: toText(row.full_name),
    passwordHash: toText(row.password_hash),
    status: normalizeRegistrationRequestStatus(row.status),
  }
}

export const approveStaffRegistrationRequest = async (params: {
  requestId: string
  adminUserId: string | null
}): Promise<StaffUser> => {
  const parsedRequestId = parseRequestId(params.requestId)
  if (!parsedRequestId) {
    throw new AuthServiceError(400, 'ID permintaan petugas tidak valid.')
  }

  const adminUserId = params.adminUserId
    ? Number.parseInt(params.adminUserId, 10)
    : null

  const connection = await dbPool.getConnection()
  try {
    await connection.beginTransaction()
    await ensureAuthSchema(connection)
    await ensureStaffRegistrationSchemaReady(connection)
    await ensureStaffJoinDateColumn(connection)
    await ensureStaffProfileColumns(connection)

    const request = await loadStaffRegistrationRequestByIdWithConnection(
      connection,
      parsedRequestId,
    )
    if (!request) {
      throw new AuthServiceError(404, 'Permintaan petugas tidak ditemukan.')
    }

    const requestStatus = normalizeRegistrationRequestStatus(request.status)
    if (requestStatus !== 'PENDING') {
      throw new AuthServiceError(
        409,
        'Permintaan petugas sudah diproses sebelumnya.',
      )
    }

    const requestEmail = normalizeEmail(toText(request.email))
    await ensureUniqueEmail(connection, requestEmail)
    const dbStaffRole = await resolveStaffDbRoleLabel(connection)
    const [insertResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO users (
        full_name,
        email,
        password_hash,
        role,
        is_active,
        tanggal_masuk
      ) VALUES (?, ?, ?, ?, 1, CURDATE())`,
      [toText(request.full_name), requestEmail, toText(request.password_hash), dbStaffRole],
    )

    const createdStaffId = Number(insertResult.insertId)
    await markRegistrationRequestApproved(connection, {
      requestId: parsedRequestId,
      adminUserId:
        Number.isFinite(adminUserId) && (adminUserId ?? 0) > 0
          ? Number(adminUserId)
          : null,
      approvedStaffUserId: createdStaffId,
    })

    const createdStaff = await getStaffByIdWithConnection(connection, createdStaffId)
    if (!createdStaff) {
      throw new AuthServiceError(
        500,
        'Petugas berhasil disetujui, tetapi data tidak dapat dimuat ulang.',
      )
    }

    await connection.commit()
    return createdStaff
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export const rejectStaffRegistrationRequest = async (params: {
  requestId: string
  adminUserId: string | null
}): Promise<void> => {
  const parsedRequestId = parseRequestId(params.requestId)
  if (!parsedRequestId) {
    throw new AuthServiceError(400, 'ID permintaan petugas tidak valid.')
  }

  const adminUserId = params.adminUserId
    ? Number.parseInt(params.adminUserId, 10)
    : null

  const connection = await dbPool.getConnection()
  try {
    await connection.beginTransaction()
    await ensureAuthSchema(connection)
    await ensureStaffRegistrationSchemaReady(connection)

    const request = await loadStaffRegistrationRequestByIdWithConnection(
      connection,
      parsedRequestId,
    )
    if (!request) {
      throw new AuthServiceError(404, 'Permintaan petugas tidak ditemukan.')
    }

    const requestStatus = normalizeRegistrationRequestStatus(request.status)
    if (requestStatus !== 'PENDING') {
      throw new AuthServiceError(
        409,
        'Permintaan petugas sudah diproses sebelumnya.',
      )
    }

    await markRegistrationRequestRejected(connection, {
      requestId: parsedRequestId,
      adminUserId:
        Number.isFinite(adminUserId) && (adminUserId ?? 0) > 0
          ? Number(adminUserId)
          : null,
    })

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export const createStaffUser = async (input: StaffUserInput): Promise<StaffUser> => {
  const validated = validateInput(input, { isCreate: true })
  const connection = await dbPool.getConnection()

  try {
    await connection.beginTransaction()
    await ensureAuthSchema(connection)
    await ensureStaffRegistrationSchemaReady(connection)
    await ensureStaffJoinDateColumn(connection)
    await ensureStaffProfileColumns(connection)
    await ensureUniqueEmail(connection, validated.email)
    const dbStaffRole = await resolveStaffDbRoleLabel(connection)

    const passwordHash = await hashPassword(validated.password)
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO users (
        full_name,
        email,
        password_hash,
        role,
        is_active,
        tanggal_masuk,
        staff_photo_data_url,
        staff_photo_name,
        staff_description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        validated.fullName,
        validated.email,
        passwordHash,
        dbStaffRole,
        validated.isActive ? 1 : 0,
        validated.tanggalMasuk,
        validated.photoDataUrl || null,
        validated.photoName || null,
        validated.description,
      ],
    )

    const staffId = Number(result.insertId)
    await connection.execute(
      `UPDATE staff_registration_requests
      SET
        status = 'APPROVED',
        decided_at = CURRENT_TIMESTAMP,
        approved_user_id = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE email = ?
        AND status = 'PENDING'`,
      [staffId, validated.email],
    )

    const created = await getStaffByIdWithConnection(connection, staffId)
    if (!created) {
      throw new AuthServiceError(
        500,
        'Petugas berhasil dibuat, tetapi data tidak dapat dimuat ulang.',
      )
    }

    await connection.commit()
    return created
  } catch (error) {
    await connection.rollback()
    if (error instanceof PasswordError) {
      throw new AuthServiceError(error.status, error.message)
    }
    throw error
  } finally {
    connection.release()
  }
}

export const updateStaffUser = async (
  id: string,
  input: StaffUserInput,
): Promise<StaffUser> => {
  const staffId = parseStaffId(id)
  if (!staffId) {
    throw new AuthServiceError(400, 'ID petugas tidak valid.')
  }

  const validated = validateInput(input, { isCreate: false })
  const connection = await dbPool.getConnection()

  try {
    await connection.beginTransaction()
    await ensureAuthSchema(connection)
    await ensureStaffJoinDateColumn(connection)
    await ensureStaffProfileColumns(connection)

    const existing = await getStaffByIdWithConnection(connection, staffId)
    if (!existing) {
      throw new AuthServiceError(404, 'Petugas tidak ditemukan.')
    }

    await ensureUniqueEmail(connection, validated.email, staffId)

    const nextPassword = validated.password.trim()
    const shouldRevokeSessions =
      nextPassword.length > 0 ||
      !validated.isActive ||
      validated.email !== existing.email

    if (nextPassword.length > 0) {
      const passwordHash = await hashPassword(nextPassword)
      await connection.execute(
        `UPDATE users
        SET
          full_name = ?,
          email = ?,
          password_hash = ?,
          is_active = ?,
          tanggal_masuk = ?,
          staff_photo_data_url = ?,
          staff_photo_name = ?,
          staff_description = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND role IN ('PETUGAS', 'STAFF')`,
        [
          validated.fullName,
          validated.email,
          passwordHash,
          validated.isActive ? 1 : 0,
          validated.tanggalMasuk,
          validated.photoDataUrl || null,
          validated.photoName || null,
          validated.description,
          staffId,
        ],
      )
    } else {
      await connection.execute(
        `UPDATE users
        SET
          full_name = ?,
          email = ?,
          is_active = ?,
          tanggal_masuk = ?,
          staff_photo_data_url = ?,
          staff_photo_name = ?,
          staff_description = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND role IN ('PETUGAS', 'STAFF')`,
        [
          validated.fullName,
          validated.email,
          validated.isActive ? 1 : 0,
          validated.tanggalMasuk,
          validated.photoDataUrl || null,
          validated.photoName || null,
          validated.description,
          staffId,
        ],
      )
    }

    if (shouldRevokeSessions) {
      await revokeSessionsBySubject(
        { role: 'PETUGAS', subjectId: staffId },
        connection,
      )
    }

    const updated = await getStaffByIdWithConnection(connection, staffId)
    if (!updated) {
      throw new AuthServiceError(
        500,
        'Petugas berhasil diperbarui, tetapi data tidak dapat dimuat ulang.',
      )
    }

    await connection.commit()
    return updated
  } catch (error) {
    await connection.rollback()
    if (error instanceof PasswordError) {
      throw new AuthServiceError(error.status, error.message)
    }
    throw error
  } finally {
    connection.release()
  }
}

export const deleteStaffUser = async (id: string): Promise<void> => {
  const staffId = parseStaffId(id)
  if (!staffId) {
    throw new AuthServiceError(400, 'ID petugas tidak valid.')
  }

  const connection = await dbPool.getConnection()
  try {
    await connection.beginTransaction()
    await ensureAuthSchema(connection)
    await ensureStaffProfileColumns(connection)

    const existing = await getStaffByIdWithConnection(connection, staffId)
    if (!existing) {
      throw new AuthServiceError(404, 'Petugas tidak ditemukan.')
    }

    await connection.execute(
      `DELETE FROM users
      WHERE id = ?
        AND role IN ('PETUGAS', 'STAFF')`,
      [staffId],
    )
    await revokeSessionsBySubject(
      { role: 'PETUGAS', subjectId: staffId },
      connection,
    )

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
