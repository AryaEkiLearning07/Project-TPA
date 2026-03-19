import { Router } from 'express'
import {
    createObservationRecord,
    deleteObservationRecord,
    getObservationRecords,
    getObservationRecordById,
    updateObservationRecord,
    ServiceError,
} from '../services/observation-service.js'
import type { ObservationRecordInput } from '../types/index.js'
import {
    requireAuth,
    requirePetugasCheckedIn,
    requireRoles,
} from '../middlewares/auth-middleware.js'
import { sanitizeServerErrorMessage } from '../utils/error-sanitizer.js'
import { InputParseError, parseObservationRecordInput } from '../utils/input-parsers.js'

const observationRoutes = Router()

observationRoutes.use(requireAuth)
observationRoutes.use(requireRoles('PETUGAS', 'ADMIN'))
observationRoutes.use(requirePetugasCheckedIn)

observationRoutes.get('/', async (req, res) => {
    try {
        const month = typeof req.query.month === 'string' ? req.query.month : undefined
        const records = await getObservationRecords(month)
        res.json({ success: true, data: records })
    } catch (error) {
        const message = sanitizeServerErrorMessage(error, 'Gagal memuat data observasi.')
        res.status(500).json({ success: false, message })
    }
})

observationRoutes.get('/:id', async (req, res) => {
    try {
        const record = await getObservationRecordById(req.params.id)
        if (!record) {
            res.status(404).json({ success: false, message: 'Data observasi tidak ditemukan.' })
            return
        }
        res.json({ success: true, data: record })
    } catch (error) {
        const message = sanitizeServerErrorMessage(error, 'Gagal memuat detail observasi.')
        res.status(500).json({ success: false, message })
    }
})

observationRoutes.post('/', async (req, res) => {
    try {
        const input = parseObservationRecordInput(req.body)
        const record = await createObservationRecord(input)
        res.status(201).json({ success: true, data: record })
    } catch (error) {
        if (error instanceof ServiceError || error instanceof InputParseError) {
            res.status(error instanceof ServiceError ? error.statusCode : error.status).json({ success: false, message: error.message })
            return
        }
        const message = sanitizeServerErrorMessage(error, 'Gagal membuat data observasi.')
        res.status(500).json({ success: false, message })
    }
})

observationRoutes.put('/:id', async (req, res) => {
    try {
        const input = req.body as ObservationRecordInput
        const record = await updateObservationRecord(req.params.id, input)
        res.json({ success: true, data: record })
    } catch (error) {
        if (error instanceof ServiceError) {
            res.status(error.statusCode).json({ success: false, message: error.message })
            return
        }
        const message = sanitizeServerErrorMessage(error, 'Gagal memperbarui data observasi.')
        res.status(500).json({ success: false, message })
    }
})

observationRoutes.delete('/:id', async (req, res) => {
    try {
        await deleteObservationRecord(req.params.id)
        res.json({ success: true, data: { id: req.params.id } })
    } catch (error) {
        if (error instanceof ServiceError) {
            res.status(error.statusCode).json({ success: false, message: error.message })
            return
        }
        const message = sanitizeServerErrorMessage(error, 'Gagal menghapus data observasi.')
        res.status(500).json({ success: false, message })
    }
})

export default observationRoutes
