import { Router } from 'express'
import {
    createCommunicationEntry,
    deleteCommunicationEntry,
    getCommunicationEntries,
    getCommunicationEntryById,
    updateCommunicationEntry,
    ServiceError,
} from '../services/communication-service.js'
import type { CommunicationBookEntryInput } from '../types/index.js'
import {
    requireAuth,
    requirePetugasCheckedIn,
    requireRoles,
} from '../middlewares/auth-middleware.js'
import { sanitizeServerErrorMessage } from '../utils/error-sanitizer.js'
import { InputParseError, parseCommunicationBookEntryInput } from '../utils/input-parsers.js'

const communicationRoutes = Router()

communicationRoutes.use(requireAuth)
communicationRoutes.use(requireRoles('PETUGAS', 'ADMIN'))
communicationRoutes.use(requirePetugasCheckedIn)

communicationRoutes.get('/', async (req, res) => {
    try {
        const month = typeof req.query.month === 'string' ? req.query.month : undefined
        const records = await getCommunicationEntries(month)
        res.json({ success: true, data: records })
    } catch (error) {
        const message = sanitizeServerErrorMessage(error, 'Gagal memuat buku komunikasi.')
        res.status(500).json({ success: false, message })
    }
})

communicationRoutes.get('/:id', async (req, res) => {
    try {
        const record = await getCommunicationEntryById(req.params.id)
        if (!record) {
            res.status(404).json({ success: false, message: 'Data buku komunikasi tidak ditemukan.' })
            return
        }
        res.json({ success: true, data: record })
    } catch (error) {
        const message = sanitizeServerErrorMessage(error, 'Gagal memuat detail buku komunikasi.')
        res.status(500).json({ success: false, message })
    }
})

communicationRoutes.post('/', async (req, res) => {
    try {
        const input = parseCommunicationBookEntryInput(req.body)
        const record = await createCommunicationEntry(input)
        res.status(201).json({ success: true, data: record })
    } catch (error) {
        if (error instanceof ServiceError || error instanceof InputParseError) {
            res.status(error instanceof ServiceError ? error.statusCode : error.status).json({ success: false, message: error.message })
            return
        }
        const message = sanitizeServerErrorMessage(error, 'Gagal membuat data komunikasi.')
        res.status(500).json({ success: false, message })
    }
})

communicationRoutes.put('/:id', async (req, res) => {
    try {
        const input = req.body as CommunicationBookEntryInput
        const record = await updateCommunicationEntry(req.params.id, input)
        res.json({ success: true, data: record })
    } catch (error) {
        if (error instanceof ServiceError) {
            res.status(error.statusCode).json({ success: false, message: error.message })
            return
        }
        const message = sanitizeServerErrorMessage(error, 'Gagal memperbarui data komunikasi.')
        res.status(500).json({ success: false, message })
    }
})

communicationRoutes.delete('/:id', async (req, res) => {
    try {
        await deleteCommunicationEntry(req.params.id)
        res.json({ success: true, data: { id: req.params.id } })
    } catch (error) {
        if (error instanceof ServiceError) {
            res.status(error.statusCode).json({ success: false, message: error.message })
            return
        }
        const message = sanitizeServerErrorMessage(error, 'Gagal menghapus data komunikasi.')
        res.status(500).json({ success: false, message })
    }
})

export default communicationRoutes
