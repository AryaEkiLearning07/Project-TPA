import { Router } from 'express'
import { dbPool } from '../config/database.js'
import {
  getRequestMeta,
  requireAuth,
  requirePetugasCheckedIn,
  requireRoles,
} from '../middlewares/auth-middleware.js'
import {
  createParentAccount,
  deleteParentAccount,
  getParentAccounts,
  ParentAccountServiceError,
  updateParentAccount,
} from '../services/parent-account-service.js'
import { writeActivityLog } from '../services/auth-service.js'
import type { ParentAccountInput } from '../types/parent-account.js'
import {
  sanitizeDatabaseErrorMessage,
  sanitizeServerErrorMessage,
} from '../utils/error-sanitizer.js'

type DbLikeError = {
  code?: string
  sqlMessage?: string
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isDbLikeError = (value: unknown): value is DbLikeError =>
  isObject(value) && 'code' in value

const asBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    return value === 1
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') {
      return true
    }
    if (normalized === 'false' || normalized === '0') {
      return false
    }
  }
  return fallback
}

const asString = (value: unknown): string => (typeof value === 'string' ? value : '')

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }
  return value.map((item) => (typeof item === 'string' ? item : '')).filter(Boolean)
}

const parseParentAccountInput = (
  value: unknown,
  options: { isCreate: boolean },
): ParentAccountInput => {
  if (!isObject(value)) {
    throw new ParentAccountServiceError(400, 'Payload akun orang tua tidak valid.')
  }

  const profileObject = isObject(value.parentProfile) ? value.parentProfile : {}

  const payload: ParentAccountInput = {
    username: asString(value.username),
    password: asString(value.password),
    isActive: asBoolean(value.isActive, true),
    childIds: asStringArray(value.childIds),
    parentProfile: {
      fatherName: asString(profileObject.fatherName),
      motherName: asString(profileObject.motherName),
      email: asString(profileObject.email),
      whatsappNumber: asString(profileObject.whatsappNumber),
      homePhone: asString(profileObject.homePhone),
      otherPhone: asString(profileObject.otherPhone),
      homeAddress: asString(profileObject.homeAddress),
      officeAddress: asString(profileObject.officeAddress),
    },
  }

  if (options.isCreate && !payload.password.trim()) {
    throw new ParentAccountServiceError(400, 'Password wajib diisi.')
  }

  return payload
}

const handleError = (error: unknown): { status: number; message: string } => {
  if (error instanceof ParentAccountServiceError) {
    return { status: error.status, message: error.message }
  }

  if (isDbLikeError(error)) {
    if (error.code === 'ER_DUP_ENTRY') {
      return {
        status: 409,
        message: 'Data duplikat ditemukan pada akun orang tua.',
      }
    }

    return {
      status: 500,
      message: sanitizeDatabaseErrorMessage(error.sqlMessage, 'Terjadi kesalahan pada database.'),
    }
  }

  return {
    status: 500,
    message: sanitizeServerErrorMessage(error, 'Terjadi kesalahan server.'),
  }
}

const router = Router()

router.use('/parent-accounts', requireAuth, requireRoles('PETUGAS', 'ADMIN'), requirePetugasCheckedIn)

router.get('/parent-accounts', async (_req, res) => {
  try {
    const data = await getParentAccounts()
    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const { status, message } = handleError(error)
    res.status(status).json({
      success: false,
      message,
      timestamp: new Date().toISOString(),
    })
  }
})

router.post('/parent-accounts', async (req, res) => {
  try {
    const payload = parseParentAccountInput(req.body, { isCreate: true })
    const data = await createParentAccount(payload)
    if (req.auth) {
      await writeActivityLog(dbPool, {
        gmail: req.auth.user.email,
        role: req.auth.user.role,
        action: 'CREATE_PARENT_ACCOUNT',
        target: `parent-account:${data.id}`,
        detail: `Akun orang tua ${data.parentProfile.email || data.username} dibuat.`,
        status: 'SUCCESS',
        meta: getRequestMeta(req),
      })
    }
    res.status(201).json({
      success: true,
      data,
      message: 'Akun orang tua berhasil dibuat',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const { status, message } = handleError(error)
    res.status(status).json({
      success: false,
      message,
      timestamp: new Date().toISOString(),
    })
  }
})

router.put('/parent-accounts/:id', async (req, res) => {
  try {
    const payload = parseParentAccountInput(req.body, { isCreate: false })
    const data = await updateParentAccount(req.params.id, payload)
    if (req.auth) {
      await writeActivityLog(dbPool, {
        gmail: req.auth.user.email,
        role: req.auth.user.role,
        action: 'UPDATE_PARENT_ACCOUNT',
        target: `parent-account:${data.id}`,
        detail: `Akun orang tua ${data.parentProfile.email || data.username} diperbarui.`,
        status: 'SUCCESS',
        meta: getRequestMeta(req),
      })
    }
    res.json({
      success: true,
      data,
      message: 'Akun orang tua berhasil diperbarui',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const { status, message } = handleError(error)
    res.status(status).json({
      success: false,
      message,
      timestamp: new Date().toISOString(),
    })
  }
})

router.delete('/parent-accounts/:id', async (req, res) => {
  try {
    await deleteParentAccount(req.params.id)
    if (req.auth) {
      await writeActivityLog(dbPool, {
        gmail: req.auth.user.email,
        role: req.auth.user.role,
        action: 'DELETE_PARENT_ACCOUNT',
        target: `parent-account:${req.params.id}`,
        detail: 'Akun orang tua dihapus.',
        status: 'SUCCESS',
        meta: getRequestMeta(req),
      })
    }
    res.json({
      success: true,
      data: { id: req.params.id },
      message: 'Akun orang tua berhasil dihapus',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const { status, message } = handleError(error)
    res.status(status).json({
      success: false,
      message,
      timestamp: new Date().toISOString(),
    })
  }
})

export default router
