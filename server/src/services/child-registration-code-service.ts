import { randomBytes } from 'node:crypto'
import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2/promise'
import { dbPool } from '../config/database.js'
import { ensureChildrenTable } from './child-service.js'
import {
  ensureParentRelationshipSchema,
  type SqlExecutor,
} from './parent-relations-service.js'

export type ChildRegistrationCodeStatus =
  | 'ACTIVE'
  | 'CLAIMED'
  | 'REVOKED'
  | 'EXPIRED'

export interface ChildRegistrationCodeRecord {
  id: string
  childId: string
  code: string
  status: ChildRegistrationCodeStatus
  expiresAt: string | null
  claimedAt: string | null
  claimedByParentAccountId: string | null
  createdAt: string
  updatedAt: string
}

export class ChildRegistrationCodeServiceError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ChildRegistrationCodeServiceError'
    this.status = status
  }
}

const toText = (value: unknown): string => (typeof value === 'string' ? value : '')

const toIsoDateTime = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') {
    return null
  }
  if (value instanceof Date) {
    return value.toISOString()
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

  return parsed.toISOString()
}

const normalizeStatus = (value: unknown): ChildRegistrationCodeStatus => {
  const normalized = toText(value).trim().toUpperCase()
  if (
    normalized === 'ACTIVE' ||
    normalized === 'CLAIMED' ||
    normalized === 'REVOKED' ||
    normalized === 'EXPIRED'
  ) {
    return normalized
  }
  return 'ACTIVE'
}

const parseChildId = (value: string): number => {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ChildRegistrationCodeServiceError(400, 'ID anak tidak valid.')
  }
  return parsed
}

const normalizeRegistrationCode = (value: string): string =>
  value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')

const mapCodeRow = (row: RowDataPacket): ChildRegistrationCodeRecord => ({
  id: String(row.id),
  childId: String(row.child_id),
  code: toText(row.code),
  status: normalizeStatus(row.status),
  expiresAt: toIsoDateTime(row.expires_at),
  claimedAt: toIsoDateTime(row.claimed_at),
  claimedByParentAccountId:
    row.claimed_by_parent_account_id === null || row.claimed_by_parent_account_id === undefined
      ? null
      : String(row.claimed_by_parent_account_id),
  createdAt: toIsoDateTime(row.created_at) ?? new Date().toISOString(),
  updatedAt: toIsoDateTime(row.updated_at) ?? new Date().toISOString(),
})

const ensureChildRegistrationCodeTable = async (
  executor: SqlExecutor,
): Promise<void> => {
  await ensureChildrenTable(executor)
  await ensureParentRelationshipSchema(executor)
  await executor.execute(
    `CREATE TABLE IF NOT EXISTS child_registration_codes (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      child_id BIGINT NOT NULL,
      code VARCHAR(32) NOT NULL,
      status ENUM('ACTIVE', 'CLAIMED', 'REVOKED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
      expires_at DATETIME NULL,
      claimed_at DATETIME NULL,
      claimed_by_parent_account_id BIGINT NULL,
      generated_by_admin_id BIGINT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_child_registration_codes_code (code),
      INDEX idx_child_registration_codes_child_status (child_id, status),
      INDEX idx_child_registration_codes_claimed_account (claimed_by_parent_account_id)
    )`,
  )
}

export const ensureChildRegistrationCodeSchema = async (
  executor: SqlExecutor = dbPool,
): Promise<void> => {
  await ensureChildRegistrationCodeTable(executor)
}

const getChildRowById = async (
  childId: number,
  executor: SqlExecutor,
): Promise<RowDataPacket | null> => {
  const [rows] = await executor.execute<RowDataPacket[]>(
    `SELECT
      id,
      full_name,
      parent_profile_id,
      is_active
    FROM children
    WHERE id = ?
    LIMIT 1`,
    [childId],
  )

  return rows[0] ?? null
}

const getCodeRowById = async (
  codeId: number,
  executor: SqlExecutor,
): Promise<ChildRegistrationCodeRecord | null> => {
  const [rows] = await executor.execute<RowDataPacket[]>(
    `SELECT
      id,
      child_id,
      code,
      status,
      expires_at,
      claimed_at,
      claimed_by_parent_account_id,
      created_at,
      updated_at
    FROM child_registration_codes
    WHERE id = ?
    LIMIT 1`,
    [codeId],
  )

  const row = rows[0]
  return row ? mapCodeRow(row) : null
}

