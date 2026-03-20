import {
    BarChart3,
    Boxes,
    CalendarCheck2,
    ClipboardList,
    FileText,
    Settings,
    UserCog,
    UsersRound,
    WalletCards,
} from 'lucide-react'
import { servicePackageOptions } from '../../constants/options'
import type { SidebarMenuItem } from '../../components/layout/Sidebar'
import type {
    AppData,
    ConfirmDialogOptions,
    ServiceBillingSummaryResponse,
    ServiceBillingPeriodInput,
    ServiceBillingPaymentInput,
    ServiceBillingRefundInput,
    ServicePackage,
    ServicePackageRates,
    ServicePackageRatesInput,
    StaffUserInput,
} from '../../types'
import { getLocalDateIso } from '../../utils/date'

// ─── Navigation types ───────────────────────────────────────────────────────

export type AdminSidebarKey = 'monitoring' | 'data-anak' | 'settings'
export type MonitoringSubTab =
    | 'kehadiran-anak'
    | 'observasi-anak'
    | 'berita-acara'
    | 'kehadiran-petugas'
    | 'layanan'
export type SettingsSubTab = 'petugas' | 'orang-tua' | 'logs' | 'backup'

export interface AdminNavigationState {
    scope: 'admin'
    sidebar: AdminSidebarKey
    monitoringTab: MonitoringSubTab
    settingsTab: SettingsSubTab
}

export const isAdminSidebarKey = (value: unknown): value is AdminSidebarKey =>
    value === 'monitoring' || value === 'data-anak' || value === 'settings'

export const isMonitoringSubTab = (value: unknown): value is MonitoringSubTab =>
    value === 'kehadiran-anak' ||
    value === 'observasi-anak' ||
    value === 'berita-acara' ||
    value === 'kehadiran-petugas' ||
    value === 'layanan'

export const isSettingsSubTab = (value: unknown): value is SettingsSubTab =>
    value === 'petugas' || value === 'orang-tua' || value === 'logs' || value === 'backup'

export const isAdminNavigationState = (value: unknown): value is AdminNavigationState => {
    if (typeof value !== 'object' || value === null) {
        return false
    }

    const state = value as Partial<AdminNavigationState>
    return (
        state.scope === 'admin' &&
        isAdminSidebarKey(state.sidebar) &&
        isMonitoringSubTab(state.monitoringTab) &&
        isSettingsSubTab(state.settingsTab)
    )
}

export const buildAdminNavigationState = (
    sidebar: AdminSidebarKey,
    monitoringTab: MonitoringSubTab,
    settingsTab: SettingsSubTab,
): AdminNavigationState => ({
    scope: 'admin',
    sidebar,
    monitoringTab,
    settingsTab,
})

// ─── Menu & tab constants ───────────────────────────────────────────────────

export const adminMenus: SidebarMenuItem[] = [
    {
        key: 'monitoring',
        label: 'Rekap & Monitoring',
        icon: BarChart3,
    },
    {
        key: 'data-anak',
        label: 'Data Anak',
        icon: UsersRound,
    },
    {
        key: 'settings',
        label: 'Pengaturan',
        icon: Settings,
    },
]

export const monitoringSubTabs = [
    {
        key: 'kehadiran-anak',
        label: 'Kehadiran Anak',
        description: 'Rekap bulanan kehadiran anak',
        icon: CalendarCheck2,
    },
    {
        key: 'observasi-anak',
        label: 'Observasi Anak',
        description: 'Ringkasan point observasi per anak',
        icon: ClipboardList,
    },
    {
        key: 'berita-acara',
        label: 'Berita Acara',
        description: 'Ringkasan berita acara per anak',
        icon: FileText,
    },
    {
        key: 'kehadiran-petugas',
        label: 'Kehadiran Petugas',
        description: 'Rekap kehadiran harian petugas',
        icon: UsersRound,
    },
    {
        key: 'layanan',
        label: 'Rekap Layanan',
        description: 'Tarif dan estimasi biaya layanan',
        icon: WalletCards,
    },
] as const satisfies Array<{
    key: MonitoringSubTab
    label: string
    description: string
    icon: typeof BarChart3
}>

