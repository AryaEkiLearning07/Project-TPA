import type { NextFunction, Request, Response } from 'express'
import { env } from '../config/env.js'
import {
  AuthServiceError,
  parseBearerToken,
  resolveAuthContext,
} from '../services/auth-service.js'
import {
  hasCheckedInForDate,
  StaffAttendanceServiceError,
} from '../services/staff-attendance-service.js'
import type { UserRole } from '../types/auth.js'
import { sanitizeServerErrorMessage } from '../utils/error-sanitizer.js'

export const normalizeUserRole = (value: unknown): UserRole | null => {
  const role = typeof value === 'string' ? value.trim().toUpperCase() : ''
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
    return 'ADMIN'
  }
  if (role === 'PETUGAS' || role === 'STAFF') {
    return 'PETUGAS'
  }
  if (role === 'ORANG_TUA') {
    return 'ORANG_TUA'
  }
  return null
}

const unauthorized = (res: Response, message: string) => {
  res.status(401).json({
    success: false,
    message,
    timestamp: new Date().toISOString(),
  })
}

const forbidden = (res: Response, message: string) => {
  res.status(403).json({
    success: false,
    message,
    timestamp: new Date().toISOString(),
  })
}

const parseCookieValue = (
  cookieHeader: string | undefined,
  cookieName: string,
): string | null => {
  if (!cookieHeader || !cookieName) {
    return null
  }

  const pairs = cookieHeader.split(';')
  for (const pair of pairs) {
    const separatorIndex = pair.indexOf('=')
    if (separatorIndex <= 0) {
      continue
    }

    const name = decodeURIComponent(pair.slice(0, separatorIndex).trim())
    if (name !== cookieName) {
      continue
    }

    const rawValue = pair.slice(separatorIndex + 1).trim()
    if (!rawValue) {
      return null
    }

    try {
      return decodeURIComponent(rawValue)
    } catch {
      return rawValue
    }
  }

  return null
}

const resolveAuthToken = (req: Request): string | null => {
  const bearerToken = parseBearerToken(req.headers.authorization)
  if (bearerToken) {
    return bearerToken
  }

  return parseCookieValue(req.headers.cookie, env.authCookie.name)
}

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = resolveAuthToken(req)
    if (!token) {
      unauthorized(res, 'Akses ditolak. Token tidak ditemukan.')
      return
    }

    const context = await resolveAuthContext(token)
    if (!context) {
      unauthorized(res, 'Sesi tidak valid atau sudah kedaluwarsa.')
      return
    }

    req.auth = context
    next()
  } catch (error) {
    if (error instanceof AuthServiceError) {
      res.status(error.status).json({
        success: false,
        message: error.message,
        timestamp: new Date().toISOString(),
      })
      return
    }

    const message = sanitizeServerErrorMessage(error, 'Terjadi kesalahan server.')
    res.status(500).json({
      success: false,
      message,
      timestamp: new Date().toISOString(),
    })
  }
}

export const requireRoles = (...roles: UserRole[]) => {
  const roleSet = new Set<UserRole>(roles)

  return (req: Request, res: Response, next: NextFunction) => {
    const currentRole = normalizeUserRole(req.auth?.user.role)
    if (!currentRole || !roleSet.has(currentRole)) {
      forbidden(res, 'Role Anda tidak memiliki akses ke endpoint ini.')
      return
    }

    next()
  }
}

export const getRequestMeta = (req: Request): { ipAddress: string; userAgent: string } => {
  const ipAddress =
    req.ip ||
    (typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for']
      : '') ||
    ''

  const userAgent = typeof req.headers['user-agent'] === 'string'
    ? req.headers['user-agent']
    : ''

  return { ipAddress, userAgent }
}

export const requirePetugasCheckedIn = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const auth = req.auth
    if (!auth || normalizeUserRole(auth.user.role) !== 'PETUGAS') {
      next()
      return
    }

    const staffUserId = Number(auth.user.id)
    if (!Number.isFinite(staffUserId) || staffUserId <= 0) {
      forbidden(res, 'Identitas petugas tidak valid.')
      return
    }

    const checkedIn = await hasCheckedInForDate({ staffUserId })
    if (!checkedIn) {
      res.status(403).json({
        success: false,
        message:
          'Absensi petugas dicatat oleh admin. Silakan datang ke admin untuk absen masuk sebelum mengakses fitur operasional.',
        data: {
          attendanceRequired: true,
          adminAssistedAttendanceRequired: true,
        },
        timestamp: new Date().toISOString(),
      })
      return
    }

    next()
  } catch (error) {
    if (error instanceof StaffAttendanceServiceError) {
      res.status(error.status).json({
        success: false,
        message: error.message,
        timestamp: new Date().toISOString(),
      })
      return
    }

    const message = sanitizeServerErrorMessage(error, 'Terjadi kesalahan server.')
    res.status(500).json({
      success: false,
      message,
      timestamp: new Date().toISOString(),
    })
  }
}
