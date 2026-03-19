import { Router } from 'express'
import {
    createAttendanceRecord,
    deleteAttendanceRecord,
    getAttendanceRecords,
    getAttendanceRecordById,
    updateAttendanceRecord,
    ServiceError,
} from '../services/attendance-service.js'
import type { AttendanceRecordInput } from '../types/index.js'
import {
    requireAuth,
    requirePetugasCheckedIn,
    requireRoles,
} from '../middlewares/auth-middleware.js'
import { sanitizeServerErrorMessage } from '../utils/error-sanitizer.js'
import { InputParseError, parseAttendanceRecordInput } from '../utils/input-parsers.js'

const attendanceRoutes = Router()

attendanceRoutes.use(requireAuth)
attendanceRoutes.use(requireRoles('PETUGAS', 'ADMIN'))
attendanceRoutes.use(requirePetugasCheckedIn)

attendanceRoutes.get('/', async (req, res) => {
    try {
        const month = typeof req.query.month === 'string' ? req.query.month : undefined
        const records = await getAttendanceRecords(month)
        res.json({ success: true, data: records })
    } catch (error) {
        const message = sanitizeServerErrorMessage(error, 'Gagal memuat data kehadiran.')
        res.status(500).json({ success: false, message })
    }
})

attendanceRoutes.get('/:id', async (req, res) => {
    try {
        const record = await getAttendanceRecordById(req.params.id)
        if (!record) {
            res.status(404).json({ success: false, message: 'Data kehadiran tidak ditemukan.' })
            return
        }
        res.json({ success: true, data: record })
    } catch (error) {
        const message = sanitizeServerErrorMessage(error, 'Gagal memuat detail kehadiran.')
        res.status(500).json({ success: false, message })
    }
})

attendanceRoutes.post('/', async (req, res) => {
    try {
        const input = parseAttendanceRecordInput(req.body)
        const record = await createAttendanceRecord(input)
        res.status(201).json({ success: true, data: record })
    } catch (error) {
        if (error instanceof ServiceError || error instanceof InputParseError) {
            res.status(error instanceof ServiceError ? error.statusCode : error.status).json({ success: false, message: error.message })
            return
        }
        const message = sanitizeServerErrorMessage(error, 'Gagal membuat data kehadiran.')
        res.status(500).json({ success: false, message })
    }
})

attendanceRoutes.put('/:id', async (req, res) => {
    try {
        const input = req.body as AttendanceRecordInput
        const record = await updateAttendanceRecord(req.params.id, input)
        res.json({ success: true, data: record })
    } catch (error) {
        if (error instanceof ServiceError || error instanceof InputParseError) {
            res.status(error instanceof ServiceError ? error.statusCode : error.status).json({ success: false, message: error.message })
            return
        }
        const message = sanitizeServerErrorMessage(error, 'Gagal memperbarui data kehadiran.')
        res.status(500).json({ success: false, message })
    }
})

attendanceRoutes.delete('/:id', async (req, res) => {
    try {
        await deleteAttendanceRecord(req.params.id)
        res.json({ success: true, data: { id: req.params.id } })
    } catch (error) {
        if (error instanceof ServiceError) {
            res.status(error.statusCode).json({ success: false, message: error.message })
            return
        }
        const message = sanitizeServerErrorMessage(error, 'Gagal menghapus data kehadiran.')
        res.status(500).json({ success: false, message })
    }
})

export default attendanceRoutes
