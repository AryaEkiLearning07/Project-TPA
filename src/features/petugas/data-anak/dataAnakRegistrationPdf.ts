import jsPDF from 'jspdf'
import type { ChildProfile, ServicePackage } from '../../../types'

export interface DataAnakRegistrationPdfInput {
  child: ChildProfile
  logoPath?: string
}

export interface DataAnakRegistrationPdfResult {
  logoLoaded: boolean
  pageCount: number
  fileName: string
}

interface LoadedLogo {
  dataUrl: string
  width: number
  height: number
}

interface RenderContext {
  doc: jsPDF
  cursorY: number
}

const DEFAULT_LOGO_PATH = '/UBAYA-noBG.png'
const PAGE_WIDTH = 210
const LEFT_MARGIN = 18
const RIGHT_MARGIN = 18
const CONTENT_TOP = 43
const CONTENT_BOTTOM = 280
const VALUE_X = 88
const ROW_LINE_HEIGHT = 5.2

const DOC_INFO_LINES = [
  { label: 'No. Dokumen', value: 'FM-PKLP-03/-/01' },
  { label: 'No. Revisi', value: '-' },
  { label: 'Tanggal Berlaku', value: '15 Oktober 2011' },
]

const loadImageDataUrl = (path: string): Promise<LoadedLogo | null> =>
  new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        const context = canvas.getContext('2d')
        if (!context) {
          resolve(null)
          return
        }
        context.drawImage(image, 0, 0)
        resolve({
          dataUrl: canvas.toDataURL('image/png'),
          width: image.naturalWidth,
          height: image.naturalHeight,
        })
      } catch {
        resolve(null)
      }
    }
    image.onerror = () => resolve(null)
    image.src = path
  })

