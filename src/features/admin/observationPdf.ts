import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ChildProfile, ObservationRecord } from '../../types'

export interface ObservationBatchPdfInput {
  filterDate: string
  filterGroupLabel: string
  records: ObservationRecord[]
  childrenData: ChildProfile[]
  logoPath?: string
}

export interface ObservationBatchPdfResult {
  logoLoaded: boolean
  pageCount: number
}

interface LoadedLogo {
  dataUrl: string
  width: number
  height: number
}

const DEFAULT_LOGO_PATH = '/UBAYA-noBG.png'
const PAGE_MARGIN_LEFT = 25
const PAGE_MARGIN_RIGHT = 20
const PAGE_MARGIN_TOP = 30
const PAGE_MARGIN_BOTTOM = 25
const CHECK_MARK_TOKEN = '__CHECK_MARK__'
const HEADER_BASE_Y = PAGE_MARGIN_TOP
const HEADER_RULE_Y = HEADER_BASE_Y + 17.8
const GROUP_TITLE_Y = HEADER_RULE_Y + 8.7
const FIELD_DATE_Y = GROUP_TITLE_Y + 9
const FIELD_NAME_Y = FIELD_DATE_Y + 7.3
const TABLE_START_Y = FIELD_NAME_Y + 5.6
const TABLE_COLUMN_WIDTHS = {
  activity: 28,
  indicator: 68,
  perluArahan: 16,
  perluLatihan: 16,
  sudahBaik: 16,
  notes: 21,
} as const
const TABLE_WIDTH =
  TABLE_COLUMN_WIDTHS.activity +
  TABLE_COLUMN_WIDTHS.indicator +
  TABLE_COLUMN_WIDTHS.perluArahan +
  TABLE_COLUMN_WIDTHS.perluLatihan +
  TABLE_COLUMN_WIDTHS.sudahBaik +
  TABLE_COLUMN_WIDTHS.notes

const ISO_LINES = [
  { label: 'No. Dokumen', value: 'FM-PKLP-03/02/01' },
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

const toSafeFilePart = (value: string): string => {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return 'kelompok'
  const safe = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return safe || 'kelompok'
}

const formatReadableDate = (isoDate: string): string => {
  if (!isoDate) return '-'
  const parsed = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(parsed)
}

const resolveIsoPageByGroup = (groupLabel: string, fallbackPageNumber: number): string => {
  const normalized = groupLabel.trim().toLowerCase()
  if (normalized.includes('pelangi')) return '2'
  if (normalized.includes('bintang')) return '3'
  if (normalized.includes('bulan')) return '4'
  if (normalized.includes('matahari')) return '4'
  return String(fallbackPageNumber)
}

const drawCheckMarkInCell = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const previousLineWidth = doc.getLineWidth()
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.34)

  const startX = x + width * 0.34
  const startY = y + height * 0.55
  const middleX = x + width * 0.45
  const middleY = y + height * 0.7
  const endX = x + width * 0.66
  const endY = y + height * 0.41

  doc.line(startX, startY, middleX, middleY)
  doc.line(middleX, middleY, endX, endY)
  doc.setLineWidth(previousLineWidth)
}

interface ObservationActivityGroup {
  activity: string
  items: ObservationRecord['items']
}

type ObservationPdfCell =
  | string
  | {
    content: string
    rowSpan?: number
    styles?: Record<string, unknown>
  }

type ObservationPdfBodyRow = ObservationPdfCell[]

const buildObservationActivityGroups = (
  items: ObservationRecord['items'],
): ObservationActivityGroup[] => {
  const groups: ObservationActivityGroup[] = []

  for (const item of items) {
    const cleanActivity = item.activity.trim() || '-'
    const latestGroup = groups.at(-1)
    if (latestGroup && latestGroup.activity === cleanActivity) {
      latestGroup.items.push(item)
      continue
    }

    groups.push({
      activity: cleanActivity,
      items: [item],
    })
  }

  return groups
}

