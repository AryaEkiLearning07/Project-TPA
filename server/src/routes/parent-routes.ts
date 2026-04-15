import { type Response, Router } from 'express'
import { requireAuth, requireRoles } from '../middlewares/auth-middleware.js'
import {
  changeParentPortalPassword,
  ParentPortalServiceError,
  getParentDashboardData,
  linkChildToParentByCode,
  updateParentPortalProfile,
  updateParentMessageForAttendance,
} from '../services/parent-portal-service.js'
import { parseChildProfileInput } from '../utils/input-parsers.js'
import type { ParentProfile } from '../types/index.js'
import { sanitizeServerErrorMessage } from '../utils/error-sanitizer.js'

const toText = (value: unknown): string => (typeof value === 'string' ? value : '')
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const parseParentProfileInput = (value: unknown): ParentProfile => {
  const input = isObject(value) ? value : {}
  return {
    fatherName: toText(input.fatherName),
    motherName: toText(input.motherName),
    email: toText(input.email),
    whatsappNumber: toText(input.whatsappNumber),
    homePhone: toText(input.homePhone),
    otherPhone: toText(input.otherPhone),
    homeAddress: toText(input.homeAddress),
    officeAddress: toText(input.officeAddress),
  }
}

const handleError = (res: Response, error: unknown) => {
  if (error instanceof ParentPortalServiceError) {
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

const router = Router()

router.use('/parent', requireAuth, requireRoles('ORANG_TUA'))

router.get('/parent/dashboard', async (req, res) => {
  try {
    const data = await getParentDashboardData(req.auth?.user.id ?? '')
    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.post('/parent/link-child', async (req, res) => {
  try {
    const registrationCode = toText(req.body?.registrationCode)
    const data = await linkChildToParentByCode({
      parentAccountId: req.auth?.user.id ?? '',
      registrationCode,
    })
    res.json({
      success: true,
      data,
      message: 'Anak berhasil ditautkan ke akun orang tua.',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.put('/parent/attendance/:attendanceId/message', async (req, res) => {
  try {
    const attendanceId = toText(req.params?.attendanceId)
    const parentMessage = toText(req.body?.parentMessage)
    const data = await updateParentMessageForAttendance({
      parentAccountId: req.auth?.user.id ?? '',
      attendanceId,
      parentMessage,
    })
    res.json({
      success: true,
      data,
      message: 'Pesan untuk petugas berhasil disimpan.',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.put('/parent/profile/:childId', async (req, res) => {
  try {
    const childId = toText(req.params?.childId)
    const payload = isObject(req.body) ? req.body : {}
    const data = await updateParentPortalProfile({
      parentAccountId: req.auth?.user.id ?? '',
      childId,
      childProfile: parseChildProfileInput(payload.childProfile),
      parentProfile: parseParentProfileInput(payload.parentProfile),
    })
    res.json({
      success: true,
      data,
      message: 'Profil parent portal berhasil diperbarui.',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.put('/parent/password', async (req, res) => {
  try {
    const payload = isObject(req.body) ? req.body : {}
    const data = await changeParentPortalPassword({
      parentAccountId: req.auth?.user.id ?? '',
      currentPassword: toText(payload.currentPassword),
      newPassword: toText(payload.newPassword),
    })
    res.json({
      success: true,
      data,
      message: 'Password akun parent portal berhasil diperbarui.',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

export default router
