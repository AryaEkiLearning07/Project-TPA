import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const moduleDir = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(moduleDir, '../../.env')
dotenv.config({ path: envPath, override: true })

const asNumber = (name: string, fallback: number): number => {
  const raw = process.env[name]
  if (!raw) {
    return fallback
  }

  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number in environment variable ${name}: ${raw}`)
  }

  return parsed
}

const asBoolean = (name: string, fallback: boolean): boolean => {
  const raw = process.env[name]
  if (!raw) {
    return fallback
  }

  const normalized = raw.trim().toLowerCase()
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') {
    return true
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no') {
    return false
  }

  return fallback
}

const asString = (name: string, fallback: string): string => {
  const raw = process.env[name]
  return raw && raw.length > 0 ? raw : fallback
}

const asOptionalString = (name: string): string | null => {
  const raw = process.env[name]
  if (!raw) {
    return null
  }

  const normalized = raw.trim()
  return normalized.length > 0 ? normalized : null
}

const asStringArray = (name: string, fallback: string[]): string[] => {
  const raw = process.env[name]
  if (!raw) {
    return fallback
  }

  const parsed = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  return parsed.length > 0 ? parsed : fallback
}

const asCookieSameSite = (name: string, fallback: 'lax' | 'strict' | 'none'): 'lax' | 'strict' | 'none' => {
  const raw = process.env[name]
  if (!raw) {
    return fallback
  }

  const normalized = raw.trim().toLowerCase()
  if (normalized === 'lax' || normalized === 'strict' || normalized === 'none') {
    return normalized
  }

  return fallback
}

const asTrustProxy = (
  name: string,
  fallback: boolean | number,
): boolean | number => {
  const raw = process.env[name]
  if (!raw) {
    return fallback
  }

  const normalized = raw.trim().toLowerCase()
  if (normalized === 'true') {
    return true
  }
  if (normalized === 'false') {
    return false
  }

  const parsedNumber = Number.parseInt(raw, 10)
  if (Number.isFinite(parsedNumber) && parsedNumber >= 0) {
    return parsedNumber
  }

  return fallback
}

const nodeEnv = asString('NODE_ENV', 'development')

const parsedEnv = {
  nodeEnv,
  port: asNumber('PORT', 4000),
  corsOrigins: asStringArray('CORS_ORIGIN', ['http://localhost:5173']),
  sessionHours: asNumber('SESSION_HOURS', 12),
  authCookie: {
    name: asString('AUTH_COOKIE_NAME', 'tpa_session'),
    sameSite: asCookieSameSite('AUTH_COOKIE_SAMESITE', 'lax'),
    secure: asBoolean('AUTH_COOKIE_SECURE', nodeEnv === 'production'),
    domain: asOptionalString('AUTH_COOKIE_DOMAIN'),
  },
  admin: {
    name: asString(
      'ADMIN_NAME',
      asString('SUPER_ADMIN_NAME', 'Admin'),
    ),
    email: asString(
      'ADMIN_EMAIL',
      asString(
        'SUPER_ADMIN_EMAIL',
        nodeEnv === 'production' ? '' : 'admin@gmail.com',
      ),
    ),
    password: asString(
      'ADMIN_PASSWORD',
      asString(
        'SUPER_ADMIN_PASSWORD',
        nodeEnv === 'production' ? '' : '12345678',
      ),
    ),
  },
  backup: {
    encryptionKey: asString(
      'BACKUP_ENCRYPTION_KEY',
      nodeEnv === 'production'
        ? ''
        : 'dev-only-backup-key-change-this',
    ),
  },
  security: {
    cspEnabled: asBoolean('SECURITY_CSP_ENABLED', true),
    trustProxy: asTrustProxy('TRUST_PROXY', nodeEnv === 'production' ? 1 : false),
    globalRateLimitWindowMs: asNumber('GLOBAL_RATE_LIMIT_WINDOW_MS', 60_000),
    globalRateLimitMax: asNumber('GLOBAL_RATE_LIMIT_MAX', 120),
    loginRateLimitWindowMs: asNumber('LOGIN_RATE_LIMIT_WINDOW_MS', 60_000),
    loginRateLimitMax: asNumber('LOGIN_RATE_LIMIT_MAX', 8),
    loginRateLimitBlockMs: asNumber('LOGIN_RATE_LIMIT_BLOCK_MS', 5 * 60_000),
    defaultBodyLimitBytes: asNumber('DEFAULT_BODY_LIMIT_BYTES', 2 * 1024 * 1024),
    uploadBodyLimitBytes: asNumber('UPLOAD_BODY_LIMIT_BYTES', 30 * 1024 * 1024),
  },
  db: {
    host: asString('DB_HOST', '127.0.0.1'),
    port: asNumber('DB_PORT', 3306),
    user: asString('DB_USER', nodeEnv === 'production' ? '' : 'root'),
    password: process.env.DB_PASSWORD ?? '',
    name: asString('DB_NAME', 'db_TPA'),
    connectionLimit: asNumber('DB_CONNECTION_LIMIT', 10),
  },
} as const

if (parsedEnv.nodeEnv === 'production') {
  const dbUser = parsedEnv.db.user.trim().toLowerCase()
  if (!dbUser) {
    throw new Error('DB_USER wajib diisi di production.')
  }
  if (dbUser === 'root') {
    throw new Error('DB_USER root tidak diizinkan di production. Gunakan user aplikasi khusus.')
  }
  if (!parsedEnv.db.password.trim()) {
    throw new Error('DB_PASSWORD wajib diisi di production.')
  }

  const backupKey = parsedEnv.backup.encryptionKey.trim()
  if (!backupKey || backupKey === 'dev-only-backup-key-change-this') {
    throw new Error(
      'BACKUP_ENCRYPTION_KEY wajib diisi dengan nilai unik di production (bukan nilai default).',
    )
  }

  const adminEmail = parsedEnv.admin.email.trim()
  const adminPassword = parsedEnv.admin.password.trim()
  if (adminEmail && adminPassword) {
    if (adminPassword.length < 12) {
      throw new Error(
        'ADMIN_PASSWORD harus minimal 12 karakter di production.',
      )
    }
  }
}

export const env = parsedEnv