const buildObservationBodyRows = (
  items: ObservationRecord['items'],
): ObservationPdfBodyRow[] => {
  const groups = buildObservationActivityGroups(items)
  if (groups.length === 0) {
    return [['-', '-', '', '', '', '']]
  }

  const rows: ObservationPdfBodyRow[] = []

  groups.forEach((group) => {
    group.items.forEach((item, itemIndex: number) => {
      const indicator = item.indicator.trim()
      const notes = item.notes.trim()
      const categoryPerluArahan =
        item.category === 'perlu-arahan' ? CHECK_MARK_TOKEN : ''
      const categoryPerluLatihan =
        item.category === 'perlu-latihan' ? CHECK_MARK_TOKEN : ''
      const categorySudahBaik =
        item.category === 'sudah-baik' ? CHECK_MARK_TOKEN : ''

      if (itemIndex === 0) {
        rows.push([
          {
            content: group.activity,
            rowSpan: group.items.length > 1 ? group.items.length : undefined,
            styles: {
              halign: 'center',
              valign: 'middle',
            },
          },
          indicator || '',
          categoryPerluArahan,
          categoryPerluLatihan,
          categorySudahBaik,
          notes || '',
        ])
        return
      }

      rows.push([
        indicator || '',
        categoryPerluArahan,
        categoryPerluLatihan,
        categorySudahBaik,
        notes || '',
      ])
    })
  })

  return rows
}

const drawHeader = (
  doc: jsPDF,
  options: {
    groupLabel: string
    printableDate: string
    childName: string
    pageNumber: number
  },
  logoAsset: LoadedLogo | null,
) => {
  const pageWidth = doc.internal.pageSize.getWidth()
  const rightEdge = pageWidth - PAGE_MARGIN_RIGHT
  const headerRuleStartX = PAGE_MARGIN_LEFT
  const headerRuleEndX = rightEdge

  const maxLogoWidth = 21.5
  const maxLogoHeight = 15.5
  const logoX = headerRuleStartX + 0.2
  const logoY = HEADER_BASE_Y + 0.2
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
      logoY + (maxLogoHeight - renderHeight) / 2,
      renderWidth,
      renderHeight,
    )
  }

  const boxWidth = 70
  const boxHeight = 14.4
  const boxX = headerRuleEndX - boxWidth
  const boxY = HEADER_BASE_Y + 0.3
  const rowHeight = boxHeight / 4
  const labelWidth = 27.5
  const isoCenterX = boxX + boxWidth / 2
  const titleCenterX = (logoCenterX + isoCenterX) / 2 - 1.5

  doc.setFont('times', 'bold')
  doc.setFontSize(10.4)
  doc.text('FORM', titleCenterX, HEADER_BASE_Y + 5.9, { align: 'center' })
  doc.text('OBSERVASI ANAK', titleCenterX, HEADER_BASE_Y + 10.8, { align: 'center' })

  doc.setLineWidth(0.18)
  doc.rect(boxX, boxY, boxWidth, boxHeight)
  doc.line(boxX + labelWidth, boxY, boxX + labelWidth, boxY + boxHeight)
  doc.line(boxX, boxY + rowHeight, boxX + boxWidth, boxY + rowHeight)
  doc.line(boxX, boxY + rowHeight * 2, boxX + boxWidth, boxY + rowHeight * 2)
  doc.line(boxX, boxY + rowHeight * 3, boxX + boxWidth, boxY + rowHeight * 3)

  const boxLines = [
    ISO_LINES[0],
    ISO_LINES[1],
    ISO_LINES[2],
    {
      label: 'Jumlah Halaman',
      value: resolveIsoPageByGroup(options.groupLabel, options.pageNumber),
    },
  ]

  doc.setFontSize(6.5)
  boxLines.forEach((line, index) => {
    const lineY = boxY + rowHeight * index + 2.65
    doc.setFont('times', 'bold')
    doc.text(line.label, boxX + 0.9, lineY)
    doc.text(':', boxX + labelWidth - 1.05, lineY)
    doc.setFont('times', 'normal')
    doc.text(line.value, boxX + labelWidth + 1.0, lineY)
  })

  doc.setLineWidth(0.24)
  doc.line(headerRuleStartX, HEADER_RULE_Y, headerRuleEndX, HEADER_RULE_Y)

  doc.setFont('times', 'bold')
  doc.setFontSize(11)
  doc.text(options.groupLabel.toUpperCase(), pageWidth / 2, GROUP_TITLE_Y, { align: 'center' })

  doc.setFontSize(10.2)
  doc.text('Hari/tanggal', headerRuleStartX + 0.2, FIELD_DATE_Y)
  doc.text('Nama', headerRuleStartX + 0.2, FIELD_NAME_Y)
  doc.text(':', headerRuleStartX + 22.6, FIELD_DATE_Y)
  doc.text(':', headerRuleStartX + 22.6, FIELD_NAME_Y)
  doc.setFont('times', 'normal')
  doc.text(options.printableDate, headerRuleStartX + 24.6, FIELD_DATE_Y)
  doc.text(options.childName, headerRuleStartX + 24.6, FIELD_NAME_Y)

  doc.setLineWidth(0.12)
  doc.line(headerRuleStartX + 24.1, FIELD_DATE_Y + 0.7, headerRuleStartX + 84.5, FIELD_DATE_Y + 0.7)
  doc.line(headerRuleStartX + 24.1, FIELD_NAME_Y + 0.7, headerRuleStartX + 84.5, FIELD_NAME_Y + 0.7)
}

