interface CompressOptions {
  maxDimension?: number
  quality?: number
  aspectRatio?: number
}

const DEFAULT_MAX_DIMENSION = 1280
const DEFAULT_QUALITY = 0.75

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('Gagal membaca file gambar'))
    }
    reader.onerror = () => reject(new Error('Gagal membaca file gambar'))
    reader.readAsDataURL(file)
  })

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Gagal memproses gambar'))
    image.src = src
  })

const getScaledSize = (
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } => {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height }
  }

  if (width >= height) {
    const nextHeight = Math.round((height * maxDimension) / width)
    return { width: maxDimension, height: nextHeight }
  }

  const nextWidth = Math.round((width * maxDimension) / height)
  return { width: nextWidth, height: maxDimension }
}

export const compressImageToDataUrl = async (
  file: File,
  options?: CompressOptions,
): Promise<{ dataUrl: string; name: string }> => {
  if (!file.type.startsWith('image/')) {
    throw new Error('File harus berupa gambar')
  }

  const maxDimension = options?.maxDimension ?? DEFAULT_MAX_DIMENSION
  const quality = options?.quality ?? DEFAULT_QUALITY
  const aspectRatio = options?.aspectRatio

  const sourceDataUrl = await readFileAsDataUrl(file)
  const image = await loadImage(sourceDataUrl)

  const sourceWidth = image.width
  const sourceHeight = image.height

  let cropX = 0
  let cropY = 0
  let cropWidth = sourceWidth
  let cropHeight = sourceHeight

  if (aspectRatio && aspectRatio > 0) {
    const sourceRatio = sourceWidth / sourceHeight

    if (sourceRatio > aspectRatio) {
      cropHeight = sourceHeight
      cropWidth = Math.round(cropHeight * aspectRatio)
      cropX = Math.round((sourceWidth - cropWidth) / 2)
    } else if (sourceRatio < aspectRatio) {
      cropWidth = sourceWidth
      cropHeight = Math.round(cropWidth / aspectRatio)
      cropY = Math.round((sourceHeight - cropHeight) / 2)
    }
  }

  const scaled = getScaledSize(cropWidth, cropHeight, maxDimension)

  const canvas = document.createElement('canvas')
  canvas.width = scaled.width
  canvas.height = scaled.height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas tidak tersedia di browser ini')
  }

  context.drawImage(
    image,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    scaled.width,
    scaled.height,
  )
  const dataUrl = canvas.toDataURL('image/jpeg', quality)

  return {
    dataUrl,
    name: file.name,
  }
}
