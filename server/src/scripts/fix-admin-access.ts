import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { dbPool } from '../config/database.js'
import { env } from '../config/env.js'
import { ensureAuthSchema } from '../services/auth-service.js'
import { hashPassword } from '../utils/password.js'

const normalizeEmail = (value: string): string => value.trim().toLowerCase()
const toText = (value: unknown): string => (typeof value === 'string' ? value : '')

const run = async (): Promise<void> => {
  await ensureAuthSchema(dbPool)

  const email = normalizeEmail(env.admin.email)
  const fullName = toText(env.admin.name).trim() || 'Admin'
  const passwordHash = await hashPassword(env.admin.password)

  const [existingRows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT id, role, is_active
    FROM users
    WHERE LOWER(email) = ?
    LIMIT 1`,
    [email],
  )

  let adminId = 0
  if (existingRows.length === 0) {
    const [inserted] = await dbPool.execute<ResultSetHeader>(
      `INSERT INTO users (
        full_name,
        email,
        password_hash,
        role,
        is_active
      ) VALUES (?, ?, ?, 'ADMIN', 1)`,
      [fullName, email, passwordHash],
    )
    adminId = Number(inserted.insertId)
    console.log(`Admin dibuat: ${email} (id=${adminId})`)
  } else {
    adminId = Number(existingRows[0].id)
    await dbPool.execute(
      `UPDATE users
      SET
        full_name = ?,
        password_hash = ?,
        role = 'ADMIN',
        is_active = 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [fullName, passwordHash, adminId],
    )
    console.log(`Admin diperbarui: ${email} (id=${adminId})`)
  }

  await dbPool.execute(
    `DELETE FROM auth_sessions
    WHERE LOWER(email) = ?
       OR (subject_id = ? AND subject_role IN ('ADMIN', 'SUPER_ADMIN', 'PETUGAS'))`,
    [email, adminId],
  )

  console.log('Sesi login lama admin/petugas terkait akun ini sudah dihapus.')
  console.log('Silakan login ulang dari browser.')
}

run()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Gagal memperbaiki akses admin: ${message}`)
    process.exit(1)
  })
  .finally(async () => {
    await dbPool.end()
  })