const drawFooter = (doc: jsPDF, observerName: string, tableBottomY: number) => {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const footerStartY = Math.min(
    Math.max(tableBottomY + 5.4, 238.5),
    pageHeight - PAGE_MARGIN_BOTTOM - 12.2,
  )

  doc.setFont('times', 'bold')
  doc.setFontSize(8.5)
  doc.text('Keterangan :', PAGE_MARGIN_LEFT + 1.4, footerStartY)

  doc.setFont('times', 'normal')
  doc.text(
    'Perlu arahan : belum bisa dan masih perlu bantuan/masih dibantu.',
    PAGE_MARGIN_LEFT + 30,
    footerStartY,
  )
  doc.text(
    'Perlu latihan : sudah bisa, namun terkadang perlu pengulangan/latihan.',
    PAGE_MARGIN_LEFT + 30,
    footerStartY + 4.6,
  )
  doc.text(
    'Sudah bisa : dilakukan berulang kali secara mandiri tanpa bantuan dan latihan.',
    PAGE_MARGIN_LEFT + 30,
    footerStartY + 9.2,
  )

  const signLineEndX = pageWidth - PAGE_MARGIN_RIGHT
  const signLineStartX = signLineEndX - 34
  const signY = pageHeight - PAGE_MARGIN_BOTTOM + 0.2
  doc.setFont('times', 'normal')
  doc.setFontSize(9.9)
  doc.text('Nama observer :', signLineStartX - 28, signY)
  doc.line(signLineStartX, signY, signLineEndX, signY)
  if (observerName.trim()) {
    doc.text(observerName.trim(), signLineStartX + 0.5, signY - 1.2)
  }
}

