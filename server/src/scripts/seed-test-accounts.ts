import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { dbPool } from '../config/database.js'
import {
  ensureAuthSchema,
  resolveStaffDbRoleLabel,
} from '../services/auth-service.js'
import { ensureParentRelationshipSchema } from '../services/parent-relations-service.js'
import { hashPassword } from '../utils/password.js'

const TEST_PASSWORD = 'Testing123!'

const TEST_ADMIN = {
  fullName: 'Admin Testing',
  email: 'testing.admin@gmail.com',
  role: 'ADMIN' as const,
}

const TEST_STAFF = {
  fullName: 'Petugas Testing',
  email: 'testing.staff@gmail.com',
}

const TEST_PARENT = {
  fatherName: 'Ayah Testing',
  motherName: 'Ibu Testing',
  email: 'testing.orangtua@gmail.com',
  username: 'testing.orangtua@gmail.com',
}

const normalizeEmail = (value: string): string => value.trim().toLowerCase()

const upsertStaffLikeUser = async (params: {
  fullName: string
  email: string
  role: 'ADMIN' | 'SUPER_ADMIN' | 'PETUGAS' | 'STAFF'
  passwordHash: string
}) => {
  const [rows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT id
    FROM users
    WHERE email = ?
    LIMIT 1`,
    [params.email],
  )

  const existing = rows[0]
  if (existing) {
    await dbPool.execute(
      `UPDATE users
      SET
        full_name = ?,
        password_hash = ?,
        role = ?,
        is_active = 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [params.fullName, params.passwordHash, params.role, Number(existing.id)],
    )
    return Number(existing.id)
  }

  const [result] = await dbPool.execute<ResultSetHeader>(
    `INSERT INTO users (
      full_name,
      email,
      password_hash,
      role,
      is_active
    ) VALUES (?, ?, ?, ?, 1)`,
    [params.fullName, params.email, params.passwordHash, params.role],
  )
  return Number(result.insertId)
}

const resolveParentProfileId = async (): Promise<number> => {
  const [rows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT id
    FROM parent_profiles
    WHERE email = ?
    LIMIT 1`,
    [normalizeEmail(TEST_PARENT.email)],
  )

  const existing = rows[0]
  if (existing) {
    const existingId = Number(existing.id)
    await dbPool.execute(
      `UPDATE parent_profiles
      SET
        father_name = ?,
        mother_name = ?,
        email = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        TEST_PARENT.fatherName,
        TEST_PARENT.motherName,
        normalizeEmail(TEST_PARENT.email),
        existingId,
      ],
    )
    return existingId
  }

  const [result] = await dbPool.execute<ResultSetHeader>(
    `INSERT INTO parent_profiles (
      father_name,
      mother_name,
      email
    ) VALUES (?, ?, ?)`,
    [
      TEST_PARENT.fatherName,
      TEST_PARENT.motherName,
      normalizeEmail(TEST_PARENT.email),
    ],
  )
  return Number(result.insertId)
}

const upsertParentAccount = async (passwordHash: string): Promise<number> => {
  const parentProfileId = await resolveParentProfileId()

  const [rows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT id
    FROM parent_accounts
    WHERE parent_profile_id = ?
    LIMIT 1`,
    [parentProfileId],
  )

  const existing = rows[0]
  if (existing) {
    const existingId = Number(existing.id)
    await dbPool.execute(
      `UPDATE parent_accounts
      SET
        username = ?,
        password_hash = ?,
        is_active = 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [TEST_PARENT.username, passwordHash, existingId],
    )
    return existingId
  }

  const [result] = await dbPool.execute<ResultSetHeader>(
    `INSERT INTO parent_accounts (
      parent_profile_id,
      username,
      password_hash,
      is_active
    ) VALUES (?, ?, ?, 1)`,
    [parentProfileId, TEST_PARENT.username, passwordHash],
  )
  return Number(result.insertId)
}

const run = async () => {
  await ensureParentRelationshipSchema(dbPool)
  await ensureAuthSchema(dbPool)

  const passwordHash = await hashPassword(TEST_PASSWORD)
  const dbStaffRole = await resolveStaffDbRoleLabel(dbPool)

  const adminId = await upsertStaffLikeUser({
    ...TEST_ADMIN,
    email: normalizeEmail(TEST_ADMIN.email),
    passwordHash,
  })

  const staffId = await upsertStaffLikeUser({
    fullName: TEST_STAFF.fullName,
    email: normalizeEmail(TEST_STAFF.email),
    role: dbStaffRole,
    passwordHash,
  })

  const parentId = await upsertParentAccount(passwordHash)

  console.log('Seed akun testing selesai.')
  console.log(`ADMIN: ${TEST_ADMIN.email} / ${TEST_PASSWORD} (id=${adminId})`)
  console.log(`PETUGAS: ${TEST_STAFF.email} / ${TEST_PASSWORD} (id=${staffId})`)
  console.log(`PARENT_ACCOUNT: ${TEST_PARENT.email} / ${TEST_PASSWORD} (id=${parentId})`)
}

run()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Gagal seed akun testing: ${message}`)
    process.exit(1)
  })
  .finally(async () => {
    await dbPool.end()
  })
