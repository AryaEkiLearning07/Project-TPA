import express, { type Request, type Response } from 'express'
import {
    createSupplyItem,
    deleteSupplyItem,
    getSupplyInventory,
    ServiceError,
    updateSupplyItem,
} from '../services/supply-inventory-service.js'
import {
    requireAuth,
    requirePetugasCheckedIn,
    requireRoles,
} from '../middlewares/auth-middleware.js'
import { sanitizeServerErrorMessage } from '../utils/error-sanitizer.js'
import { parseSupplyInventoryItemInput } from '../utils/input-parsers.js'

const router = express.Router()

router.use(requireAuth)
router.use(requireRoles('PETUGAS', 'ADMIN'))
router.use(requirePetugasCheckedIn)

router.get('/', async (_req: Request, res: Response) => {
    try {
        const items = await getSupplyInventory()
        res.json({ success: true, data: items })
    } catch {
        res.status(500).json({ success: false, message: 'Gagal memuat inventori' })
    }
})

router.post('/', async (req: Request, res: Response) => {
    try {
        const input = parseSupplyInventoryItemInput(req.body)
        const newItem = await createSupplyItem(input)
        res.json({ success: true, data: newItem })
    } catch (error) {
        const status = error instanceof ServiceError ? error.statusCode : 500
        const message = error instanceof ServiceError
            ? error.message
            : sanitizeServerErrorMessage(error, 'Gagal menambahkan item inventori')
        res
            .status(status)
            .json({ success: false, message })
    }
})

router.put('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params
        const input = parseSupplyInventoryItemInput(req.body)
        const updatedItem = await updateSupplyItem(id, input)
        res.json({ success: true, data: updatedItem })
    } catch (error) {
        const status = error instanceof ServiceError ? error.statusCode : 500
        const message = error instanceof ServiceError
            ? error.message
            : sanitizeServerErrorMessage(error, 'Gagal mengupdate item inventori')
        res
            .status(status)
            .json({ success: false, message })
    }
})

router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params
        await deleteSupplyItem(id)
        res.json({ success: true, data: { id } })
    } catch (error) {
        const status = error instanceof ServiceError ? error.statusCode : 500
        const message = error instanceof ServiceError
            ? error.message
            : sanitizeServerErrorMessage(error, 'Gagal menghapus item inventori')
        res
            .status(status)
            .json({ success: false, message })
    }
})

export default router
