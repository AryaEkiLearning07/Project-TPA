import path from 'node:path'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import { compressImage } from './image-compress.js'
import { UPLOADS_DIR } from '../middlewares/upload-middleware.js'

/**
 * Mendeteksi apakah string adalah Data URL (Base64)
 */
export const isBase64Image = (value: unknown): value is string => {
    if (typeof value !== 'string') return false
    return value.startsWith('data:image/') && value.includes(';base64,')
}

/**
 * Menyimpan Base64 Image ke Disk dangan Auto-Compress
 * 
 * @param base64Data - String base64 (Data URL)
 * @param prefix - Prefix nama file (misal: 'child', 'inventory')
 * @returns Path relatif file (misal: 'uploads/2026/02/child_xyz.webp')
 */
export const saveBase64ToDisk = async (
    base64Data: string,
    prefix: string = 'img'
): Promise<string> => {
    if (!isBase64Image(base64Data)) {
        return base64Data // Jika sudah berupa path, return apa adanya
    }

    // Pisahkan header Base64 dari datanya
    const [, body] = base64Data.split(';base64,')
    const buffer = Buffer.from(body, 'base64')

    // Tentukan path penyimpanan (Folder per bulan)
    const now = new Date()
    const subDir = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`
    const outputDir = path.join(UPLOADS_DIR, subDir)

    // Buat folder jika belum ada
    await fs.mkdir(outputDir, { recursive: true })

    // Kompres gambar menggunakan utility yang sudah ada
    const result = await compressImage(buffer)

    // Nama file unik
    const uniqueId = crypto.randomBytes(6).toString('hex')
    const fileName = `${prefix}_${Date.now()}_${uniqueId}.webp`
    const fullPath = path.join(outputDir, fileName)

    // Tulis ke disk
    await fs.writeFile(fullPath, result.buffer)

    // Kembalikan path relatif untuk akses via web: /uploads/2026/02/file.webp
    return `uploads/${subDir}/${fileName}`
}
