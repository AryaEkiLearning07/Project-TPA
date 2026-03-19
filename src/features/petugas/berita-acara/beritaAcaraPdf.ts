import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  INCIDENT_PRINTABLE_CATEGORY_KEYS,
  type PrintableIncidentCategoryKey,
} from '../../../constants/incident-categories'
import type {
  AttendanceRecord,
  ChildProfile,
  IncidentCarriedItem,
  IncidentReport,
} from '../../../types'

export interface BeritaAcaraPdfInput {
  filterDate: string
  headerLabel?: string
  reports: IncidentReport[]
  attendanceRecords: AttendanceRecord[]
  childrenData: ChildProfile[]
  logoPath?: string
}

export interface BeritaAcaraPdfResult {
  logoLoaded: boolean
  pageCount: number
}

interface LoadedLogo {
  dataUrl: string
  width: number
  height: number
}

const ISO_LINES = [
  { label: 'No. Dokumen', value: 'FM-PKLP-03/01/01' },
  { label: 'No. Revisi', value: '-' },
  { label: 'Tanggal Berlaku', value: '15 Oktober 2011' },
]

const DEFAULT_LOGO_PATH = '/UBAYA-noBG.png'
const PAGE_MARGIN_X = 10
const TABLE_START_Y = 47
const CHILD_PER_PAGE = 3
const HEADER_RULE_INSET = 2
const TABLE_COLUMN_WIDTHS = [55, 45, 45, 45] as const
const BODY_ROW_MIN_HEIGHT: Record<number, number> = {
  0: 9,
  1: 8,
  2: 8,
  3: 8,
  4: 8,
  5: 20,
  6: 11,
  7: 11,
  8: 11,
  9: 11,
  10: 14,
  11: 14,
  12: 14,
  13: 24,
  14: 16,
  15: 16,
}

