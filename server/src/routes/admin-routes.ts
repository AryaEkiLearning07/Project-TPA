import { type Request, type Response, Router } from 'express'
import { getRequestMeta, requireAuth, requireRoles } from '../middlewares/auth-middleware.js'
import {
  AuthServiceError,
  listActivityLogs,
  writeActivityLog,
} from '../services/auth-service.js'
import {
  createStaffUser,
  deleteStaffUser,
  getStaffUsers,
  updateStaffUser,
} from '../services/staff-user-service.js'
import { createDatabaseBackup } from '../services/database-backup-service.js'
import type { StaffUserInput } from '../types/auth.js'
import { dbPool } from '../config/database.js'
import {
  getServicePackageRates,
  type ServicePackageRatesInput,
  updateServicePackageRates,
} from '../services/service-rate-service.js'
import {
  confirmServiceBillingUpgrade,
  createServiceBillingPayment,
  createServiceBillingPeriod,
  createServiceBillingRefund,
  getServiceBillingHistory,
  getServiceBillingSummary,
  ServiceBillingError,
  type ServiceBillingBucket,
  type ServiceBillingConfirmUpgradeInput,
  type ServiceBillingPaymentInput,
  type ServiceBillingPeriodInput,
  type ServiceBillingRefundInput,
  type ServicePackageKey,
} from '../services/service-billing-service.js'
import {
  checkInStaffForDate,
  checkOutStaffForDate,
  listStaffAttendanceRecap,
  StaffAttendanceServiceError,
} from '../services/staff-attendance-service.js'
import {
  ChildRegistrationCodeServiceError,
  generateChildRegistrationCode,
  getChildRegistrationCode,
} from '../services/child-registration-code-service.js'
import {
  createLandingAnnouncement,
  deleteLandingAnnouncement,
  LandingAnnouncementError,
  type LandingAnnouncementInput,
  listLandingAnnouncementsForAdmin,
  parseLandingAnnouncementId,
  updateLandingAnnouncement,
} from '../services/landing-announcement-service.js'
import { sanitizeServerErrorMessage } from '../utils/error-sanitizer.js'

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const toText = (value: unknown): string => (typeof value === 'string' ? value : '')

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

const parseStaffPayload = (value: unknown): StaffUserInput => {
  if (!isObject(value)) {
    throw new AuthServiceError(400, 'Payload petugas tidak valid.')
  }

  return {
    fullName: toText(value.fullName),
    email: toText(value.email),
    password: toText(value.password),
    isActive: asBoolean(value.isActive, true),
  }
}

const toCurrencyAmount = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.round(value))
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/[^\d-]/g, '')
    if (!normalized) {
      return 0
    }

    const parsed = Number.parseInt(normalized, 10)
    if (!Number.isFinite(parsed)) {
      return 0
    }

    return Math.max(0, parsed)
  }

  return 0
}

const parseServiceRatePayload = (value: unknown): ServicePackageRatesInput => {
  if (!isObject(value)) {
    throw new AuthServiceError(400, 'Payload tarif layanan tidak valid.')
  }

  return {
    harian: toCurrencyAmount(value.harian),
    '2-mingguan': toCurrencyAmount(value['2-mingguan']),
    bulanan: toCurrencyAmount(value.bulanan),
  }
}

const toChildId = (value: unknown): string => {
  const normalized = toText(value).trim()
  if (!/^\d+$/.test(normalized)) {
    throw new AuthServiceError(400, 'ID anak tidak valid.')
  }
  return normalized
}

const toStaffUserId = (value: unknown): number => {
  const normalized = toText(value).trim()
  if (!/^\d+$/.test(normalized)) {
    throw new AuthServiceError(400, 'ID petugas tidak valid.')
  }

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AuthServiceError(400, 'ID petugas tidak valid.')
  }

  return parsed
}

const toPeriodId = (value: unknown): string => {
  const normalized = toText(value).trim()
  if (!/^\d+$/.test(normalized)) {
    throw new AuthServiceError(400, 'ID periode tidak valid.')
  }
  return normalized
}

const toServicePackageKey = (value: unknown): ServicePackageKey => {
  const normalized = toText(value).trim().toLowerCase()
  if (
    normalized === 'harian' ||
    normalized === '2-mingguan' ||
    normalized === 'bulanan'
  ) {
    return normalized
  }

  throw new AuthServiceError(400, 'Paket layanan tidak valid.')
}

