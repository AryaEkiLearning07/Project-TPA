import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { compressAndSave, isSupportedImage } from '../utils/image-compress.js';

// ===========================================================
// Upload Middleware dengan Auto-Compress
//
// Flow:
// 1. Multer menerima file dari multipart/form-data → buffer
// 2. Jika file adalah gambar → auto-compress ke WebP
// 3. Simpan file terkompresi ke disk
// 4. Attach metadata ke req.compressedFiles
// ===========================================================

// --- Config ---
const UPLOADS_DIR = path.resolve(
    process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads')
);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file
const MAX_FILES = 5;

// --- Multer config: simpan ke memory buffer dulu ---
const storage = multer.memoryStorage();

const fileFilter = (
    _req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
) => {
    // Izinkan gambar dan PDF
    const allowedMimes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'image/tiff',
        'image/avif',
        'application/pdf'
    ];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Tipe file tidak diizinkan: ${file.mimetype}`));
    }
};

// Multer instance
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: MAX_FILES
    }
});

// --- Types ---
export interface CompressedFileInfo {
    /** Nama field dari form */
    fieldName: string;
    /** Nama file asli */
    originalName: string;
    /** Path relatif file tersimpan (untuk disimpan di DB) */
    filePath: string;
    /** MIME type output */
    mimeType: string;
    /** Ukuran file asli (bytes) */
    originalSizeBytes: number;
    /** Ukuran setelah compress (bytes) */
    compressedSizeBytes: number;
    /** WebP quality */
    compressionQuality: number;
    /** Dimensi output */
    width: number;
    height: number;
    /** Persentase penghematan */
    compressionRatio: number;
}

// Extend Express Request
declare global {
    namespace Express {
        interface Request {
            compressedFiles?: CompressedFileInfo[];
        }
    }
}

/**
 * Buat unique filename berdasarkan timestamp + random hex
 */
function generateFileName(originalName: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(6).toString('hex');
    const ext = path.extname(originalName).toLowerCase();
    const baseName = path.basename(originalName, ext)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 40);
    return `${timestamp}_${random}_${baseName}`;
}

/**
 * Middleware: upload single file + auto-compress
 *
 * Contoh penggunaan:
 * ```ts
 * router.post('/child/photo', uploadSingle('photo'), (req, res) => {
 *   const file = req.compressedFiles?.[0];
 *   // INSERT ke tabel attachments...
 * });
 * ```
 */
export function uploadSingle(fieldName: string) {
    return [
        upload.single(fieldName),
        autoCompressMiddleware
    ];
}

/**
 * Middleware: upload multiple files + auto-compress
 *
 * Contoh penggunaan:
 * ```ts
 * router.post('/incident/photos', uploadMultiple('photos', 5), (req, res) => {
 *   const files = req.compressedFiles ?? [];
 *   // INSERT ke tabel attachments...
 * });
 * ```
 */
export function uploadMultiple(fieldName: string, maxCount: number = MAX_FILES) {
    return [
        upload.array(fieldName, maxCount),
        autoCompressMiddleware
    ];
}

/**
 * Middleware: upload dari beberapa field sekaligus + auto-compress
 *
 * Contoh penggunaan:
 * ```ts
 * router.post('/attendance', uploadFields([
 *   { name: 'escort_signature', maxCount: 1 },
 *   { name: 'pickup_signature', maxCount: 1 }
 * ]), (req, res) => {
 *   const files = req.compressedFiles ?? [];
 * });
 * ```
 */
export function uploadFields(fields: multer.Field[]) {
    return [
        upload.fields(fields),
        autoCompressMiddleware
    ];
}

/**
 * Auto-compress middleware.
 * Dijalankan SETELAH multer memparse file ke memory buffer.
 * Compress semua gambar → simpan ke disk → attach metadata ke req.
 */
async function autoCompressMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction
): Promise<void> {
    try {
        // Kumpulkan semua file dari berbagai multer modes
        const files: Express.Multer.File[] = [];

        if (req.file) {
            files.push(req.file);
        }
        if (Array.isArray(req.files)) {
            files.push(...req.files);
        } else if (req.files && typeof req.files === 'object') {
            // req.files dari upload.fields() = { [fieldName]: File[] }
            for (const fieldFiles of Object.values(req.files)) {
                files.push(...fieldFiles);
            }
        }

        if (files.length === 0) {
            req.compressedFiles = [];
            return next();
        }

        // Buat subfolder berdasarkan bulan: uploads/2026/02/
        const now = new Date();
        const subDir = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
        const outputDir = path.join(UPLOADS_DIR, subDir);

        const results: CompressedFileInfo[] = [];

        for (const file of files) {
            const uniqueName = generateFileName(file.originalname);

            if (isSupportedImage(file.mimetype)) {
                // Gambar → compress ke WebP
                const result = await compressAndSave(
                    file.buffer,
                    outputDir,
                    uniqueName
                );

                results.push({
                    fieldName: file.fieldname,
                    originalName: file.originalname,
                    filePath: `${subDir}/${result.filePath}`,
                    mimeType: result.mimeType,
                    originalSizeBytes: result.originalSizeBytes,
                    compressedSizeBytes: result.compressedSizeBytes,
                    compressionQuality: result.quality,
                    width: result.width,
                    height: result.height,
                    compressionRatio: result.compressionRatio
                });
            } else {
                // Non-image (PDF, dll) → simpan langsung tanpa compress
                const { promises: fsPromises } = await import('fs');
                const outputFileName = `${uniqueName}${path.extname(file.originalname)}`;
                const outputPath = path.join(outputDir, outputFileName);

                await fsPromises.mkdir(outputDir, { recursive: true });
                await fsPromises.writeFile(outputPath, file.buffer);

                results.push({
                    fieldName: file.fieldname,
                    originalName: file.originalname,
                    filePath: `${subDir}/${outputFileName}`,
                    mimeType: file.mimetype,
                    originalSizeBytes: file.buffer.length,
                    compressedSizeBytes: file.buffer.length,
                    compressionQuality: 100,
                    width: 0,
                    height: 0,
                    compressionRatio: 0
                });
            }
        }

        req.compressedFiles = results;
        next();
    } catch (error) {
        next(error);
    }
}

// --- Static file serving helper ---
export { UPLOADS_DIR };