const chunk = <T,>(items: T[], size: number): T[][] => {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

const toValidTimestamp = (value: string): number => {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER
}

const compareDateTimeAsc = (left: string, right: string): number => {
  const diff = toValidTimestamp(left) - toValidTimestamp(right)
  if (diff !== 0) {
    return diff
  }
  return left.localeCompare(right, 'id')
}

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

const toSentenceCase = (value: string): string => {
  const normalized = value.trim()
  if (!normalized) {
    return ''
  }
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`
}

const formatReadableDate = (isoDate: string): string => {
  const parsed = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return isoDate
  }
  return parsed.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

const createLegacyItemsFromReport = (report: IncidentReport): IncidentCarriedItem[] => {
  const items: IncidentCarriedItem[] = []
  const pushValue = (
    categoryKey: PrintableIncidentCategoryKey,
    rawValue: string,
  ) => {
    const value = rawValue.trim()
    if (!value) {
      return
    }
    items.push({
      id: `legacy-item-${items.length}`,
      categoryKey,
      description: value,
    })
  }

  pushValue(
    'DRINKING_BOTTLE',
    report.mealEquipment.drinkingBottle.description ||
      report.mealEquipment.drinkingBottle.brand ||
      '',
  )
  pushValue(
    'MILK_CONTAINER',
    report.mealEquipment.milkBottle.description ||
      report.mealEquipment.milkBottle.brand ||
      '',
  )
  pushValue(
    'MEAL_CONTAINER',
    report.mealEquipment.mealContainer.description ||
      report.mealEquipment.mealContainer.brand ||
      '',
  )
  pushValue(
    'SNACK_CONTAINER',
    report.mealEquipment.snackContainer.description ||
      report.mealEquipment.snackContainer.brand ||
      '',
  )
  pushValue('BATH_SUPPLIES', report.bathEquipment || '')
  pushValue('MEDICINE_VITAMIN', report.medicines || '')
  pushValue('BAG', report.bag || '')

  return items
}

const getIncidentItems = (report: IncidentReport): IncidentCarriedItem[] =>
  Array.isArray(report.carriedItems) && report.carriedItems.length > 0
    ? report.carriedItems
    : createLegacyItemsFromReport(report)

const getPrintableCellValue = (
  report: IncidentReport,
  categoryKey: PrintableIncidentCategoryKey,
): string => {
  const values = getIncidentItems(report)
    .filter((item) => item.categoryKey === categoryKey)
    .map((item) => item.description.trim())
    .filter(Boolean)
  return values.join('\n')
}

const drawHeader = (
  doc: jsPDF,
  printableDate: string,
  logoAsset: LoadedLogo | null,
): void => {
  const pageWidth = doc.internal.pageSize.getWidth()
  const rightEdge = pageWidth - PAGE_MARGIN_X
  const headerRuleStartX = PAGE_MARGIN_X + HEADER_RULE_INSET
  const headerRuleEndX = rightEdge - HEADER_RULE_INSET

  const maxLogoWidth = 26
  const maxLogoHeight = 18
  const logoX = headerRuleStartX
  let logoCenterX = logoX + maxLogoWidth / 2
  if (logoAsset) {
    const scale = Math.min(
      maxLogoWidth / logoAsset.width,
      maxLogoHeight / logoAsset.height,
    )
    const renderWidth = logoAsset.width * scale
    const renderHeight = logoAsset.height * scale
    logoCenterX = logoX + renderWidth / 2
    doc.addImage(
      logoAsset.dataUrl,
      'PNG',
      logoX,
      7.4 + (maxLogoHeight - renderHeight) / 2,
      renderWidth,
      renderHeight,
    )
  }

  const boxWidth = 79
  const boxHeight = 18.4
  const boxX = rightEdge - boxWidth - 2.4
  const boxY = 7.6
  const rowHeight = boxHeight / 3
  const labelColWidth = 30
  const isoCenterX = boxX + boxWidth / 2
  const titleCenterX = (logoCenterX + isoCenterX) / 2

  doc.setFont('times', 'bold')
  doc.setFontSize(11.5)
  doc.text('FORM', titleCenterX, 13.3, { align: 'center' })
  doc.text('BERITA ACARA', titleCenterX, 19.2, { align: 'center' })

  doc.setLineWidth(0.25)
  doc.rect(boxX, boxY, boxWidth, boxHeight)
  doc.line(boxX + labelColWidth, boxY, boxX + labelColWidth, boxY + boxHeight)
  doc.line(boxX, boxY + rowHeight, boxX + boxWidth, boxY + rowHeight)
  doc.line(boxX, boxY + rowHeight * 2, boxX + boxWidth, boxY + rowHeight * 2)

  doc.setFont('times', 'bold')
  doc.setFontSize(8.4)
  ISO_LINES.forEach((line, index) => {
    const y = boxY + rowHeight * index + 4.25
    doc.text(line.label, boxX + 1.8, y)
    doc.text(':', boxX + labelColWidth - 1.7, y)
    doc.setFont('times', 'normal')
    doc.text(line.value, boxX + labelColWidth + 1.8, y)
    doc.setFont('times', 'bold')
  })

  doc.setLineWidth(0.36)
  doc.line(headerRuleStartX, 30.8, headerRuleEndX, 30.8)
  doc.setFont('times', 'bold')
  doc.setFontSize(10.6)
  doc.text('Hari/Tanggal :', headerRuleStartX + 2, 38.4)
  doc.setFont('times', 'normal')
  doc.setFontSize(9.3)
  doc.text(printableDate, headerRuleStartX + 27.3, 38.4)
}

const drawFooterSignArea = (doc: jsPDF): void => {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const leftCenterX = pageWidth * 0.28
  const rightCenterX = pageWidth * 0.72
  const titleY = pageHeight - 16.2
  const lineY = pageHeight - 8.3
  const lineWidth = 49

  doc.setFont('times', 'bold')
  doc.setFontSize(10.4)
  doc.text('PENDAMPING ANAK PAGI', leftCenterX, titleY, { align: 'center' })
  doc.text('PENDAMPING ANAK SIANG', rightCenterX, titleY, { align: 'center' })

  doc.setLineWidth(0.25)
  doc.line(leftCenterX - lineWidth / 2, lineY, leftCenterX + lineWidth / 2, lineY)
  doc.line(
    rightCenterX - lineWidth / 2,
    lineY,
    rightCenterX + lineWidth / 2,
    lineY,
  )
}

const getCellText = (value: string): string => {
  return value.trim()
}

const getAdaptiveCellFontSize = (rawValue: string): number => {
  const value = rawValue.trim()
  if (!value) {
    return 8
  }

  const lines = value.split('\n').map((line) => line.trim())
  const longestLineLength = lines.reduce(
    (currentMax, line) => Math.max(currentMax, line.length),
    0,
  )

  if (longestLineLength >= 45 || lines.length >= 6) {
    return 6.4
  }
  if (longestLineLength >= 34 || lines.length >= 5) {
    return 6.8
  }
  if (longestLineLength >= 24 || lines.length >= 3) {
    return 7.3
  }
  return 8
}

const buildTableHeadRows = (chunkReports: IncidentReport[]) => {
  const names = chunkReports.map((report) => getCellText(report.childId))
  while (names.length < CHILD_PER_PAGE) {
    names.push('-')
  }

  return [
    [
      { content: 'HAL YANG PERLU\nDIPERHATIKAN', rowSpan: 2 },
      { content: 'NAMA ANAK', colSpan: 3 },
    ],
    names.map((name) => ({ content: name })),
  ]
}

const buildBodyRows = (chunkReports: IncidentReport[]): string[][] => {
  const padded: Array<IncidentReport | null> = [...chunkReports]
  while (padded.length < CHILD_PER_PAGE) {
    padded.push(null)
  }

  const getValue = (
    report: IncidentReport | null,
    reader: (item: IncidentReport) => string,
  ): string => (report ? getCellText(reader(report)) : '')

  return [
    [
      '1. KONDISI ANAK (datang)\n   a. kondisi fisik',
      ...padded.map((report) =>
        getValue(report, (item) => toSentenceCase(item.arrivalPhysicalCondition)),
      ),
    ],
    [
      '   b. kondisi emosi',
      ...padded.map((report) =>
        getValue(report, (item) => toSentenceCase(item.arrivalEmotionalCondition)),
      ),
    ],
    ['KONDISI ANAK (pulang)', '', '', ''],
    [
      '   a. kondisi fisik',
      ...padded.map((report) =>
        getValue(report, (item) => toSentenceCase(item.departurePhysicalCondition)),
      ),
    ],
    [
      '   b. kondisi emosi',
      ...padded.map((report) =>
        getValue(report, (item) => toSentenceCase(item.departureEmotionalCondition)),
      ),
    ],
    [
      '2. PERLENGKAPAN\n    MAKAN\n   a. tempat minum',
      ...padded.map((report) =>
        getValue(report, (item) => getPrintableCellValue(item, 'DRINKING_BOTTLE')),
      ),
    ],
    [
      '   b. tempat susu',
      ...padded.map((report) =>
        getValue(report, (item) => getPrintableCellValue(item, 'MILK_CONTAINER')),
      ),
    ],
    [
      '   c. tempat makan/sayur',
      ...padded.map((report) =>
        getValue(report, (item) => getPrintableCellValue(item, 'MEAL_CONTAINER')),
      ),
    ],
    [
      '   d. tempat kue',
      ...padded.map((report) =>
        getValue(report, (item) => getPrintableCellValue(item, 'SNACK_CONTAINER')),
      ),
    ],
    [
      '3. PERLENGKAPAN MANDI',
      ...padded.map((report) =>
        getValue(report, (item) => getPrintableCellValue(item, 'BATH_SUPPLIES')),
      ),
    ],
    [
      '4. LAIN-LAIN\n   a. obat / vitamin',
      ...padded.map((report) =>
        getValue(report, (item) => getPrintableCellValue(item, 'MEDICINE_VITAMIN')),
      ),
    ],
    [
      '   b. tas',
      ...padded.map((report) =>
        getValue(report, (item) => getPrintableCellValue(item, 'BAG')),
      ),
    ],
    [
      'PESAN DARI ORANG TUA',
      ...padded.map((report) => getValue(report, (item) => item.parentMessage)),
    ],
    [
      'PESAN UTK ORANG TUA',
      ...padded.map((report) => getValue(report, (item) => item.messageForParent)),
    ],
    [
      'Catatan / keterangan',
      ...padded.map((report) => getValue(report, (item) => item.notes)),
    ],
    ['Tanda tangan orang tua', ...padded.map(() => '1.\n\n2.')],
  ]
}

const subPointRowIndexes = new Set([1, 3, 4, 6, 7, 8, 11])
const centerAlignedDataRowIndexes = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
const messageRowIndexes = new Set([12, 13])

export const downloadBeritaAcaraPdf = async (
  input: BeritaAcaraPdfInput,
): Promise<BeritaAcaraPdfResult> => {
  if (input.reports.length === 0) {
    throw new Error('Tidak ada data berita acara untuk dicetak.')
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    format: 'a4',
    unit: 'mm',
  })

  const printableKeySet = new Set<PrintableIncidentCategoryKey>(
    INCIDENT_PRINTABLE_CATEGORY_KEYS,
  )
  if (printableKeySet.size === 0) {
    throw new Error('Kategori cetak berita acara belum tersedia')
  }

  const childNameById = new Map(
    input.childrenData.map((child) => [child.id, child.fullName]),
  )

  const sortedAttendance = input.attendanceRecords
    .filter(
      (record) =>
        record.date === input.filterDate && record.arrivalTime.trim().length > 0,
    )
    .sort((left, right) => {
      const byArrival = left.arrivalTime.localeCompare(right.arrivalTime, 'id')
      if (byArrival !== 0) {
        return byArrival
      }
      const byCreated = compareDateTimeAsc(left.createdAt, right.createdAt)
      if (byCreated !== 0) {
        return byCreated
      }
      return left.childId.localeCompare(right.childId, 'id')
    })

  const attendanceOrderByChildId = new Map<string, number>()
  sortedAttendance.forEach((record) => {
    if (!attendanceOrderByChildId.has(record.childId)) {
      attendanceOrderByChildId.set(record.childId, attendanceOrderByChildId.size)
    }
  })

  const sortedReports = [...input.reports].sort((left, right) => {
    const leftOrder = attendanceOrderByChildId.get(left.childId)
    const rightOrder = attendanceOrderByChildId.get(right.childId)
    const leftHasOrder = leftOrder !== undefined
    const rightHasOrder = rightOrder !== undefined

    if (leftHasOrder && rightHasOrder) {
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder
      }
      const byCreatedAt = compareDateTimeAsc(left.createdAt, right.createdAt)
      if (byCreatedAt !== 0) {
        return byCreatedAt
      }
      return left.childId.localeCompare(right.childId, 'id')
    }

    if (leftHasOrder) {
      return -1
    }
    if (rightHasOrder) {
      return 1
    }

    const byCreatedAt = compareDateTimeAsc(left.createdAt, right.createdAt)
    if (byCreatedAt !== 0) {
      return byCreatedAt
    }

    const leftName = childNameById.get(left.childId) || left.childId
    const rightName = childNameById.get(right.childId) || right.childId
    const byName = leftName.localeCompare(rightName, 'id')
    if (byName !== 0) {
      return byName
    }
    return left.childId.localeCompare(right.childId, 'id')
  })

  const pageChunks = chunk(sortedReports, CHILD_PER_PAGE)
  const logoAsset = await loadImageDataUrl(input.logoPath ?? DEFAULT_LOGO_PATH)
  const printableDate = input.headerLabel?.trim() || formatReadableDate(input.filterDate)

  pageChunks.forEach((pageReports, pageIndex) => {
    if (pageIndex > 0) {
      doc.addPage()
    }

    const reportWithNames = pageReports.map((report) => ({
      ...report,
      childId: childNameById.get(report.childId) || report.childId,
    }))

    drawHeader(doc, printableDate, logoAsset)

    const body = buildBodyRows(reportWithNames)
    const tableHeadRows = buildTableHeadRows(reportWithNames)

    autoTable(doc, {
      startY: TABLE_START_Y,
      margin: {
        left: PAGE_MARGIN_X,
        right: PAGE_MARGIN_X,
        top: TABLE_START_Y,
        bottom: 20,
      },
      tableWidth: 190,
      theme: 'grid',
      head: tableHeadRows,
      body,
      styles: {
        font: 'times',
        fontSize: 8,
        cellPadding: 1.05,
        lineWidth: 0.22,
        lineColor: [45, 45, 45],
        textColor: [0, 0, 0],
        overflow: 'linebreak',
        valign: 'top',
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
      },
      columnStyles: {
        0: { cellWidth: TABLE_COLUMN_WIDTHS[0] },
        1: { cellWidth: TABLE_COLUMN_WIDTHS[1] },
        2: { cellWidth: TABLE_COLUMN_WIDTHS[2] },
        3: { cellWidth: TABLE_COLUMN_WIDTHS[3] },
      },
      didParseCell: (hookData) => {
        if (hookData.section === 'head') {
          const headerText = hookData.cell.text.join('\n')
          const isNameRow = hookData.row.index === 1
          hookData.cell.styles.minCellHeight = isNameRow ? 5.2 : 5.6
          hookData.cell.styles.fontSize = isNameRow
            ? getAdaptiveCellFontSize(headerText)
            : hookData.column.index === 0
              ? 8
              : 8.6
          hookData.cell.styles.fontStyle = isNameRow ? 'normal' : 'bold'
          hookData.cell.styles.valign = 'middle'
          hookData.cell.styles.cellPadding = {
            top: 0.65,
            right: 1.1,
            bottom: 0.52,
            left: 1.1,
          }
          return
        }

        if (hookData.section !== 'body') {
          return
        }

        hookData.cell.styles.minCellHeight =
          BODY_ROW_MIN_HEIGHT[hookData.row.index] ?? 8
        hookData.cell.styles.cellPadding = {
          top: 0.72,
          right: 1.1,
          bottom: 0.58,
          left: 1.1,
        }
        hookData.cell.styles.lineWidth = 0.22

        if (hookData.column.index === 0) {
          hookData.cell.styles.cellPadding = {
            top: 0.72,
            right: 1,
            bottom: 0.58,
            left: 1.5,
          }
          hookData.cell.styles.fontStyle = 'bold'
          hookData.cell.styles.fontSize = 8
        }
        if (hookData.column.index === 0 && subPointRowIndexes.has(hookData.row.index)) {
          hookData.cell.styles.cellPadding = {
            top: 0.72,
            right: 1,
            bottom: 0.58,
            left: 2.9,
          }
        }
        if (hookData.column.index > 0) {
          const rawCellText =
            typeof hookData.cell.raw === 'string'
              ? hookData.cell.raw.trim()
              : `${hookData.cell.raw ?? ''}`.trim()
          const normalizedCellText = rawCellText || '-'
          if (!rawCellText) {
            hookData.cell.text = ['-']
          }

          const isListCell = rawCellText.includes('\n')
          if (centerAlignedDataRowIndexes.has(hookData.row.index)) {
            hookData.cell.styles.valign = 'middle'
            hookData.cell.styles.halign = isListCell ? 'left' : 'center'
          }
          if (messageRowIndexes.has(hookData.row.index)) {
            hookData.cell.styles.halign = 'left'
            hookData.cell.styles.valign = 'top'
          }

          hookData.cell.styles.fontSize = getAdaptiveCellFontSize(normalizedCellText)
        }

      },
    })

    drawFooterSignArea(doc)
  })

  const safeFilterDate = input.filterDate.replace(/[^\d-]/g, '').trim() || Date.now().toString()
  doc.save(`berita-acara-${safeFilterDate}.pdf`)
  return {
    logoLoaded: Boolean(logoAsset),
    pageCount: pageChunks.length,
  }
}