export const settingsSubTabs = [
    {
        key: 'petugas',
        label: 'Petugas',
        description: 'Kelola akun petugas dan statusnya',
        icon: UserCog,
    },
    {
        key: 'orang-tua',
        label: 'Akun Orang Tua',
        description: 'Monitoring akun orang tua yang sudah daftar',
        icon: UsersRound,
    },
    {
        key: 'logs',
        label: 'Log Aktivitas',
        description: 'Pantau riwayat aktivitas sistem',
        icon: ClipboardList,
    },
    {
        key: 'backup',
        label: 'Backup',
        description: 'Unduh cadangan data aplikasi',
        icon: Boxes,
    },
] as const satisfies Array<{
    key: SettingsSubTab
    label: string
    description: string
    icon: typeof Settings
}>

export const sidebarTitles: Record<AdminSidebarKey, { title: string; subtitle: string }> = {
    monitoring: {
        title: 'Rekap & Monitoring',
        subtitle: 'Kehadiran, observasi, berita acara, petugas, dan layanan',
    },
    'data-anak': {
        title: 'Data Anak',
        subtitle: 'Profil anak dan informasi orang tua',
    },
    settings: {
        title: 'Pengaturan',
        subtitle: 'Kelola petugas, akun orang tua, log aktivitas, dan backup data',
    },
}

// ─── Form initial values ────────────────────────────────────────────────────

export const initialStaffForm: StaffUserInput = {
    fullName: '',
    email: '',
    password: '',
    isActive: true,
    tanggalMasuk: '',
}

export const initialServiceRatesForm: ServicePackageRatesInput = {
    harian: 0,
    '2-mingguan': 0,
    bulanan: 0,
}

export const initialServiceRates: ServicePackageRates = {
    ...initialServiceRatesForm,
    updatedAt: '',
}

export const toServiceRateTextForm = (
    rates: Pick<ServicePackageRatesInput, 'harian' | '2-mingguan' | 'bulanan'>,
): Record<ServicePackage, string> => ({
    harian: `Rp.${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(
        Math.max(0, Math.round(rates.harian)),
    )}`,
    '2-mingguan': `Rp.${new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: 0,
    }).format(Math.max(0, Math.round(rates['2-mingguan'])))}`,
    bulanan: `Rp.${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(
        Math.max(0, Math.round(rates.bulanan)),
    )}`,
})

export const initialServiceBillingPeriodForm: ServiceBillingPeriodInput = {
    childId: '',
    packageKey: 'harian',
    startDate: getLocalDateIso(),
    amount: 0,
    notes: '',
}

export const initialServiceBillingPaymentForm: ServiceBillingPaymentInput = {
    childId: '',
    amount: 0,
    bucket: 'period',
    periodId: '',
    notes: '',
    paymentProofDataUrl: '',
    paymentProofName: '',
}

export const initialServiceBillingRefundForm: ServiceBillingRefundInput = {
    childId: '',
    amount: 0,
    bucket: 'arrears',
    periodId: '',
    notes: '',
}

export const ACTIVITY_LOG_LIMIT_OPTIONS = [20, 50, 100, 500, 1000]

// ─── Staff service calculation ────────────────────────────────────────────────

// Calculate service length from tanggalMasuk to current date
export const calculateServiceLength = (tanggalMasuk: string): string => {
    const start = new Date(tanggalMasuk)
    const now = new Date()

    if (isNaN(start.getTime())) {
        return '-'
    }

    let years = now.getFullYear() - start.getFullYear()
    let months = now.getMonth() - start.getMonth()
    let days = now.getDate() - start.getDate()

    if (days < 0) {
        months--
        const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0)
        days += prevMonth.getDate()
    }

    if (months < 0) {
        years--
        months += 12
    }

    const parts = []
    if (years > 0) parts.push(`${years} tahun`)
    if (months > 0) parts.push(`${months} bulan`)
    if (days > 0 || parts.length === 0) parts.push(`${days} hari`)

    return parts.join(', ')
}

// Check if staff is senior (> 1 year of service)
export const calculateIsSenior = (tanggalMasuk: string): boolean => {
    const start = new Date(tanggalMasuk)
    const now = new Date()
    if (isNaN(start.getTime())) return false
    const yearsDiff = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
    return yearsDiff > 1
}

// Format duration in hours and minutes (e.g., 3h30m)
export const formatDuration = (checkIn: string, checkOut: string): { hours: number; label: string } => {
    const start = new Date(checkIn)
    const end = new Date(checkOut)
    const diffMs = end.getTime() - start.getTime()
    const totalHours = diffMs / (1000 * 60 * 60)
    const hours = Math.floor(totalHours)
    const minutes = Math.round((totalHours - hours) * 60)
    const label = minutes > 0 ? `${hours}j${minutes}m` : `${hours}j`
    return { hours: parseFloat(totalHours.toFixed(2)), label }
}

