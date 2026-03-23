import { type Response, Router } from 'express'
import { requireAuth, requireRoles } from '../middlewares/auth-middleware.js'
import {
  ParentPortalServiceError,
  getParentDashboardData,
  linkChildToParentByCode,
} from '../services/parent-portal-service.js'
import { sanitizeServerErrorMessage } from '../utils/error-sanitizer.js'

const toText = (value: unknown): string => (typeof value === 'string' ? value : '')

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

export default router
