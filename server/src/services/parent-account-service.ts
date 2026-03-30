import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2/promise'
import { dbPool } from '../config/database.js'
import {
  ensureParentRelationshipSchema,
  hasParentProfileIdentity,
  normalizeParentProfileInput,
  resolveParentProfileId,
} from './parent-relations-service.js'
import type {
  ParentAccount,
  ParentAccountChild,
  ParentAccountInput,
  ParentProfile,
} from '../types/parent-account.js'
import { hashPassword, PasswordError } from '../utils/password.js'

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

const parseAccountId = (value: string): number | null => {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}

const uniqueNumericChildIds = (childIds: string[]): number[] => {
  const unique = new Set<number>()
  for (const childId of childIds) {
    const parsed = Number.parseInt(String(childId), 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      unique.add(parsed)
    }
  }
  return [...unique]
}

const toInClausePlaceholders = (values: number[]): string =>
  values.map(() => '?').join(', ')

const profileFromRow = (row: RowDataPacket): ParentProfile => ({
  fatherName: toText(row.father_name),
  motherName: toText(row.mother_name),
  email: toText(row.email),
  whatsappNumber: toText(row.whatsapp_number),
  homePhone: toText(row.home_phone),
  otherPhone: toText(row.other_phone),
  homeAddress: toText(row.home_address),
  officeAddress: toText(row.office_address),
})

const mapParentAccounts = (rows: RowDataPacket[]): ParentAccount[] => {
  const accountMap = new Map<string, ParentAccount>()

  for (const row of rows) {
    const accountId = String(row.account_id)
    let account = accountMap.get(accountId)
    if (!account) {
      account = {
        id: accountId,
        createdAt: toIsoDateTime(row.account_created_at),
        updatedAt: toIsoDateTime(row.account_updated_at),
        username: toText(row.username),
        isActive: parseBoolean(row.is_active),
        parentProfile: profileFromRow(row),
        children: [],
      }
      accountMap.set(accountId, account)
    }

    if (row.child_id === null || row.child_id === undefined) {
      continue
    }

    const child: ParentAccountChild = {
      id: String(row.child_id),
      fullName: toText(row.child_full_name),
    }
    account.children.push(child)
  }

  return [...accountMap.values()]
}

const baseQuery = `
  SELECT
    pa.id AS account_id,
    pa.username,
    pa.is_active,
    pa.created_at AS account_created_at,
    pa.updated_at AS account_updated_at,
    pa.parent_profile_id,
    pp.father_name,
    pp.mother_name,
    pp.email,
    pp.whatsapp_number,
    pp.home_phone,
    pp.other_phone,
    pp.home_address,
    pp.office_address,
    c.id AS child_id,
    c.full_name AS child_full_name
  FROM parent_accounts pa
  JOIN parent_profiles pp ON pp.id = pa.parent_profile_id
  LEFT JOIN children c
    ON c.parent_profile_id = pp.id
    AND c.is_active = 1
`

const getAccountByIdWithConnection = async (
  connection: PoolConnection,
  accountId: number,
): Promise<ParentAccount | null> => {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `${baseQuery}
    WHERE pa.id = ?
    ORDER BY c.full_name ASC`,
    [accountId],
  )

  const accounts = mapParentAccounts(rows)
  return accounts[0] ?? null
}

const ensureUniqueUsername = async (
  connection: PoolConnection,
  username: string,
  excludeAccountId?: number,
): Promise<void> => {
  const [rows] = await connection.execute<RowDataPacket[]>(
    'SELECT id FROM parent_accounts WHERE username = ? LIMIT 1',
    [username],
  )

  if (rows.length === 0) {
    return
  }

  const existingId = Number(rows[0].id)
  if (!excludeAccountId || existingId !== excludeAccountId) {
    throw new ParentAccountServiceError(
      409,
      'Username sudah digunakan. Pilih username lain.',
    )
  }
}