const toBillingBucket = (value: unknown): ServiceBillingBucket => {
  const normalized = toText(value).trim().toLowerCase()
  if (normalized === 'period' || normalized === 'arrears') {
    return normalized
  }

  throw new AuthServiceError(400, 'Bucket billing tidak valid.')
}

const toOptionalDate = (value: unknown): string | undefined => {
  const normalized = toText(value).trim()
  if (!normalized) {
    return undefined
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new AuthServiceError(400, 'Format tanggal billing tidak valid (YYYY-MM-DD).')
  }
  return normalized
}

const toOptionalPeriodId = (value: unknown): string | undefined => {
  const normalized = toText(value).trim()
  if (!normalized) {
    return undefined
  }
  if (!/^\d+$/.test(normalized)) {
    throw new AuthServiceError(400, 'ID periode tidak valid.')
  }
  return normalized
}

const toAttendanceDate = (value: unknown): string => {
  const normalized = toText(value).trim()
  if (!normalized) {
    return new Date().toISOString().slice(0, 10)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new AuthServiceError(400, 'Format tanggal absensi tidak valid (YYYY-MM-DD).')
  }
  return normalized
}

const toAttendanceMonth = (value: unknown, fallbackDate: string): string => {
  const normalized = toText(value).trim()
  if (!normalized) {
    return fallbackDate.slice(0, 7)
  }
  if (!/^\d{4}-\d{2}$/.test(normalized)) {
    throw new AuthServiceError(400, 'Format bulan absensi tidak valid (YYYY-MM).')
  }
  return normalized
}

const parseServiceBillingPeriodPayload = (value: unknown): ServiceBillingPeriodInput => {
  if (!isObject(value)) {
    throw new AuthServiceError(400, 'Payload periode billing tidak valid.')
  }

  return {
    childId: toChildId(value.childId),
    packageKey: toServicePackageKey(value.packageKey),
    startDate: toOptionalDate(value.startDate),
    amount: toCurrencyAmount(value.amount),
    notes: toText(value.notes).trim(),
  }
}

const parseServiceBillingPaymentPayload = (value: unknown): ServiceBillingPaymentInput => {
  if (!isObject(value)) {
    throw new AuthServiceError(400, 'Payload pembayaran billing tidak valid.')
  }

  return {
    childId: toChildId(value.childId),
    amount: toCurrencyAmount(value.amount),
    bucket: toBillingBucket(value.bucket),
    periodId: toOptionalPeriodId(value.periodId),
    notes: toText(value.notes).trim(),
    paymentProofDataUrl: toText(value.paymentProofDataUrl).trim(),
    paymentProofName: toText(value.paymentProofName).trim(),
  }
}

const parseServiceBillingRefundPayload = (value: unknown): ServiceBillingRefundInput => {
  if (!isObject(value)) {
    throw new AuthServiceError(400, 'Payload refund billing tidak valid.')
  }

  return {
    childId: toChildId(value.childId),
    amount: toCurrencyAmount(value.amount),
    bucket: toBillingBucket(value.bucket),
    periodId: toOptionalPeriodId(value.periodId),
    notes: toText(value.notes).trim(),
  }
}

const parseServiceBillingUpgradePayload = (
  value: unknown,
): ServiceBillingConfirmUpgradeInput => {
  if (!isObject(value)) {
    throw new AuthServiceError(400, 'Payload konfirmasi upgrade tidak valid.')
  }

  return {
    childId: toChildId(value.childId),
    periodId: toPeriodId(value.periodId),
    notes: toText(value.notes).trim(),
  }
}

const parseLandingAnnouncementPayload = (value: unknown): LandingAnnouncementInput => {
  if (!isObject(value)) {
    throw new AuthServiceError(400, 'Payload pengumuman landing tidak valid.')
  }

  return {
    title: toText(value.title),
    slug: toText(value.slug),
    category: toText(value.category).trim().toLowerCase() as LandingAnnouncementInput['category'],
    displayMode: toText(value.displayMode).trim().toLowerCase() as LandingAnnouncementInput['displayMode'],
    excerpt: toText(value.excerpt),
    content: toText(value.content),
    coverImageDataUrl: toText(value.coverImageDataUrl),
    coverImageName: toText(value.coverImageName),
    ctaLabel: toText(value.ctaLabel),
    ctaUrl: toText(value.ctaUrl),
    publishStartDate: toText(value.publishStartDate),
    publishEndDate: toText(value.publishEndDate),
    status: toText(value.status).trim().toLowerCase() as LandingAnnouncementInput['status'],
    isPinned: asBoolean(value.isPinned, false),
    authorName: toText(value.authorName),
    authorEmail: toText(value.authorEmail),
  }
}