// Calculate honor and transport based on service duration and staff seniority
export const calculateStaffPay = (durationHours: number, isSenior: boolean): { honor: number; transport: number } => {
    const hourlyRate = isSenior ? 15000 : 10000
    const honor = Math.round(durationHours * hourlyRate)
    const transport = durationHours >= 3 ? 15000 : 0
    return { honor, transport }
}
export const DEFAULT_ACTIVITY_LOG_LIMIT = 100

// ─── Formatting helpers ─────────────────────────────────────────────────────

export const formatDateTime = (value: string): string => {
    if (!value) {
        return '-'
    }

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
        return value
    }

    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(parsed)
}

export const formatLogDateTimeParts = (value: string): { date: string; time: string } => {
    if (!value) {
        return {
            date: '-',
            time: '-',
        }
    }

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
        return {
            date: value,
            time: '-',
        }
    }

    const parts = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(parsed)

    const readPart = (type: Intl.DateTimeFormatPartTypes): string =>
        parts.find((part) => part.type === type)?.value ?? ''

    const day = readPart('day')
    const month = readPart('month')
    const year = readPart('year')
    const hour = readPart('hour')
    const minute = readPart('minute')
    const second = readPart('second')

    return {
        date: `${day} ${month} ${year}`.trim(),
        time: `${hour}.${minute}.${second}`.trim(),
    }
}

export const formatDateOnly = (value: string): string => {
    if (!value) {
        return '-'
    }

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
        return value
    }

    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(parsed)
}

export const formatDateWithWeekday = (value: string): string => {
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

export const formatMonthLabel = (value: string): string => {
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

export const formatTimeOnly = (value: string): string => {
    if (!value) {
        return '-'
    }

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
        return value
    }

    const formatter = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    })
    const parts = formatter.formatToParts(parsed)
    const hours = parts.find((part) => part.type === 'hour')?.value ?? '00'
    const minutes = parts.find((part) => part.type === 'minute')?.value ?? '00'
    return `${hours}:${minutes}`
}

export const formatCurrency = (value: number): string =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(Number.isFinite(value) ? value : 0)

export const formatRupiah = formatCurrency

export const formatRupiahInput = (value: number): string => {
    const safeValue = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
    const formatted = new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: 0,
    }).format(safeValue)
    return `Rp.${formatted}`
}

export const parseRupiahInput = (value: string): number => {
    const digits = value.replace(/[^\d]/g, '')
    if (!digits) {
        return 0
    }
    const parsed = Number.parseInt(digits, 10)
    if (!Number.isFinite(parsed) || parsed < 0) {
        return 0
    }
    return parsed
}

