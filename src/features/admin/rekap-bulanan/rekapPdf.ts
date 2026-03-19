import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface RekapAttendancePdfRow {
  childName: string
  packageLabel: string
  attendanceByDate: Record<string, boolean>
  totalAttendance: number
}

export interface RekapAttendancePdfInput {
  selectedMonth: string
  monthLabel: string
  internalHolidayDates?: string[]
  workingDates: string[]
  rows: RekapAttendancePdfRow[]
  totalByDate: number[]
  grandTotal: number
  logoPath?: string
}

export interface RekapAttendancePdfResult {
  logoLoaded: boolean
}

interface LoadedLogo {
  dataUrl: string
  width: number
  height: number
}

const PAGE_MARGIN_X = 10
const HEADER_TOP_Y = 12
const HEADER_SEPARATOR_Y = 38
const MONTH_TITLE_Y = 44
const TABLE_START_Y = 50
const REKAP_ROW_COUNT = 15
const TOTAL_DAYS_COLUMN_WIDTH = 14

const ISO_LINES = [
  'No. Dokumen : FM PKLP-03/01/01',
  'No. Revisi : -',
  'Tanggal Berlaku : 15 Oktober 2011',
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

const getDateNumberLabel = (isoDate: string): string =>
  String(Number(isoDate.slice(-2)))

const isMondayIsoDate = (isoDate: string): boolean => {
  const parsedDate = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(parsedDate.getTime())) {
    return false
  }
  return parsedDate.getDay() === 1
}

const drawDocumentHeader = (
  doc: jsPDF,
  monthTitle: string,
  logoAsset: LoadedLogo | null,
): void => {
  const pageWidth = doc.internal.pageSize.getWidth()
  const rightEdgeX = pageWidth - PAGE_MARGIN_X

  if (logoAsset) {
    const maxLogoWidth = 28
    const maxLogoHeight = 22
    const scale = Math.min(
      maxLogoWidth / logoAsset.width,
      maxLogoHeight / logoAsset.height,
    )
    const renderWidth = logoAsset.width * scale
    const renderHeight = logoAsset.height * scale
    const logoX = PAGE_MARGIN_X + 4
    const logoY = HEADER_TOP_Y + (maxLogoHeight - renderHeight) / 2

    doc.addImage(
      logoAsset.dataUrl,
      'PNG',
      logoX,
      logoY,
      renderWidth,
      renderHeight,
    )
  }

  doc.setFont('times', 'bold')
  doc.setFontSize(14)
  doc.text('REKAP KEHADIRAN ANAK', pageWidth / 2, 20, { align: 'center' })

  const isoWidth = 88
  const isoRowHeight = 6.5
  const isoX = rightEdgeX - isoWidth
  const isoY = HEADER_TOP_Y
  const isoHeight = isoRowHeight * ISO_LINES.length

  doc.setLineWidth(0.2)
  doc.rect(isoX, isoY, isoWidth, isoHeight)
  doc.line(isoX, isoY + isoRowHeight, isoX + isoWidth, isoY + isoRowHeight)
  doc.line(
    isoX,
    isoY + isoRowHeight * 2,
    isoX + isoWidth,
    isoY + isoRowHeight * 2,
  )

  doc.setFont('times', 'normal')
  doc.setFontSize(8.5)
  ISO_LINES.forEach((line, index) => {
    const y = isoY + isoRowHeight * index + 4.4
    doc.text(line, isoX + 2, y)
  })

  doc.setLineWidth(0.5)
  doc.line(PAGE_MARGIN_X, HEADER_SEPARATOR_Y, rightEdgeX, HEADER_SEPARATOR_Y)

  doc.setFont('times', 'bold')
  doc.setFontSize(11)
  doc.text(monthTitle.toUpperCase(), pageWidth / 2, MONTH_TITLE_Y, {
    align: 'center',
  })
}

const buildColumnStyles = (
  internalHolidayColumnCount: number,
  dateCount: number,
  dateCellWidth: number,
): Record<number, { cellWidth: number }> => {
  const styles: Record<number, { cellWidth: number }> = {
    0: { cellWidth: 58 },
    1: { cellWidth: 8 },
  }

  for (let index = 0; index < internalHolidayColumnCount; index += 1) {
    styles[2 + index] = { cellWidth: 8 }
  }

  for (let index = 0; index < dateCount; index += 1) {
    styles[2 + internalHolidayColumnCount + index] = {
      cellWidth: dateCellWidth,
    }
  }

  styles[2 + internalHolidayColumnCount + dateCount] = {
    cellWidth: TOTAL_DAYS_COLUMN_WIDTH,
  }
  return styles
}