const formatLongDate = (isoDate: string): string => {
  const normalized = isoDate.trim()
  if (!normalized) return '-'

  const parsed = new Date(`${normalized}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return normalized
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parsed)
}

const formatGender = (value: string): string =>
  value === 'P' ? 'Perempuan' : value === 'L' ? 'Laki-laki' : '-'

const formatTimeForDoc = (value: string): string => {
  const normalized = value.trim()
  if (!normalized) return '-'
  if (/^\d{2}:\d{2}$/.test(normalized)) {
    return `Pk. ${normalized.replace(':', '.')}`
  }
  return normalized
}

const toTextValue = (value: string): string => {
  const normalized = value.trim()
  return normalized || '-'
}

const splitTextLines = (doc: jsPDF, value: string, width: number): string[] => {
  const source = value.trim() || '-'
  const segments = source.split(/\r?\n/)
  const lines: string[] = []

  for (const segment of segments) {
    const safeSegment = segment.trim() || '-'
    const wrapped = doc.splitTextToSize(safeSegment, width)
    if (Array.isArray(wrapped)) {
      lines.push(...wrapped.map((line) => String(line)))
    } else {
      lines.push(String(wrapped))
    }
  }

  return lines.length > 0 ? lines : ['-']
}

const makePickupPersonsList = (pickupPersons: string[]): string => {
  if (!Array.isArray(pickupPersons) || pickupPersons.length === 0) {
    return '-'
  }

  return pickupPersons
    .map((name, index) => {
      const label = String.fromCharCode(97 + index)
      return `${label}. ${toTextValue(name)}`
    })
    .join('\n')
}

const buildPackageLines = (selected: ServicePackage): string =>
  [
    `a. Bulanan${selected === 'bulanan' ? ' (Dipilih)' : ''}`,
    `b. 2 Mingguan${selected === '2-mingguan' ? ' (Dipilih)' : ''}`,
    `c. Harian${selected === 'harian' ? ' (Dipilih)' : ''}`,
  ].join('\n')

const sanitizeFileNamePart = (value: string): string => {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return 'anak'
  const safe = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return safe || 'anak'
}

const drawPageHeader = (
  doc: jsPDF,
  logoAsset: LoadedLogo | null,
  pageNumber: number,
  pageCount: number,
): void => {
  const headerRuleStartX = LEFT_MARGIN
  const headerRuleEndX = PAGE_WIDTH - RIGHT_MARGIN

  const maxLogoWidth = 26
  const maxLogoHeight = 20
  const logoX = LEFT_MARGIN + 3
  const logoY = 7.4

  if (logoAsset) {
    const scale = Math.min(
      maxLogoWidth / logoAsset.width,
      maxLogoHeight / logoAsset.height,
    )
    const renderWidth = logoAsset.width * scale
    const renderHeight = logoAsset.height * scale
    doc.addImage(
      logoAsset.dataUrl,
      'PNG',
      logoX,
      logoY + (maxLogoHeight - renderHeight) / 2,
      renderWidth,
      renderHeight,
    )
  }

  const boxWidth = 74
  const boxHeight = 17.6
  const boxX = PAGE_WIDTH - RIGHT_MARGIN - boxWidth
  const boxY = 7
  const rowHeight = boxHeight / 4
  const labelColWidth = 31
  const titleCenterX = (logoX + maxLogoWidth + boxX) / 2

  doc.setFont('times', 'bold')
  doc.setFontSize(12.3)
  doc.text('FORM', titleCenterX, 12.8, { align: 'center' })
  doc.text('PENDAFTARAN', titleCenterX, 18.2, { align: 'center' })

  doc.setLineWidth(0.2)
  doc.rect(boxX, boxY, boxWidth, boxHeight)
  doc.line(boxX + labelColWidth, boxY, boxX + labelColWidth, boxY + boxHeight)
  doc.line(boxX, boxY + rowHeight, boxX + boxWidth, boxY + rowHeight)
  doc.line(boxX, boxY + rowHeight * 2, boxX + boxWidth, boxY + rowHeight * 2)
  doc.line(boxX, boxY + rowHeight * 3, boxX + boxWidth, boxY + rowHeight * 3)

  const lines = [
    ...DOC_INFO_LINES,
    { label: 'Halaman', value: `${pageNumber} / ${pageCount}` },
  ]

  doc.setFontSize(7.8)
  lines.forEach((line, index) => {
    const y = boxY + rowHeight * index + 2.9
    doc.setFont('times', 'normal')
    doc.text(line.label, boxX + 1.6, y)
    doc.text(':', boxX + labelColWidth - 1.7, y)
    doc.text(line.value, boxX + labelColWidth + 1.8, y)
  })

  doc.setLineWidth(0.3)
  doc.line(headerRuleStartX, 30.4, headerRuleEndX, 30.4)
}

const ensureSpace = (context: RenderContext, height: number): void => {
  if (context.cursorY + height <= CONTENT_BOTTOM) {
    return
  }
  context.doc.addPage()
  context.cursorY = CONTENT_TOP
}

const addSectionTitle = (context: RenderContext, title: string): void => {
  ensureSpace(context, 8)
  context.doc.setFont('times', 'bold')
  context.doc.setFontSize(14)
  context.doc.text(title, LEFT_MARGIN, context.cursorY)
  context.cursorY += 6
}

const addSubTitle = (context: RenderContext, title: string): void => {
  ensureSpace(context, 6.5)
  context.doc.setFont('times', 'italic')
  context.doc.setFontSize(12.5)
  context.doc.text(title, LEFT_MARGIN, context.cursorY)
  context.cursorY += 5.2
}

const addField = (
  context: RenderContext,
  label: string,
  value: string,
  options?: {
    valueStyle?: 'normal' | 'italic'
    labelStyle?: 'normal' | 'bold'
    indent?: number
  },
): void => {
  const valueLines = splitTextLines(
    context.doc,
    value,
    PAGE_WIDTH - RIGHT_MARGIN - VALUE_X,
  )
  const requiredHeight = valueLines.length * ROW_LINE_HEIGHT + 1.2
  ensureSpace(context, requiredHeight)

  const labelX = LEFT_MARGIN + (options?.indent ?? 0)

  context.doc.setFont('times', options?.labelStyle ?? 'normal')
  context.doc.setFontSize(12.3)
  context.doc.text(label, labelX, context.cursorY)
  context.doc.text(':', VALUE_X - 2.5, context.cursorY)

  context.doc.setFont('times', options?.valueStyle ?? 'italic')
  context.doc.text(valueLines, VALUE_X, context.cursorY)

  context.cursorY += valueLines.length * ROW_LINE_HEIGHT
}

const addFieldValueBelow = (
  context: RenderContext,
  label: string,
  value: string,
  options?: {
    valueStyle?: 'normal' | 'italic'
    labelStyle?: 'normal' | 'bold'
    indent?: number
    tabIndent?: number
  },
): void => {
  const valueX = VALUE_X + (options?.tabIndent ?? 7)
  const valueLines = splitTextLines(
    context.doc,
    value,
    PAGE_WIDTH - RIGHT_MARGIN - valueX,
  )
  const requiredHeight = ROW_LINE_HEIGHT + valueLines.length * ROW_LINE_HEIGHT + 1.2
  ensureSpace(context, requiredHeight)

  const labelX = LEFT_MARGIN + (options?.indent ?? 0)
  context.doc.setFont('times', options?.labelStyle ?? 'normal')
  context.doc.setFontSize(12.3)
  context.doc.text(label, labelX, context.cursorY)
  context.doc.text(':', VALUE_X - 2.5, context.cursorY)

  context.doc.setFont('times', options?.valueStyle ?? 'normal')
  context.doc.text(valueLines, valueX, context.cursorY + ROW_LINE_HEIGHT)

  context.cursorY += ROW_LINE_HEIGHT + valueLines.length * ROW_LINE_HEIGHT
}

const addGap = (context: RenderContext, gap = 3.2): void => {
  ensureSpace(context, gap)
  context.cursorY += gap
}

const addParagraph = (
  context: RenderContext,
  text: string,
  options?: {
    fontStyle?: 'normal' | 'italic'
    fontSize?: number
    indent?: number
    lineHeight?: number
  },
): void => {
  const x = LEFT_MARGIN + (options?.indent ?? 0)
  const width = PAGE_WIDTH - RIGHT_MARGIN - x
  const lines = splitTextLines(context.doc, text, width)
  const lineHeight = options?.lineHeight ?? 4.4
  const requiredHeight = lines.length * lineHeight + 0.8
  ensureSpace(context, requiredHeight)

  context.doc.setFont('times', options?.fontStyle ?? 'normal')
  context.doc.setFontSize(options?.fontSize ?? 10.2)
  context.doc.text(lines, x, context.cursorY)
  context.cursorY += lines.length * lineHeight
}

const renderBody = (context: RenderContext, child: ChildProfile): void => {
  const birthLine = `${toTextValue(child.birthPlace)}, ${formatLongDate(child.birthDate)}`
  const packageLines = buildPackageLines(child.servicePackage)
  const pickupPersons = makePickupPersonsList(child.pickupPersons)
  const healthSummary = child.healthHistory.trim()
    ? child.healthHistory
    : child.allergy.trim()
      ? `Ada riwayat alergi (${child.allergy.trim()}).`
      : '-'
  const extraPhone = [child.homePhone, child.otherPhone]
    .map((phone) => phone.trim())
    .filter(Boolean)
    .join(' / ')

  addSectionTitle(context, 'Data anak')
  addField(context, '1. Nama lengkap', child.fullName)
  addField(context, '2. Nama panggilan', child.nickName)
  addField(context, '3. Tempat, tgl lahir', birthLine)
  addField(context, '4. Anak ke', child.childOrder)
  addField(context, '5. Jenis kelamin', formatGender(child.gender), { valueStyle: 'normal' })
  addField(context, '6. Agama', child.religion, { valueStyle: 'normal' })
  addField(context, '7. Kegiatan di luar TPA', child.outsideActivities)

  addGap(context)
  addSectionTitle(context, 'Data orang tua / wali')
  addField(context, '1. Nama ayah', child.fatherName)
  addField(context, '2. Nama ibu', child.motherName)
  addField(context, '3. Alamat rumah', child.homeAddress)
  addField(context, '4. Nomor telepon rumah', child.homePhone, { valueStyle: 'normal' })
  addField(context, '5. Alamat kantor', child.officeAddress)
  addField(context, '6. Nomor telepon lain', extraPhone, { valueStyle: 'normal' })
  addField(context, '7. E Mail', child.email, { valueStyle: 'normal' })

  addGap(context)
  addSectionTitle(context, 'Lain-lain')
  addField(context, '1. Paket layanan yang diambil', packageLines, { valueStyle: 'normal' })
  addField(
    context,
    '2. Tanggal mulai masuk',
    formatLongDate(child.serviceStartDate),
    { valueStyle: 'normal' },
  )
  addField(context, '3. Jam datang', formatTimeForDoc(child.arrivalTime), { valueStyle: 'normal' })
  addField(context, '4. Jam pulang / dijemput', formatTimeForDoc(child.departureTime), { valueStyle: 'normal' })
  addFieldValueBelow(context, '5. Nama penjemput anak (bisa lebih dari satu)', pickupPersons, {
    valueStyle: 'normal',
    tabIndent: 8,
  })
  addParagraph(
    context,
    '(Jika nama yang tercantum berhalangan menjemput, orang tua wajib menghubungi staf TPA untuk konfirmasi penjemput.)',
    { fontStyle: 'italic', indent: 3, fontSize: 10, lineHeight: 4.2 },
  )
  addField(context, '6. Mendapat informasi TPA dari berbagai sumber', '-', { valueStyle: 'normal' })
  addField(context, '7. Tujuan menitipkan anak di TPA', child.depositPurpose)

  addGap(context, 5)
  ensureSpace(context, 9)
  context.doc.setFont('times', 'bold')
  context.doc.setFontSize(14)
  context.doc.text('IDENTITAS DIRI ANAK', PAGE_WIDTH / 2, context.cursorY, {
    align: 'center',
  })
  context.cursorY += 6.5

  addSectionTitle(context, 'Perkembangan Anak')
  addField(context, 'Masa Prenatal (kandungan)', child.prenatalPeriod)
  addField(context, 'Masa Partus (kelahiran)', child.partusPeriod)
  addField(context, 'Masa Post-natal (setelah kelahiran)', child.postNatalPeriod)
  addField(context, 'a. Kemampuan motorik saat ini', child.motorSkill)
  addField(context, 'b. Kemampuan bahasa saat ini', child.languageSkill)
  addField(context, 'c. Riwayat kesehatan', healthSummary)

  addGap(context, 4.5)
  addSectionTitle(context, 'B. Kebiasaan sehari-hari')
  addSubTitle(context, 'Toilet training')
  addField(context, 'a. BAB (Buang Air Besar)', child.toiletTrainingBab)
  addField(context, 'b. BAK (Buang Air Kecil)', child.toiletTrainingBak)
  addField(context, 'c. Mandi', child.toiletTrainingBath)
  addField(context, 'Gosok gigi', child.brushingTeeth)
  addField(context, 'Makan', child.eating)
  addField(context, 'Minum susu', child.drinkingMilk)
  addField(context, 'Saat menangis', child.whenCrying)
  addField(context, 'Saat bermain', child.whenPlaying)
  addField(context, 'Tidur', child.sleeping)
  addField(context, 'Lain-lain', child.otherHabits)
}

export const downloadDataAnakRegistrationPdf = async (
  input: DataAnakRegistrationPdfInput,
): Promise<DataAnakRegistrationPdfResult> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const logoAsset = await loadImageDataUrl(input.logoPath ?? DEFAULT_LOGO_PATH)

  const context: RenderContext = {
    doc,
    cursorY: CONTENT_TOP,
  }

  renderBody(context, input.child)

  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    drawPageHeader(doc, logoAsset, page, pageCount)
  }

  const fileName = `form-pendaftaran-${sanitizeFileNamePart(input.child.fullName)}.pdf`
  doc.save(fileName)

  return {
    logoLoaded: Boolean(logoAsset),
    pageCount,
    fileName,
  }
}
