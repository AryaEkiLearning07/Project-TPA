import { createCipheriv, createHash, randomBytes } from 'node:crypto'
import type { RowDataPacket } from 'mysql2/promise'
import { dbPool } from '../config/database.js'
import { env } from '../config/env.js'
import { ensureAuthSchema } from './auth-service.js'
import { ensureParentRelationshipSchema } from './parent-relations-service.js'
import { ensureServiceRateSchema } from './service-rate-service.js'
import { ensureServiceBillingSchema } from './service-billing-service.js'
import { ensureStaffAttendanceSchema } from './staff-attendance-service.js'

const BACKUP_TABLES = [
  'children',
  'attendance_records',
  'incident_reports',
  'observation_records',
  'observation_items',
  'supply_inventory',
  'parent_profiles',
  'parent_accounts',
  'users',
  'activity_logs',
  'staff_daily_attendance',
  'service_package_rates',
  'service_billing_settings',
  'service_billing_periods',
  'service_billing_transactions',
] as const

const REDACTED_COLUMNS: Record<string, string[]> = {
  users: ['password_hash'],
  parent_accounts: ['password_hash'],
  activity_logs: ['ip_address', 'user_agent'],
}

const tableExists = async (tableName: string): Promise<boolean> => {
  const [rows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS count
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?`,
    [tableName],
  )

  return Number(rows[0]?.count ?? 0) > 0
}

const dumpTable = async (
  tableName: string,
): Promise<{ table: string; rows: RowDataPacket[] }> => {
  if (!(BACKUP_TABLES as readonly string[]).includes(tableName)) {
    throw new Error(`Tabel "${tableName}" tidak ada dalam daftar backup yang diizinkan.`)
  }

  const exists = await tableExists(tableName)
  if (!exists) {
    return { table: tableName, rows: [] }
  }

  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT * FROM \`${tableName}\``,
  )
  return { table: tableName, rows: rows ?? [] }
}

const sanitizeRowsForBackup = (
  tableName: string,
  rows: RowDataPacket[],
): Record<string, unknown>[] => {
  const redactedSet = new Set(
    (REDACTED_COLUMNS[tableName] ?? []).map((column) => column.toLowerCase()),
  )
  if (redactedSet.size === 0) {
    return rows.map((row) => ({ ...row }))
  }

  return rows.map((row) => {
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(row)) {
      if (redactedSet.has(key.toLowerCase())) {
        continue
      }
      sanitized[key] = value
    }
    return sanitized
  })
}

const readBackupKey = (): Buffer => {
  const rawKey = env.backup.encryptionKey.trim()
  if (!rawKey) {
    throw new Error('BACKUP_ENCRYPTION_KEY belum dikonfigurasi.')
  }
  if (rawKey.length < 16) {
    throw new Error('BACKUP_ENCRYPTION_KEY minimal 16 karakter.')
  }

  return createHash('sha256').update(rawKey).digest()
}

const encryptBackupPayload = (plaintext: string): {
  iv: string
  authTag: string
  cipherText: string
} => {
  const key = readBackupKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(plaintext, 'utf8')),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    cipherText: encrypted.toString('base64'),
  }
}

const toBackupTimestamp = (date: Date): string => {
  const yyyy = String(date.getUTCFullYear())
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const hh = String(date.getUTCHours()).padStart(2, '0')
  const mi = String(date.getUTCMinutes()).padStart(2, '0')
  const ss = String(date.getUTCSeconds()).padStart(2, '0')
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`
}

export interface DatabaseBackupPayload {
  generatedAt: string
  filename: string
  contentType: string
  content: Buffer
}

export const createDatabaseBackup = async (): Promise<DatabaseBackupPayload> => {
  await ensureParentRelationshipSchema(dbPool)
  await ensureAuthSchema(dbPool)
  await ensureStaffAttendanceSchema(dbPool)
  await ensureServiceRateSchema(dbPool)
  await ensureServiceBillingSchema(dbPool)

  const dumps = await Promise.all(BACKUP_TABLES.map((table) => dumpTable(table)))
  const generatedDate = new Date()
  const fileStamp = toBackupTimestamp(generatedDate)

  const data = dumps.reduce<Record<string, Record<string, unknown>[]>>((accumulator, dump) => {
    accumulator[dump.table] = sanitizeRowsForBackup(dump.table, dump.rows)
    return accumulator
  }, {})

  const payload = {
    generatedAt: generatedDate.toISOString(),
    schema: {
      database: process.env.DB_NAME ?? 'tpa_platform',
      tables: [...BACKUP_TABLES],
      redactedColumns: REDACTED_COLUMNS,
    },
    data,
  }
  const encryptedPayload = encryptBackupPayload(JSON.stringify(payload))
  const serializedArchive = JSON.stringify(
    {
      version: 1,
      algorithm: 'aes-256-gcm',
      generatedAt: payload.generatedAt,
      iv: encryptedPayload.iv,
      authTag: encryptedPayload.authTag,
      cipherText: encryptedPayload.cipherText,
    },
    null,
    2,
  )

  return {
    generatedAt: payload.generatedAt,
    filename: `backup-tpa-${fileStamp}.encrypted.json`,
    contentType: 'application/json; charset=utf-8',
    content: Buffer.from(serializedArchive, 'utf8'),
  }
}
