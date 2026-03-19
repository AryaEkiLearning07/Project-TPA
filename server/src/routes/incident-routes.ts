
import { Router } from 'express'
import {
    createIncidentReport,
    deleteIncidentReport,
    getIncidentReports,
    getIncidentReportById,
    updateIncidentReport,
    ServiceError,
} from '../services/incident-service.js'
import type { IncidentReportInput } from '../types/index.js'
import {
    requireAuth,
    requirePetugasCheckedIn,
    requireRoles,
} from '../middlewares/auth-middleware.js'
import { sanitizeServerErrorMessage } from '../utils/error-sanitizer.js'
import { InputParseError, parseIncidentReportInput } from '../utils/input-parsers.js'

const incidentRoutes = Router()

incidentRoutes.use(requireAuth)
incidentRoutes.use(requireRoles('PETUGAS', 'ADMIN'))
incidentRoutes.use(requirePetugasCheckedIn)

incidentRoutes.get('/', async (req, res) => {
    try {
        const month = typeof req.query.month === 'string' ? req.query.month : undefined
        const records = await getIncidentReports(month)
        res.json({ success: true, data: records })
    } catch (error) {
        const message = sanitizeServerErrorMessage(error, 'Gagal memuat data berita acara.')
        res.status(500).json({ success: false, message })
    }
})

incidentRoutes.get('/:id', async (req, res) => {
    try {
        const record = await getIncidentReportById(req.params.id)
        if (!record) {
            res.status(404).json({ success: false, message: 'Data berita acara tidak ditemukan.' })
            return
        }
        res.json({ success: true, data: record })
    } catch (error) {
        const message = sanitizeServerErrorMessage(error, 'Gagal memuat detail berita acara.')
        res.status(500).json({ success: false, message })
    }
})

incidentRoutes.post('/', async (req, res) => {
    try {
        const input = parseIncidentReportInput(req.body)
        const record = await createIncidentReport(input)
        res.status(201).json({ success: true, data: record })
    } catch (error) {
        if (error instanceof ServiceError || error instanceof InputParseError) {
            res.status(error instanceof ServiceError ? error.statusCode : error.status).json({ success: false, message: error.message })
            return
        }
        const message = sanitizeServerErrorMessage(error, 'Gagal membuat berita acara.')
        res.status(500).json({ success: false, message })
    }
})

incidentRoutes.put('/:id', async (req, res) => {
    try {
        const input = req.body as IncidentReportInput
        const record = await updateIncidentReport(req.params.id, input)
        res.json({ success: true, data: record })
    } catch (error) {
        if (error instanceof ServiceError) {
            res.status(error.statusCode).json({ success: false, message: error.message })
            return
        }
        const message = sanitizeServerErrorMessage(error, 'Gagal memperbarui berita acara.')
        res.status(500).json({ success: false, message })
    }
})

incidentRoutes.delete('/:id', async (req, res) => {
    try {
        await deleteIncidentReport(req.params.id)
        res.json({ success: true, data: { id: req.params.id } })
    } catch (error) {
        if (error instanceof ServiceError) {
            res.status(error.statusCode).json({ success: false, message: error.message })
            return
        }
        const message = sanitizeServerErrorMessage(error, 'Gagal menghapus berita acara.')
        res.status(500).json({ success: false, message })
    }
})

export default incidentRoutes
