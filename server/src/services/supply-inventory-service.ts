import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import { dbPool } from '../config/database.js'
import type { SupplyInventoryItem, SupplyInventoryItemInput } from '../types/index.js'
import { toText } from '../utils/string-utils.js'
import { saveBase64ToDisk } from '../utils/base64-storage.js'

import { ServiceError } from '../utils/service-error.js'
export { ServiceError }

interface SupplyRow extends RowDataPacket {
    id: number
    child_id: number
    product_name: string
    category: string
    quantity: number
    description: string | null
    image_path: string | null
    image_name: string | null
    created_at: string
    updated_at: string
}

const mapRow = (row: SupplyRow): SupplyInventoryItem => ({
    id: String(row.id),
    childId: String(row.child_id),
    productName: toText(row.product_name),
    category: toText(row.category),
    quantity: Number(row.quantity) || 0,
    description: toText(row.description),
    imageDataUrl: toText(row.image_path),
    imageName: toText(row.image_name),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
})

const normalizeInput = (input: SupplyInventoryItemInput): SupplyInventoryItemInput => ({
    childId: toText(input.childId).trim(),
    productName: toText(input.productName).trim(),
    category: toText(input.category).trim(),
    quantity: Number.isFinite(input.quantity) ? Math.max(0, Math.floor(input.quantity)) : 0,
    description: toText(input.description).trim(),
    imageDataUrl: toText(input.imageDataUrl).trim(),
    imageName: toText(input.imageName).trim(),
})

const validateInput = (input: SupplyInventoryItemInput): void => {
    if (!input.childId) throw new ServiceError(400, 'Nama anak wajib diisi')
    if (!input.productName) throw new ServiceError(400, 'Nama barang wajib diisi')
    if (!input.category) throw new ServiceError(400, 'Kategori barang wajib diisi')
}

export const getSupplyInventory = async (): Promise<SupplyInventoryItem[]> => {
    const [rows] = await dbPool.query<SupplyRow[]>(
        'SELECT * FROM supply_inventory ORDER BY created_at DESC'
    )
    return rows.map(mapRow)
}

export const createSupplyItem = async (input: SupplyInventoryItemInput): Promise<SupplyInventoryItem> => {
    const normalized = normalizeInput(input)
    validateInput(normalized)

    const childId = parseInt(normalized.childId, 10)
    if (!childId || isNaN(childId)) throw new ServiceError(400, 'ID Anak tidak valid.')

    const imagePath = await saveBase64ToDisk(normalized.imageDataUrl || '', 'inventory')

    const [result] = await dbPool.execute<ResultSetHeader>(
        `INSERT INTO supply_inventory (child_id, product_name, category, quantity, description, image_path, image_name)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [childId, normalized.productName, normalized.category, normalized.quantity, normalized.description || null, imagePath || null, normalized.imageName || null]
    )

    const [rows] = await dbPool.query<SupplyRow[]>('SELECT * FROM supply_inventory WHERE id = ?', [result.insertId])
    if (rows.length === 0) throw new ServiceError(500, 'Gagal membaca item setelah insert')
    return mapRow(rows[0])
}

export const updateSupplyItem = async (id: string, input: SupplyInventoryItemInput): Promise<SupplyInventoryItem> => {
    const normalized = normalizeInput(input)
    validateInput(normalized)

    const itemId = parseInt(id, 10)
    if (!itemId || isNaN(itemId)) throw new ServiceError(400, 'ID Barang tidak valid.')

    const childId = parseInt(normalized.childId, 10)
    if (!childId || isNaN(childId)) throw new ServiceError(400, 'ID Anak tidak valid.')

    const imagePath = await saveBase64ToDisk(normalized.imageDataUrl || '', 'inventory')

    const [result] = await dbPool.execute<ResultSetHeader>(
        `UPDATE supply_inventory SET child_id = ?, product_name = ?, category = ?, quantity = ?, description = ?, image_path = ?, image_name = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [childId, normalized.productName, normalized.category, normalized.quantity, normalized.description || null, imagePath || null, normalized.imageName || null, itemId]
    )

    if (result.affectedRows === 0) throw new ServiceError(404, 'Item inventori tidak ditemukan.')

    const [rows] = await dbPool.query<SupplyRow[]>('SELECT * FROM supply_inventory WHERE id = ?', [itemId])
    if (rows.length === 0) throw new ServiceError(500, 'Gagal membaca item setelah update')
    return mapRow(rows[0])
}

export const deleteSupplyItem = async (id: string): Promise<void> => {
    const itemId = parseInt(id, 10)
    if (!itemId || isNaN(itemId)) throw new ServiceError(400, 'ID Barang tidak valid.')

    const [result] = await dbPool.execute<ResultSetHeader>(
        'DELETE FROM supply_inventory WHERE id = ?',
        [itemId]
    )

    if (result.affectedRows === 0) throw new ServiceError(404, 'Item inventori tidak ditemukan.')
}
