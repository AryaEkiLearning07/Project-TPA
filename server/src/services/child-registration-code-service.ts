import { randomBytes } from 'node:crypto'
import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2/promise'
import { dbPool } from '../config/database.js'
import { ensureChildrenTable } from './child-service.js'
import { ensureAuthSchema } from './auth-service.js'
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

const hasColumn = async (
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

  return rows.length > 0
}

const hasIndex = async (
  executor: SqlExecutor,
  tableName: string,
  indexName: string,
): Promise<boolean> => {
  const [rows] = (await executor.execute(
    `SELECT 1
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND INDEX_NAME = ?
    LIMIT 1`,
    [tableName, indexName],
  )) as [RowDataPacket[], unknown]

  return rows.length > 0
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

const ensureGeneratedByAdminColumn = async (executor: SqlExecutor): Promise<void> => {
  const exists = await hasColumn(executor, 'child_registration_codes', 'generated_by_admin_id')
  if (exists) {
    return
  }

  await executor.execute(
    `ALTER TABLE child_registration_codes
    ADD COLUMN generated_by_admin_id BIGINT NULL
    AFTER claimed_by_parent_account_id`,
  )
}

const ensureGeneratedByAdminIndex = async (executor: SqlExecutor): Promise<void> => {
  const exists = await hasIndex(
    executor,
    'child_registration_codes',
    'idx_child_registration_codes_generated_admin',
  )
  if (exists) {
    return
  }

  await executor.execute(
    `ALTER TABLE child_registration_codes
    ADD INDEX idx_child_registration_codes_generated_admin (generated_by_admin_id)`,
  )
}

const ensureChildRegistrationCodeColumnTypes = async (
  executor: SqlExecutor,
): Promise<void> => {
  const childrenIdType = await resolveReferencedColumnType(
    executor,
    'children',
    'id',
    'BIGINT',
  )
  const parentAccountsIdType = await resolveReferencedColumnType(
    executor,
    'parent_accounts',
    'id',
    'BIGINT',
  )
  const usersIdType = await resolveReferencedColumnType(executor, 'users', 'id', 'BIGINT')

  await ensureColumnType(executor, {
    tableName: 'child_registration_codes',
    columnName: 'child_id',
    targetType: childrenIdType,
    nullable: false,
  })
  await ensureColumnType(executor, {
    tableName: 'child_registration_codes',
    columnName: 'claimed_by_parent_account_id',
    targetType: parentAccountsIdType,
    nullable: true,
  })
  await ensureColumnType(executor, {
    tableName: 'child_registration_codes',
    columnName: 'generated_by_admin_id',
    targetType: usersIdType,
    nullable: true,
  })
}

const reconcileChildRegistrationCodeReferences = async (
  executor: SqlExecutor,
): Promise<void> => {
  await executor.execute(
    `DELETE crc
    FROM child_registration_codes crc
    LEFT JOIN children c ON c.id = crc.child_id
    WHERE c.id IS NULL`,
  )

  await executor.execute(
    `UPDATE child_registration_codes crc
    LEFT JOIN parent_accounts pa ON pa.id = crc.claimed_by_parent_account_id
    SET
      crc.claimed_by_parent_account_id = NULL,
      crc.claimed_at = NULL,
      crc.status = CASE
        WHEN crc.status = 'CLAIMED' THEN 'REVOKED'
        ELSE crc.status
      END,
      crc.updated_at = CURRENT_TIMESTAMP
    WHERE crc.claimed_by_parent_account_id IS NOT NULL
      AND pa.id IS NULL`,
  )

  await executor.execute(
    `UPDATE child_registration_codes crc
    LEFT JOIN users u ON u.id = crc.generated_by_admin_id
    SET
      crc.generated_by_admin_id = NULL,
      crc.updated_at = CURRENT_TIMESTAMP
    WHERE crc.generated_by_admin_id IS NOT NULL
      AND u.id IS NULL`,
  )
}

const ensureChildRegistrationCodeForeignKeys = async (
  executor: SqlExecutor,
): Promise<void> => {
  const hasChildForeignKey = await hasForeignKeyOnColumn(
    executor,
    'child_registration_codes',
    'child_id',
  )
  if (!hasChildForeignKey) {
    await executor.execute(
      `ALTER TABLE child_registration_codes
      ADD CONSTRAINT fk_child_registration_codes_child
      FOREIGN KEY (child_id)
      REFERENCES children(id)
      ON UPDATE CASCADE
      ON DELETE CASCADE`,
    )
  }

  const hasClaimedAccountForeignKey = await hasForeignKeyOnColumn(
    executor,
    'child_registration_codes',
    'claimed_by_parent_account_id',
  )
  if (!hasClaimedAccountForeignKey) {
    await executor.execute(
      `ALTER TABLE child_registration_codes
      ADD CONSTRAINT fk_child_registration_codes_claimed_parent_account
      FOREIGN KEY (claimed_by_parent_account_id)
      REFERENCES parent_accounts(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL`,
    )
  }

  const hasGeneratedAdminForeignKey = await hasForeignKeyOnColumn(
    executor,
    'child_registration_codes',
    'generated_by_admin_id',
  )
  if (!hasGeneratedAdminForeignKey) {
    await executor.execute(
      `ALTER TABLE child_registration_codes
      ADD CONSTRAINT fk_child_registration_codes_generated_admin
      FOREIGN KEY (generated_by_admin_id)
      REFERENCES users(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL`,
    )
  }
}

const ensureChildRegistrationCodeTable = async (
  executor: SqlExecutor,
): Promise<void> => {
  await ensureAuthSchema(executor)
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
  await ensureGeneratedByAdminColumn(executor)
  await ensureChildRegistrationCodeColumnTypes(executor)
  await ensureGeneratedByAdminIndex(executor)
  await reconcileChildRegistrationCodeReferences(executor)
  await ensureChildRegistrationCodeForeignKeys(executor)
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