const resolveActor = (req: Request) => {
  const auth = req.auth
  if (!auth) {
    throw new AuthServiceError(401, 'Sesi admin tidak ditemukan.')
  }
  return {
    gmail: auth.user.email,
    role: auth.user.role,
  }
}

const writeAdminLog = async (
  req: Request,
  action: string,
  target: string,
  detail: string,
) => {
  const actor = resolveActor(req)
  await writeActivityLog(dbPool, {
    gmail: actor.gmail,
    role: actor.role,
    action,
    target,
    detail,
    status: 'SUCCESS',
    meta: getRequestMeta(req),
  })
}

const resolveStaffAttendanceTarget = async (staffUserId: number) => {
  const staffUsers = await getStaffUsers()
  const matched = staffUsers.find((staff) => Number(staff.id) === staffUserId)

  if (!matched) {
    throw new AuthServiceError(404, 'Data petugas tidak ditemukan.')
  }

  if (!matched.isActive) {
    throw new AuthServiceError(400, 'Petugas nonaktif tidak bisa melakukan absensi.')
  }

  return {
    staffUserId: Number(matched.id),
    email: matched.email,
    fullName: matched.fullName,
  }
}

const handleError = (res: Response, error: unknown) => {
  if (
    error instanceof AuthServiceError ||
    error instanceof ServiceBillingError ||
    error instanceof StaffAttendanceServiceError ||
    error instanceof ChildRegistrationCodeServiceError ||
    error instanceof LandingAnnouncementError
  ) {
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

const buildServerDateContext = () => {
  const now = new Date()
  const todayDate = now.toISOString().slice(0, 10)

  return {
    timestamp: now.toISOString(),
    todayDate,
    todayMonth: todayDate.slice(0, 7),
    todayYear: todayDate.slice(0, 4),
  }
}

const router = Router()

router.use(requireAuth)
router.use(requireRoles('ADMIN'))

router.get('/admin/server-date-context', async (_req, res) => {
  try {
    const context = buildServerDateContext()
    res.json({
      success: true,
      data: context,
      timestamp: context.timestamp,
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.get('/admin/landing-announcements', async (_req, res) => {
  try {
    const data = await listLandingAnnouncementsForAdmin()
    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.post('/admin/landing-announcements', async (req, res) => {
  try {
    const payload = parseLandingAnnouncementPayload(req.body)
    const data = await createLandingAnnouncement(payload)
    await writeAdminLog(
      req,
      'CREATE_LANDING_ANNOUNCEMENT',
      `landing-announcement:${data.id}`,
      `Pengumuman landing dibuat (${data.title}) dengan status ${data.status}.`,
    )
    res.status(201).json({
      success: true,
      data,
      message: 'Pengumuman landing berhasil dibuat.',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.put('/admin/landing-announcements/:id', async (req, res) => {
  try {
    parseLandingAnnouncementId(req.params.id)
    const payload = parseLandingAnnouncementPayload(req.body)
    const data = await updateLandingAnnouncement(req.params.id, payload)
    await writeAdminLog(
      req,
      'UPDATE_LANDING_ANNOUNCEMENT',
      `landing-announcement:${data.id}`,
      `Pengumuman landing diperbarui (${data.title}) dengan status ${data.status}.`,
    )
    res.json({
      success: true,
      data,
      message: 'Pengumuman landing berhasil diperbarui.',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.delete('/admin/landing-announcements/:id', async (req, res) => {
  try {
    const announcementId = parseLandingAnnouncementId(req.params.id)
    await deleteLandingAnnouncement(String(announcementId))
    await writeAdminLog(
      req,
      'DELETE_LANDING_ANNOUNCEMENT',
      `landing-announcement:${announcementId}`,
      'Pengumuman landing dihapus.',
    )
    res.json({
      success: true,
      data: { id: String(announcementId) },
      message: 'Pengumuman landing berhasil dihapus.',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.get('/admin/children/:childId/registration-code', async (req, res) => {
  try {
    const data = await getChildRegistrationCode(req.params.childId)
    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.post('/admin/children/:childId/registration-code', async (req, res) => {
  try {
    const existingCode = await getChildRegistrationCode(req.params.childId)
    if (existingCode) {
      res.json({
        success: true,
        data: existingCode,
        message: 'Kode registrasi sudah tersedia untuk anak ini.',
        timestamp: new Date().toISOString(),
      })
      return
    }

    const data = await generateChildRegistrationCode({
      childId: req.params.childId,
      generatedByAdminId: req.auth?.user.id ?? null,
    })
    await writeAdminLog(
      req,
      'GENERATE_CHILD_REGISTRATION_CODE',
      `child:${data.childId}`,
      `Kode registrasi baru dibuat (${data.code}).`,
    )
    res.status(201).json({
      success: true,
      data,
      message: 'Kode registrasi berhasil dibuat.',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.get('/admin/staff-users', async (_req, res) => {
  try {
    const data = await getStaffUsers()
    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.post('/admin/staff-users', async (req, res) => {
  try {
    const payload = parseStaffPayload(req.body)
    const data = await createStaffUser(payload)
    await writeAdminLog(
      req,
      'CREATE_STAFF',
      `staff:${data.id}`,
      `Petugas baru dibuat (${data.email})`,
    )
    res.status(201).json({
      success: true,
      data,
      message: 'Akun petugas berhasil dibuat.',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.put('/admin/staff-users/:id', async (req, res) => {
  try {
    const payload = parseStaffPayload(req.body)
    const data = await updateStaffUser(req.params.id, payload)
    await writeAdminLog(
      req,
      'UPDATE_STAFF',
      `staff:${data.id}`,
      `Petugas diperbarui (${data.email})`,
    )
    res.json({
      success: true,
      data,
      message: 'Akun petugas berhasil diperbarui.',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.delete('/admin/staff-users/:id', async (req, res) => {
  try {
    await deleteStaffUser(req.params.id)
    await writeAdminLog(
      req,
      'DELETE_STAFF',
      `staff:${req.params.id}`,
      'Akun petugas dihapus.',
    )
    res.json({
      success: true,
      data: { id: req.params.id },
      message: 'Akun petugas berhasil dihapus.',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.get('/admin/activity-logs', async (req, res) => {
  try {
    const search = toText(req.query.search)
    const limitRaw = Number.parseInt(toText(req.query.limit), 10)
    const limit = Number.isFinite(limitRaw) ? limitRaw : 200
    const cursor = toText(req.query.cursor).trim()
    const eventDate = toText(req.query.eventDate).trim()

    const data = await listActivityLogs({ search, limit, cursor, eventDate })
    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.get('/admin/staff-attendance/recap', async (req, res) => {
  try {
    const attendanceDate = toAttendanceDate(req.query.date)
    const attendanceMonth = toAttendanceMonth(req.query.month, attendanceDate)

    const data = await listStaffAttendanceRecap({
      attendanceDate,
      attendanceMonth,
    })

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.post('/admin/staff-attendance/check-in', async (req, res) => {
  try {
    if (!isObject(req.body)) {
      throw new AuthServiceError(400, 'Payload absensi masuk tidak valid.')
    }

    const staffUserId = toStaffUserId(req.body.staffUserId)
    const attendanceDate = toAttendanceDate(req.body.attendanceDate)
    const staffTarget = await resolveStaffAttendanceTarget(staffUserId)
    const requestMeta = getRequestMeta(req)

    const data = await checkInStaffForDate({
      staffUserId: staffTarget.staffUserId,
      email: staffTarget.email,
      attendanceDate,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    })

    await writeAdminLog(
      req,
      'ADMIN_STAFF_CHECKIN',
      `staff:${staffTarget.staffUserId}`,
      data.alreadyCheckedIn
        ? `Absensi masuk ${staffTarget.fullName} sudah tercatat pada ${attendanceDate}.`
        : `Absensi masuk ${staffTarget.fullName} berhasil dicatat pada ${attendanceDate}.`,
    )

    res.json({
      success: true,
      data,
      message: data.alreadyCheckedIn
        ? `Absensi masuk ${staffTarget.fullName} sudah tercatat.`
        : `Absensi masuk ${staffTarget.fullName} berhasil dicatat.`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.post('/admin/staff-attendance/check-out', async (req, res) => {
  try {
    if (!isObject(req.body)) {
      throw new AuthServiceError(400, 'Payload absensi pulang tidak valid.')
    }

    const staffUserId = toStaffUserId(req.body.staffUserId)
    const attendanceDate = toAttendanceDate(req.body.attendanceDate)
    const staffTarget = await resolveStaffAttendanceTarget(staffUserId)
    const requestMeta = getRequestMeta(req)

    const data = await checkOutStaffForDate({
      staffUserId: staffTarget.staffUserId,
      email: staffTarget.email,
      attendanceDate,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    })

    await writeAdminLog(
      req,
      'ADMIN_STAFF_CHECKOUT',
      `staff:${staffTarget.staffUserId}`,
      data.alreadyCheckedOut
        ? `Absensi pulang ${staffTarget.fullName} sudah tercatat pada ${attendanceDate}.`
        : `Absensi pulang ${staffTarget.fullName} berhasil dicatat pada ${attendanceDate}.`,
    )

    res.json({
      success: true,
      data,
      message: data.alreadyCheckedOut
        ? `Absensi pulang ${staffTarget.fullName} sudah tercatat.`
        : `Absensi pulang ${staffTarget.fullName} berhasil dicatat.`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.get('/admin/service-rates', async (_req, res) => {
  try {
    const data = await getServicePackageRates()
    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.put('/admin/service-rates', async (req, res) => {
  try {
    const payload = parseServiceRatePayload(req.body)
    const data = await updateServicePackageRates(payload)
    await writeAdminLog(
      req,
      'UPDATE_SERVICE_RATES',
      'service-rates',
      `Tarif layanan diperbarui (harian=${payload.harian}, 2-mingguan=${payload['2-mingguan']}, bulanan=${payload.bulanan}).`,
    )

    res.json({
      success: true,
      data,
      message: 'Tarif layanan berhasil diperbarui.',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.get('/admin/service-billing/summary', async (_req, res) => {
  try {
    const data = await getServiceBillingSummary()
    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.get('/admin/service-billing/history/:childId', async (req, res) => {
  try {
    const data = await getServiceBillingHistory(req.params.childId)
    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.post('/admin/service-billing/periods', async (req, res) => {
  try {
    const payload = parseServiceBillingPeriodPayload(req.body)
    const data = await createServiceBillingPeriod(payload)

    await writeAdminLog(
      req,
      'CREATE_SERVICE_BILLING_PERIOD',
      `child:${payload.childId}`,
      `Periode billing dibuat (paket=${payload.packageKey}, mulai=${payload.startDate ?? 'hari-ini'}, nominal=${payload.amount ?? 0}).`,
    )

    res.status(201).json({
      success: true,
      data,
      message: 'Periode billing berhasil dibuat.',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.post('/admin/service-billing/payments', async (req, res) => {
  try {
    const payload = parseServiceBillingPaymentPayload(req.body)
    const data = await createServiceBillingPayment(payload)

    await writeAdminLog(
      req,
      'CREATE_SERVICE_BILLING_PAYMENT',
      `child:${payload.childId}`,
      `Pembayaran billing dicatat (bucket=${payload.bucket}, nominal=${payload.amount}).`,
    )

    res.status(201).json({
      success: true,
      data,
      message: 'Pembayaran billing berhasil dicatat.',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.post('/admin/service-billing/refunds', async (req, res) => {
  try {
    const payload = parseServiceBillingRefundPayload(req.body)
    const data = await createServiceBillingRefund(payload)

    await writeAdminLog(
      req,
      'CREATE_SERVICE_BILLING_REFUND',
      `child:${payload.childId}`,
      `Refund billing dicatat (bucket=${payload.bucket}, nominal=${payload.amount}).`,
    )

    res.status(201).json({
      success: true,
      data,
      message: 'Refund billing berhasil dicatat.',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.post('/admin/service-billing/confirm-upgrade', async (req, res) => {
  try {
    const payload = parseServiceBillingUpgradePayload(req.body)
    const data = await confirmServiceBillingUpgrade(payload)

    await writeAdminLog(
      req,
      'CONFIRM_SERVICE_BILLING_UPGRADE',
      `child:${payload.childId}`,
      `Upgrade paket layanan dikonfirmasi untuk periode ${payload.periodId}.`,
    )

    res.json({
      success: true,
      data,
      message: 'Upgrade paket ke bulanan berhasil dikonfirmasi.',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    handleError(res, error)
  }
})

router.get('/admin/backup', async (req, res) => {
  try {
    const backup = await createDatabaseBackup()
    await writeAdminLog(
      req,
      'BACKUP_DATABASE',
      'database',
      `Backup terenkripsi dibuat (${backup.filename})`,
    )

    res.setHeader('Content-Type', backup.contentType)
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${backup.filename}"`,
    )
    res.status(200).send(backup.content)
  } catch (error) {
    handleError(res, error)
  }
})

export default router
