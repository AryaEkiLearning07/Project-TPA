
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  CreditCard,
  Home,
  LogOut,
  Moon,
  PlusCircle,
  RefreshCw,
  ScrollText,
  Sun,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import type {
  AuthUser,
  CarriedItem,
  ChildProfile,
  ParentDashboardData,
  ParentProfile,
  ServiceBillingPeriod,
  ServiceBillingSummaryRow,
  ServiceBillingTransaction,
  SupplyInventoryItem,
} from '../../types'
import { parentApi } from '../../services/api'
import './parent-portal.css'

const LOGO_SRC = `${import.meta.env.BASE_URL}logo_TPA.jpg`
const ACTIVE_CHILD_STORAGE_KEY = 'tpa-parent-active-child'
const PARENT_THEME_STORAGE_KEY = 'tpa-parent-theme'

type ParentMenuKey = 'dashboard' | 'daily-logs' | 'billing' | 'profile' | 'inventory'
type ParentTheme = 'light' | 'dark'

interface ParentDashboardAccount {
  id: string
  username: string
  isActive: boolean
  parentProfile: ParentProfile
}

interface ParentDailyReport {
  attendanceId: string
  childId: string
  childName: string
  date: string
  arrivalTime: string
  departureTime: string
  escortName: string
  pickupName: string
  arrivalPhysicalCondition: string
  arrivalEmotionalCondition: string
  departurePhysicalCondition: string
  departureEmotionalCondition: string
  parentMessage: string
  messageForParent: string
  departureNotes: string
  carriedItems: CarriedItem[]
  createdAt: string
  updatedAt: string
}

interface ParentBillingSnapshot {
  summary: ServiceBillingSummaryRow | null
  periods: ServiceBillingPeriod[]
  transactions: ServiceBillingTransaction[]
}

interface ParentDashboardPayload extends Omit<ParentDashboardData, 'attendanceRecords'> {
  parentAccount?: ParentDashboardAccount
  todayDate?: string
  dailyReports?: Record<string, ParentDailyReport | null>
  attendanceRecords: ParentDailyReport[]
  billingByChild?: Record<string, ParentBillingSnapshot | null>
  supplyInventoryByChild?: Record<string, SupplyInventoryItem[]>
}

interface ParentPortalSectionProps {
  user: AuthUser
  onLogout: () => Promise<void>
}

const menus: { key: ParentMenuKey; label: string; icon: LucideIcon }[] = [
  { key: 'dashboard', label: 'Beranda', icon: Home },
  { key: 'daily-logs', label: 'Laporan', icon: ScrollText },
  { key: 'billing', label: 'Keuangan', icon: CreditCard },
  { key: 'profile', label: 'Profil', icon: UserRound },
]

const pageLabels: Record<ParentMenuKey, string> = {
  dashboard: 'Beranda',
  'daily-logs': 'Laporan',
  billing: 'Keuangan',
  profile: 'Profil',
  inventory: 'Inventory',
}

const asPayload = (payload: ParentDashboardData): ParentDashboardPayload =>
  payload as unknown as ParentDashboardPayload

const formatDate = (value: string, options: Intl.DateTimeFormatOptions) => {
  if (!value) return '-'
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', options).format(parsed)
}

const formatLongDate = (value: string) =>
  formatDate(value, { day: 'numeric', month: 'long', year: 'numeric' })

const formatTime = (value: string) => {
  if (!value) return '--:--'
  const [hours = '--', minutes = '--'] = value.split(':')
  return `${hours}:${minutes}`
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)

const formatPackage = (value: ChildProfile['servicePackage']) =>
  value === '2-mingguan' ? '2 Mingguan' : value.charAt(0).toUpperCase() + value.slice(1)

const getInitials = (value: string) =>
  value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

