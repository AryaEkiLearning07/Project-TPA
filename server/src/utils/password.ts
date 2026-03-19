import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

export class PasswordError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'PasswordError'
    this.status = status
  }
}

const normalizePassword = (value: string): string => value.trim()

export const hashPassword = async (password: string): Promise<string> => {
  const normalized = normalizePassword(password)
  if (normalized.length < 8) {
    throw new PasswordError(400, 'Password minimal 8 karakter.')
  }

  const salt = randomBytes(16).toString('hex')
  const derived = (await scryptAsync(normalized, salt, 64)) as Buffer
  return `scrypt$${salt}$${derived.toString('hex')}`
}

export const verifyPassword = async (
  password: string,
  passwordHash: string,
): Promise<boolean> => {
  const normalized = normalizePassword(password)
  if (!passwordHash.startsWith('scrypt$')) {
    return false
  }

  const parts = passwordHash.split('$')
  if (parts.length !== 3) {
    return false
  }

  const salt = parts[1]
  const hashHex = parts[2]
  if (!salt || !hashHex || hashHex.length % 2 !== 0) {
    return false
  }

  let storedHash: Buffer
  try {
    storedHash = Buffer.from(hashHex, 'hex')
  } catch {
    return false
  }

  const derived = (await scryptAsync(normalized, salt, 64)) as Buffer
  if (derived.length !== storedHash.length) {
    return false
  }

  return timingSafeEqual(derived, storedHash)
}
