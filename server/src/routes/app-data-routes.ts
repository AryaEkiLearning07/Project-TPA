import { Router } from 'express'
import { dbPool } from '../config/database.js'
import {
  getRequestMeta,
  normalizeUserRole,
  requireAuth,
  requirePetugasCheckedIn,
  requireRoles,
} from '../middlewares/auth-middleware.js'
import { writeActivityLog } from '../services/auth-service.js'
import {
  getAppData,
  maskSensitiveData,
  replaceAppData,
  ServiceError,
  stripAppDataMediaPayload,
} from '../services/app-data-service.js'
import type { AppData } from '../types/app-data.js'
import {
  sanitizeDatabaseErrorMessage,
  sanitizeServerErrorMessage,
} from '../utils/error-sanitizer.js'

type DbLikeError = {
  code?: string
  sqlMessage?: string
}

const isDbLikeError = (error: unknown): error is DbLikeError =>
  typeof error === 'object' && error !== null && 'code' in error

const handleError = (error: unknown): { status: number; message: string } => {
  if (error instanceof ServiceError) {
    return { status: error.status, message: error.message }
  }

  if (isDbLikeError(error)) {
    if (error.code === 'ER_DUP_ENTRY') {
      return {
        status: 409,
        message: 'Data duplikat ditemukan. Pastikan data per anak dan tanggal unik.',
      }
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return {
        status: 400,
        message: 'Relasi data tidak valid. Pastikan data anak tersedia.',
      }
    }
    if (error.code === 'ER_BAD_NULL_ERROR') {
      return { status: 400, message: 'Ada field wajib yang belum terisi.' }
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

const parseAppData = (value: unknown): AppData => {
  if (typeof value !== 'object' || value === null) {
    throw new ServiceError(400, 'Payload app-data tidak valid')
  }
  return value as AppData
}

const toText = (value: unknown): string => (typeof value === 'string' ? value : '')

const router = Router()

router.use(requireAuth)
router.use(requireRoles('PETUGAS', 'ADMIN'))
router.use(requirePetugasCheckedIn)

router.get('/app-data', async (req, res) => {
  try {
    let data = await getAppData()
    const mode = toText(req.query.mode).trim().toLowerCase()
    const shouldUseLitePayload = mode === 'lite'
    const viewerRole = normalizeUserRole(req.auth?.user?.role)

    if (viewerRole === 'PETUGAS') {
      data = maskSensitiveData(data)
    } else if (shouldUseLitePayload) {
      data = stripAppDataMediaPayload(data)
    }

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

router.put('/app-data', requireRoles('ADMIN'), async (req, res) => {
  try {
    const payload = parseAppData(req.body)
    const data = await replaceAppData(payload)
    if (req.auth) {
      await writeActivityLog(dbPool, {
        gmail: req.auth.user.email,
        role: req.auth.user.role,
        action: 'REPLACE_APP_DATA',
        target: 'app-data',
        detail: `Sinkronisasi penuh data aplikasi. Jumlah data anak: ${data.children.length}`,
        status: 'SUCCESS',
        meta: getRequestMeta(req),
      })
    }
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

router.post('/app-data/import', requireRoles('ADMIN'), async (req, res) => {
  try {
    const payload = parseAppData(req.body)
    const data = await replaceAppData(payload)
    if (req.auth) {
      await writeActivityLog(dbPool, {
        gmail: req.auth.user.email,
        role: req.auth.user.role,
        action: 'IMPORT_APP_DATA',
        target: 'app-data',
        detail: `Import data aplikasi selesai. Jumlah data anak: ${data.children.length}`,
        status: 'SUCCESS',
        meta: getRequestMeta(req),
      })
    }
    res.json({
      success: true,
      data,
      message: 'Import data berhasil',
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
