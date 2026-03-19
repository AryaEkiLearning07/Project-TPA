import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface StaffAttendancePdfRow {
  fullName: string
  account: string
  attendanceDateLabel: string
  checkInTime: string
  checkOutTime: string
  dutyDuration: string
  monthlyAttendanceTotal: number
  honor?: number
  transport?: number
}

export interface StaffAttendancePdfInput {
  filterDate: string
  filterMonth: string
  rows: StaffAttendancePdfRow[]
}

const formatDateLabel = (value: string): string => {
  if (!value) {
    return '-'
  }

  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(parsed)
}

const formatMonthLabel = (value: string): string => {
  if (!value) {
    return '-'
  }

  const parsed = new Date(`${value}-01T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(parsed)
}

const getFileStamp = (date: Date): string =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    '-',
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
  ].join('')

export const downloadStaffAttendancePdf = (input: StaffAttendancePdfInput): void => {
  if (input.rows.length === 0) {
    throw new Error('Tidak ada data kehadiran petugas untuk diunduh.')
  }

  const doc = new jsPDF({
    orientation: 'landscape',
    format: 'a4',
    unit: 'mm',
  })

  const now = new Date()
  const printedAt = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(now)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('REKAP KEHADIRAN PETUGAS', 14, 14)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Dicetak: ${printedAt}`, 14, 20)
  doc.text(`Tanggal: ${formatDateLabel(input.filterDate)}`, 14, 26)
  doc.text(`Bulan Rekap: ${formatMonthLabel(input.filterMonth)}`, 14, 32)

  const formatRupiah = (amount: number) => `Rp ${amount.toLocaleString('id-ID')}`

  const body = input.rows.map((row, index) => [
    String(index + 1),
    row.fullName || '-',
    row.account.replace(/@gmail\.com$/i, '') || '-',
    row.attendanceDateLabel || '-',
    row.checkInTime || '-',
    row.checkOutTime || '-',
    row.dutyDuration || '-',
    `${row.monthlyAttendanceTotal ?? 0} Hari`,
    row.honor != null ? formatRupiah(row.honor) : '-',
    row.transport != null ? formatRupiah(row.transport) : '-',
  ])

  autoTable(doc, {
    startY: 36,
    margin: { left: 14, right: 14, bottom: 14 },
    theme: 'grid',
    head: [
      [
        'No',
        'Nama Petugas',
        'Akun',
        'Hari, Tanggal',
        'Jam Datang',
        'Jam Pulang',
        'Total Jam Bertugas',
        'Total Hadir',
        'Honor',
        'Transport',
      ],
    ],
    body,
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 2,
      lineColor: [90, 90, 90],
      lineWidth: 0.1,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [246, 239, 255],
      textColor: [60, 36, 92],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 38 },
      2: { cellWidth: 38 },
      3: { cellWidth: 44 },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 18, halign: 'center' },
      6: { cellWidth: 22, halign: 'center' },
      7: { cellWidth: 20, halign: 'center' },
      8: { cellWidth: 26, halign: 'right' },
      9: { cellWidth: 26, halign: 'right' },
    },
  })

  doc.save(`rekap-kehadiran-petugas-${input.filterMonth || getFileStamp(now)}-${getFileStamp(now)}.pdf`)
}