export const downloadObservationBatchPdf = async (
  input: ObservationBatchPdfInput,
): Promise<ObservationBatchPdfResult> => {
  if (input.records.length === 0) {
    throw new Error('Tidak ada data observasi untuk dicetak.')
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    format: 'a4',
    unit: 'mm',
  })

  const childNameById = new Map(input.childrenData.map((child) => [child.id, child.fullName]))
  const logoAsset = await loadImageDataUrl(input.logoPath ?? DEFAULT_LOGO_PATH)

  input.records.forEach((record, index) => {
    if (index > 0) {
      doc.addPage()
    }

    const childName = childNameById.get(record.childId) ?? 'Data anak dihapus'
    drawHeader(
      doc,
      {
        groupLabel: input.filterGroupLabel,
        printableDate: formatReadableDate(record.date || input.filterDate),
        childName,
        pageNumber: index + 1,
      },
      logoAsset,
    )

    const body = buildObservationBodyRows(record.items)

    autoTable(doc, {
      theme: 'grid',
      startY: TABLE_START_Y,
      margin: {
        left: PAGE_MARGIN_LEFT,
        right: PAGE_MARGIN_RIGHT,
        top: TABLE_START_Y,
        bottom: PAGE_MARGIN_BOTTOM + 7.6,
      },
      tableWidth: TABLE_WIDTH,
      head: [
        [
          { content: 'Kegiatan', rowSpan: 2 },
          { content: 'Indikator', rowSpan: 2 },
          { content: 'Kategori Penilaian', colSpan: 3 },
          { content: 'Keterangan', rowSpan: 2 },
        ],
        [
          { content: 'Perlu\nArahan' },
          { content: 'Perlu\nLatihan' },
          { content: 'Sudah\nBaik' },
        ],
      ],
      body,
      styles: {
        font: 'times',
        fontSize: 7.25,
        cellPadding: 0.8,
        lineWidth: 0.18,
        lineColor: [42, 42, 42],
        textColor: [0, 0, 0],
        valign: 'top',
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.18,
      },
      columnStyles: {
        0: { cellWidth: TABLE_COLUMN_WIDTHS.activity },
        1: { cellWidth: TABLE_COLUMN_WIDTHS.indicator },
        2: { cellWidth: TABLE_COLUMN_WIDTHS.perluArahan },
        3: { cellWidth: TABLE_COLUMN_WIDTHS.perluLatihan },
        4: { cellWidth: TABLE_COLUMN_WIDTHS.sudahBaik },
        5: { cellWidth: TABLE_COLUMN_WIDTHS.notes },
      },
      didParseCell: (hookData) => {
        if (hookData.section === 'head') {
          hookData.cell.styles.minCellHeight = hookData.row.index === 0 ? 7 : 6.2
          hookData.cell.styles.fontSize = hookData.row.index === 0 ? 8.3 : 8
          hookData.cell.styles.cellPadding = {
            top: 0.58,
            right: 0.75,
            bottom: 0.45,
            left: 0.75,
          }
          return
        }

        if (hookData.section !== 'body') {
          return
        }

        hookData.cell.styles.minCellHeight = 6.6
        hookData.cell.styles.cellPadding = {
          top: 0.52,
          right: 0.68,
          bottom: 0.5,
          left: 0.68,
        }
        hookData.cell.styles.lineWidth = 0.18

        if (hookData.column.index === 0) {
          hookData.cell.styles.halign = 'center'
          hookData.cell.styles.valign = 'middle'
          hookData.cell.styles.fontStyle = 'normal'
          hookData.cell.styles.fontSize = 7.8
        }

        if (hookData.column.index === 1) {
          hookData.cell.styles.fontSize = 7.45
          hookData.cell.styles.valign = 'top'
        }

        if (hookData.column.index >= 2 && hookData.column.index <= 4) {
          hookData.cell.styles.halign = 'center'
          hookData.cell.styles.valign = 'middle'
          hookData.cell.styles.fontStyle = 'bold'
          hookData.cell.styles.fontSize = 8.4
          if (hookData.cell.raw === CHECK_MARK_TOKEN) {
            hookData.cell.text = ['']
          }
        }

        if (hookData.column.index === 5) {
          hookData.cell.styles.halign = 'left'
          hookData.cell.styles.valign = 'top'
          hookData.cell.styles.fontSize = 7.35
        }
      },
      didDrawCell: (hookData) => {
        if (
          hookData.section === 'body' &&
          hookData.column.index >= 2 &&
          hookData.column.index <= 4 &&
          hookData.cell.raw === CHECK_MARK_TOKEN
        ) {
          drawCheckMarkInCell(
            hookData.doc,
            hookData.cell.x,
            hookData.cell.y,
            hookData.cell.width,
            hookData.cell.height,
          )
        }
      },
    })

    const tableBottomY =
      (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
      188
    drawFooter(doc, record.observerName, tableBottomY)
  })

  const safeGroupName = toSafeFilePart(input.filterGroupLabel)
  doc.save(`observasi-${input.filterDate}-${safeGroupName}.pdf`)
  return {
    logoLoaded: Boolean(logoAsset),
    pageCount: input.records.length,
  }
}