const getCurrentCodeRowForChild = async (
  childId: number,
  executor: SqlExecutor,
): Promise<RowDataPacket | null> => {
  const [rows] = await executor.execute<RowDataPacket[]>(
    `SELECT
      id,
      child_id,
      code,
      status,
      expires_at,
      claimed_at,
      claimed_by_parent_account_id,
      created_at,
      updated_at
    FROM child_registration_codes
    WHERE child_id = ?
    ORDER BY
      CASE status
        WHEN 'ACTIVE' THEN 0
        WHEN 'CLAIMED' THEN 1
        WHEN 'REVOKED' THEN 2
        WHEN 'EXPIRED' THEN 3
        ELSE 4
      END,
      id DESC
    LIMIT 1`,
    [childId],
  )

  return rows[0] ?? null
}

export const getChildRegistrationCode = async (
  childIdValue: string,
  executor: SqlExecutor = dbPool,
): Promise<ChildRegistrationCodeRecord | null> => {
  await ensureChildRegistrationCodeSchema(executor)
  const childId = parseChildId(childIdValue)
  const row = await getCurrentCodeRowForChild(childId, executor)
  return row ? mapCodeRow(row) : null
}

const REGISTRATION_CODE_PREFIX = 'TPARC'
const REGISTRATION_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const REGISTRATION_CODE_SEGMENT_LENGTH = 4

const stylizeRegistrationCodeCharacters = (
  rawCharacters: string[],
  caseSeed: Uint8Array,
): string[] => {
  let hasLowercaseLetter = false

  const styled = rawCharacters.map((character, index) => {
    if (!/[A-Z]/.test(character)) {
      return character
    }

    if (caseSeed[index] % 2 === 0) {
      return character
    }

    hasLowercaseLetter = true
    return character.toLowerCase()
  })

  if (!hasLowercaseLetter) {
    const firstLetterIndex = styled.findIndex((character) => /[A-Z]/.test(character))
    if (firstLetterIndex >= 0) {
      styled[firstLetterIndex] = styled[firstLetterIndex].toLowerCase()
    }
  }

  return styled
}

const generateRegistrationCodeValue = (): string => {
  const rawBytes = randomBytes(REGISTRATION_CODE_SEGMENT_LENGTH * 2)
  const caseBytes = randomBytes(REGISTRATION_CODE_SEGMENT_LENGTH * 2)
  const rawCharacters: string[] = []

  for (const byte of rawBytes) {
    rawCharacters.push(
      REGISTRATION_CODE_ALPHABET[byte % REGISTRATION_CODE_ALPHABET.length],
    )
  }

  const styledCharacters = stylizeRegistrationCodeCharacters(rawCharacters, caseBytes)

  return `${REGISTRATION_CODE_PREFIX}-${styledCharacters
    .slice(0, REGISTRATION_CODE_SEGMENT_LENGTH)
    .join('')}-${styledCharacters.slice(REGISTRATION_CODE_SEGMENT_LENGTH).join('')}`
}

const createUniqueCodeValue = async (
  connection: PoolConnection,
): Promise<string> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const nextCode = generateRegistrationCodeValue()
    const [rows] = await connection.execute<RowDataPacket[]>(
      'SELECT id FROM child_registration_codes WHERE UPPER(code) = ? LIMIT 1',
      [nextCode.toUpperCase()],
    )
    if (rows.length === 0) {
      return nextCode
    }
  }

  throw new ChildRegistrationCodeServiceError(
    500,
    'Gagal membuat kode registrasi unik. Silakan coba lagi.',
  )
}

export const generateChildRegistrationCode = async (params: {
  childId: string
  generatedByAdminId?: string | null
}): Promise<ChildRegistrationCodeRecord> => {
  const childId = parseChildId(params.childId)
  const connection = await dbPool.getConnection()

  try {
    await connection.beginTransaction()
    await ensureChildRegistrationCodeSchema(connection)

    const childRow = await getChildRowById(childId, connection)
    if (!childRow || Number(childRow.is_active) === 0) {
      throw new ChildRegistrationCodeServiceError(404, 'Data anak tidak ditemukan.')
    }

    const existingRow = await getCurrentCodeRowForChild(childId, connection)
    if (existingRow) {
      await connection.commit()
      return mapCodeRow(existingRow)
    }

    const code = await createUniqueCodeValue(connection)
    const generatedByAdminId = Number.parseInt(params.generatedByAdminId ?? '', 10)
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO child_registration_codes (
        child_id,
        code,
        status,
        expires_at,
        generated_by_admin_id
      ) VALUES (?, ?, 'ACTIVE', NULL, ?)`,
      [
        childId,
        code,
        Number.isFinite(generatedByAdminId) && generatedByAdminId > 0
          ? generatedByAdminId
          : null,
      ],
    )

    const created = await getCodeRowById(Number(result.insertId), connection)
    if (!created) {
      throw new ChildRegistrationCodeServiceError(
        500,
        'Kode registrasi berhasil dibuat, tetapi data tidak dapat dimuat ulang.',
      )
    }

    await connection.commit()
    return created
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export interface ClaimChildRegistrationCodeParams {
  registrationCode: string
  parentAccountId: number
  parentProfileId: number
}

export interface ClaimChildRegistrationCodeResult {
  childId: string
  childName: string
  code: ChildRegistrationCodeRecord
}

const loadCodeRowByValueForUpdate = async (
  connection: PoolConnection,
  registrationCode: string,
): Promise<RowDataPacket | null> => {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT
      id,
      child_id,
      code,
      status,
      expires_at,
      claimed_at,
      claimed_by_parent_account_id,
      created_at,
      updated_at
    FROM child_registration_codes
    WHERE UPPER(code) = ?
    LIMIT 1
    FOR UPDATE`,
    [registrationCode.toUpperCase()],
  )

  return rows[0] ?? null
}

