import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

type LandingAssetSpec = {
  inputFile: string
  outputBaseName: string
  maxWidth?: number
  maxHeight?: number
  webpQuality?: number
  avifQuality?: number
}

type GeneratedAssetInfo = {
  inputFile: string
  outputFile: string
  originalSizeBytes: number
  outputSizeBytes: number
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRootDir = path.resolve(scriptDir, '../../..')
const publicDir = path.join(projectRootDir, 'public')
const optimizedDir = path.join(publicDir, 'optimized')

const LANDING_ASSETS: LandingAssetSpec[] = [
  {
    inputFile: 'hero2-desktop.jpg',
    outputBaseName: 'hero-home-desktop',
    maxWidth: 1920,
    maxHeight: 1080,
    webpQuality: 76,
    avifQuality: 58,
  },
  {
    inputFile: 'hero2-mobile.jpg',
    outputBaseName: 'hero-home-mobile',
    maxWidth: 960,
    maxHeight: 1600,
    webpQuality: 74,
    avifQuality: 56,
  },
  {
    inputFile: 'hero1.png',
    outputBaseName: 'about-head',
    maxWidth: 1200,
    maxHeight: 1200,
    webpQuality: 74,
    avifQuality: 52,
  },
  {
    inputFile: 'event.jpg',
    outputBaseName: 'gallery-event-default',
    maxWidth: 1400,
    maxHeight: 1400,
    webpQuality: 74,
    avifQuality: 54,
  },
  {
    inputFile: 'logo_TPA.jpg',
    outputBaseName: 'logo-tpa',
    maxWidth: 900,
    maxHeight: 900,
    webpQuality: 82,
    avifQuality: 62,
  },
]

const humanizeBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const toPercent = (before: number, after: number): string => {
  if (before <= 0) return '0%'
  const ratio = ((before - after) / before) * 100
  return `${Math.max(0, ratio).toFixed(1)}%`
}

const generateVariant = async (
  spec: LandingAssetSpec,
  format: 'webp' | 'avif',
): Promise<GeneratedAssetInfo> => {
  const inputPath = path.join(publicDir, spec.inputFile)
  const outputFile = `${spec.outputBaseName}.${format}`
  const outputPath = path.join(optimizedDir, outputFile)

  const sourceBuffer = await fs.readFile(inputPath)
  let pipeline = sharp(sourceBuffer).rotate()

  if (spec.maxWidth || spec.maxHeight) {
    pipeline = pipeline.resize({
      width: spec.maxWidth,
      height: spec.maxHeight,
      fit: 'inside',
      withoutEnlargement: true,
    })
  }

  if (format === 'webp') {
    await pipeline
      .webp({
        quality: spec.webpQuality ?? 75,
        effort: 5,
      })
      .toFile(outputPath)
  } else {
    await pipeline
      .avif({
        quality: spec.avifQuality ?? 55,
        effort: 4,
      })
      .toFile(outputPath)
  }

  const [inputStat, outputStat] = await Promise.all([
    fs.stat(inputPath),
    fs.stat(outputPath),
  ])

  return {
    inputFile: spec.inputFile,
    outputFile,
    originalSizeBytes: inputStat.size,
    outputSizeBytes: outputStat.size,
  }
}

const optimizeLandingAssets = async (): Promise<void> => {
  await fs.mkdir(optimizedDir, { recursive: true })
  const reports: GeneratedAssetInfo[] = []

  for (const spec of LANDING_ASSETS) {
    const inputPath = path.join(publicDir, spec.inputFile)
    try {
      await fs.access(inputPath)
    } catch {
      console.warn(`Skip: source tidak ditemukan -> ${inputPath}`)
      continue
    }

    reports.push(await generateVariant(spec, 'webp'))
    reports.push(await generateVariant(spec, 'avif'))
  }

  if (reports.length === 0) {
    console.log('Tidak ada asset yang diproses.')
    return
  }

  console.log('Landing image optimization summary:')
  for (const report of reports) {
    console.log(
      `- ${report.inputFile} -> optimized/${report.outputFile} | ${humanizeBytes(report.originalSizeBytes)} -> ${humanizeBytes(report.outputSizeBytes)} (${toPercent(report.originalSizeBytes, report.outputSizeBytes)} lebih kecil)`,
    )
  }
}

optimizeLandingAssets().catch((error) => {
  console.error('Gagal optimize landing assets:', error)
  process.exitCode = 1
})
