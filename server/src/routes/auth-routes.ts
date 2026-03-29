import { type CookieOptions, type Response, Router } from 'express'
import { env } from '../config/env.js'
import { getRequestMeta, requireAuth } from '../middlewares/auth-middleware.js'
import {
  AuthServiceError,
  login,
  logout,
} from '../services/auth-service.js'
import {
  ParentPortalServiceError,
  registerParentWithCode,
} from '../services/parent-portal-service.js'
import type { LoginInput } from '../types/auth.js'
import { sanitizeServerErrorMessage } from '../utils/error-sanitizer.js'

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const toText = (value: unknown): string => (typeof value === 'string' ? value : '')

const parseLoginPayload = (value: unknown): LoginInput => {
  if (!isObject(value)) {
    throw new AuthServiceError(400, 'Payload login tidak valid.')
  }

  const rawPreference = toText(value.loginPreference).trim().toUpperCase()
  const loginPreference =
    rawPreference === 'STAFF_FIRST' || rawPreference === 'PARENT_FIRST'
      ? (rawPreference as LoginInput['loginPreference'])
      : undefined

  return {
    email: toText(value.email),
    password: toText(value.password),
    loginPreference,
  }
}

const parseParentRegistrationPayload = (value: unknown): {
  email: string
  password: string
  registrationCode: string
} => {
  if (!isObject(value)) {
    throw new ParentPortalServiceError(400, 'Payload pendaftaran orang tua tidak valid.')
  }

  return {
    email: toText(value.email),
    password: toText(value.password),
    registrationCode: toText(value.registrationCode),
  }
}

const handleError = (res: Response, error: unknown) => {
  if (error instanceof AuthServiceError || error instanceof ParentPortalServiceError) {
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

const buildAuthCookieOptions = (expiresAtIso: string): CookieOptions => ({
  httpOnly: true,
  secure: env.authCookie.secure,
  sameSite: env.authCookie.sameSite,
  path: '/',
  domain: env.authCookie.domain ?? undefined,
  expires: new Date(expiresAtIso),
})

const clearAuthCookie = (res: Response): void => {
  res.clearCookie(env.authCookie.name, {
    httpOnly: true,
    secure: env.authCookie.secure,
    sameSite: env.authCookie.sameSite,
    path: '/',
    domain: env.authCookie.domain ?? undefined,
  })
}

const router = Router()

router.post('/auth/login', async (req, res) => {
  try {
    const payload = parseLoginPayload(req.body)
    const session = await login(payload, getRequestMeta(req))

    res.cookie(
      env.authCookie.name,
      session.token,
      buildAuthCookieOptions(session.expiresAt),
    )

    res.json({
      success: true,
      data: {
        user: session.user,
        expiresAt: session.expiresAt,
      },
      message: 'Login berhasil',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.post('/auth/register-parent-with-code', async (req, res) => {
  try {
    const payload = parseParentRegistrationPayload(req.body)
    const result = await registerParentWithCode(payload)

    res.cookie(
      env.authCookie.name,
      result.session.token,
      buildAuthCookieOptions(result.session.expiresAt),
    )

    res.status(201).json({
      success: true,
      data: {
        user: result.session.user,
        expiresAt: result.session.expiresAt,
        dashboard: result.dashboard,
      },
      message: 'Akun orang tua berhasil dibuat.',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.post('/auth/logout', requireAuth, async (req, res) => {
  try {
    const token = req.auth?.token
    if (token) {
      await logout(token, getRequestMeta(req))
    }
    clearAuthCookie(res)

    res.json({
      success: true,
      data: { loggedOut: true },
      message: 'Logout berhasil',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    clearAuthCookie(res)
    handleError(res, error)
  }
})

router.get('/auth/me', requireAuth, (req, res) => {
  const auth = req.auth
  if (!auth) {
    res.status(401).json({
      success: false,
      message: 'Sesi tidak ditemukan.',
      timestamp: new Date().toISOString(),
    })
    return
  }

  res.json({
    success: true,
    data: {
      user: auth.user,
      expiresAt: auth.expiresAt,
    },
    timestamp: new Date().toISOString(),
  })
})

export default router