export const downloadRekapAttendancePdf = async (
  input: RekapAttendancePdfInput,
): Promise<RekapAttendancePdfResult> => {
  const doc = new jsPDF({
    orientation: 'landscape',
    format: 'a4',
    unit: 'mm',
  })

  const logoPath = input.logoPath ?? '/UBAYA-noBG.png'
  const logoAsset = await loadImageDataUrl(logoPath)
  const internalHolidayDates = input.internalHolidayDates ?? []
  const internalHolidayColumnCount = internalHolidayDates.length

  const pageInnerWidth = doc.internal.pageSize.getWidth() - PAGE_MARGIN_X * 2
  const fixedColumnsWidth =
    58 + 8 + internalHolidayColumnCount * 8 + TOTAL_DAYS_COLUMN_WIDTH
  const dateCellWidth = (pageInnerWidth - fixedColumnsWidth) / input.workingDates.length

  const dateNumbers = input.workingDates.map((_, index) => String(index + 1))
  const dateLabels = input.workingDates.map(getDateNumberLabel)
  const internalColumns = Array.from(
    { length: internalHolidayColumnCount },
    () => '',
  )
  const dateStartColumnIndex = 2 + internalHolidayColumnCount
  const mondayColumnIndexes = new Set<number>()
  input.workingDates.forEach((date, index) => {
    if (isMondayIsoDate(date)) {
      mondayColumnIndexes.add(dateStartColumnIndex + index)
    }
  })

  const head = [
    [
      { content: 'Nama anak & Paket', rowSpan: 2 },
      'No',
      ...internalColumns,
      ...dateNumbers,
      { content: 'Jumlah\nHari', rowSpan: 2 },
    ],
    ['Tgl', ...internalColumns, ...dateLabels],
  ]

  const normalizedRows = input.rows.slice(0, REKAP_ROW_COUNT)

  const bodyRows = normalizedRows.map((row, rowIndex) => {
    const attendanceCells = input.workingDates.map((date) =>
      row.attendanceByDate[date] ? '1' : '0',
    )

    const prefixCells =
      rowIndex === 0 && internalHolidayColumnCount > 0
        ? [
            {
              content: 'LIBURAN INTERNAL',
              rowSpan: REKAP_ROW_COUNT,
              colSpan: internalHolidayColumnCount,
              styles: {
                fillColor: [224, 224, 224] as [number, number, number],
                textColor: [62, 62, 62] as [number, number, number],
              },
            },
          ]
        : []

    return [
      `${row.childName}, ${row.packageLabel.toLowerCase()}`,
      String(rowIndex + 1),
      ...prefixCells,
      ...attendanceCells,
      String(row.totalAttendance),
    ]
  })

  while (bodyRows.length < REKAP_ROW_COUNT) {
    const nextRowNumber = String(bodyRows.length + 1)
    const prefixCells =
      bodyRows.length === 0 && internalHolidayColumnCount > 0
        ? [
            {
              content: 'LIBURAN INTERNAL',
              rowSpan: REKAP_ROW_COUNT,
              colSpan: internalHolidayColumnCount,
              styles: {
                fillColor: [224, 224, 224] as [number, number, number],
                textColor: [62, 62, 62] as [number, number, number],
              },
            },
          ]
        : []

    bodyRows.push([
      '',
      nextRowNumber,
      ...prefixCells,
      ...input.workingDates.map(() => ''),
      '',
    ])
  }

  bodyRows.push([
    'Jumlah hadir per tanggal',
    '',
    ...internalColumns,
    ...input.totalByDate.map((value) => String(value)),
    String(input.grandTotal),
  ])

  autoTable(doc, {
    theme: 'grid',
    startY: TABLE_START_Y,
    margin: {
      top: TABLE_START_Y,
      left: PAGE_MARGIN_X,
      right: PAGE_MARGIN_X,
      bottom: 10,
    },
    head,
    body: bodyRows,
    tableWidth: pageInnerWidth,
    columnStyles: buildColumnStyles(
      internalHolidayColumnCount,
      input.workingDates.length,
      dateCellWidth,
    ),
    styles: {
      font: 'helvetica',
      fontSize: 7,
      cellPadding: 1.1,
      textColor: [0, 0, 0],
      lineColor: [20, 20, 20],
      lineWidth: 0.1,
      halign: 'center',
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineWidth: 0.2,
    },
    didParseCell: (hookData) => {
      const columnIndex = hookData.column.index
      const dateColumnStart = 2 + internalHolidayColumnCount
      const dateColumnEnd = dateColumnStart + input.workingDates.length - 1
      const totalRowIndex = bodyRows.length - 1
      const isTotalRow =
        hookData.section === 'body' && hookData.row.index === totalRowIndex

      if (hookData.section === 'body' && hookData.column.index === 0) {
        hookData.cell.styles.halign = 'left'
      }

      if (columnIndex === 1) {
        hookData.cell.styles.fillColor = [235, 235, 235]
      }

      if (
        columnIndex >= 2 &&
        columnIndex < 2 + internalHolidayColumnCount
      ) {
        hookData.cell.styles.fillColor = [224, 224, 224]
      }

      if (
        hookData.section === 'head' &&
        hookData.row.index === 0 &&
        columnIndex >= dateColumnStart &&
        columnIndex <= dateColumnEnd
      ) {
        hookData.cell.styles.fillColor = [226, 226, 226]
      }

      if (
        hookData.section === 'head' &&
        hookData.row.index === 1 &&
        mondayColumnIndexes.has(columnIndex)
      ) {
        hookData.cell.styles.fillColor = [217, 217, 217]
      }

      if (isTotalRow) {
        hookData.cell.styles.fontStyle = 'bold'
        hookData.cell.styles.fillColor = [244, 244, 244]
      }
    },
    didDrawPage: () => {
      drawDocumentHeader(doc, input.monthLabel, logoAsset)
    },
  })

  doc.save(`rekap-kehadiran-${input.selectedMonth}.pdf`)
  return { logoLoaded: Boolean(logoAsset) }
}