const ensureSingleAccountPerParentProfile = async (
  connection: PoolConnection,
  parentProfileId: number,
  excludeAccountId?: number,
): Promise<void> => {
  const [rows] = await connection.execute<RowDataPacket[]>(
    'SELECT id FROM parent_accounts WHERE parent_profile_id = ? LIMIT 1',
    [parentProfileId],
  )

  if (rows.length === 0) {
    return
  }

  const existingId = Number(rows[0].id)
  if (!excludeAccountId || existingId !== excludeAccountId) {
    throw new ParentAccountServiceError(
      409,
      'Akun untuk pasangan orang tua ini sudah terdaftar.',
    )
  }
}

const ensureChildIdsExist = async (
  connection: PoolConnection,
  childIds: number[],
): Promise<void> => {
  const placeholders = toInClausePlaceholders(childIds)
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT id FROM children WHERE is_active = 1 AND id IN (${placeholders})`,
    childIds,
  )

  const foundIds = new Set<number>(
    rows
      .map((row) => Number(row.id))
      .filter((id) => Number.isFinite(id) && id > 0),
  )

  const missing = childIds.filter((id) => !foundIds.has(id))
  if (missing.length > 0) {
    throw new ParentAccountServiceError(
      400,
      `Data anak tidak ditemukan untuk ID: ${missing.join(', ')}`,
    )
  }
}

const cleanupOrphanProfile = async (
  connection: PoolConnection,
  profileId: number,
): Promise<void> => {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT
      (SELECT COUNT(*) FROM parent_accounts WHERE parent_profile_id = ?) AS account_count,
      (SELECT COUNT(*) FROM children WHERE parent_profile_id = ?) AS child_count`,
    [profileId, profileId],
  )

  const accountCount = Number(rows[0]?.account_count ?? 0)
  const childCount = Number(rows[0]?.child_count ?? 0)
  if (accountCount === 0 && childCount === 0) {
    await connection.execute('DELETE FROM parent_profiles WHERE id = ?', [profileId])
  }
}

const syncChildrenForProfile = async (
  connection: PoolConnection,
  profileId: number,
  childIds: number[],
): Promise<void> => {
  await ensureChildIdsExist(connection, childIds)
  const placeholders = toInClausePlaceholders(childIds)

  await connection.execute(
    `UPDATE children
    SET parent_profile_id = NULL
    WHERE parent_profile_id = ?
      AND id NOT IN (${placeholders})`,
    [profileId, ...childIds],
  )

  await connection.execute(
    `UPDATE children
    SET
      parent_profile_id = ?
    WHERE id IN (${placeholders})`,
    [
      profileId,
      ...childIds,
    ],
  )
}

const validateInput = (
  input: ParentAccountInput,
  options: { isCreate: boolean },
): {
  username: string
  password: string
  isActive: boolean
  childIds: number[]
  profile: ParentProfile
} => {
  const normalizedProfile = normalizeParentProfileInput({
    fatherName: input.parentProfile?.fatherName,
    motherName: input.parentProfile?.motherName,
    email: input.parentProfile?.email,
    whatsappNumber: input.parentProfile?.whatsappNumber,
    homePhone: input.parentProfile?.homePhone,
    otherPhone: input.parentProfile?.otherPhone,
    homeAddress: input.parentProfile?.homeAddress,
    officeAddress: input.parentProfile?.officeAddress,
  })

  if (!hasParentProfileIdentity(normalizedProfile)) {
    throw new ParentAccountServiceError(
      400,
      'Data orang tua tidak boleh kosong.',
    )
  }

  const profileEmail = normalizedProfile.email ?? ''
  if (!profileEmail) {
    throw new ParentAccountServiceError(
      400,
      'Email Gmail orang tua wajib diisi untuk login.',
    )
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileEmail)) {
    throw new ParentAccountServiceError(400, 'Format email orang tua tidak valid.')
  }

  if (!profileEmail.toLowerCase().endsWith('@gmail.com')) {
    throw new ParentAccountServiceError(
      400,
      'Akun orang tua harus menggunakan email Gmail (@gmail.com).',
    )
  }

  const usernameCandidate = toText(input.username).trim()
  const username = usernameCandidate || profileEmail
  if (!username) {
    throw new ParentAccountServiceError(400, 'Username wajib diisi.')
  }

  const password = toText(input.password)
  if (options.isCreate && password.trim().length === 0) {
    throw new ParentAccountServiceError(400, 'Password wajib diisi.')
  }

  const childIds = uniqueNumericChildIds(input.childIds)
  if (childIds.length === 0) {
    throw new ParentAccountServiceError(
      400,
      'Pilih minimal satu anak untuk akun orang tua.',
    )
  }

  return {
    username,
    password,
    isActive: Boolean(input.isActive),
    childIds,
    profile: {
      fatherName: normalizedProfile.fatherName,
      motherName: normalizedProfile.motherName,
      email: normalizedProfile.email ?? '',
      whatsappNumber: normalizedProfile.whatsappNumber ?? '',
      homePhone: normalizedProfile.homePhone ?? '',
      otherPhone: normalizedProfile.otherPhone ?? '',
      homeAddress: normalizedProfile.homeAddress ?? '',
      officeAddress: normalizedProfile.officeAddress ?? '',
    },
  }
}

