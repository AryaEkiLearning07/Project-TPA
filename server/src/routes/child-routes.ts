import express, { type Request, type Response } from 'express'
import {
    ServiceError,
    createChild,
    deleteChild,
    getChildById,
    getChildren,
    updateChild,
} from '../services/child-service.js'
import type { ChildProfile } from '../types/index.js'
import {
    normalizeUserRole,
    requireAuth,
    requirePetugasCheckedIn,
    requireRoles,
} from '../middlewares/auth-middleware.js'
import { sanitizeServerErrorMessage } from '../utils/error-sanitizer.js'
import { parseChildProfileInput } from '../utils/input-parsers.js'

const router = express.Router()

const respondChildError = (
    res: Response,
    error: unknown,
    fallbackMessage: string,
) => {
    if (error instanceof ServiceError) {
        res.status(error.statusCode).json({ success: false, message: error.message })
        return
    }

    if (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        typeof (error as { status?: unknown }).status === 'number'
    ) {
        const status = (error as { status: number }).status
        const message =
            error instanceof Error && error.message.trim().length > 0
                ? error.message
                : fallbackMessage
        res.status(status).json({ success: false, message })
        return
    }

    const message = sanitizeServerErrorMessage(error, fallbackMessage)
    res.status(500).json({ success: false, message })
}

const REDACTED_TEXT = '[DISENSOR]'

const shouldMaskParentData = (role: unknown): boolean =>
    normalizeUserRole(role) === 'PETUGAS'

const maskChildForPetugas = (child: ChildProfile): ChildProfile => ({
    ...child,
    fatherName: REDACTED_TEXT,
    motherName: REDACTED_TEXT,
    homeAddress: REDACTED_TEXT,
    officeAddress: REDACTED_TEXT,
    homePhone: '',
    whatsappNumber: '',
    email: '',
    otherPhone: '',
})

router.use(requireAuth)
router.use(requireRoles('PETUGAS', 'ADMIN'))
router.use(requirePetugasCheckedIn)

router.get('/', async (req: Request, res: Response) => {
    try {
        const children = await getChildren()
        const data = shouldMaskParentData(req.auth?.user.role)
            ? children.map(maskChildForPetugas)
            : children
        res.json({ success: true, data })
    } catch (error) {
        respondChildError(res, error, 'Gagal memuat data anak')
    }
})

router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params
        const child = await getChildById(id)
        if (!child) {
            res.status(404).json({ success: false, message: 'Data anak tidak ditemukan' })
            return
        }
        res.json({
            success: true,
            data: shouldMaskParentData(req.auth?.user.role)
                ? maskChildForPetugas(child)
                : child,
        })
    } catch (error) {
        respondChildError(res, error, 'Gagal memuat data anak')
    }
})

router.post('/', requireRoles('ADMIN'), async (req: Request, res: Response) => {
    try {
        const input = parseChildProfileInput(req.body)
        const newChild = await createChild(input)
        res.json({ success: true, data: newChild })
    } catch (error) {
        respondChildError(res, error, 'Gagal menambahkan data anak')
    }
})

router.put('/:id', requireRoles('ADMIN'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params
        const input = parseChildProfileInput(req.body)
        const updatedChild = await updateChild(id, input)
        res.json({ success: true, data: updatedChild })
    } catch (error) {
        respondChildError(res, error, 'Gagal mengupdate data anak')
    }
})

router.delete('/:id', requireRoles('ADMIN'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params
        await deleteChild(id)
        res.json({ success: true, data: { id } })
    } catch (error) {
        respondChildError(res, error, 'Gagal menghapus data anak')
    }
})

export default router