const getAgeLabel = (birthDate: string) => {
  if (!birthDate) return '-'
  const birth = new Date(`${birthDate}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return '-'

  const now = new Date()
  let years = now.getFullYear() - birth.getFullYear()
  let months = now.getMonth() - birth.getMonth()
  if (now.getDate() < birth.getDate()) months -= 1
  if (months < 0) {
    years -= 1
    months += 12
  }

  if (years > 0) {
    return `${years} tahun${months > 0 ? ` ${months} bulan` : ''}`
  }

  return `${Math.max(months, 0)} bulan`
}

const getChildStorageKey = (userId: string) => `${ACTIVE_CHILD_STORAGE_KEY}:${userId}`

const getInitialTheme = (): ParentTheme => {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const savedTheme = window.localStorage.getItem(PARENT_THEME_STORAGE_KEY)
  if (savedTheme === 'dark' || savedTheme === 'light') {
    return savedTheme
  }

  return 'light'
}

const parseDateKey = (value: string) => {
  if (!value) return null
  const normalized = value.length >= 10 ? value.slice(0, 10) : value
  const parsed = new Date(`${normalized}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

const createActivitySummary = (report: ParentDailyReport | null) => {
  if (!report) return []

  const summary: string[] = ['Pemantauan kedatangan dan kondisi awal anak.']

  if (report.carriedItems.length > 0) {
    summary.push(`Pengecekan barang bawaan (${report.carriedItems.length} item).`)
  }

  if (report.parentMessage.trim()) {
    summary.push('Orang tua mengirim catatan untuk petugas.')
  }

  if (report.messageForParent.trim()) {
    summary.push('Petugas mengirim catatan perkembangan untuk orang tua.')
  }

  if (report.departureTime || report.pickupName) {
    summary.push('Pemantauan penjemputan dan kondisi anak saat pulang.')
  }

  return summary
}

const createActivityTimeline = (report: ParentDailyReport | null) => {
  if (!report) return []

  const arrivalTime = formatTime(report.arrivalTime)
  const departureTime = formatTime(report.departureTime)
  const timeline: Array<{ label: string; description: string }> = [
    {
      label: `${arrivalTime} - ${departureTime}`,
      description: 'Pendampingan harian anak di TPA.',
    },
  ]

  if (report.carriedItems.length > 0) {
    timeline.push({
      label: arrivalTime,
      description: `Petugas mencatat ${report.carriedItems.length} barang bawaan.`,
    })
  }

  if (report.parentMessage.trim()) {
    timeline.push({
      label: arrivalTime,
      description: 'Orang tua mengirim pesan untuk petugas.',
    })
  }

  if (report.messageForParent.trim()) {
    timeline.push({
      label: departureTime,
      description: 'Petugas mengirim catatan perkembangan untuk orang tua.',
    })
  }

  return timeline
}

export default function ParentPortalSection({
  user,
  onLogout,
}: ParentPortalSectionProps) {
  const [theme, setTheme] = useState<ParentTheme>(() => getInitialTheme())
  const [activeMenu, setActiveMenu] = useState<ParentMenuKey>('dashboard')
  const [dashboardData, setDashboardData] = useState<ParentDashboardPayload | null>(null)
  const [activeChildId, setActiveChildId] = useState<string | null>(null)
  const [registrationCode, setRegistrationCode] = useState('')
  const [isLinkFormOpen, setLinkFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLinking, setIsLinking] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null)
  const [expandedMessageReportId, setExpandedMessageReportId] = useState<string | null>(null)
  const [isDashboardItemsOpen, setDashboardItemsOpen] = useState(false)
  const [expandedFinanceId, setExpandedFinanceId] = useState<string | null>(null)

  const clearSelectedChildSession = () => {
    window.localStorage.removeItem(getChildStorageKey(user.id))
  }

  const saveSelectedChildSession = (childId: string) => {
    window.localStorage.setItem(getChildStorageKey(user.id), childId)
  }

  const loadDashboard = async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const data = asPayload(await parentApi.getDashboardData())
      setDashboardData(data)

      const sessionKey = getChildStorageKey(user.id)
      const storedChildId = window.localStorage.getItem(sessionKey)
      const hasStoredChild =
        !!storedChildId && data.children.some((child) => child.id === storedChildId)

      if (hasStoredChild) {
        setActiveChildId(storedChildId)
      } else {
        setActiveChildId(null)
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Gagal memuat portal orang tua.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [])

  useEffect(() => {
    window.localStorage.setItem(PARENT_THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    setExpandedReportId(null)
    setExpandedMessageReportId(null)
    setDashboardItemsOpen(false)
    setExpandedFinanceId(null)
  }, [activeChildId])

  const children = dashboardData?.children ?? []
  const activeChild = useMemo(
    () => children.find((child) => child.id === activeChildId) ?? null,
    [activeChildId, children],
  )

  const reports = useMemo(() => {
    if (!activeChild) return []
    return (dashboardData?.attendanceRecords ?? [])
      .filter((record) => record.childId === activeChild.id)
      .sort((left, right) =>
        `${right.date}${right.createdAt}`.localeCompare(`${left.date}${left.createdAt}`, 'id'),
      )
  }, [activeChild, dashboardData])

  const todayReport = activeChild
    ? dashboardData?.dailyReports?.[activeChild.id] ?? reports[0] ?? null
    : null

  const billing = activeChild
    ? dashboardData?.billingByChild?.[activeChild.id] ?? null
    : null

  const parentProfile = dashboardData?.parentAccount?.parentProfile
  const todayDateKey = dashboardData?.todayDate || new Date().toISOString().slice(0, 10)

  const inventoryItems = useMemo(() => {
    if (!activeChild) return []

    const fromInventory = dashboardData?.supplyInventoryByChild?.[activeChild.id] ?? []
    if (fromInventory.length > 0) {
      return fromInventory
    }

    return (todayReport?.carriedItems ?? []).map((item, index) => ({
      id: `${activeChild.id}-carried-${index}`,
      childId: activeChild.id,
      productName: item.category || 'Barang bawaan',
      category: item.category || '-',
      quantity: 1,
      description: item.description || '-',
      imageDataUrl: item.imageDataUrl,
      imageName: item.imageName,
      createdAt: todayReport?.createdAt ?? new Date().toISOString(),
      updatedAt: todayReport?.updatedAt ?? new Date().toISOString(),
    }))
  }, [activeChild, dashboardData?.supplyInventoryByChild, todayReport])

  const lowStockItems = inventoryItems.filter((item) => item.quantity <= 3)

  const arrearsPeriods = useMemo(
    () => (billing?.periods ?? []).filter((period) => period.outstandingAmount > 0),
    [billing?.periods],
  )

  const paidTransactions = useMemo(
    () =>
      (billing?.transactions ?? []).filter(
        (transaction) => transaction.transactionType === 'payment' && transaction.amount > 0,
      ),
    [billing?.transactions],
  )

  const latestPaymentMethodByPeriod = useMemo(() => {
    const sortedTransactions = [...paidTransactions].sort((left, right) =>
      right.transactedAt.localeCompare(left.transactedAt, 'id'),
    )
    const entries = new Map<string, string>()

    sortedTransactions.forEach((transaction) => {
      if (!entries.has(transaction.periodId)) {
        entries.set(transaction.periodId, transaction.notes || '-')
      }
    })

    return entries
  }, [paidTransactions])

  const isReportPhotoVisible = (reportDate: string) => {
    const reportParsed = parseDateKey(reportDate)
    const todayParsed = parseDateKey(todayDateKey)
    if (!reportParsed || !todayParsed) return true

    const diffMs = todayParsed.getTime() - reportParsed.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    return diffDays <= 31
  }

  const handleSelectChild = (childId: string) => {
    saveSelectedChildSession(childId)
    setActiveChildId(childId)
    setActiveMenu('dashboard')
    setLinkFormOpen(false)
  }

  const handleLinkChild = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)

    const code = registrationCode.trim().toUpperCase()
    if (!code) {
      setErrorMessage('Kode registrasi wajib diisi.')
      return
    }

    setIsLinking(true)
    try {
      const previousChildIds = new Set(children.map((child) => child.id))
      const data = asPayload(await parentApi.linkChildByCode({ registrationCode: code }))
      setDashboardData(data)

      const newlyLinkedChild =
        data.children.find((child) => !previousChildIds.has(child.id)) ?? data.children[0] ?? null

      if (newlyLinkedChild) {
        saveSelectedChildSession(newlyLinkedChild.id)
        setActiveChildId(newlyLinkedChild.id)
      }

      setRegistrationCode('')
      setLinkFormOpen(false)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Gagal menautkan data anak.')
    } finally {
      setIsLinking(false)
    }
  }

  const handleLogoutFromProfile = async () => {
    clearSelectedChildSession()
    await onLogout()
  }

  const toggleTheme = () => {
    setTheme((previous) => (previous === 'dark' ? 'light' : 'dark'))
  }

  const renderStatusCard = (params: {
    title: string
    state: 'arrival' | 'departure'
    time: string
    personName: string
    physical: string
    emotional: string
  }) => {
    const isFilled = Boolean(params.time)
    return (
      <article
        className={`parent-solid-status-card parent-solid-status-card--${params.state} ${
          isFilled ? '' : 'is-empty'
        }`}
      >
        <h4>{params.title}</h4>
        <div className="parent-solid-status-list">
          <div>
            <span>Jam</span>
            <strong>{formatTime(params.time)}</strong>
          </div>
          <div>
            <span>{params.state === 'arrival' ? 'Pengantar' : 'Penjemput'}</span>
            <strong>{params.personName || '-'}</strong>
          </div>
          <div>
            <span>Kondisi</span>
            <strong>
              {params.physical || '-'} | {params.emotional || '-'}
            </strong>
          </div>
        </div>
      </article>
    )
  }

  const renderCarriedItems = (
    items: CarriedItem[],
    options: {
      emptyLabel: string
      minFrames?: number
      showPhotos?: boolean
      hiddenPhotoLabel?: string
    },
  ) => {
    const minFrames = options.minFrames ?? 0
    const showPhotos = options.showPhotos ?? true
    const hiddenPhotoLabel = options.hiddenPhotoLabel || 'Foto arsip tidak tersedia'
    const totalFrames = Math.max(items.length, minFrames)
    const frameIndexes = Array.from({ length: totalFrames }, (_, index) => index)

    return (
      <div className="parent-solid-carried-wrap">
        <div className="parent-solid-carried-photos">
          {frameIndexes.map((index) => {
            const item = items[index]
            const hasVisiblePhoto = Boolean(item && showPhotos && item.imageDataUrl)
            return (
              <figure
                key={item?.id || `${item?.category || 'frame'}-${index}`}
                className={`parent-solid-carried-photo ${hasVisiblePhoto ? '' : 'is-empty'}`}
              >
                {hasVisiblePhoto ? (
                  <img src={item.imageDataUrl} alt={item.category || 'Barang bawaan'} />
                ) : (
                  <div className="parent-solid-carried-photo__placeholder">
                    {item ? hiddenPhotoLabel : 'Frame foto kosong'}
                  </div>
                )}
              </figure>
            )
          })}
        </div>
        {items.length === 0 ? (
          <ul className="parent-solid-carried-list parent-solid-carried-list--empty">
            <li>
              <span>{options.emptyLabel}</span>
            </li>
          </ul>
        ) : (
          <ul className="parent-solid-carried-list">
            {items.map((item, index) => (
              <li key={`${item.id || item.category}-${index}`}>
                <strong>{item.category || `Barang ${index + 1}`}</strong>
                <span>{item.description || '-'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  const renderActivityTimelineCard = (report: ParentDailyReport | null, emptyLabel: string) => {
    const timeline = createActivityTimeline(report)

    return (
      <article className="parent-solid-card">
        <div className="parent-solid-card__header parent-solid-card__header--stack">
          <h3>Kegiatan Anak</h3>
          <p className="parent-solid-card__lead">
            Timeline kegiatan dari jam ke jam dengan keterangan singkat.
          </p>
        </div>
        {timeline.length === 0 ? (
          <p className="parent-solid-empty">{emptyLabel}</p>
        ) : (
          <ul className="parent-solid-activity-timeline">
            {timeline.map((item) => (
              <li key={`${item.label}-${item.description}`}>
                <span>{item.label}</span>
                <strong>{item.description}</strong>
              </li>
            ))}
          </ul>
        )}
      </article>
    )
  }

  const renderDashboard = () => (
    <section className="parent-solid-section parent-solid-section--stacked">
      <article className="parent-solid-card">
        <div className="parent-solid-card__header parent-solid-card__header--stack">
          <h3>KEHADIRAN</h3>
          <p className="parent-solid-card__lead">
            Ringkasan status kehadiran harian untuk memantau jam datang dan pulang anak.
          </p>
        </div>

        <div className="parent-solid-grid parent-solid-grid--status">
          {renderStatusCard({
            title: 'Status Datang',
            state: 'arrival',
            time: todayReport?.arrivalTime ?? '',
            personName: todayReport?.escortName ?? '',
            physical: todayReport?.arrivalPhysicalCondition ?? '',
            emotional: todayReport?.arrivalEmotionalCondition ?? '',
          })}

          {renderStatusCard({
            title: 'Status Pulang',
            state: 'departure',
            time: todayReport?.departureTime ?? '',
            personName: todayReport?.pickupName ?? '',
            physical: todayReport?.departurePhysicalCondition ?? '',
            emotional: todayReport?.departureEmotionalCondition ?? '',
          })}
        </div>
      </article>

      <article className="parent-solid-card">
        <div className="parent-solid-card__header parent-solid-card__header--stack">
          <h3>Pesan Orang Tua</h3>
          <p className="parent-solid-card__lead">
            Untuk Petugas dapat diinput orang tua dari portal orang tua, dan balasan petugas tampil pada kolom Untuk Orang Tua.
          </p>
        </div>
        <div className="parent-solid-grid parent-solid-grid--two">
          <div className="parent-solid-message-box">
            <label>Untuk Petugas</label>
            <p>{todayReport?.parentMessage || 'Belum ada pesan untuk petugas.'}</p>
          </div>
          <div className="parent-solid-message-box">
            <label>Untuk Orang Tua</label>
            <p>{todayReport?.messageForParent || 'Belum ada pesan dari petugas.'}</p>
          </div>
        </div>
      </article>

      <article className="parent-solid-card">
        <div className="parent-solid-card__header parent-solid-card__header--stack">
          <h3>Barang Bawaan</h3>
          <p className="parent-solid-card__lead">
            Klik gambar untuk memeriksa daftar barang bawaan anak.
          </p>
        </div>

        <button
          type="button"
          className="parent-solid-carried-hero"
          onClick={() => setDashboardItemsOpen((previous) => !previous)}
        >
          {(todayReport?.carriedItems[0]?.imageDataUrl ?? '') ? (
            <img
              src={todayReport?.carriedItems[0]?.imageDataUrl}
              alt={todayReport?.carriedItems[0]?.category || 'Barang bawaan anak'}
            />
          ) : (
            <div className="parent-solid-carried-hero__placeholder">
              Belum ada foto barang bawaan
            </div>
          )}
          <div className="parent-solid-carried-hero__meta">
            <strong>{`Total barang: ${todayReport?.carriedItems.length ?? 0}`}</strong>
            <span>
              {todayReport?.carriedItems[0]?.description || 'Klik untuk tampilkan daftar barang bawaan.'}
            </span>
          </div>
        </button>

        {isDashboardItemsOpen
          ? renderCarriedItems(todayReport?.carriedItems ?? [], {
            emptyLabel: 'Belum ada data barang bawaan hari ini.',
            minFrames: 0,
          })
          : null}
      </article>

      {renderActivityTimelineCard(todayReport, 'Ringkasan kegiatan anak belum tersedia.')}
    </section>
  )

  const renderDailyLogs = () => {
    return (
      <section className="parent-solid-section parent-solid-section--stacked">
        <article className="parent-solid-card">
          <div className="parent-solid-card__header">
            <div>
              <h3>INVENTORI</h3>
              <p className="parent-solid-card__lead">
                {`Persediaan Kebutuhan ${activeChild?.fullName || 'Anak'} di TPA`}
              </p>
            </div>
            <button
              type="button"
              className="parent-solid-inline-button"
              onClick={() => setActiveMenu('inventory')}
            >
              Periksa
            </button>
          </div>

          {lowStockItems.length > 0 ? (
            <p className="parent-solid-warning">
              Notifikasi: {lowStockItems.length} barang memiliki stok menipis.
            </p>
          ) : null}
        </article>

        <article className="parent-solid-card">
          <div className="parent-solid-card__header parent-solid-card__header--stack">
            <h3>LAPORAN HARIAN</h3>
            <p className="parent-solid-card__lead">
              Klik setiap tanggal untuk membuka detail laporan harian.
            </p>
          </div>

          {reports.length === 0 ? (
            <p className="parent-solid-empty">Belum ada laporan harian.</p>
          ) : (
            <div className="parent-solid-report-list">
              {reports.map((report) => {
                const isExpanded = expandedReportId === report.attendanceId
                const isMessageExpanded = expandedMessageReportId === report.attendanceId
                const shouldShowReportPhotos = isReportPhotoVisible(report.date)
                const activitySummary = createActivitySummary(report)

                return (
                  <article key={report.attendanceId} className="parent-solid-report-item">
                    <button
                      type="button"
                      className="parent-solid-report-item__trigger"
                      onClick={() => {
                        if (isExpanded) {
                          setExpandedReportId(null)
                          setExpandedMessageReportId(null)
                        } else {
                          setExpandedReportId(report.attendanceId)
                          setExpandedMessageReportId(null)
                        }
                      }}
                    >
                      <div className="parent-solid-report-item__summary">
                        <strong>{formatLongDate(report.date)}</strong>
                        {!isExpanded ? (
                          <div className="parent-solid-report-item__summary-row">
                            <span className="parent-solid-report-item__summary-arrival">
                              {`Datang : ${formatTime(report.arrivalTime)} | ${report.escortName || '-'}`}
                            </span>
                            <span className="parent-solid-report-item__summary-departure">
                              {`Pulang : ${formatTime(report.departureTime)} | ${report.pickupName || '-'}`}
                            </span>
                          </div>
                        ) : null}
                      </div>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {isExpanded ? (
                      <div className="parent-solid-report-item__dropdown">
                        <div className="parent-solid-report-item__detail-grid">
                          <article className="parent-solid-report-detail parent-solid-report-detail--arrival">
                            <h4>Datang</h4>
                            <p>{`${formatTime(report.arrivalTime)} | ${report.escortName || '-'}`}</p>
                            <span>
                              {`Kondisi: ${report.arrivalPhysicalCondition || '-'} | ${report.arrivalEmotionalCondition || '-'}`}
                            </span>
                          </article>
                          <article className="parent-solid-report-detail parent-solid-report-detail--departure">
                            <h4>Pulang</h4>
                            <p>{`${formatTime(report.departureTime)} | ${report.pickupName || '-'}`}</p>
                            <span>
                              {`Kondisi: ${report.departurePhysicalCondition || '-'} | ${report.departureEmotionalCondition || '-'}`}
                            </span>
                          </article>
                        </div>

                        <article className="parent-solid-card parent-solid-card--nested">
                          <button
                            type="button"
                            className="parent-solid-inline-button parent-solid-inline-button--muted"
                            onClick={() =>
                              setExpandedMessageReportId((previous) =>
                                previous === report.attendanceId ? null : report.attendanceId,
                              )
                            }
                          >
                            <span>Pesan Orang Tua</span>
                            {isMessageExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>

                          {isMessageExpanded ? (
                            <div className="parent-solid-grid parent-solid-grid--two">
                              <div className="parent-solid-message-box">
                                <label>Untuk Petugas</label>
                                <p>{report.parentMessage || 'Belum ada pesan untuk petugas.'}</p>
                              </div>
                              <div className="parent-solid-message-box">
                                <label>Untuk Orang Tua</label>
                                <p>{report.messageForParent || 'Belum ada pesan dari petugas.'}</p>
                              </div>
                            </div>
                          ) : null}
                        </article>

                        <article className="parent-solid-card parent-solid-card--nested">
                          <h4>Barang Bawaan</h4>
                          {renderCarriedItems(report.carriedItems, {
                            emptyLabel: 'Tidak ada detail barang bawaan.',
                            minFrames: 3,
                            showPhotos: shouldShowReportPhotos,
                            hiddenPhotoLabel: 'Foto diarsipkan (lebih dari 1 bulan)',
                          })}
                          {!shouldShowReportPhotos && report.carriedItems.length > 0 ? (
                            <p className="parent-solid-empty parent-solid-empty--note">
                              Foto barang bawaan hanya ditampilkan sampai 1 bulan.
                            </p>
                          ) : null}
                        </article>

                        <article className="parent-solid-card parent-solid-card--nested">
                          <h4>Ringkasan Kegiatan Anak</h4>
                          {activitySummary.length === 0 ? (
                            <p className="parent-solid-empty">Ringkasan kegiatan belum tersedia.</p>
                          ) : (
                            <ul className="parent-solid-activity-list parent-solid-activity-list--compact">
                              {activitySummary.map((summary) => (
                                <li key={summary}>{summary}</li>
                              ))}
                            </ul>
                          )}
                        </article>
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          )}
        </article>
      </section>
    )
  }

  const renderInventoryPage = () => (
    <section className="parent-solid-section parent-solid-section--stacked">
      <article className="parent-solid-card">
        <div className="parent-solid-card__header">
          <div>
            <h3>INVENTORY</h3>
            <p className="parent-solid-card__lead">
              {`Data inventori kebutuhan ${activeChild?.fullName || 'anak'} (hanya tampilan).`}
            </p>
          </div>
          <button
            type="button"
            className="parent-solid-inline-button"
            onClick={() => setActiveMenu('daily-logs')}
          >
            Kembali
          </button>
        </div>

        {lowStockItems.length > 0 ? (
          <p className="parent-solid-warning">
            Notifikasi: {lowStockItems.length} barang memiliki stok menipis.
          </p>
        ) : null}

        {inventoryItems.length === 0 ? (
          <p className="parent-solid-empty">Belum ada data inventori anak.</p>
        ) : (
          <div className="parent-solid-inventory-grid">
            {inventoryItems.map((item) => (
              <article key={item.id} className="parent-solid-item-card parent-solid-item-card--inventory">
                {item.imageDataUrl ? <img src={item.imageDataUrl} alt={item.productName} /> : null}
                <div>
                  <strong>{item.productName}</strong>
                  <p>{item.description || '-'}</p>
                  <span>{`Stok: ${item.quantity}`}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </article>
    </section>
  )

  const renderFinanceDisclosure = (params: {
    id: string
    dateLabel: string
    totalPaid: number
    packageLabel: string
    outstandingAmount: number
    paymentMethod: string
  }) => {
    const isExpanded = expandedFinanceId === params.id

    return (
      <article className={`parent-solid-finance-disclosure ${isExpanded ? 'is-open' : ''}`}>
        <button
          type="button"
          className="parent-solid-finance-disclosure__trigger"
          onClick={() =>
            setExpandedFinanceId((previous) => (previous === params.id ? null : params.id))
          }
        >
          <strong>{params.dateLabel}</strong>
          <span>{formatCurrency(params.totalPaid)}</span>
        </button>

        {isExpanded ? (
          <div className="parent-solid-finance-disclosure__detail">
            <div className="parent-solid-finance-disclosure__meta">
              <div>
                <span>Paket</span>
                <strong>{params.packageLabel}</strong>
              </div>
              <div>
                <span>Metode Pembayaran</span>
                <strong>{params.paymentMethod || '-'}</strong>
              </div>
            </div>

            <div className="parent-solid-finance-disclosure__amounts">
              <div className="parent-solid-finance-amount parent-solid-finance-amount--paid">
                <span>Jumlah Dibayarkan</span>
                <strong>{formatCurrency(params.totalPaid)}</strong>
              </div>
              <div
                className={`parent-solid-finance-amount parent-solid-finance-amount--outstanding ${
                  params.outstandingAmount <= 0 ? 'is-muted' : ''
                }`}
              >
                <span>Sisa Tagihan</span>
                <strong>{formatCurrency(params.outstandingAmount)}</strong>
              </div>
            </div>
          </div>
        ) : null}
      </article>
    )
  }

  const renderBilling = () => (
    <section className="parent-solid-section parent-solid-section--stacked">
      <article className="parent-solid-card parent-solid-card--finance parent-solid-card--arrears">
        <div className="parent-solid-card__header parent-solid-card__header--stack">
          <h3>TUNGGAKAN</h3>
          <p className="parent-solid-card__lead">
            {`Total sisa tagihan: ${formatCurrency(billing?.summary?.totalOutstanding ?? 0)}`}
          </p>
        </div>

        {arrearsPeriods.length === 0 ? (
          <p className="parent-solid-empty">Tidak ada data tunggakan.</p>
        ) : (
          <div className="parent-solid-finance-detail">
            {arrearsPeriods.map((period) => (
              <div key={period.id}>
                {renderFinanceDisclosure({
                  id: `arrears-${period.id}`,
                  dateLabel: formatLongDate(period.endDate || period.startDate),
                  totalPaid: period.paidAmount,
                  packageLabel: formatPackage(period.packageKey),
                  outstandingAmount: period.outstandingAmount,
                  paymentMethod: latestPaymentMethodByPeriod.get(period.id) || '-',
                })}
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="parent-solid-card parent-solid-card--finance parent-solid-card--paid">
        <div className="parent-solid-card__header parent-solid-card__header--stack">
          <h3>PEMBAYARAN LUNAS</h3>
          <p className="parent-solid-card__lead">{`${paidTransactions.length} transaksi pembayaran`}</p>
        </div>

        {paidTransactions.length === 0 ? (
          <p className="parent-solid-empty">Belum ada pembayaran lunas.</p>
        ) : (
          <div className="parent-solid-finance-detail">
            {paidTransactions.map((transaction) => {
              const period = billing?.periods.find((item) => item.id === transaction.periodId)
              return (
                <div key={transaction.id}>
                  {renderFinanceDisclosure({
                    id: `paid-${transaction.id}`,
                    dateLabel: formatLongDate(transaction.transactedAt),
                    totalPaid: transaction.amount,
                    packageLabel: period ? formatPackage(period.packageKey) : '-',
                    outstandingAmount: period?.outstandingAmount ?? 0,
                    paymentMethod: transaction.notes || '-',
                  })}
                </div>
              )
            })}
          </div>
        )}
      </article>
    </section>
  )

  const renderProfile = () => {
    if (!activeChild) return null

    return (
      <section className="parent-solid-section parent-solid-section--stacked">
        <article className="parent-solid-card parent-solid-profile-top">
          <div className="parent-solid-profile-avatar">
            {activeChild.photoDataUrl ? (
              <img src={activeChild.photoDataUrl} alt={activeChild.fullName} />
            ) : (
              <span>{getInitials(activeChild.fullName)}</span>
            )}
          </div>
          <div>
            <h3>{activeChild.fullName}</h3>
            <p>
              {activeChild.nickName || '-'} | {activeChild.gender || '-'} | {getAgeLabel(activeChild.birthDate)}
            </p>
          </div>
        </article>

        <article className="parent-solid-card">
          <div className="parent-solid-card__header">
            <h3>Data Orang Tua</h3>
          </div>
          <div className="parent-solid-detail-grid">
            <div><span>Nama ayah</span><strong>{parentProfile?.fatherName || '-'}</strong></div>
            <div><span>Nama ibu</span><strong>{parentProfile?.motherName || '-'}</strong></div>
            <div><span>Email</span><strong>{parentProfile?.email || user.email}</strong></div>
            <div><span>WhatsApp</span><strong>{parentProfile?.whatsappNumber || '-'}</strong></div>
            <div><span>Telepon rumah</span><strong>{parentProfile?.homePhone || '-'}</strong></div>
            <div><span>Alamat rumah</span><strong>{parentProfile?.homeAddress || '-'}</strong></div>
          </div>
        </article>

        <article className="parent-solid-card">
          <div className="parent-solid-card__header">
            <h3>Data Layanan</h3>
          </div>
          <div className="parent-solid-detail-grid">
            <div><span>Paket layanan</span><strong>{formatPackage(activeChild.servicePackage)}</strong></div>
            <div><span>Jam datang</span><strong>{activeChild.arrivalTime || '-'}</strong></div>
            <div><span>Jam pulang</span><strong>{activeChild.departureTime || '-'}</strong></div>
            <div><span>Pengantar & Penjemput</span><strong>{activeChild.pickupPersons.join(', ') || '-'}</strong></div>
            <div><span>Tujuan layanan</span><strong>{activeChild.depositPurpose || '-'}</strong></div>
          </div>
        </article>

        <article className="parent-solid-card">
          <div className="parent-solid-card__header">
            <h3>Perkembangan Kondisi Anak</h3>
          </div>
          <div className="parent-solid-detail-grid">
            <div><span>Masa prenatal</span><strong>{activeChild.prenatalPeriod || '-'}</strong></div>
            <div><span>Masa partus</span><strong>{activeChild.partusPeriod || '-'}</strong></div>
            <div><span>Masa post-natal</span><strong>{activeChild.postNatalPeriod || '-'}</strong></div>
            <div><span>Kemampuan motorik</span><strong>{activeChild.motorSkill || '-'}</strong></div>
            <div><span>Kemampuan bahasa</span><strong>{activeChild.languageSkill || '-'}</strong></div>
            <div><span>Riwayat kesehatan</span><strong>{activeChild.healthHistory || '-'}</strong></div>
          </div>
        </article>

        <article className="parent-solid-card">
          <div className="parent-solid-card__header">
            <h3>Kebiasaan Sehari-hari</h3>
          </div>
          <div className="parent-solid-detail-grid">
            <div><span>Toilet BAB</span><strong>{activeChild.toiletTrainingBab || '-'}</strong></div>
            <div><span>Toilet BAK</span><strong>{activeChild.toiletTrainingBak || '-'}</strong></div>
            <div><span>Mandi</span><strong>{activeChild.toiletTrainingBath || '-'}</strong></div>
            <div><span>Gosok gigi</span><strong>{activeChild.brushingTeeth || '-'}</strong></div>
            <div><span>Makan</span><strong>{activeChild.eating || '-'}</strong></div>
            <div><span>Minum susu</span><strong>{activeChild.drinkingMilk || '-'}</strong></div>
            <div><span>Saat menangis</span><strong>{activeChild.whenCrying || '-'}</strong></div>
            <div><span>Saat bermain</span><strong>{activeChild.whenPlaying || '-'}</strong></div>
            <div><span>Tidur</span><strong>{activeChild.sleeping || '-'}</strong></div>
            <div><span>Lain-lain</span><strong>{activeChild.otherHabits || '-'}</strong></div>
          </div>
        </article>

        <article className="parent-solid-card">
          <button
            type="button"
            className="parent-solid-logout"
            onClick={() => {
              void handleLogoutFromProfile()
            }}
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </article>
      </section>
    )
  }

  const renderPortalContent = () => {
    if (!activeChild) return null

    return (
      <>
        <section className="parent-solid-page-head">
          <h2>{pageLabels[activeMenu]}</h2>
          <p>
            {`Data monitoring harian • ${formatLongDate(dashboardData?.todayDate || new Date().toISOString().slice(0, 10))}`}
          </p>
        </section>

        {activeMenu === 'dashboard' ? renderDashboard() : null}
        {activeMenu === 'daily-logs' ? renderDailyLogs() : null}
        {activeMenu === 'inventory' ? renderInventoryPage() : null}
        {activeMenu === 'billing' ? renderBilling() : null}
        {activeMenu === 'profile' ? renderProfile() : null}
      </>
    )
  }

  return (
    <div className="parent-solid" data-theme={theme}>
      <header className="parent-solid-header">
        <div className="parent-solid-brand">
          <span className="parent-solid-brand__logo">
            <img src={LOGO_SRC} alt="Logo TPA Rumah Ceria UBAYA" />
          </span>
          <div>
            <h1>TPA RUMAH CERIA UBAYA</h1>
            <p>DASHBOARD MONITORING</p>
          </div>
        </div>

        <div className="parent-solid-header__right">
          <nav className="parent-solid-desktop-nav" aria-label="Navigasi orang tua">
            {menus.map((menu) => (
              <button
                key={menu.key}
                type="button"
                className={
                  activeMenu === menu.key || (activeMenu === 'inventory' && menu.key === 'daily-logs')
                    ? 'is-active'
                    : ''
                }
                onClick={() => setActiveMenu(menu.key)}
                disabled={!activeChild}
              >
                <menu.icon size={16} />
                <span>{menu.label}</span>
              </button>
            ))}
          </nav>

          <button
            type="button"
            className="parent-solid-theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Ubah ke mode terang' : 'Ubah ke mode gelap'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span>{theme === 'dark' ? 'Terang' : 'Gelap'}</span>
          </button>
        </div>
      </header>

      <main className="parent-solid-main">
        {errorMessage ? <p className="parent-solid-banner parent-solid-banner--error">{errorMessage}</p> : null}

        {isLoading && !dashboardData ? (
          <section className="parent-solid-state">
            <RefreshCw size={20} className="parent-solid-spinner" />
            <p>Memuat dashboard orang tua...</p>
          </section>
        ) : null}

        {dashboardData && children.length === 0 ? (
          <section className="parent-solid-selector">
            <article className="parent-solid-card">
              <h2>Belum ada akun anak yang tertaut.</h2>
              <p className="parent-solid-empty">Masukkan kode registrasi untuk menambahkan akun anak.</p>
              <form className="parent-solid-link-form" onSubmit={handleLinkChild}>
                <input
                  type="text"
                  className="parent-solid-input"
                  placeholder="Masukkan Kode Registrasi"
                  value={registrationCode}
                  onChange={(event) => setRegistrationCode(event.target.value.toUpperCase())}
                  disabled={isLinking}
                />
                <button type="submit" className="parent-solid-button" disabled={isLinking}>
                  {isLinking ? 'Menautkan...' : 'Tautkan Anak'}
                </button>
              </form>
            </article>
          </section>
        ) : null}

        {dashboardData && children.length > 0 && !activeChild ? (
          <section className="parent-solid-selector">
            <article className="parent-solid-card parent-solid-selector__welcome">
              <h2>Selamat datang Ayah Bunda di platform monitoring anak digital.</h2>
              <p>
                Silahkan pilih akun anak Anda dan dapatkan notifikasi perkembangan anak Anda
                secara real-time.
              </p>
            </article>

            <div className="parent-solid-child-grid">
              {children.map((child) => (
                <button
                  key={child.id}
                  type="button"
                  className="parent-solid-child-card"
                  onClick={() => handleSelectChild(child.id)}
                >
                  <span className="parent-solid-child-card__avatar">
                    {child.photoDataUrl ? (
                      <img src={child.photoDataUrl} alt={child.fullName} />
                    ) : (
                      <span>{getInitials(child.fullName)}</span>
                    )}
                  </span>
                  <span className="parent-solid-child-card__name">{child.fullName}</span>
                  <span className="parent-solid-child-card__meta">
                    {`${child.nickName || '-'} | ${getAgeLabel(child.birthDate)}`}
                  </span>
                </button>
              ))}
            </div>

            <div className="parent-solid-add-child">
              <button
                type="button"
                className="parent-solid-button parent-solid-button--ghost"
                onClick={() => setLinkFormOpen((previous) => !previous)}
              >
                <PlusCircle size={16} />
                <span>Tambah Data Anak</span>
              </button>

              {isLinkFormOpen ? (
                <form className="parent-solid-link-form" onSubmit={handleLinkChild}>
                  <input
                    type="text"
                    className="parent-solid-input"
                    placeholder="Masukkan Kode Registrasi"
                    value={registrationCode}
                    onChange={(event) => setRegistrationCode(event.target.value.toUpperCase())}
                    disabled={isLinking}
                  />
                  <button type="submit" className="parent-solid-button" disabled={isLinking}>
                    {isLinking ? 'Menautkan...' : 'Tautkan Anak'}
                  </button>
                </form>
              ) : null}
            </div>
          </section>
        ) : null}

        {dashboardData && activeChild ? renderPortalContent() : null}
      </main>

      <nav className="parent-solid-mobile-nav" aria-label="Bottom navigation orang tua">
        {menus.map((menu) => (
          <button
            key={menu.key}
            type="button"
            className={
              activeMenu === menu.key || (activeMenu === 'inventory' && menu.key === 'daily-logs')
                ? 'is-active'
                : ''
            }
            onClick={() => setActiveMenu(menu.key)}
            disabled={!activeChild}
          >
            <menu.icon size={16} />
            <span>{menu.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

