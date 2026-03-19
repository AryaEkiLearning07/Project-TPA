import { type Response, Router } from 'express'
import { dbPool } from '../config/database.js'
import { getRequestMeta, requireAuth, requireRoles } from '../middlewares/auth-middleware.js'
import { writeActivityLog } from '../services/auth-service.js'
import {
  checkInStaffForDate,
  checkOutStaffForDate,
  getStaffAttendanceStatus,
  StaffAttendanceServiceError,
} from '../services/staff-attendance-service.js'
import { sanitizeServerErrorMessage } from '../utils/error-sanitizer.js'

const handleError = (res: Response, error: unknown) => {
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

const resolveStaffUser = (auth: { user: { id: string; email: string } } | undefined) => {
  if (!auth) {
    return null
  }

  const staffUserId = Number(auth.user.id)
  if (!Number.isFinite(staffUserId) || staffUserId <= 0) {
    return null
  }

  return {
    staffUserId,
    email: auth.user.email,
  }
}

const router = Router()

router.use('/staff-attendance', requireAuth, requireRoles('PETUGAS'))

router.get('/staff-attendance/status', async (req, res) => {
  try {
    const staffUser = resolveStaffUser(req.auth)
    if (!staffUser) {
      res.status(401).json({
        success: false,
        message: 'Sesi petugas tidak valid.',
        timestamp: new Date().toISOString(),
      })
      return
    }

    const status = await getStaffAttendanceStatus(staffUser)
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.post('/staff-attendance/check-in', async (req, res) => {
  try {
    const staffUser = resolveStaffUser(req.auth)
    if (!staffUser) {
      res.status(401).json({
        success: false,
        message: 'Sesi petugas tidak valid.',
        timestamp: new Date().toISOString(),
      })
      return
    }

    const requestMeta = getRequestMeta(req)
    const result = await checkInStaffForDate({
      ...staffUser,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    })

    await writeActivityLog(dbPool, {
      gmail: staffUser.email,
      role: 'PETUGAS',
      action: 'STAFF_CHECKIN',
      target: 'staff-attendance',
      detail: result.alreadyCheckedIn
        ? 'Absensi datang sudah tercatat sebelumnya.'
        : 'Absensi datang berhasil.',
      status: 'SUCCESS',
      meta: requestMeta,
    })

    res.json({
      success: true,
      data: result,
      message: result.alreadyCheckedIn
        ? 'Absensi datang sudah tercatat hari ini.'
        : 'Absensi datang berhasil.',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.post('/staff-attendance/check-out', async (req, res) => {
  try {
    const staffUser = resolveStaffUser(req.auth)
    if (!staffUser) {
      res.status(401).json({
        success: false,
        message: 'Sesi petugas tidak valid.',
        timestamp: new Date().toISOString(),
      })
      return
    }

    const requestMeta = getRequestMeta(req)
    const result = await checkOutStaffForDate({
      ...staffUser,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    })

    await writeActivityLog(dbPool, {
      gmail: staffUser.email,
      role: 'PETUGAS',
      action: 'STAFF_CHECKOUT',
      target: 'staff-attendance',
      detail: result.alreadyCheckedOut
        ? 'Absensi pulang sudah tercatat sebelumnya.'
        : 'Absensi pulang berhasil.',
      status: 'SUCCESS',
      meta: requestMeta,
    })

    res.json({
      success: true,
      data: result,
      message: result.alreadyCheckedOut
        ? 'Absensi pulang sudah tercatat hari ini.'
        : 'Absensi pulang berhasil.',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

export default router
