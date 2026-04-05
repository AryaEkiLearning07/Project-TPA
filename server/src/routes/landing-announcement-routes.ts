import { Router } from 'express'
import {
  type LandingAnnouncementCategory,
  LandingAnnouncementError,
  listLandingAnnouncementsForLanding,
} from '../services/landing-announcement-service.js'
import { sanitizeServerErrorMessage } from '../utils/error-sanitizer.js'

const CATEGORY_SET = new Set<LandingAnnouncementCategory>([
  'event',
  'dokumentasi',
  'galeri',
  'fasilitas',
  'tim',
  'promosi',
  'ucapan',
])

const toText = (value: unknown): string => (typeof value === 'string' ? value : '')

const router = Router()

router.get('/landing-announcements', async (req, res) => {
  try {
    const limitRaw = Number.parseInt(toText(req.query.limit), 10)
    const categoryRaw = toText(req.query.category).trim().toLowerCase()
    const category = CATEGORY_SET.has(categoryRaw as LandingAnnouncementCategory)
      ? (categoryRaw as LandingAnnouncementCategory)
      : undefined

    const data = await listLandingAnnouncementsForLanding({
      limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
      category,
    })

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    if (error instanceof LandingAnnouncementError) {
      res.status(error.status).json({
        success: false,
        message: error.message,
        timestamp: new Date().toISOString(),
      })
      return
    }

    res.status(500).json({
      success: false,
      message: sanitizeServerErrorMessage(error, 'Gagal memuat pengumuman landing.'),
      timestamp: new Date().toISOString(),
    })
  }
})

export default router
