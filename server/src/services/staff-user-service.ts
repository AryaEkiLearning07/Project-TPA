import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { dbPool } from '../config/database.js'
import type { StaffUser, StaffUserInput } from '../types/auth.js'
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

const normalizeEmail = (value: string): string => value.trim().toLowerCase()

const hasEmailFormat = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

const mapStaffRow = (row: RowDataPacket): StaffUser => ({
  id: String(row.id),
  fullName: toText(row.full_name),
  email: toText(row.email),
  role: 'PETUGAS',
  isActive: parseBoolean(row.is_active),
  createdAt: toIsoDateTime(row.created_at),
  updatedAt: toIsoDateTime(row.updated_at),
})

const validateInput = (
  input: StaffUserInput,
  options: { isCreate: boolean },
): StaffUserInput => {
  const fullName = toText(input.fullName).trim()
  const email = normalizeEmail(toText(input.email))
  const password = toText(input.password)
  const isActive = Boolean(input.isActive)

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

  return {
    fullName,
    email,
    password,
    isActive,
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

  const [rows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT
      id,
      full_name,
      email,
      role,
      is_active,
      created_at,
      updated_at
    FROM users
    WHERE role IN ('PETUGAS', 'STAFF')
    ORDER BY created_at DESC`,
  )

  return rows.map(mapStaffRow)
}

export const createStaffUser = async (input: StaffUserInput): Promise<StaffUser> => {
  const validated = validateInput(input, { isCreate: true })
  const connection = await dbPool.getConnection()

  try {
    await connection.beginTransaction()
    await ensureAuthSchema(connection)
    await ensureUniqueEmail(connection, validated.email)
    const dbStaffRole = await resolveStaffDbRoleLabel(connection)

    const passwordHash = await hashPassword(validated.password)
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO users (
        full_name,
        email,
        password_hash,
        role,
        is_active
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        validated.fullName,
        validated.email,
        passwordHash,
        dbStaffRole,
        validated.isActive ? 1 : 0,
      ],
    )

    const staffId = Number(result.insertId)
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
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND role IN ('PETUGAS', 'STAFF')`,
        [
          validated.fullName,
          validated.email,
          passwordHash,
          validated.isActive ? 1 : 0,
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
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND role IN ('PETUGAS', 'STAFF')`,
        [validated.fullName, validated.email, validated.isActive ? 1 : 0, staffId],
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
