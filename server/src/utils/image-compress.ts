import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

// ===========================================================
// Image Compression Utility
// Menggunakan Sharp (libvips) untuk auto-compress gambar
// yang diupload ke server.
//
// Strategi:
// 1. Resize jika dimensi > MAX_DIMENSION (menjaga aspect ratio)
// 2. Convert ke WebP quality 80 (optimal size/quality ratio)
// 3. Return metadata untuk disimpan di tabel `attachments`
// ===========================================================

const MAX_DIMENSION = 1920; // px - max width/height
const DEFAULT_QUALITY = 80; // WebP quality (1-100)

export interface CompressResult {
    /** Compressed image buffer */
    buffer: Buffer;
    /** Original file size in bytes */
    originalSizeBytes: number;
    /** Compressed file size in bytes */
    compressedSizeBytes: number;
    /** Width setelah resize */
    width: number;
    /** Height setelah resize */
    height: number;
    /** Quality yang digunakan */
    quality: number;
    /** Output MIME type */
    mimeType: string;
    /** Persentase kompresi (misal: 72 = 72% lebih kecil) */
    compressionRatio: number;
}

/**
 * Compress gambar dari buffer.
 *
 * - Input: Buffer gambar (JPEG, PNG, WebP, TIFF, AVIF, dll)
 * - Output: WebP terkompresi + metadata
 *
 * @param inputBuffer - Buffer file gambar asli
 * @param options - Override quality atau max dimension
 */
export async function compressImage(
    inputBuffer: Buffer,
    options?: {
        quality?: number;
        maxDimension?: number;
    }
): Promise<CompressResult> {
    const quality = options?.quality ?? DEFAULT_QUALITY;
    const maxDim = options?.maxDimension ?? MAX_DIMENSION;
    const originalSizeBytes = inputBuffer.length;

    // Baca metadata gambar asli
    const metadata = await sharp(inputBuffer).metadata();
    const origWidth = metadata.width ?? 0;
    const origHeight = metadata.height ?? 0;

    // Pipeline: resize (jika perlu) → convert ke WebP
    let pipeline = sharp(inputBuffer).rotate(); // auto-rotate berdasarkan EXIF

    // Resize hanya jika gambar lebih besar dari max dimension
    if (origWidth > maxDim || origHeight > maxDim) {
        pipeline = pipeline.resize(maxDim, maxDim, {
            fit: 'inside',           // Menjaga aspect ratio
            withoutEnlargement: true // Tidak perbesar gambar kecil
        });
    }

    // Convert ke WebP dengan quality setting
    const outputBuffer = await pipeline
        .webp({ quality, effort: 4 }) // effort 4 = balance speed/compression
        .toBuffer();

    // Ambil metadata output
    const outputMeta = await sharp(outputBuffer).metadata();
    const compressedSizeBytes = outputBuffer.length;

    const compressionRatio = originalSizeBytes > 0
        ? Math.round((1 - compressedSizeBytes / originalSizeBytes) * 100)
        : 0;

    return {
        buffer: outputBuffer,
        originalSizeBytes,
        compressedSizeBytes,
        width: outputMeta.width ?? 0,
        height: outputMeta.height ?? 0,
        quality,
        mimeType: 'image/webp',
        compressionRatio
    };
}

/**
 * Compress gambar dan simpan ke disk.
 *
 * @param inputBuffer - Buffer file gambar dari upload
 * @param outputDir   - Folder tujuan (absolut)
 * @param fileName    - Nama file output (tanpa ekstensi, akan jadi .webp)
 * @returns CompressResult + filePath
 */
export async function compressAndSave(
    inputBuffer: Buffer,
    outputDir: string,
    fileName: string,
    options?: { quality?: number; maxDimension?: number }
): Promise<CompressResult & { filePath: string }> {
    // Pastikan folder ada
    await fs.mkdir(outputDir, { recursive: true });

    const result = await compressImage(inputBuffer, options);
    const outputFileName = `${fileName}.webp`;
    const filePath = path.join(outputDir, outputFileName);

    await fs.writeFile(filePath, result.buffer);

    return {
        ...result,
        filePath: outputFileName // path relatif untuk disimpan di DB
    };
}

/**
 * Cek apakah MIME type adalah gambar yang didukung Sharp
 */
export function isSupportedImage(mimeType: string): boolean {
    const supported = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/tiff',
        'image/avif',
        'image/gif',
        'image/svg+xml'
    ];
    return supported.includes(mimeType.toLowerCase());
}