const assertClaimableCode = (
  row: RowDataPacket | null,
  parentAccountId: number,
): ChildRegistrationCodeRecord => {
  if (!row) {
    throw new ChildRegistrationCodeServiceError(404, 'Kode registrasi tidak ditemukan.')
  }

  const mapped = mapCodeRow(row)
  if (mapped.status === 'CLAIMED') {
    if (mapped.claimedByParentAccountId === String(parentAccountId)) {
      throw new ChildRegistrationCodeServiceError(
        409,
        'Anak ini sudah terhubung ke akun orang tua Anda.',
      )
    }
    throw new ChildRegistrationCodeServiceError(
      409,
      'Kode registrasi ini sudah digunakan oleh akun lain.',
    )
  }

  if (mapped.status !== 'ACTIVE') {
    throw new ChildRegistrationCodeServiceError(
      409,
      'Kode registrasi ini tidak aktif lagi.',
    )
  }

  if (mapped.expiresAt && new Date(mapped.expiresAt).getTime() <= Date.now()) {
    throw new ChildRegistrationCodeServiceError(
      409,
      'Kode registrasi ini sudah kedaluwarsa.',
    )
  }

  return mapped
}

const ensureChildCanBeClaimed = async (
  connection: PoolConnection,
  childId: number,
  parentAccountId: number,
): Promise<RowDataPacket> => {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT
      c.id,
      c.full_name,
      c.parent_profile_id,
      c.is_active,
      pa.id AS existing_parent_account_id
    FROM children c
    LEFT JOIN parent_accounts pa
      ON pa.parent_profile_id = c.parent_profile_id
    WHERE c.id = ?
    LIMIT 1
    FOR UPDATE`,
    [childId],
  )

  const row = rows[0]
  if (!row || Number(row.is_active) === 0) {
    throw new ChildRegistrationCodeServiceError(404, 'Data anak tidak ditemukan.')
  }

  const existingParentAccountId = Number(row.existing_parent_account_id)
  if (
    Number.isFinite(existingParentAccountId) &&
    existingParentAccountId > 0 &&
    existingParentAccountId !== parentAccountId
  ) {
    throw new ChildRegistrationCodeServiceError(
      409,
      'Anak ini sudah diklaim oleh akun orang tua lain.',
    )
  }

  return row
}

export const claimChildRegistrationCode = async (
  connection: PoolConnection,
  params: ClaimChildRegistrationCodeParams,
): Promise<ClaimChildRegistrationCodeResult> => {
  await ensureChildRegistrationCodeSchema(connection)

  const normalizedCode = normalizeRegistrationCode(params.registrationCode)
  if (!normalizedCode) {
    throw new ChildRegistrationCodeServiceError(400, 'Kode registrasi wajib diisi.')
  }

  const codeRow = await loadCodeRowByValueForUpdate(connection, normalizedCode)
  const code = assertClaimableCode(codeRow, params.parentAccountId)
  const childId = Number(code.childId)
  const childRow = await ensureChildCanBeClaimed(
    connection,
    childId,
    params.parentAccountId,
  )

  await connection.execute(
    `UPDATE children
    SET
      parent_profile_id = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`,
    [params.parentProfileId, childId],
  )

  await connection.execute(
    `UPDATE child_registration_codes
    SET
      status = 'CLAIMED',
      claimed_at = CURRENT_TIMESTAMP,
      claimed_by_parent_account_id = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`,
    [params.parentAccountId, Number(code.id)],
  )

  await connection.execute(
    `UPDATE child_registration_codes
    SET
      status = 'REVOKED',
      updated_at = CURRENT_TIMESTAMP
    WHERE child_id = ?
      AND id <> ?
      AND status = 'ACTIVE'`,
    [childId, Number(code.id)],
  )

  const claimedCode = await getCodeRowById(Number(code.id), connection)
  if (!claimedCode) {
    throw new ChildRegistrationCodeServiceError(
      500,
      'Kode registrasi berhasil diklaim, tetapi data tidak dapat dimuat ulang.',
    )
  }

  return {
    childId: String(childRow.id),
    childName: toText(childRow.full_name),
    code: claimedCode,
  }
}