export const escapeCsvCell = (value: string | number): string => {
    const text = String(value ?? '')
    if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`
    }
    return text
}

// ─── Service billing helpers ────────────────────────────────────────────────

export const toUnpaidAttendanceDays = (
    row: ServiceBillingSummaryResponse['rows'][number],
    rates: ServicePackageRates,
): number => {
    if (row.totalOutstanding <= 0) {
        return 0
    }

    if (row.displayServicePackage === 'harian') {
        const dailyRate = Math.max(1, rates.harian)
        return Math.max(1, Math.ceil(row.totalOutstanding / dailyRate))
    }

    if (row.displayServicePackage === '2-mingguan') {
        const baseRate = Math.max(1, rates['2-mingguan'])
        const dailyRate = Math.max(1, rates.harian)

        // Jika tunggakannya lebih besar dari harga dasar 2-mingguan
        if (row.totalOutstanding >= baseRate) {
            const extraOutstanding = row.totalOutstanding - baseRate
            const extraDays = Math.floor(extraOutstanding / dailyRate)
            return 10 + extraDays
        }

        // Jika tunggakannya kurang dari harga dasar (misal baru DP atau menunggak sebagian)
        // Kita estimasikan harinya secara proporsional dengan rate harian
        return Math.max(1, Math.ceil(row.totalOutstanding / dailyRate))
    }

    // Paket bulanan: representasikan seluruh kehadiran periode aktif sebagai kehadiran belum lunas.
    return Math.max(1, row.attendanceInActivePeriod)
}

export const toBillingStatusLabel = (status: ServiceBillingSummaryResponse['rows'][number]['status']): string => {
    if (status === 'aktif-lancar') return 'Aktif Lancar'
    if (status === 'aktif-menunggak') return 'Aktif Menunggak'
    if (status === 'upgrade-pending') return 'Upgrade Pending'
    if (status === 'periode-berakhir-menunggak') return 'Periode Berakhir Menunggak'
    return 'Belum Periode'
}

// ─── Generic helpers ────────────────────────────────────────────────────────

export const downloadBlob = (blob: Blob, fileName: string) => {
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(objectUrl)
}

export const toTimestamp = (value: string): number => {
    if (!value) {
        return 0
    }

    const parsed = new Date(value).getTime()
    return Number.isNaN(parsed) ? 0 : parsed
}

export const toLocalDateKey = (value: string): string => {
    if (!value) {
        return ''
    }

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
        return value.slice(0, 10)
    }

    return [
        parsed.getFullYear(),
        String(parsed.getMonth() + 1).padStart(2, '0'),
        String(parsed.getDate()).padStart(2, '0'),
    ].join('-')
}

// ─── Staff attendance helpers ───────────────────────────────────────────────

export const calculateDutyMinutes = (checkInAt: string, checkOutAt: string): number | null => {
    const checkInTime = toTimestamp(checkInAt)
    const checkOutTime = toTimestamp(checkOutAt)

    if (checkInTime <= 0 || checkOutTime <= 0) {
        return null
    }
    if (checkOutTime < checkInTime) {
        return null
    }

    return Math.round((checkOutTime - checkInTime) / 60000)
}

export const formatDutyDuration = (minutes: number | null): string => {
    if (minutes === null) {
        return '-'
    }

    const hours = Math.floor(minutes / 60)
    const remainingMinutes = Math.round(minutes % 60)

    if (hours > 0) {
        return remainingMinutes > 0 ? `${hours}j ${remainingMinutes} menit` : `${hours}j`
    }
    return `${remainingMinutes} menit`
}

// ─── Date key helpers ───────────────────────────────────────────────────────

export const isDateKey = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value)
export const isMonthKey = (value: string): boolean => /^\d{4}-\d{2}$/.test(value)
export const getTodayDateKey = (): string => getLocalDateIso()
export const getTodayMonthKey = (todayDate: string = getTodayDateKey()): string => todayDate.slice(0, 7)

export const clampDateKeyToToday = (
    value: string,
    todayDate: string = getTodayDateKey(),
): string => {
    if (!isDateKey(value)) {
        return todayDate
    }
    return value > todayDate ? todayDate : value
}

export const clampMonthKeyToToday = (
    value: string,
    todayMonth: string = getTodayMonthKey(),
): string => {
    if (!isMonthKey(value)) {
        return todayMonth
    }
    return value > todayMonth ? todayMonth : value
}

// ─── Service package helpers ────────────────────────────────────────────────

export const servicePackageLabels = servicePackageOptions.reduce<
    Record<ServicePackage, string>
>(
    (accumulator, option) => {
        accumulator[option.value] = option.label
        return accumulator
    },
    {
        harian: 'Harian',
        '2-mingguan': '2 Mingguan',
        bulanan: 'Bulanan',
    },
)

export const createServicePackageCounter = (): Record<ServicePackage, number> => ({
    harian: 0,
    '2-mingguan': 0,
    bulanan: 0,
})

export const servicePackageTableOrder: ServicePackage[] = ['harian', '2-mingguan', 'bulanan']

export type ServiceGenderKey = 'L' | 'P' | 'other'

export const resolveServiceGenderKey = (value: string): ServiceGenderKey => {
    const normalized = value.trim().toUpperCase()
    if (normalized === 'L' || normalized.includes('LAKI')) {
        return 'L'
    }
    if (normalized === 'P' || normalized.includes('PEREMPUAN')) {
        return 'P'
    }
    return 'other'
}

// ─── Shared interfaces ─────────────────────────────────────────────────────

export interface StaffAttendanceSummary {
    key: string
    staffUserId: string
    fullName: string
    account: string
    attendanceDateLabel: string
    checkInAt: string
    checkOutAt: string
    dutyMinutes: number | null
    monthlyAttendanceCount: number
}

export interface ServiceMonthlyRecapRow {
    monthKey: string
    monthLabel: string
    totalChildren: number
    packageCounts: Record<ServicePackage, number>
    serviceDayCounts: Record<ServicePackage, number>
    totalServiceDays: number
    estimatedCharge: number
}

export interface ServiceMonthChildRow {
    childName: string
    attendanceCount: number
    genderKey: ServiceGenderKey
}

export interface ServiceMonthlyDetail {
    monthKey: string
    monthLabel: string
    totalChildren: number
    genderCounts: Record<ServiceGenderKey, number>
    byPackage: Record<ServicePackage, ServiceMonthChildRow[]>
}

export interface ServicePackageTableRow {
    childId: string
    childName: string
    attendanceInSelectedMonth: number
    totalPaidAmount: number
    unpaidAttendanceDays: number
    totalOutstanding: number
    packageKey: ServicePackage
    isMigrated: boolean
}

export interface ServicePackagePanel {
    packageKey: ServicePackage
    title: string
    rows: ServicePackageTableRow[]
    totalChildren: number
    totalPaidChildren: number
    totalUnpaid: number
    totalPaidAmount: number
}

export interface ServiceBillingArrearsRow {
    childId: string
    childName: string
    packageKey: ServicePackage
    packageLabel: string
    unpaidAttendanceDays: number
    totalOutstanding: number
    activePeriodId: string
    currentServicePackage: ServicePackage
    isMigrated: boolean
}

export interface ObservationCategorySummary {
    perluArahan: number
    perluLatihan: number
    sudahBaik: number
}

export interface ObservationRecapRow {
    childId: string
    childName: string
    latestDate: string
    latestGroup: string
    totalObservations: number
    totalPoints: number
    categorySummary: ObservationCategorySummary
}

export interface IncidentRecapRow {
    childId: string
    childName: string
    latestDate: string
    totalReports: number
    latestArrivalCondition: string
    latestDepartureCondition: string
}

export type DownloadNoticeType = 'success' | 'warning' | 'error'

// ─── Observation helpers ────────────────────────────────────────────────────

export const createEmptyObservationCategorySummary = (): ObservationCategorySummary => ({
    perluArahan: 0,
    perluLatihan: 0,
    sudahBaik: 0,
})

export const summarizeObservationItems = (
    items: AppData['observationRecords'][number]['items'],
): ObservationCategorySummary => {
    const summary = createEmptyObservationCategorySummary()

    for (const item of items) {
        if (item.category === 'perlu-arahan') summary.perluArahan += 1
        if (item.category === 'perlu-latihan') summary.perluLatihan += 1
        if (item.category === 'sudah-baik') summary.sudahBaik += 1
    }

    return summary
}

export const formatConditionPair = (physical: string, emotional: string): string =>
    `${physical}/${emotional}`

export const normalizeGroupName = (value: string): string => value.trim().toLowerCase()

export const defaultObservationGroupOptions = [
    { value: 'bulan', label: 'Kelompok Bulan (2-3 tahun)' },
    { value: 'pelangi', label: 'Kelompok Pelangi (3-4 tahun)' },
    { value: 'bintang', label: 'Kelompok Bintang (4-5 tahun)' },
    { value: 'matahari', label: 'Kelompok Matahari (5-6 tahun)' },
] as const

export const resolveObservationGroupFilterValue = (groupName: string): string => {
    const normalized = normalizeGroupName(groupName)
    if (!normalized) {
        return ''
    }

    if (normalized.includes('bulan')) return 'bulan'
    if (normalized.includes('pelangi')) return 'pelangi'
    if (normalized.includes('bintang')) return 'bintang'
    if (normalized.includes('matahari')) return 'matahari'

    return normalized
}

export type ObservationGroupFilterKey = (typeof defaultObservationGroupOptions)[number]['value']

export const isDefaultObservationGroupKey = (value: string): value is ObservationGroupFilterKey =>
    defaultObservationGroupOptions.some((option) => option.value === value)

export const getAgeInMonths = (birthDate: string): number | null => {
    const parsed = new Date(`${birthDate}T00:00:00`)
    if (Number.isNaN(parsed.getTime())) {
        return null
    }

    const today = new Date()
    let months =
        (today.getFullYear() - parsed.getFullYear()) * 12 +
        (today.getMonth() - parsed.getMonth())

    if (today.getDate() < parsed.getDate()) {
        months -= 1
    }

    return months >= 0 ? months : null
}

export const resolveGroupByAgeMonths = (ageMonths: number | null): ObservationGroupFilterKey => {
    if (ageMonths === null) return 'pelangi'
    if (ageMonths < 36) return 'bulan'
    if (ageMonths < 48) return 'pelangi'
    if (ageMonths < 60) return 'bintang'
    return 'matahari'
}

// ─── Confirm dialog state type ──────────────────────────────────────────────

export type ConfirmDialogState = Required<
    Pick<ConfirmDialogOptions, 'title' | 'message' | 'confirmLabel' | 'cancelLabel' | 'tone'>
>