const loadAccountMetaById = async (
  connection: PoolConnection,
  accountId: number,
): Promise<{ id: number; parentProfileId: number } | null> => {
  const [rows] = await connection.execute<RowDataPacket[]>(
    'SELECT id, parent_profile_id FROM parent_accounts WHERE id = ? LIMIT 1',
    [accountId],
  )

  const row = rows[0]
  if (!row) {
    return null
  }

  return {
    id: Number(row.id),
    parentProfileId: Number(row.parent_profile_id),
  }
}

export class ParentAccountServiceError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ParentAccountServiceError'
    this.status = status
  }
}

export const getParentAccounts = async (): Promise<ParentAccount[]> => {
  await ensureParentRelationshipSchema(dbPool)

  const [rows] = await dbPool.execute<RowDataPacket[]>(
    `${baseQuery}
    ORDER BY pa.created_at DESC, c.full_name ASC`,
  )

  return mapParentAccounts(rows)
}

export const createParentAccount = async (
  input: ParentAccountInput,
): Promise<ParentAccount> => {
  const connection = await dbPool.getConnection()

  try {
    await connection.beginTransaction()
    await ensureParentRelationshipSchema(connection)

    const validated = validateInput(input, { isCreate: true })
    const parentProfileId = await resolveParentProfileId(connection, validated.profile)
    if (!parentProfileId) {
      throw new ParentAccountServiceError(400, 'Data orang tua tidak valid.')
    }

    await ensureUniqueUsername(connection, validated.username)
    await ensureSingleAccountPerParentProfile(connection, parentProfileId)

    const passwordHash = await hashPassword(validated.password)

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO parent_accounts (
        parent_profile_id,
        username,
        password_hash,
        is_active
      ) VALUES (?, ?, ?, ?)`,
      [
        parentProfileId,
        validated.username,
        passwordHash,
        validated.isActive ? 1 : 0,
      ],
    )

    await connection.execute(
      `UPDATE parent_profiles
      SET
        father_name = ?,
        mother_name = ?,
        email = ?,
        whatsapp_number = ?,
        home_phone = ?,
        other_phone = ?,
        home_address = ?,
        office_address = ?
      WHERE id = ?`,
      [
        validated.profile.fatherName,
        validated.profile.motherName,
        validated.profile.email || null,
        validated.profile.whatsappNumber || null,
        validated.profile.homePhone || null,
        validated.profile.otherPhone || null,
        validated.profile.homeAddress || null,
        validated.profile.officeAddress || null,
        parentProfileId,
      ],
    )

    await syncChildrenForProfile(
      connection,
      parentProfileId,
      validated.childIds,
    )

    const accountId = Number(result.insertId)
    const createdAccount = await getAccountByIdWithConnection(connection, accountId)
    if (!createdAccount) {
      throw new ParentAccountServiceError(
        500,
        'Akun berhasil dibuat, tetapi data tidak dapat dimuat ulang.',
      )
    }

    await connection.commit()
    return createdAccount
  } catch (error) {
    if (error instanceof PasswordError) {
      throw new ParentAccountServiceError(error.status, error.message)
    }
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export const updateParentAccount = async (
  id: string,
  input: ParentAccountInput,
): Promise<ParentAccount> => {
  const accountId = parseAccountId(id)
  if (!accountId) {
    throw new ParentAccountServiceError(400, 'ID akun tidak valid.')
  }

  const connection = await dbPool.getConnection()

  try {
    await connection.beginTransaction()
    await ensureParentRelationshipSchema(connection)

    const existing = await loadAccountMetaById(connection, accountId)
    if (!existing) {
      throw new ParentAccountServiceError(404, 'Akun orang tua tidak ditemukan.')
    }

    const validated = validateInput(input, { isCreate: false })
    const nextProfileId = await resolveParentProfileId(connection, validated.profile)
    if (!nextProfileId) {
      throw new ParentAccountServiceError(400, 'Data orang tua tidak valid.')
    }

    await ensureUniqueUsername(connection, validated.username, accountId)
    await ensureSingleAccountPerParentProfile(connection, nextProfileId, accountId)

    const password = toText(validated.password).trim()
    if (password.length > 0) {
      const passwordHash = await hashPassword(password)
      await connection.execute(
        `UPDATE parent_accounts
        SET
          parent_profile_id = ?,
          username = ?,
          password_hash = ?,
          is_active = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          nextProfileId,
          validated.username,
          passwordHash,
          validated.isActive ? 1 : 0,
          accountId,
        ],
      )
    } else {
      await connection.execute(
        `UPDATE parent_accounts
        SET
          parent_profile_id = ?,
          username = ?,
          is_active = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [nextProfileId, validated.username, validated.isActive ? 1 : 0, accountId],
      )
    }

    await connection.execute(
      `UPDATE parent_profiles
      SET
        father_name = ?,
        mother_name = ?,
        email = ?,
        whatsapp_number = ?,
        home_phone = ?,
        other_phone = ?,
        home_address = ?,
        office_address = ?
      WHERE id = ?`,
      [
        validated.profile.fatherName,
        validated.profile.motherName,
        validated.profile.email || null,
        validated.profile.whatsappNumber || null,
        validated.profile.homePhone || null,
        validated.profile.otherPhone || null,
        validated.profile.homeAddress || null,
        validated.profile.officeAddress || null,
        nextProfileId,
      ],
    )

    await syncChildrenForProfile(
      connection,
      nextProfileId,
      validated.childIds,
    )

    await cleanupOrphanProfile(connection, existing.parentProfileId)

    const updatedAccount = await getAccountByIdWithConnection(connection, accountId)
    if (!updatedAccount) {
      throw new ParentAccountServiceError(
        500,
        'Akun berhasil diperbarui, tetapi data tidak dapat dimuat ulang.',
      )
    }

    await connection.commit()
    return updatedAccount
  } catch (error) {
    if (error instanceof PasswordError) {
      throw new ParentAccountServiceError(error.status, error.message)
    }
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export const deleteParentAccount = async (id: string): Promise<void> => {
  const accountId = parseAccountId(id)
  if (!accountId) {
    throw new ParentAccountServiceError(400, 'ID akun tidak valid.')
  }

  const connection = await dbPool.getConnection()

  try {
    await connection.beginTransaction()
    await ensureParentRelationshipSchema(connection)

    const existing = await loadAccountMetaById(connection, accountId)
    if (!existing) {
      throw new ParentAccountServiceError(404, 'Akun orang tua tidak ditemukan.')
    }

    await connection.execute('DELETE FROM parent_accounts WHERE id = ?', [accountId])
    await cleanupOrphanProfile(connection, existing.parentProfileId)

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
