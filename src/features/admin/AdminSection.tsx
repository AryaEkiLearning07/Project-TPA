import {
  Menu,
  CheckCircle2,
  Download,
} from 'lucide-react'
import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AppDatePickerField,
  AppMonthPickerField,
} from '../../components/common/DatePickerFields'
import Sidebar from '../../components/layout/Sidebar'
import {
  adminApi,
  attendanceApi,
  childApi,
  incidentApi,
  observationApi,
  parentAccountApi,
} from '../../services/api'
import DataAnakPage from '../petugas/data-anak/DataAnakPage'
import { downloadBeritaAcaraPdf } from '../petugas/berita-acara/beritaAcaraPdf'
import { downloadObservationBatchPdf } from './observationPdf'
import { downloadStaffAttendancePdf } from './staffAttendancePdf'
import { downloadRekapAttendancePdf } from './rekap-bulanan/rekapPdf'
import KehadiranAnakPage from './rekap-monitoring/KehadiranAnakPage'
import ObservasiAnakPage from './rekap-monitoring/ObservasiAnakPage'
import BeritaAcaraPage from './rekap-monitoring/BeritaAcaraPage'
import KehadiranPetugasPage from './rekap-monitoring/KehadiranPetugasPage'
import BillingPage from './rekap-monitoring/BillingPage'
import ManajemenPetugasPage from './pengaturan/ManajemenPetugasPage'
import LogAktivitasPage from './pengaturan/LogAktivitasPage'
import BackupPage from './pengaturan/BackupPage'
import ManajemenAkunOrangTuaPage from './pengaturan/ManajemenAkunOrangTuaPage'
import UpdatePengumumanPage, {
  type LandingAnnouncementEditorForm,
} from './pengaturan/UpdatePengumumanPage'
import type {
  ActivityLogEntry,
  AppData,
  AuthUser,
  ChildRegistrationCode,
  ChildProfile,
  ChildProfileInput,
  ConfirmDialogOptions,
  LandingAnnouncement,
  LandingAnnouncementInput,
  ParentAccount,
  ServiceBillingSummaryResponse,
  ServiceBillingHistoryResponse,
  ServiceBillingPeriodInput,
  ServiceBillingPaymentInput,
  ServiceBillingRefundInput,
  ServicePackage,
  ServicePackageRates,
  StaffRegistrationRequest,
  StaffAttendanceRecapRow,
  StaffUser,
  StaffUserInput,
} from '../../types'
import { getLocalDateIso } from '../../utils/date'
import { compressImageToDataUrl } from '../../utils/image'
import { createEmptyAppData } from '../../utils/storage'
import {
  parseNavigationState,
  pushNavigationState,
  readNavigationState,
  replaceNavigationState,
} from '../../utils/browser-history'
import { useHideOnScroll } from '../../utils/useHideOnScroll'
import {
  type AdminSidebarKey,
  type MonitoringSubTab,
  type SettingsSubTab,
  type ConfirmDialogState,
  type StaffAttendanceSummary,
  type ServiceMonthlyRecapRow,
  type ServiceMonthChildRow,
  type ServiceMonthlyDetail,

  type ServiceBillingArrearsRow,
  type ObservationRecapRow,
  type DownloadNoticeType,
  type ServiceGenderKey,
  isAdminNavigationState,
  buildAdminNavigationState,
  adminMenus,
  monitoringSubTabs,
  settingsSubTabs,
  sidebarTitles,
  initialStaffForm,
  initialServiceRates,
  initialServiceBillingPeriodForm,
  initialServiceBillingPaymentForm,
  initialServiceBillingRefundForm,
  ACTIVITY_LOG_LIMIT_OPTIONS,
  DEFAULT_ACTIVITY_LOG_LIMIT,
  formatDateTime,
  formatLogDateTimeParts,
  formatDateOnly,
  formatDateWithWeekday,
  formatMonthLabel,
  formatTimeOnly,
  calculateServiceLength,
  calculateIsSenior,
  calculateStaffPay,
  formatRupiah,
  formatCurrency,
  toUnpaidAttendanceDays,
  downloadBlob,
  toLocalDateKey,
  calculateDutyMinutes,
  formatDutyDuration,
  clampDateKeyToToday,
  clampMonthKeyToToday,
  servicePackageLabels,
  createServicePackageCounter,
  resolveServiceGenderKey,
  createEmptyObservationCategorySummary,
  summarizeObservationItems,
  defaultObservationGroupOptions,
  resolveObservationGroupFilterValue,
} from './adminHelpers'
import { servicePackageOptions } from '../../constants/options'

interface AdminSectionProps {
  user: AuthUser
  onLogout: () => Promise<void>
}

type IncidentPdfMode = 'date' | 'month'
type StaffAttendancePdfMode = 'monthly' | 'yearly'
type MonthDateFilterSelection = {
  month: string
  date: string
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const ISO_MONTH_PATTERN = /^\d{4}-\d{2}$/
const ADMIN_BACKGROUND_SYNC_INTERVAL_MS = 15000
const ORDERED_OBSERVATION_GROUP_KEYS = ['matahari', 'bintang', 'pelangi', 'bulan'] as const

const isIsoDateKey = (value: string): boolean => ISO_DATE_PATTERN.test(value)
const isIsoMonthKey = (value: string): boolean => ISO_MONTH_PATTERN.test(value)

const clampOptionalDateKeyToToday = (value: string, todayDate?: string): string => {
  const normalized = value.trim()
  if (!normalized) {
    return ''
  }
  return clampDateKeyToToday(normalized, todayDate)
}

const getMonthDateBounds = (monthKey: string, todayDate: string): { min: string; max: string } => {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return {
      min: todayDate.slice(0, 7) + '-01',
      max: todayDate,
    }
  }

  const [yearText, monthText] = monthKey.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const daysInMonth = new Date(year, month, 0).getDate()
  const monthEndDate = `${monthKey}-${String(daysInMonth).padStart(2, '0')}`

  return {
    min: `${monthKey}-01`,
    max: monthEndDate > todayDate ? todayDate : monthEndDate,
  }
}

const resolveMonthDateFilterSelection = (
  rawValue: string,
  clampMonth: (value: string) => string,
  clampDate: (value: string) => string,
  fallbackMonth: string,
): MonthDateFilterSelection => {
  const value = rawValue.trim()

  if (isIsoDateKey(value)) {
    const date = clampDate(value)
    return {
      month: clampMonth(date.slice(0, 7)),
      date,
    }
  }

  if (isIsoMonthKey(value)) {
    return {
      month: clampMonth(value),
      date: '',
    }
  }

  return {
    month: clampMonth(fallbackMonth),
    date: '',
  }
}

const activityActionLabelMap: Record<string, string> = {
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  STAFF_CHECKIN: 'Absen masuk oleh petugas',
  STAFF_CHECKOUT: 'Absen pulang oleh petugas',
  ADMIN_STAFF_CHECKIN: 'Absen masuk dicatat admin',
  ADMIN_STAFF_CHECKOUT: 'Absen pulang dicatat admin',
  CREATE_STAFF: 'Membuat akun petugas',
  UPDATE_STAFF: 'Memperbarui akun petugas',
  DELETE_STAFF: 'Menghapus akun petugas',
  APPROVE_STAFF_REGISTRATION: 'Menyetujui pendaftaran petugas',
  REJECT_STAFF_REGISTRATION: 'Menolak pendaftaran petugas',
  UPDATE_SERVICE_RATES: 'Memperbarui tarif layanan',
  CREATE_SERVICE_BILLING_PERIOD: 'Membuat periode billing',
  CREATE_SERVICE_BILLING_PAYMENT: 'Mencatat pembayaran billing',
  CREATE_SERVICE_BILLING_REFUND: 'Mencatat refund billing',
  CONFIRM_SERVICE_BILLING_UPGRADE: 'Konfirmasi upgrade billing',
  CREATE_LANDING_ANNOUNCEMENT: 'Membuat update pengumuman landing',
  UPDATE_LANDING_ANNOUNCEMENT: 'Memperbarui update pengumuman landing',
  DELETE_LANDING_ANNOUNCEMENT: 'Menghapus update pengumuman landing',
  BACKUP_DATABASE: 'Unduh backup database',
  REPLACE_APP_DATA: 'Ganti data aplikasi',
  IMPORT_APP_DATA: 'Impor data aplikasi',
}

const formatActivityActionSummary = (entry: ActivityLogEntry): string => {
  const actionKey = entry.action.trim().toUpperCase()
  const fallback = actionKey
    ? actionKey
      .split('_')
      .filter(Boolean)
      .map((segment) => segment.charAt(0) + segment.slice(1).toLowerCase())
      .join(' ')
    : 'Aktivitas'

  const actionLabel = activityActionLabelMap[actionKey] ?? fallback
  const cleanTarget = entry.target.trim()

  if (!cleanTarget || cleanTarget === 'auth') {
    return actionLabel
  }

  return `${actionLabel} (${cleanTarget})`
}

const createFallbackServerDateContext = () => {
  const todayDate = getLocalDateIso()
  return {
    todayDate,
    todayMonth: todayDate.slice(0, 7),
    todayYear: todayDate.slice(0, 4),
  }
}

const initialLandingAnnouncementForm: LandingAnnouncementEditorForm = {
  title: '',
  slug: '',
  category: 'galeri',
  displayMode: 'section',
  excerpt: '',
  content: '',
  coverImageDataUrl: '',
  coverImageName: '',
  ctaLabel: '',
  ctaUrl: '',
  publishStartDate: '',
  publishEndDate: '',
  status: 'published',
  isPinned: false,
}

const AdminSection = ({ user, onLogout }: AdminSectionProps) => {
  const [activeSidebar, setActiveSidebar] = useState<AdminSidebarKey>('monitoring')
  const [monitoringTab, setMonitoringTab] = useState<MonitoringSubTab>('kehadiran-anak')
  const [settingsTab, setSettingsTab] = useState<SettingsSubTab>('petugas')
  const [isSidebarOpen, setSidebarOpen] = useState(false)
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([])
  const [pendingStaffRequests, setPendingStaffRequests] = useState<StaffRegistrationRequest[]>([])
  const [parentAccounts, setParentAccounts] = useState<ParentAccount[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([])
  const [staffAttendanceRecapRows, setStaffAttendanceRecapRows] = useState<
    StaffAttendanceRecapRow[]
  >([])
  const [appData, setAppData] = useState<AppData>(() => createEmptyAppData())
  const [childRegistrationCodesById, setChildRegistrationCodesById] = useState<
    Record<string, ChildRegistrationCode | null>
  >({})
  const [serviceRates, setServiceRates] = useState<ServicePackageRates>(initialServiceRates)
  const [serviceBillingSummary, setServiceBillingSummary] = useState<ServiceBillingSummaryResponse | null>(null)
  const [serviceBillingHistory, setServiceBillingHistory] = useState<ServiceBillingHistoryResponse | null>(null)
  const [selectedBillingChildId, setSelectedBillingChildId] = useState('')
  const [serviceBillingPeriodForm, setServiceBillingPeriodForm] = useState<ServiceBillingPeriodInput>(
    initialServiceBillingPeriodForm,
  )
  const [serviceBillingPaymentForm, setServiceBillingPaymentForm] = useState<ServiceBillingPaymentInput>(
    initialServiceBillingPaymentForm,
  )
  const [serviceBillingRefundForm, setServiceBillingRefundForm] = useState<ServiceBillingRefundInput>(
    initialServiceBillingRefundForm,
  )
  const [staffForm, setStaffForm] = useState<StaffUserInput>(initialStaffForm)
  const [landingAnnouncements, setLandingAnnouncements] = useState<LandingAnnouncement[]>([])
  const [landingAnnouncementForm, setLandingAnnouncementForm] = useState<LandingAnnouncementEditorForm>(
    initialLandingAnnouncementForm,
  )
  const [editingLandingAnnouncementId, setEditingLandingAnnouncementId] = useState<string | null>(null)
  const [isLoadingLandingAnnouncements, setLoadingLandingAnnouncements] = useState(false)
  const [isSavingLandingAnnouncement, setSavingLandingAnnouncement] = useState(false)
  const [deletingLandingAnnouncementId, setDeletingLandingAnnouncementId] = useState<string | null>(null)
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null)
  const [showStaffPassword, setShowStaffPassword] = useState(false)
  const [searchLogs, setSearchLogs] = useState('')
  const [activityLogDateFilter, setActivityLogDateFilter] = useState('')
  const [activityLogLimit, setActivityLogLimit] = useState(DEFAULT_ACTIVITY_LOG_LIMIT)
  const [activityLogPage, setActivityLogPage] = useState(1)
  const [activityLogPageCursor, setActivityLogPageCursor] = useState<string | null>(null)
  const [activityLogNextCursor, setActivityLogNextCursor] = useState<string | null>(null)
  const [activityLogHasMore, setActivityLogHasMore] = useState(false)
  const [observationFilterGroup, setObservationFilterGroup] = useState('')
  const [observationFilterMonth, setObservationFilterMonth] = useState(
    () => getLocalDateIso().slice(0, 7),
  )
  const [observationFilterDate, setObservationFilterDate] = useState('')
  const [incidentFilterMonth, setIncidentFilterMonth] = useState(
    () => getLocalDateIso().slice(0, 7),
  )
  const [incidentFilterDate, setIncidentFilterDate] = useState('')
  const [incidentFilterChild, setIncidentFilterChild] = useState('')
  const [staffAttendanceFilterDate, setStaffAttendanceFilterDate] = useState(
    () => getLocalDateIso(),
  )
  const [staffAttendanceFilterMonth, setStaffAttendanceFilterMonth] = useState(
    () => getLocalDateIso().slice(0, 7),
  )
  const [serviceRecapYear, setServiceRecapYear] = useState(() =>
    getLocalDateIso().slice(0, 4),
  )
  const [serviceRecapMonth, setServiceRecapMonth] = useState(() =>
    getLocalDateIso().slice(0, 7),
  )
  const [isServiceBillingSettlementOpen, setServiceBillingSettlementOpen] = useState(false)
  const [serviceBillingPaidPage, setServiceBillingPaidPage] = useState(1)
  const SERVICE_BILLING_PAID_PAGE_SIZE = 20
  const [isLoadingStaff, setLoadingStaff] = useState(false)
  const [isLoadingPendingStaffRequests, setLoadingPendingStaffRequests] = useState(false)
  const [processingStaffRequestId, setProcessingStaffRequestId] = useState<string | null>(null)
  const [isLoadingParentAccounts, setLoadingParentAccounts] = useState(false)
  const [togglingParentAccountIds, setTogglingParentAccountIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [isLoadingLogs, setLoadingLogs] = useState(false)
  const [isLoadingServices, setLoadingServices] = useState(false)
  const [isLoadingServiceBilling, setLoadingServiceBilling] = useState(false)
  const [isLoadingStaffAttendance, setLoadingStaffAttendance] = useState(false)
  const [isMutatingServiceBilling, setMutatingServiceBilling] = useState(false)
  const [isProcessingBackup, setProcessingBackup] = useState(false)
  const [isDownloadingObservationPdf, setDownloadingObservationPdf] = useState(false)
  const [downloadingObservationChildId, setDownloadingObservationChildId] = useState<string | null>(null)
  const [isDownloadingIncidentPdf, setDownloadingIncidentPdf] = useState(false)
  const [isIncidentPdfDialogOpen, setIncidentPdfDialogOpen] = useState(false)
  const [incidentPdfMode, setIncidentPdfMode] = useState<IncidentPdfMode>('month')
  const [incidentPdfFilterMonth, setIncidentPdfFilterMonth] = useState(() => getLocalDateIso().slice(0, 7))
  const [incidentPdfFilterDate, setIncidentPdfFilterDate] = useState('')

  const [isDownloadingStaffAttendancePdf, setDownloadingStaffAttendancePdf] = useState(false)
  const [isStaffAttendancePdfDialogOpen, setStaffAttendancePdfDialogOpen] = useState(false)
  const [staffAttendancePdfMode, setStaffAttendancePdfMode] = useState<StaffAttendancePdfMode>('monthly')
  const [staffAttendancePdfYear, setStaffAttendancePdfYear] = useState(() => getLocalDateIso().slice(0, 4))
  const [staffAttendanceActionState, setStaffAttendanceActionState] = useState<{
    staffUserId: string
    action: 'check-in' | 'check-out'
  } | null>(null)
  const [isDownloadingKehadiranAnakPdf, setDownloadingKehadiranAnakPdf] = useState(false)
  const [kehadiranAnakPdfNotice, setKehadiranAnakPdfNotice] = useState<{ type: DownloadNoticeType; text: string } | null>(null)
  const [kehadiranAnakPage, setKehadiranAnakPage] = useState(1)
  const KEHADIRAN_ANAK_PAGE_SIZE = 20

  const [observationFilterChild, setObservationFilterChild] = useState<string>('')
  const [serverDateContext, setServerDateContext] = useState(createFallbackServerDateContext)
  const todayIso = serverDateContext.todayDate
  const todayMonthKey = serverDateContext.todayMonth
  const todayYearKey = serverDateContext.todayYear
  const [isSyncingAppData] = useState(false)
  const [observationPdfNotice, setObservationPdfNotice] = useState<{
    type: DownloadNoticeType
    text: string
  } | null>(null)
  const [incidentPdfNotice, setIncidentPdfNotice] = useState<{
    type: DownloadNoticeType
    text: string
  } | null>(null)
  const [staffAttendancePdfNotice, setStaffAttendancePdfNotice] = useState<{
    type: DownloadNoticeType
    text: string
  } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const confirmResolveRef = useRef<((result: boolean) => void) | null>(null)
  const initialSidebarRef = useRef<AdminSidebarKey>(activeSidebar)
  const initialMonitoringTabRef = useRef<MonitoringSubTab>(monitoringTab)
  const initialSettingsTabRef = useRef<SettingsSubTab>(settingsTab)
  const isApplyingNavigationHistoryRef = useRef(false)
  const hasInitializedNavigationHistoryRef = useRef(false)
  const isTopbarHidden = useHideOnScroll()
  const hasLoadedChildrenRef = useRef(false)
  const hasLoadedAttendanceRef = useRef(false)
  const hasLoadedObservationRef = useRef(false)
  const hasLoadedIncidentRef = useRef(false)
  const hasLoadedServiceRatesRef = useRef(false)
  const childrenRequestRef = useRef<Promise<void> | null>(null)
  const attendanceRequestRef = useRef<Promise<void> | null>(null)
  const observationRequestRef = useRef<Promise<void> | null>(null)
  const incidentRequestRef = useRef<Promise<void> | null>(null)
  const serviceRatesRequestRef = useRef<Promise<void> | null>(null)

  const staffCountLabel = useMemo(() => `${staffUsers.length} petugas`, [staffUsers.length])
  const activeHeader = sidebarTitles[activeSidebar]
  const clampDateKeyToServerToday = useCallback(
    (value: string) => clampDateKeyToToday(value, todayIso),
    [todayIso],
  )
  const clampMonthKeyToServerToday = useCallback(
    (value: string) => clampMonthKeyToToday(value, todayMonthKey),
    [todayMonthKey],
  )
  const clampOptionalDateKeyToServerToday = useCallback(
    (value: string) => clampOptionalDateKeyToToday(value, todayIso),
    [todayIso],
  )

  // --- Confirm dialog ---
  const closeConfirmDialog = (result: boolean) => {
    const resolve = confirmResolveRef.current
    confirmResolveRef.current = null
    setConfirmDialog(null)
    if (resolve) {
      resolve(result)
    }
  }

  const requestConfirm = (options: ConfirmDialogOptions): Promise<boolean> =>
    new Promise((resolve) => {
      if (confirmResolveRef.current) {
        confirmResolveRef.current(false)
      }
      confirmResolveRef.current = resolve
      setConfirmDialog({
        title: options.title ?? 'Konfirmasi',
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'Ya, Lanjutkan',
        cancelLabel: options.cancelLabel ?? 'Batal',
        tone: options.tone ?? 'default',
      })
    })

  useEffect(() => {
    if (!confirmDialog) {
      return undefined
    }

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeConfirmDialog(false)
      }
    }

    document.addEventListener('keydown', handleEscapeKey)
    return () => {
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [confirmDialog])

  useEffect(() => {
    if (!message) {
      return undefined
    }

    const timerId = window.setTimeout(() => {
      setMessage(null)
    }, 3000)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [message])

  useEffect(
    () => () => {
      if (confirmResolveRef.current) {
        confirmResolveRef.current(false)
        confirmResolveRef.current = null
      }
    },
    [],
  )

  useEffect(() => {
    const restoredState = readNavigationState(isAdminNavigationState)

    if (restoredState) {
      const shouldRestore =
        restoredState.sidebar !== initialSidebarRef.current ||
        restoredState.monitoringTab !== initialMonitoringTabRef.current ||
        restoredState.settingsTab !== initialSettingsTabRef.current

      if (shouldRestore) {
        isApplyingNavigationHistoryRef.current = true
        setActiveSidebar(restoredState.sidebar)
        setMonitoringTab(restoredState.monitoringTab)
        setSettingsTab(restoredState.settingsTab)
      }
    } else {
      replaceNavigationState(
        buildAdminNavigationState(
          initialSidebarRef.current,
          initialMonitoringTabRef.current,
          initialSettingsTabRef.current,
        ),
      )
    }

    hasInitializedNavigationHistoryRef.current = true

    const handlePopState = (event: PopStateEvent) => {
      const nextState = parseNavigationState(event.state, isAdminNavigationState)
      if (!nextState) {
        return
      }

      isApplyingNavigationHistoryRef.current = true
      setActiveSidebar(nextState.sidebar)
      setMonitoringTab(nextState.monitoringTab)
      setSettingsTab(nextState.settingsTab)
      setSidebarOpen(false)
      setMessage(null)
      setErrorMessage(null)
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  useEffect(() => {
    if (!hasInitializedNavigationHistoryRef.current) {
      return
    }

    if (isApplyingNavigationHistoryRef.current) {
      isApplyingNavigationHistoryRef.current = false
      return
    }

    const currentState = readNavigationState(isAdminNavigationState)
    if (
      currentState?.sidebar === activeSidebar &&
      currentState?.monitoringTab === monitoringTab &&
      currentState?.settingsTab === settingsTab
    ) {
      return
    }

    pushNavigationState(
      buildAdminNavigationState(activeSidebar, monitoringTab, settingsTab),
    )
  }, [activeSidebar, monitoringTab, settingsTab])

  useEffect(() => {
    let isActive = true

    const syncServerDateContext = async () => {
      try {
        const context = await adminApi.getServerDateContext()
        if (!isActive) {
          return
        }

        setServerDateContext((previous) => {
          if (
            previous.todayDate === context.todayDate &&
            previous.todayMonth === context.todayMonth &&
            previous.todayYear === context.todayYear
          ) {
            return previous
          }
          return {
            todayDate: context.todayDate,
            todayMonth: context.todayMonth,
            todayYear: context.todayYear,
          }
        })
      } catch {
        // Keep local fallback when server clock request fails.
      }
    }

    void syncServerDateContext()
    const intervalId = window.setInterval(() => {
      void syncServerDateContext()
    }, 60000)

    return () => {
      isActive = false
      window.clearInterval(intervalId)
    }
  }, [])

  // --- Data loaders ---
  const loadStaff = useCallback(async () => {
    setLoadingStaff(true)
    try {
      const data = await adminApi.getStaffUsers()
      setStaffUsers(data)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memuat data petugas.'
      setErrorMessage(message)
    } finally {
      setLoadingStaff(false)
    }
  }, [])

  const loadPendingStaffRequests = useCallback(async () => {
    setLoadingPendingStaffRequests(true)
    try {
      const data = await adminApi.getPendingStaffRegistrationRequests()
      setPendingStaffRequests(data)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Gagal memuat permintaan pendaftaran petugas.'
      setErrorMessage(message)
      setPendingStaffRequests([])
    } finally {
      setLoadingPendingStaffRequests(false)
    }
  }, [])

  const loadParentAccounts = useCallback(async () => {
    setLoadingParentAccounts(true)
    try {
      const data = await parentAccountApi.getParentAccounts()
      setParentAccounts(data)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memuat akun orang tua.'
      setErrorMessage(message)
      setParentAccounts([])
    } finally {
      setLoadingParentAccounts(false)
    }
  }, [])

  const resetLandingAnnouncementForm = useCallback(() => {
    setLandingAnnouncementForm(initialLandingAnnouncementForm)
    setEditingLandingAnnouncementId(null)
  }, [])

  const toLandingAnnouncementInput = useCallback((
    form: LandingAnnouncementEditorForm,
  ): LandingAnnouncementInput => {
    const isGallery = form.category === 'galeri'
    const isDocumentation = form.category === 'event' || form.category === 'dokumentasi'
    const isFacility = form.category === 'fasilitas'
    const isPoster = form.category === 'promosi' || form.category === 'ucapan'
    const normalizedTitle = form.title.trim() || (
      isPoster
        ? `Poster ${form.publishStartDate || getLocalDateIso()}`
        : ''
    )

    return {
      title: normalizedTitle,
      slug: form.slug.trim(),
      category: form.category,
      displayMode: isPoster ? 'popup' : 'section',
      excerpt: isDocumentation || isFacility ? form.excerpt.trim() : '',
      content: isFacility ? form.content.trim() : '',
      coverImageDataUrl: form.coverImageDataUrl,
      coverImageName: form.coverImageName,
      ctaLabel: '',
      ctaUrl: '',
      publishStartDate: isGallery || isFacility ? '' : form.publishStartDate,
      publishEndDate: isPoster ? form.publishEndDate : '',
      status: isPoster ? 'published' : form.status,
      isPinned: false,
      authorName: user.displayName,
      authorEmail: user.email,
    }
  }, [user.displayName, user.email])

  const loadLandingAnnouncements = useCallback(async (options?: { silent?: boolean }) => {
    const isSilent = options?.silent === true
    if (!isSilent) {
      setLoadingLandingAnnouncements(true)
    }
    try {
      const data = await adminApi.getLandingAnnouncements()
      setLandingAnnouncements(data)
    } catch (error) {
      if (!isSilent) {
        const message = error instanceof Error ? error.message : 'Gagal memuat pengumuman landing.'
        setErrorMessage(message)
      }
    } finally {
      if (!isSilent) {
        setLoadingLandingAnnouncements(false)
      }
    }
  }, [])

  const handleSubmitLandingAnnouncement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setMessage(null)

    const isDocumentationMode =
      landingAnnouncementForm.category === 'event' ||
      landingAnnouncementForm.category === 'dokumentasi'
    const isFacilityMode = landingAnnouncementForm.category === 'fasilitas'
    const isPosterMode =
      landingAnnouncementForm.category === 'promosi' ||
      landingAnnouncementForm.category === 'ucapan'
    const title = landingAnnouncementForm.title.trim()
    if (!title && !isPosterMode) {
      setErrorMessage('Judul pengumuman wajib diisi.')
      return
    }

    if (!landingAnnouncementForm.coverImageDataUrl) {
      setErrorMessage('Foto pengumuman wajib diunggah.')
      return
    }

    if (
      isDocumentationMode &&
      !landingAnnouncementForm.publishStartDate
    ) {
      setErrorMessage('Tanggal dokumentasi wajib diisi.')
      return
    }

    if (isFacilityMode && !landingAnnouncementForm.excerpt.trim()) {
      setErrorMessage('Keterangan singkat fasilitas wajib diisi.')
      return
    }

    if (isFacilityMode && !landingAnnouncementForm.content.trim()) {
      setErrorMessage('Fungsi fasilitas wajib diisi.')
      return
    }

    if (
      isPosterMode &&
      (!landingAnnouncementForm.publishStartDate || !landingAnnouncementForm.publishEndDate)
    ) {
      setErrorMessage('Poster wajib memiliki tanggal upload dan tanggal selesai.')
      return
    }

    if (
      landingAnnouncementForm.publishStartDate &&
      landingAnnouncementForm.publishEndDate &&
      landingAnnouncementForm.publishEndDate < landingAnnouncementForm.publishStartDate
    ) {
      setErrorMessage('Tanggal tayang selesai tidak boleh lebih awal dari tanggal mulai.')
      return
    }

    setSavingLandingAnnouncement(true)
    try {
      const payload = toLandingAnnouncementInput(landingAnnouncementForm)
      if (editingLandingAnnouncementId) {
        await adminApi.updateLandingAnnouncement(editingLandingAnnouncementId, payload)
      } else {
        await adminApi.createLandingAnnouncement(payload)
      }

      await loadLandingAnnouncements()
      setMessage(
        editingLandingAnnouncementId
          ? 'Update pengumuman berhasil diperbarui.'
          : 'Update pengumuman berhasil ditambahkan.',
      )
      resetLandingAnnouncementForm()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gagal menyimpan update pengumuman landing.'
      setErrorMessage(message)
    } finally {
      setSavingLandingAnnouncement(false)
    }
  }

  const handleSelectLandingAnnouncement = (announcement: LandingAnnouncement) => {
    setEditingLandingAnnouncementId(announcement.id)
    setLandingAnnouncementForm({
      title: announcement.title,
      slug: announcement.slug,
      category: announcement.category,
      displayMode: announcement.displayMode,
      excerpt: announcement.excerpt,
      content: announcement.content,
      coverImageDataUrl: announcement.coverImageDataUrl,
      coverImageName: announcement.coverImageName,
      ctaLabel: announcement.ctaLabel,
      ctaUrl: announcement.ctaUrl,
      publishStartDate: announcement.publishStartDate,
      publishEndDate: announcement.publishEndDate,
      status: announcement.status,
      isPinned: announcement.isPinned,
    })
    setErrorMessage(null)
    setMessage('Mode edit aktif untuk update pengumuman terpilih.')
  }

  const handleDeleteLandingAnnouncement = async (announcement: LandingAnnouncement) => {
    const confirmed = await requestConfirm({
      title: 'Hapus Update Pengumuman',
      message: `Yakin menghapus "${announcement.title}"?`,
      confirmLabel: 'Ya, Hapus',
      cancelLabel: 'Batal',
      tone: 'danger',
    })
    if (!confirmed) {
      return
    }

    setDeletingLandingAnnouncementId(announcement.id)
    setErrorMessage(null)
    setMessage(null)

    try {
      await adminApi.deleteLandingAnnouncement(announcement.id)
      await loadLandingAnnouncements()
      setMessage('Update pengumuman berhasil dihapus.')
      if (editingLandingAnnouncementId === announcement.id) {
        resetLandingAnnouncementForm()
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gagal menghapus update pengumuman.'
      setErrorMessage(message)
    } finally {
      setDeletingLandingAnnouncementId(null)
    }
  }

  const handleUploadLandingAnnouncementCover = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const compressed = await compressImageToDataUrl(file, {
        maxDimension: 1600,
        quality: 0.8,
        aspectRatio: 16 / 9,
      })
      setLandingAnnouncementForm((previous) => ({
        ...previous,
        coverImageDataUrl: compressed.dataUrl,
        coverImageName: compressed.name,
      }))
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gagal memproses cover pengumuman.'
      setErrorMessage(message)
    } finally {
      event.target.value = ''
    }
  }

  const clearLandingAnnouncementCover = () => {
    setLandingAnnouncementForm((previous) => ({
      ...previous,
      coverImageDataUrl: '',
      coverImageName: '',
    }))
  }

  const handleToggleParentAccountStatus = async (
    accountId: string,
    nextStatus: boolean,
  ) => {
    const target = parentAccounts.find((account) => account.id === accountId)
    if (!target) {
      setErrorMessage('Akun orang tua tidak ditemukan.')
      return
    }

    setErrorMessage(null)
    setMessage(null)
    setTogglingParentAccountIds((previous) => {
      const next = new Set(previous)
      next.add(accountId)
      return next
    })

    try {
      await parentAccountApi.updateParentAccount(accountId, {
        username: target.username,
        password: '',
        isActive: nextStatus,
        childIds: target.children.map((child) => child.id),
        parentProfile: {
          ...target.parentProfile,
        },
      })

      setMessage(
        nextStatus
          ? 'Akun orang tua berhasil diaktifkan.'
          : 'Akun orang tua berhasil dinonaktifkan.',
      )
      await loadParentAccounts()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gagal memperbarui status akun orang tua.'
      setErrorMessage(message)
    } finally {
      setTogglingParentAccountIds((previous) => {
        const next = new Set(previous)
        next.delete(accountId)
        return next
      })
    }
  }

  const loadLogs = useCallback(async (
    query = '',
    options?: {
      silent?: boolean
      cursor?: string | null
      page?: number
      limit?: number
    },
  ) => {
    const isSilent = options?.silent === true
    const page = options?.page ?? 1
    const cursor = options?.cursor ?? null
    const limit = options?.limit ?? activityLogLimit
    if (!isSilent) {
      setLoadingLogs(true)
    }
    try {
      const data = await adminApi.getActivityLogs({
        search: query,
        limit,
        cursor,
        eventDate: activityLogDateFilter || undefined,
      })
      setActivityLogs(data.entries)
      setActivityLogPage(page)
      setActivityLogPageCursor(cursor)
      setActivityLogNextCursor(data.nextCursor)
      setActivityLogHasMore(data.hasMore)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memuat log aktivitas.'
      setErrorMessage(message)
    } finally {
      if (!isSilent) {
        setLoadingLogs(false)
      }
    }
  }, [activityLogDateFilter, activityLogLimit])

  const filteredActivityLogs = useMemo(() => {
    const gmailQuery = searchLogs.trim().toLowerCase()
    return activityLogs.filter((entry) => {
      const gmailMatch =
        !gmailQuery ||
        (entry.gmail || '').toLowerCase().includes(gmailQuery)
      const dateMatch =
        !activityLogDateFilter ||
        entry.eventAt.slice(0, 10) === activityLogDateFilter

      return gmailMatch && dateMatch
    })
  }, [activityLogDateFilter, activityLogs, searchLogs])

  const handleActivityLogLimitChange = (value: string) => {
    const parsed = Number.parseInt(value, 10)
    if (!ACTIVITY_LOG_LIMIT_OPTIONS.includes(parsed)) {
      return
    }

    setActivityLogLimit(parsed)
    void loadLogs(searchLogs, {
      limit: parsed,
      cursor: null,
      page: 1,
    })
  }

  const handleLoadNextLogs = () => {
    if (!activityLogHasMore || !activityLogNextCursor) {
      return
    }

    void loadLogs(searchLogs, {
      cursor: activityLogNextCursor,
      page: activityLogPage + 1,
    })
  }

  const loadStaffAttendanceRecap = useCallback(async (
    overrides?: {
      date?: string
      month?: string
      silent?: boolean
    },
  ) => {
    const normalizedDate = clampDateKeyToServerToday(
      overrides?.date ?? staffAttendanceFilterDate,
    )
    const normalizedMonth = clampMonthKeyToServerToday(
      overrides?.month ?? staffAttendanceFilterMonth,
    )

    if (!overrides?.silent) {
      setLoadingStaffAttendance(true)
    }
    try {
      const data = await adminApi.getStaffAttendanceRecap(
        normalizedDate,
        normalizedMonth,
      )
      setStaffAttendanceRecapRows(data)
    } catch (error) {
      if (!overrides?.silent) {
        const message =
          error instanceof Error
            ? error.message
            : 'Gagal memuat rekap kehadiran petugas.'
        setErrorMessage(message)
        setStaffAttendanceRecapRows([])
      }
    } finally {
      if (!overrides?.silent) {
        setLoadingStaffAttendance(false)
      }
    }
  }, [clampDateKeyToServerToday, clampMonthKeyToServerToday, staffAttendanceFilterDate, staffAttendanceFilterMonth])

  const ensureChildrenData = useCallback(async (options?: { force?: boolean }) => {
    const forceReload = options?.force === true

    if (!forceReload && hasLoadedChildrenRef.current) {
      return
    }
    if (!forceReload && childrenRequestRef.current) {
      await childrenRequestRef.current
      return
    }

    const requestPromise = (async () => {
      const children = await childApi.getChildren()
      setAppData((previous) => ({
        ...previous,
        children,
      }))
      hasLoadedChildrenRef.current = true
    })()

    childrenRequestRef.current = requestPromise
    try {
      await requestPromise
    } finally {
      if (childrenRequestRef.current === requestPromise) {
        childrenRequestRef.current = null
      }
    }
  }, [])

  const loadChildRegistrationCode = useCallback(async (childId: string) => {
    try {
      const code = await adminApi.getChildRegistrationCode(childId)
      setChildRegistrationCodesById((previous) => ({
        ...previous,
        [childId]: code,
      }))
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Gagal memuat kode registrasi anak.'
      setErrorMessage(message)
    }
  }, [])

  const generateChildRegistrationCodeForAdmin = useCallback(async (
    childId: string,
    options?: { silent?: boolean },
  ): Promise<ChildRegistrationCode | null> => {
    try {
      const code = await adminApi.generateChildRegistrationCode(childId)
      setChildRegistrationCodesById((previous) => ({
        ...previous,
        [childId]: code,
      }))
      if (!options?.silent) {
        setMessage(`Kode registrasi berhasil dibuat: ${code.code}`)
      }
      return code
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Gagal membuat kode registrasi anak.'
      if (!options?.silent) {
        setErrorMessage(message)
      }
      return null
    }
  }, [])

  const ensureAttendanceData = useCallback(async (options?: { force?: boolean }) => {
    const forceReload = options?.force === true

    if (!forceReload && hasLoadedAttendanceRef.current) {
      return
    }
    if (!forceReload && attendanceRequestRef.current) {
      await attendanceRequestRef.current
      return
    }

    const requestPromise = (async () => {
      const attendanceRecords = await attendanceApi.getAttendanceRecords()
      setAppData((previous) => ({
        ...previous,
        attendanceRecords,
      }))
      hasLoadedAttendanceRef.current = true
    })()

    attendanceRequestRef.current = requestPromise
    try {
      await requestPromise
    } finally {
      if (attendanceRequestRef.current === requestPromise) {
        attendanceRequestRef.current = null
      }
    }
  }, [])

  const ensureObservationData = useCallback(async (options?: { force?: boolean }) => {
    const forceReload = options?.force === true

    if (!forceReload && hasLoadedObservationRef.current) {
      return
    }
    if (!forceReload && observationRequestRef.current) {
      await observationRequestRef.current
      return
    }

    const requestPromise = (async () => {
      const observationRecords = await observationApi.getObservationRecords()
      setAppData((previous) => ({
        ...previous,
        observationRecords,
      }))
      hasLoadedObservationRef.current = true
    })()

    observationRequestRef.current = requestPromise
    try {
      await requestPromise
    } finally {
      if (observationRequestRef.current === requestPromise) {
        observationRequestRef.current = null
      }
    }
  }, [])

  const ensureIncidentData = useCallback(async (options?: { force?: boolean }) => {
    const forceReload = options?.force === true

    if (!forceReload && hasLoadedIncidentRef.current) {
      return
    }
    if (!forceReload && incidentRequestRef.current) {
      await incidentRequestRef.current
      return
    }

    const requestPromise = (async () => {
      const incidentReports = await incidentApi.getIncidentReports()
      setAppData((previous) => ({
        ...previous,
        incidentReports,
      }))
      hasLoadedIncidentRef.current = true
    })()

    incidentRequestRef.current = requestPromise
    try {
      await requestPromise
    } finally {
      if (incidentRequestRef.current === requestPromise) {
        incidentRequestRef.current = null
      }
    }
  }, [])

  const ensureServiceRatesData = useCallback(async (options?: { force?: boolean }) => {
    const forceReload = options?.force === true

    if (!forceReload && hasLoadedServiceRatesRef.current) {
      return
    }
    if (!forceReload && serviceRatesRequestRef.current) {
      await serviceRatesRequestRef.current
      return
    }

    const requestPromise = (async () => {
      const nextRates = await adminApi.getServiceRates()
      setServiceRates(nextRates)
      hasLoadedServiceRatesRef.current = true
    })()

    serviceRatesRequestRef.current = requestPromise
    try {
      await requestPromise
    } finally {
      if (serviceRatesRequestRef.current === requestPromise) {
        serviceRatesRequestRef.current = null
      }
    }
  }, [])

  const loadMonitoringAttendanceData = useCallback(
    async (options?: { force?: boolean }) => {
      setLoadingServices(true)
      try {
        await Promise.all([
          ensureChildrenData(options),
          ensureAttendanceData(options),
        ])
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Gagal memuat data kehadiran anak.'
        setErrorMessage(message)
      } finally {
        setLoadingServices(false)
      }
    },
    [ensureAttendanceData, ensureChildrenData],
  )

  const loadObservationMonitoringData = useCallback(
    async (options?: { force?: boolean }) => {
      setLoadingServices(true)
      try {
        await Promise.all([
          ensureChildrenData(options),
          ensureObservationData(options),
        ])
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Gagal memuat data observasi anak.'
        setErrorMessage(message)
      } finally {
        setLoadingServices(false)
      }
    },
    [ensureChildrenData, ensureObservationData],
  )

  const loadIncidentMonitoringData = useCallback(
    async (options?: { force?: boolean }) => {
      setLoadingServices(true)
      try {
        await Promise.all([
          ensureChildrenData(options),
          ensureAttendanceData(options),
          ensureIncidentData(options),
        ])
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Gagal memuat data berita acara.'
        setErrorMessage(message)
      } finally {
        setLoadingServices(false)
      }
    },
    [ensureAttendanceData, ensureChildrenData, ensureIncidentData],
  )

  const loadServiceManagement = useCallback(
    async (options?: { force?: boolean }) => {
      setLoadingServices(true)
      try {
        await Promise.all([
          ensureChildrenData(options),
          ensureAttendanceData(options),
          ensureServiceRatesData(options),
        ])
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Gagal memuat data layanan anak dan tarif.'
        setErrorMessage(message)
      } finally {
        setLoadingServices(false)
      }
    },
    [ensureAttendanceData, ensureChildrenData, ensureServiceRatesData],
  )

  const loadServiceBillingSummary = useCallback(async (
    preferredChildId = '',
    options?: { silent?: boolean },
  ) => {
    if (!options?.silent) {
      setLoadingServiceBilling(true)
    }
    try {
      const summary = await adminApi.getServiceBillingSummary()
      setServiceBillingSummary(summary)

      const availableChildIds = summary.rows.map((row) => row.childId)
      setSelectedBillingChildId((previous) => {
        const nextChildId =
          (preferredChildId && availableChildIds.includes(preferredChildId) && preferredChildId) ||
          (previous && availableChildIds.includes(previous) && previous) ||
          availableChildIds[0] ||
          ''
        const selectedSummary =
          summary.rows.find((row) => row.childId === nextChildId) ?? null
        const childChanged = previous !== nextChildId
        const suggestedPaymentAmount = Math.max(
          0,
          Math.round(selectedSummary?.totalOutstanding ?? 0),
        )

        setServiceBillingPeriodForm((previousPeriodForm) => ({
          ...previousPeriodForm,
          childId: nextChildId,
          packageKey:
            selectedSummary?.currentServicePackage ?? previousPeriodForm.packageKey,
        }))
        setServiceBillingPaymentForm((previousPaymentForm) => ({
          ...previousPaymentForm,
          childId: nextChildId,
          periodId: childChanged ? '' : previousPaymentForm.periodId,
          amount: childChanged ? suggestedPaymentAmount : previousPaymentForm.amount,
          paymentProofDataUrl: '',
          paymentProofName: '',
        }))
        setServiceBillingRefundForm((previousRefundForm) => ({
          ...previousRefundForm,
          childId: nextChildId,
          periodId: childChanged ? '' : previousRefundForm.periodId,
        }))
        return nextChildId
      })
    } catch (error) {
      if (!options?.silent) {
        const message =
          error instanceof Error
            ? error.message
            : 'Gagal memuat ringkasan pembayaran layanan.'
        setErrorMessage(message)
        setServiceBillingSummary(null)
        setSelectedBillingChildId('')
        setServiceBillingPeriodForm((previous) => ({
          ...previous,
          childId: '',
        }))
        setServiceBillingPaymentForm((previous) => ({
          ...previous,
          childId: '',
          amount: 0,
          periodId: '',
          paymentProofDataUrl: '',
          paymentProofName: '',
        }))
        setServiceBillingRefundForm((previous) => ({
          ...previous,
          childId: '',
          periodId: '',
        }))
      }
    } finally {
      if (!options?.silent) {
        setLoadingServiceBilling(false)
      }
    }
  }, [])

  const loadServiceBillingHistory = useCallback(async (
    childId: string,
    options?: { silent?: boolean },
  ) => {
    if (!childId) {
      setServiceBillingHistory(null)
      return
    }

    if (!options?.silent) {
      setLoadingServiceBilling(true)
    }
    try {
      const history = await adminApi.getServiceBillingHistory(childId)
      setServiceBillingHistory(history)
      const suggestedPaymentAmount = Math.max(
        0,
        Math.round(history.summary?.totalOutstanding ?? 0),
      )
      setServiceBillingPaymentForm((previous) => {
        const shouldAutoFillAmount =
          previous.childId !== childId || previous.amount <= 0
        return {
          ...previous,
          periodId: previous.periodId || history.summary?.activePeriod?.id || '',
          amount: shouldAutoFillAmount
            ? suggestedPaymentAmount
            : previous.amount,
        }
      })
      setServiceBillingRefundForm((previous) => ({
        ...previous,
        periodId: previous.periodId || history.summary?.activePeriod?.id || '',
      }))
    } catch (error) {
      if (!options?.silent) {
        const message =
          error instanceof Error
            ? error.message
            : 'Gagal memuat histori pembayaran layanan.'
        setErrorMessage(message)
        setServiceBillingHistory(null)
      }
    } finally {
      if (!options?.silent) {
        setLoadingServiceBilling(false)
      }
    }
  }, [])

  useEffect(() => {
    if (activeSidebar === 'settings') {
      if (settingsTab === 'petugas') {
        void Promise.all([loadStaff(), loadPendingStaffRequests()])
        return
      }

      if (settingsTab === 'orang-tua') {
        void loadParentAccounts()
        void ensureChildrenData().catch((error) => {
          const message = error instanceof Error ? error.message : 'Gagal memuat data anak.'
          setErrorMessage(message)
        })
        return
      }

      if (settingsTab === 'logs') {
        void loadLogs()
        return
      }

      if (settingsTab === 'update-pengumuman') {
        void loadLandingAnnouncements()
      }
      return
    }

    if (activeSidebar === 'data-anak') {
      setLoadingServices(true)
      void ensureChildrenData()
        .catch((error) => {
          const message = error instanceof Error ? error.message : 'Gagal memuat data anak.'
          setErrorMessage(message)
        })
        .finally(() => {
          setLoadingServices(false)
        })
      return
    }

    if (monitoringTab === 'kehadiran-anak') {
      void loadMonitoringAttendanceData()
      return
    }

    if (monitoringTab === 'observasi-anak') {
      void loadObservationMonitoringData()
      return
    }

    if (monitoringTab === 'berita-acara') {
      void loadIncidentMonitoringData()
      return
    }

    if (monitoringTab === 'layanan') {
      void loadServiceManagement()
      void loadServiceBillingSummary()
    }
  }, [
    activeSidebar,
    monitoringTab,
    settingsTab,
    ensureChildrenData,
    loadIncidentMonitoringData,
    loadLandingAnnouncements,
    loadMonitoringAttendanceData,
    loadLogs,
    loadPendingStaffRequests,
    loadParentAccounts,
    loadObservationMonitoringData,
    loadServiceBillingSummary,
    loadServiceManagement,
    loadStaff,
  ])

  useEffect(() => {
    let isDisposed = false

    const syncActiveViewSilently = async () => {
      try {
        if (activeSidebar === 'monitoring') {
          if (monitoringTab === 'kehadiran-anak') {
            await Promise.all([
              ensureChildrenData({ force: true }),
              ensureAttendanceData({ force: true }),
            ])
            return
          }

          if (monitoringTab === 'observasi-anak') {
            await Promise.all([
              ensureChildrenData({ force: true }),
              ensureObservationData({ force: true }),
            ])
            return
          }

          if (monitoringTab === 'berita-acara') {
            await Promise.all([
              ensureChildrenData({ force: true }),
              ensureAttendanceData({ force: true }),
              ensureIncidentData({ force: true }),
            ])
            return
          }

          if (monitoringTab === 'kehadiran-petugas') {
            await Promise.all([
              loadStaff(),
              loadStaffAttendanceRecap({ silent: true }),
            ])
            return
          }

          if (monitoringTab === 'layanan') {
            await Promise.all([
              ensureChildrenData({ force: true }),
              ensureAttendanceData({ force: true }),
              ensureServiceRatesData({ force: true }),
              loadServiceBillingSummary(selectedBillingChildId, { silent: true }),
            ])

            if (selectedBillingChildId) {
              await loadServiceBillingHistory(selectedBillingChildId, { silent: true })
            }
            return
          }
        }

        if (activeSidebar === 'settings') {
          if (settingsTab === 'petugas') {
            await loadPendingStaffRequests()
            return
          }

          if (settingsTab === 'update-pengumuman') {
            await loadLandingAnnouncements({ silent: true })
          }
          return
        }

        if (activeSidebar === 'data-anak') {
          await ensureChildrenData({ force: true })
        }
      } catch {
        if (isDisposed) {
          return
        }
      }
    }

    const intervalId = window.setInterval(() => {
      void syncActiveViewSilently()
    }, ADMIN_BACKGROUND_SYNC_INTERVAL_MS)

    return () => {
      isDisposed = true
      window.clearInterval(intervalId)
    }
  }, [
    activeSidebar,
    monitoringTab,
    settingsTab,
    selectedBillingChildId,
    ensureAttendanceData,
    ensureChildrenData,
    ensureIncidentData,
    ensureObservationData,
    ensureServiceRatesData,
    loadServiceBillingHistory,
    loadServiceBillingSummary,
    loadLandingAnnouncements,
    loadPendingStaffRequests,
    loadStaff,
    loadStaffAttendanceRecap,
  ])

  useEffect(() => {
    if (activeSidebar !== 'settings' || settingsTab !== 'logs') {
      return
    }

    const intervalId = window.setInterval(() => {
      void loadLogs(searchLogs, {
        silent: true,
        cursor: activityLogPageCursor,
        page: activityLogPage,
      })
    }, 10000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [
    activeSidebar,
    settingsTab,
    searchLogs,
    loadLogs,
    activityLogPageCursor,
    activityLogPage,
  ])

  useEffect(() => {
    if (activeSidebar !== 'monitoring' || monitoringTab !== 'kehadiran-petugas') {
      return
    }

    void loadStaffAttendanceRecap()
  }, [
    activeSidebar,
    monitoringTab,
    loadStaffAttendanceRecap,
    staffAttendanceFilterDate,
    staffAttendanceFilterMonth,
  ])

  useEffect(() => {
    if (activeSidebar !== 'monitoring' || monitoringTab !== 'kehadiran-petugas') {
      return
    }
    void loadStaff()
  }, [activeSidebar, monitoringTab, loadStaff])

  useEffect(() => {
    if (!selectedBillingChildId) {
      setServiceBillingHistory(null)
      return
    }
    void loadServiceBillingHistory(selectedBillingChildId)
  }, [loadServiceBillingHistory, selectedBillingChildId])

  const upsertChildProfileAdmin = async (
    input: ChildProfileInput,
    editingId?: string,
  ): Promise<boolean> => {
    setErrorMessage(null)
    setMessage(null)
    try {
      let saved: ChildProfile
      let generatedCode: ChildRegistrationCode | null = null
      if (editingId) {
        saved = await childApi.updateChild(editingId, input)
      } else {
        saved = await childApi.createChild(input)
        generatedCode = await generateChildRegistrationCodeForAdmin(saved.id, {
          silent: true,
        })
      }

      setAppData((previous) => ({
        ...previous,
        children: editingId
          ? previous.children.map((record) => (record.id === editingId ? saved : record))
          : [saved, ...previous.children],
      }))
      setMessage(
        editingId
          ? 'Data anak berhasil diperbarui.'
          : generatedCode
            ? `Data anak berhasil ditambahkan. Kode registrasi: ${generatedCode.code}`
            : 'Data anak berhasil ditambahkan, tetapi kode registrasi belum berhasil dibuat.',
      )
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menyimpan data anak.'
      setErrorMessage(message)
      return false
    }
  }

  const removeChildProfileAdmin = async (id: string): Promise<boolean> => {
    setErrorMessage(null)
    setMessage(null)
    try {
      await childApi.deleteChild(id)
      setAppData((previous) => ({
        ...previous,
        children: previous.children.filter((record) => record.id !== id),
        incidentReports: previous.incidentReports.filter((record) => record.childId !== id),
        attendanceRecords: previous.attendanceRecords.filter((record) => record.childId !== id),
        observationRecords: previous.observationRecords.filter((record) => record.childId !== id),
        communicationBooks: previous.communicationBooks.filter((record) => record.childId !== id),
      }))
      setChildRegistrationCodesById((previous) => {
        const next = { ...previous }
        delete next[id]
        return next
      })
      setMessage('Data anak berhasil dihapus.')
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menghapus data anak.'
      setErrorMessage(message)
      return false
    }
  }


  // --- Staff CRUD ---
  const resetStaffForm = () => {
    setStaffForm(initialStaffForm)
    setEditingStaffId(null)
    setShowStaffPassword(false)
  }

  const validateStaffForm = (): string | null => {
    if (!staffForm.fullName.trim()) {
      return 'Nama petugas wajib diisi.'
    }
    if (!staffForm.email.trim()) {
      return 'Email petugas wajib diisi.'
    }
    if (!staffForm.tanggalMasuk) {
      return 'Tanggal masuk wajib diisi.'
    }
    if (!editingStaffId && staffForm.password.trim().length < 8) {
      return 'Password petugas minimal 8 karakter.'
    }
    if (
      editingStaffId &&
      staffForm.password.trim().length > 0 &&
      staffForm.password.trim().length < 8
    ) {
      return 'Password baru minimal 8 karakter.'
    }
    return null
  }

  const handleSubmitStaff = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setMessage(null)

    const validationError = validateStaffForm()
    if (validationError) {
      setErrorMessage(validationError)
      return
    }

    try {
      if (editingStaffId) {
        await adminApi.updateStaffUser(editingStaffId, {
          fullName: staffForm.fullName.trim(),
          email: staffForm.email.trim().toLowerCase(),
          password: staffForm.password,
          isActive: staffForm.isActive,
          tanggalMasuk: staffForm.tanggalMasuk,
        })
        setMessage('Akun petugas berhasil diperbarui.')
      } else {
        await adminApi.createStaffUser({
          fullName: staffForm.fullName.trim(),
          email: staffForm.email.trim().toLowerCase(),
          password: staffForm.password,
          isActive: staffForm.isActive,
          tanggalMasuk: staffForm.tanggalMasuk,
        })
        setMessage('Akun petugas berhasil dibuat.')
      }
      resetStaffForm()
      await Promise.all([loadStaff(), loadLogs(searchLogs), loadStaffAttendanceRecap()])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menyimpan data petugas.'
      setErrorMessage(message)
    }
  }

  const handleDeleteStaff = async (staff: StaffUser) => {
    setErrorMessage(null)
    setMessage(null)

    const confirmed = await requestConfirm({
      title: 'Hapus Akun Petugas',
      message: (
        <div className="confirm-delete-warning">
          <p>Apakah Anda yakin ingin menghapus akun petugas <strong>"{staff.fullName}"</strong>?</p>
          <div className="alert alert--danger" style={{ marginTop: '1rem' }}>
            <strong>PENTING:</strong> Menghapus akun petugas akan <strong>menghapus permanen</strong> seluruh riwayat kehadiran petugas tersebut dari sistem.
            <br /><br />
            Jika petugas hanya berhenti bekerja, kami sangat menyarankan untuk menonaktifkan akun saja (Ubah status ke <strong>Nonaktif</strong>) agar data riwayat tetap tersimpan.
          </div>
        </div>
      ),
      confirmLabel: 'Ya, Hapus Permanen',
      cancelLabel: 'Batal',
      tone: 'danger',
    })
    if (!confirmed) {
      return
    }

    try {
      await adminApi.deleteStaffUser(staff.id)
      setMessage('Akun petugas berhasil dihapus.')
      if (editingStaffId === staff.id) {
        resetStaffForm()
      }
      await Promise.all([loadStaff(), loadLogs(searchLogs), loadStaffAttendanceRecap()])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menghapus akun petugas.'
      setErrorMessage(message)
    }
  }

  const handleToggleStaffStatus = async (staff: StaffUser) => {
    setErrorMessage(null)
    setMessage(null)

    const nextIsActive = !staff.isActive
    try {
      await adminApi.updateStaffUser(staff.id, {
        fullName: staff.fullName,
        email: staff.email,
        password: '',
        isActive: nextIsActive,
        tanggalMasuk: staff.tanggalMasuk,
      })
      setMessage(
        `Status ${staff.fullName} berhasil diubah menjadi ${nextIsActive ? 'Aktif' : 'Nonaktif'}.`,
      )
      await Promise.all([loadStaff(), loadLogs(searchLogs), loadStaffAttendanceRecap()])
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gagal mengubah status petugas.'
      setErrorMessage(message)
    }
  }

  const handleApproveStaffRequest = async (request: StaffRegistrationRequest) => {
    setErrorMessage(null)
    setMessage(null)
    setProcessingStaffRequestId(request.id)
    try {
      await adminApi.approveStaffRegistrationRequest(request.id)
      setMessage(`Permintaan ${request.fullName} berhasil disetujui.`)
      await Promise.all([
        loadPendingStaffRequests(),
        loadStaff(),
        loadLogs(searchLogs),
        loadStaffAttendanceRecap(),
      ])
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Gagal menyetujui permintaan petugas.'
      setErrorMessage(message)
    } finally {
      setProcessingStaffRequestId(null)
    }
  }

  const handleRejectStaffRequest = async (request: StaffRegistrationRequest) => {
    setErrorMessage(null)
    setMessage(null)
    const confirmed = await requestConfirm({
      title: 'Tolak Permintaan Petugas',
      message: `Tolak pendaftaran petugas "${request.fullName}" (${request.email})?`,
      confirmLabel: 'Ya, Tolak',
      cancelLabel: 'Batal',
      tone: 'danger',
    })
    if (!confirmed) {
      return
    }

    setProcessingStaffRequestId(request.id)
    try {
      await adminApi.rejectStaffRegistrationRequest(request.id)
      setMessage(`Permintaan ${request.fullName} berhasil ditolak.`)
      await Promise.all([loadPendingStaffRequests(), loadLogs(searchLogs)])
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Gagal menolak permintaan petugas.'
      setErrorMessage(message)
    } finally {
      setProcessingStaffRequestId(null)
    }
  }

  const startEditStaff = (staff: StaffUser) => {
    setEditingStaffId(staff.id)
    setStaffForm({
      fullName: staff.fullName,
      email: staff.email,
      password: '',
      isActive: staff.isActive,
      tanggalMasuk: staff.tanggalMasuk || staff.createdAt.slice(0, 10),
    })
    setShowStaffPassword(false)
    setActiveSidebar('settings')
    setSettingsTab('petugas')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCreateBillingPeriod = async () => {
    setErrorMessage(null)
    setMessage(null)

    if (!serviceBillingPeriodForm.childId) {
      setErrorMessage('Pilih anak terlebih dahulu untuk mulai periode billing.')
      return
    }

    setMutatingServiceBilling(true)
    try {
      const payload: ServiceBillingPeriodInput = {
        childId: serviceBillingPeriodForm.childId,
        packageKey: serviceBillingPeriodForm.packageKey,
        startDate: serviceBillingPeriodForm.startDate || undefined,
        amount: Math.max(0, Math.round(serviceBillingPeriodForm.amount ?? 0)),
        notes: serviceBillingPeriodForm.notes?.trim() || '',
      }
      const history = await adminApi.createServiceBillingPeriod(payload)
      setServiceBillingHistory(history)
      await loadServiceBillingSummary(payload.childId)
      setMessage('Periode billing berhasil dibuat.')
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Gagal membuat periode billing.'
      setErrorMessage(message)
    } finally {
      setMutatingServiceBilling(false)
    }
  }

  const handleCreateBillingPayment = async () => {
    setErrorMessage(null)
    setMessage(null)

    if (!serviceBillingPaymentForm.childId) {
      setErrorMessage('Pilih anak terlebih dahulu untuk mencatat pembayaran.')
      return
    }

    setMutatingServiceBilling(true)
    try {
      const payload: ServiceBillingPaymentInput = {
        childId: serviceBillingPaymentForm.childId,
        amount: Math.max(0, Math.round(serviceBillingPaymentForm.amount)),
        bucket: serviceBillingPaymentForm.bucket,
        periodId:
          serviceBillingPaymentForm.bucket === 'period'
            ? serviceBillingPaymentForm.periodId || serviceBillingHistory?.summary?.activePeriod?.id
            : undefined,
        notes: serviceBillingPaymentForm.notes?.trim() || '',
        paymentProofDataUrl: serviceBillingPaymentForm.paymentProofDataUrl || undefined,
        paymentProofName: serviceBillingPaymentForm.paymentProofName || undefined,
      }
      const history = await adminApi.createServiceBillingPayment(payload)
      setServiceBillingHistory(history)
      await loadServiceBillingSummary(payload.childId)
      setMessage('Pembayaran billing berhasil dicatat.')
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Gagal mencatat pembayaran billing.'
      setErrorMessage(message)
    } finally {
      setMutatingServiceBilling(false)
    }
  }

  const handleServicePaymentProofChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const result = await compressImageToDataUrl(file, {
        maxDimension: 1280,
        quality: 0.75,
      })
      setServiceBillingPaymentForm((previous) => ({
        ...previous,
        paymentProofDataUrl: result.dataUrl,
        paymentProofName: result.name,
      }))
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Gagal memproses bukti pembayaran.'
      setErrorMessage(message)
    } finally {
      event.target.value = ''
    }
  }

  const clearServicePaymentProof = () => {
    setServiceBillingPaymentForm((previous) => ({
      ...previous,
      paymentProofDataUrl: '',
      paymentProofName: '',
    }))
  }

  const handleSelectServiceBillingArrearsChild = useCallback((childId: string) => {
    setErrorMessage(null)
    setMessage(null)

    const selectedRow =
      serviceBillingSummary?.rows.find((row) => row.childId === childId) ?? null
    const suggestedPaymentAmount = Math.max(
      0,
      Math.round(selectedRow?.totalOutstanding ?? 0),
    )

    setSelectedBillingChildId(childId)
    setServiceBillingPeriodForm((previous) => ({
      ...previous,
      childId,
      packageKey: selectedRow?.currentServicePackage ?? previous.packageKey,
    }))
    setServiceBillingPaymentForm((previous) => ({
      ...previous,
      childId,
      periodId: selectedRow?.activePeriod?.id || '',
      amount: suggestedPaymentAmount,
      paymentProofDataUrl: previous.childId === childId ? previous.paymentProofDataUrl : '',
      paymentProofName: previous.childId === childId ? previous.paymentProofName : '',
    }))
    setServiceBillingRefundForm((previous) => ({
      ...previous,
      childId,
      periodId: selectedRow?.activePeriod?.id || '',
    }))
  }, [serviceBillingSummary?.rows])

  const handleQuickServicePayment = async () => {
    setErrorMessage(null)
    setMessage(null)

    const childId = serviceBillingPaymentForm.childId
    if (!childId) {
      setErrorMessage('Pilih anak terlebih dahulu.')
      return
    }

    const summary = selectedServiceBillingSummary
    if (!summary) {
      setErrorMessage('Ringkasan billing anak belum tersedia.')
      return
    }
    if (!serviceBillingPaymentForm.paymentProofDataUrl) {
      setErrorMessage('Bukti pembayaran wajib diunggah.')
      return
    }

    const amount = Math.max(0, Math.round(summary.totalOutstanding))
    if (amount <= 0) {
      setErrorMessage('Tagihan anak ini sudah lunas.')
      return
    }

    const activePeriodId =
      summary.activePeriod?.id || serviceBillingHistory?.summary?.activePeriod?.id || ''

    setMutatingServiceBilling(true)
    try {
      let remaining = amount
      let latestHistory: ServiceBillingHistoryResponse | null = null

      if (summary.outstandingPeriod > 0 && remaining > 0) {
        if (!activePeriodId) {
          throw new Error('Periode aktif tidak ditemukan untuk pembayaran periode.')
        }
        const paymentAmount = Math.min(
          remaining,
          Math.max(0, Math.round(summary.outstandingPeriod)),
        )
        if (paymentAmount > 0) {
          latestHistory = await adminApi.createServiceBillingPayment({
            childId,
            amount: paymentAmount,
            bucket: 'period',
            periodId: activePeriodId,
            notes: 'Pembayaran tunggakan layanan',
            paymentProofDataUrl:
              serviceBillingPaymentForm.paymentProofDataUrl || undefined,
            paymentProofName: serviceBillingPaymentForm.paymentProofName || undefined,
          })
          remaining -= paymentAmount
        }
      }

      if (summary.outstandingArrears > 0 && remaining > 0) {
        const arrearsPaymentAmount = Math.min(
          remaining,
          Math.max(0, Math.round(summary.outstandingArrears)),
        )
        if (arrearsPaymentAmount > 0) {
          latestHistory = await adminApi.createServiceBillingPayment({
            childId,
            amount: arrearsPaymentAmount,
            bucket: 'arrears',
            notes: 'Pembayaran tunggakan harian layanan',
            paymentProofDataUrl:
              serviceBillingPaymentForm.paymentProofDataUrl || undefined,
            paymentProofName: serviceBillingPaymentForm.paymentProofName || undefined,
          })
          remaining -= arrearsPaymentAmount
        }
      }

      if (remaining > 0) {
        const fallbackBucket =
          summary.outstandingPeriod > 0 ? 'period' : 'arrears'
        latestHistory = await adminApi.createServiceBillingPayment({
          childId,
          amount: remaining,
          bucket: fallbackBucket,
          periodId: fallbackBucket === 'period' ? activePeriodId || undefined : undefined,
          notes: 'Pembayaran layanan',
          paymentProofDataUrl:
            serviceBillingPaymentForm.paymentProofDataUrl || undefined,
          paymentProofName: serviceBillingPaymentForm.paymentProofName || undefined,
        })
      }

      if (latestHistory) {
        setServiceBillingHistory(latestHistory)
      }
      await loadServiceBillingSummary(childId)
      await loadServiceBillingHistory(childId)
      setMessage('Pembayaran layanan berhasil dicatat.')
      setServiceBillingPaymentForm((previous) => ({
        ...previous,
        amount: 0,
        paymentProofDataUrl: '',
        paymentProofName: '',
      }))
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Gagal mencatat pembayaran layanan.'
      setErrorMessage(message)
    } finally {
      setMutatingServiceBilling(false)
    }
  }

  const handleCreateBillingRefund = async () => {
    setErrorMessage(null)
    setMessage(null)

    if (!serviceBillingRefundForm.childId) {
      setErrorMessage('Pilih anak terlebih dahulu untuk mencatat refund.')
      return
    }

    setMutatingServiceBilling(true)
    try {
      const payload: ServiceBillingRefundInput = {
        childId: serviceBillingRefundForm.childId,
        amount: Math.max(0, Math.round(serviceBillingRefundForm.amount)),
        bucket: serviceBillingRefundForm.bucket,
        periodId:
          serviceBillingRefundForm.bucket === 'period'
            ? serviceBillingRefundForm.periodId || serviceBillingHistory?.summary?.activePeriod?.id
            : undefined,
        notes: serviceBillingRefundForm.notes?.trim() || '',
      }
      const history = await adminApi.createServiceBillingRefund(payload)
      setServiceBillingHistory(history)
      await loadServiceBillingSummary(payload.childId)
      setMessage('Refund billing berhasil dicatat.')
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Gagal mencatat refund billing.'
      setErrorMessage(message)
    } finally {
      setMutatingServiceBilling(false)
    }
  }

  // --- Backup ---
  const handleBackup = async () => {
    setProcessingBackup(true)
    setErrorMessage(null)
    setMessage(null)

    try {
      const { blob, fileName } = await adminApi.downloadBackup()
      const safeFileName = fileName || `backup-tpa-${Date.now()}.json`
      downloadBlob(blob, safeFileName)
      setMessage(`Backup berhasil diunduh (${safeFileName}).`)
      await loadLogs(searchLogs)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal melakukan backup.'
      setErrorMessage(message)
    } finally {
      setProcessingBackup(false)
    }
  }

  // --- Navigation ---
  const selectMenu = (menu: string) => {
    setActiveSidebar(menu as AdminSidebarKey)
    setSidebarOpen(false)
    setMessage(null)
    setErrorMessage(null)
  }

  const handleObservationGroupFilterChange = (value: string) => {
    setObservationFilterGroup(value)
    setObservationPdfNotice(null)
  }

  const handleObservationFilterPickerChange = (value: string) => {
    const nextSelection = resolveMonthDateFilterSelection(
      value,
      clampMonthKeyToServerToday,
      clampDateKeyToServerToday,
      observationFilterMonth,
    )
    setObservationFilterMonth(nextSelection.month)
    setObservationFilterDate(nextSelection.date)
    setObservationPdfNotice(null)
  }

  const handleIncidentFilterPickerChange = (value: string) => {
    const nextSelection = resolveMonthDateFilterSelection(
      value,
      clampMonthKeyToServerToday,
      clampDateKeyToServerToday,
      incidentFilterMonth,
    )
    setIncidentFilterMonth(nextSelection.month)
    setIncidentFilterDate(nextSelection.date)
    setIncidentPdfNotice(null)
  }

  const openIncidentPdfDialog = () => {
    setIncidentPdfMode(incidentFilterDate ? 'date' : 'month')
    setIncidentPdfFilterMonth(incidentFilterMonth)
    setIncidentPdfFilterDate(incidentFilterDate)
    setIncidentPdfDialogOpen(true)
  }

  const openStaffAttendancePdfDialog = () => {
    setStaffAttendancePdfMode('monthly')
    setStaffAttendancePdfYear(staffAttendanceFilterMonth.slice(0, 4))
    setStaffAttendancePdfDialogOpen(true)
    setStaffAttendancePdfNotice(null)
  }

  const handleAdminCheckInStaff = async (staffUserId: string) => {
    const attendanceDate = clampDateKeyToServerToday(staffAttendanceFilterDate)
    setStaffAttendanceActionState({
      staffUserId,
      action: 'check-in',
    })
    setStaffAttendancePdfNotice(null)

    try {
      await adminApi.checkInStaffAttendance({
        staffUserId,
        attendanceDate,
      })

      setStaffAttendanceFilterDate(attendanceDate)
      await loadStaffAttendanceRecap({
        date: attendanceDate,
        month: staffAttendanceFilterMonth,
      })
      setStaffAttendancePdfNotice({
        type: 'success',
        text: 'Absensi masuk berhasil dicatat.',
      })
    } catch (error) {
      setStaffAttendancePdfNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Gagal mencatat absensi masuk.',
      })
    } finally {
      setStaffAttendanceActionState(null)
    }
  }

  const handleAdminCheckOutStaff = async (staffUserId: string) => {
    const attendanceDate = clampDateKeyToServerToday(staffAttendanceFilterDate)
    setStaffAttendanceActionState({
      staffUserId,
      action: 'check-out',
    })
    setStaffAttendancePdfNotice(null)

    try {
      await adminApi.checkOutStaffAttendance({
        staffUserId,
        attendanceDate,
      })

      setStaffAttendanceFilterDate(attendanceDate)
      await loadStaffAttendanceRecap({
        date: attendanceDate,
        month: staffAttendanceFilterMonth,
      })
      setStaffAttendancePdfNotice({
        type: 'success',
        text: 'Absensi pulang berhasil dicatat.',
      })
    } catch (error) {
      setStaffAttendancePdfNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Gagal mencatat absensi pulang.',
      })
    } finally {
      setStaffAttendanceActionState(null)
    }
  }

  const handleStaffAttendanceDateFilterChange = (value: string) => {
    const normalizedDate = clampDateKeyToServerToday(value)
    setStaffAttendanceFilterDate(normalizedDate)

    if (normalizedDate.length >= 7) {
      setStaffAttendanceFilterMonth(clampMonthKeyToServerToday(normalizedDate.slice(0, 7)))
    }
    setStaffAttendancePdfNotice(null)
  }

  const handleStaffAttendanceMonthFilterChange = (value: string) => {
    const normalizedMonth = clampMonthKeyToServerToday(value)
    setStaffAttendanceFilterMonth(normalizedMonth)
    if (!staffAttendanceFilterDate.startsWith(normalizedMonth)) {
      setStaffAttendanceFilterDate(`${normalizedMonth}-01`)
    }
    setStaffAttendancePdfNotice(null)
  }

  useEffect(() => {
    const clampedObservationMonth = clampMonthKeyToServerToday(observationFilterMonth)
    if (clampedObservationMonth !== observationFilterMonth) {
      setObservationFilterMonth(clampedObservationMonth)
    }
    if (observationFilterDate && !observationFilterDate.startsWith(clampedObservationMonth)) {
      setObservationFilterDate('')
    }

    const clampedIncidentMonth = clampMonthKeyToServerToday(incidentFilterMonth)
    if (clampedIncidentMonth !== incidentFilterMonth) {
      setIncidentFilterMonth(clampedIncidentMonth)
    }
    if (incidentFilterDate && !incidentFilterDate.startsWith(clampedIncidentMonth)) {
      setIncidentFilterDate('')
    }

    const clampedDate = clampDateKeyToServerToday(staffAttendanceFilterDate)
    if (clampedDate !== staffAttendanceFilterDate) {
      setStaffAttendanceFilterDate(clampedDate)
    }

    const clampedMonth = clampMonthKeyToServerToday(staffAttendanceFilterMonth)
    if (clampedMonth !== staffAttendanceFilterMonth) {
      setStaffAttendanceFilterMonth(clampedMonth)
    }

    const clampedIncidentPdfMonth = clampMonthKeyToServerToday(incidentPdfFilterMonth)
    if (clampedIncidentPdfMonth !== incidentPdfFilterMonth) {
      setIncidentPdfFilterMonth(clampedIncidentPdfMonth)
    }
    if (incidentPdfFilterDate && !incidentPdfFilterDate.startsWith(clampedIncidentPdfMonth)) {
      setIncidentPdfFilterDate('')
    }

    if (
      /^\d{4}$/.test(staffAttendancePdfYear) &&
      Number(staffAttendancePdfYear) > Number(todayYearKey)
    ) {
      setStaffAttendancePdfYear(todayYearKey)
    }
  }, [
    clampDateKeyToServerToday,
    clampMonthKeyToServerToday,
    incidentFilterDate,
    incidentFilterMonth,
    incidentPdfFilterDate,
    incidentPdfFilterMonth,
    observationFilterDate,
    observationFilterMonth,
    staffAttendanceFilterDate,
    staffAttendanceFilterMonth,
    staffAttendancePdfYear,
    todayYearKey,
  ])

  const childNameById = useMemo(
    () =>
      appData.children.reduce<Record<string, string>>((accumulator, child) => {
        accumulator[child.id] = child.fullName
        return accumulator
      }, {}),
    [appData.children],
  )

  const observationGroupOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const option of defaultObservationGroupOptions) {
      map.set(option.value, option.label)
    }

    for (const record of appData.observationRecords) {
      const label = record.groupName.trim()
      if (!label) continue
      const key = resolveObservationGroupFilterValue(label)
      if (!map.has(key)) {
        map.set(key, label)
      }
    }

    const ordered = ORDERED_OBSERVATION_GROUP_KEYS
      .filter((key) => map.has(key))
      .map((key) => ({
        value: key,
        label: map.get(key) || key,
      }))

    const extras = Array.from(map.entries())
      .filter(([value]) => !ORDERED_OBSERVATION_GROUP_KEYS.includes(value as (typeof ORDERED_OBSERVATION_GROUP_KEYS)[number]))
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label, 'id-ID'))

    return [...ordered, ...extras]
  }, [appData.observationRecords])

  const selectedObservationGroupLabel =
    observationGroupOptions.find((option) => option.value === observationFilterGroup)?.label ?? ''

  const observationChildFilterOptions = useMemo(
    () =>
      appData.children
        .slice()
        .sort((left, right) => left.fullName.localeCompare(right.fullName, 'id-ID'))
        .map((child) => ({
          value: child.id,
          label: child.fullName,
        })),
    [appData.children],
  )

  const observationScopedRecords = useMemo(
    () =>
      appData.observationRecords.filter((record) => {
        if (
          observationFilterGroup &&
          resolveObservationGroupFilterValue(record.groupName) !== observationFilterGroup
        ) {
          return false
        }
        if (observationFilterChild && record.childId !== observationFilterChild) {
          return false
        }
        if (observationFilterDate) {
          return record.date === observationFilterDate
        }
        return record.date.startsWith(observationFilterMonth)
      }),
    [
      appData.observationRecords,
      observationFilterChild,
      observationFilterDate,
      observationFilterGroup,
      observationFilterMonth,
    ],
  )

  const observationMonthlyRecords = useMemo(
    () =>
      appData.observationRecords.filter((record) => {
        if (
          observationFilterGroup &&
          resolveObservationGroupFilterValue(record.groupName) !== observationFilterGroup
        ) {
          return false
        }
        if (observationFilterChild && record.childId !== observationFilterChild) {
          return false
        }
        return record.date.startsWith(observationFilterMonth)
      }),
    [
      appData.observationRecords,
      observationFilterChild,
      observationFilterGroup,
      observationFilterMonth,
    ],
  )

  const observationRecapRows = useMemo<ObservationRecapRow[]>(() => {
    const map = new Map<
      string,
      ObservationRecapRow & {
        latestSortKey: string
      }
    >()

    for (const record of observationScopedRecords) {
      const current =
        map.get(record.childId) ??
        {
          childId: record.childId,
          childName: childNameById[record.childId] ?? 'Data anak dihapus',
          latestDate: '',
          latestGroup: '-',
          totalObservations: 0,
          totalPoints: 0,
          categorySummary: createEmptyObservationCategorySummary(),
          latestSortKey: '',
        }

      current.totalObservations += 1
      current.totalPoints += record.items.length

      const recordSummary = summarizeObservationItems(record.items)
      current.categorySummary.perluArahan += recordSummary.perluArahan
      current.categorySummary.perluLatihan += recordSummary.perluLatihan
      current.categorySummary.sudahBaik += recordSummary.sudahBaik

      const currentSortKey = `${record.date}-${record.updatedAt || record.createdAt}`
      if (currentSortKey >= current.latestSortKey) {
        current.latestSortKey = currentSortKey
        current.latestDate = record.date
        current.latestGroup = record.groupName || '-'
      }

      map.set(record.childId, current)
    }

    return Array.from(map.values()).map(({ latestSortKey, ...row }) => {
      void latestSortKey
      return row
    })
  }, [childNameById, observationScopedRecords])

  const sortedObservationRecapRows = useMemo(
    () =>
      [...observationRecapRows].sort((left, right) => {
        const dateCompare = right.latestDate.localeCompare(left.latestDate)
        if (dateCompare !== 0) {
          return dateCompare
        }
        return left.childName.localeCompare(right.childName, 'id-ID')
      }),
    [observationRecapRows],
  )

  const observationChildIdsWithMonthlyRecords = useMemo(
    () => new Set(observationMonthlyRecords.map((record) => record.childId)),
    [observationMonthlyRecords],
  )

  const resolveObservationMonthlyRecordsByChild = useCallback(
    (childId: string) =>
      observationMonthlyRecords
        .filter((record) => record.childId === childId)
        .sort((left, right) => {
          const dateCompare = left.date.localeCompare(right.date)
          if (dateCompare !== 0) {
            return dateCompare
          }
          return (left.createdAt || '').localeCompare(right.createdAt || '')
        }),
    [observationMonthlyRecords],
  )

  const observationDownloadAllRecords = useMemo(() => {
    if (!observationFilterGroup || !observationFilterChild) {
      return []
    }
    return resolveObservationMonthlyRecordsByChild(observationFilterChild)
  }, [
    observationFilterChild,
    observationFilterGroup,
    resolveObservationMonthlyRecordsByChild,
  ])

  const canDownloadObservationAll =
    Boolean(observationFilterGroup && observationFilterChild) &&
    observationDownloadAllRecords.length > 0

  const incidentPdfDateBounds = useMemo(
    () => getMonthDateBounds(incidentPdfFilterMonth, todayIso),
    [incidentPdfFilterMonth, todayIso],
  )

  const incidentFilteredList = useMemo(() => {
    const filtered = appData.incidentReports.filter((record) => {
      if (incidentFilterChild && record.childId !== incidentFilterChild) {
        return false
      }
      if (incidentFilterDate) {
        return record.date === incidentFilterDate
      }
      return record.date.startsWith(incidentFilterMonth)
    })

    return filtered.sort((left, right) => {
      const dateCompare = right.date.localeCompare(left.date)
      if (dateCompare !== 0) {
        return dateCompare
      }
      return (right.updatedAt || right.createdAt || '').localeCompare(left.updatedAt || left.createdAt || '')
    })
  }, [
    appData.incidentReports,
    incidentFilterChild,
    incidentFilterDate,
    incidentFilterMonth,
  ])

  const incidentChildFilterOptions = useMemo(
    () =>
      appData.children
        .slice()
        .sort((left, right) => left.fullName.localeCompare(right.fullName, 'id-ID'))
        .map((child) => ({
          value: child.id,
          label: child.fullName,
        })),
    [appData.children],
  )

  const incidentRecapTotals = useMemo(() => {
    const uniqueChildren = new Set(incidentFilteredList.map((record) => record.childId))
    return {
      totalChildren: uniqueChildren.size,
      totalReports: incidentFilteredList.length,
    }
  }, [incidentFilteredList])

  const incidentCompanionByChildDate = useMemo(() => {
    const map = new Map<string, { escortName: string; pickupName: string; sortKey: string }>()

    for (const record of appData.attendanceRecords) {
      const key = `${record.childId}-${record.date}`
      const sortKey = `${record.date}-${record.updatedAt || record.createdAt}`
      const current = map.get(key)
      if (!current || sortKey >= current.sortKey) {
        map.set(key, {
          escortName: record.escortName.trim(),
          pickupName: record.pickupName.trim(),
          sortKey,
        })
      }
    }

    return map
  }, [appData.attendanceRecords])

  const resolveIncidentReportsForPdf = useCallback(
    (mode: IncidentPdfMode, monthKey: string, dateKey: string) => {
      const filtered = appData.incidentReports.filter((record) => {
        if (incidentFilterChild && record.childId !== incidentFilterChild) {
          return false
        }
        if (mode === 'date') {
          return record.date === dateKey
        }
        return record.date.startsWith(monthKey)
      })

      return filtered.sort((left, right) => {
        const dateCompare = left.date.localeCompare(right.date)
        if (dateCompare !== 0) {
          return dateCompare
        }
        return (left.createdAt || '').localeCompare(right.createdAt || '')
      })
    },
    [appData.incidentReports, incidentFilterChild],
  )

  const handleDownloadIncidentPdf = async () => {
    const selectedMonth = clampMonthKeyToServerToday(incidentPdfFilterMonth || incidentFilterMonth)
    const selectedDate = clampOptionalDateKeyToServerToday(incidentPdfFilterDate)

    if (incidentPdfMode === 'date') {
      if (!selectedDate) {
        setIncidentPdfNotice({
          type: 'error',
          text: 'Pilih tanggal berita acara terlebih dahulu.',
        })
        return
      }
      if (!selectedDate.startsWith(selectedMonth)) {
        setIncidentPdfNotice({
          type: 'error',
          text: 'Tanggal harus berada pada bulan yang dipilih.',
        })
        return
      }
    }

    const reportsForPdf = resolveIncidentReportsForPdf(
      incidentPdfMode,
      selectedMonth,
      selectedDate,
    )
    if (reportsForPdf.length === 0) {
      setIncidentPdfNotice({
        type: 'error',
        text:
          incidentPdfMode === 'date'
            ? 'Tidak ada data berita acara pada tanggal yang dipilih.'
            : 'Tidak ada data berita acara pada bulan yang dipilih.',
      })
      return
    }

    setDownloadingIncidentPdf(true)
    setIncidentPdfNotice(null)

    try {
      const filterDate = incidentPdfMode === 'date' ? selectedDate : selectedMonth
      const result = await downloadBeritaAcaraPdf({
        filterDate,
        headerLabel: incidentPdfMode === 'month' ? formatMonthLabel(selectedMonth) : undefined,
        reports: reportsForPdf,
        attendanceRecords: appData.attendanceRecords,
        childrenData: appData.children,
        logoPath: `${import.meta.env.BASE_URL}UBAYA-noBG.png`,
      })

      setIncidentFilterMonth(selectedMonth)
      setIncidentFilterDate(incidentPdfMode === 'date' ? selectedDate : '')
      setIncidentPdfDialogOpen(false)

      if (!result.logoLoaded) {
        setIncidentPdfNotice({
          type: 'warning',
          text: `PDF berita acara berhasil diunduh (${result.pageCount} lembar), tetapi logo tidak ditemukan.`,
        })
        return
      }

      setIncidentPdfNotice({
        type: 'success',
        text: `PDF berita acara berhasil diunduh (${result.pageCount} lembar).`,
      })
    } catch {
      setIncidentPdfNotice({
        type: 'error',
        text: 'Gagal membuat PDF berita acara. Silakan coba lagi.',
      })
    } finally {
      setDownloadingIncidentPdf(false)
    }
  }

  const selectedStaffAttendanceDateLabel = useMemo(
    () => formatDateWithWeekday(staffAttendanceFilterDate),
    [staffAttendanceFilterDate],
  )

  const selectedStaffAttendanceMonthLabel = useMemo(
    () => formatMonthLabel(staffAttendanceFilterMonth),
    [staffAttendanceFilterMonth],
  )

  const staffAttendanceSummary = useMemo<StaffAttendanceSummary[]>(() => {
    return staffAttendanceRecapRows
      .map((row) => {
        const attendanceDateLabel = formatDateWithWeekday(
          row.attendanceDate || staffAttendanceFilterDate,
        )

        return {
          key: row.key || `${row.staffUserId}-${row.attendanceDate}`,
          staffUserId: row.staffUserId,
          fullName: row.fullName || 'Petugas',
          account: row.account || '-',
          attendanceDateLabel,
          checkInAt: row.checkInAt,
          checkOutAt: row.checkOutAt,
          dutyMinutes: calculateDutyMinutes(row.checkInAt, row.checkOutAt),
          monthlyAttendanceCount: Math.max(0, row.monthlyAttendanceCount),
        }
      })
      .sort((left, right) => left.fullName.localeCompare(right.fullName, 'id-ID'))
  }, [
    staffAttendanceFilterDate,
    staffAttendanceRecapRows,
  ])

  const staffAttendanceSummaryByStaffId = useMemo(
    () => new Map(staffAttendanceSummary.map((row) => [row.staffUserId, row])),
    [staffAttendanceSummary],
  )

  const staffAttendanceDailyRows = useMemo(() => {
    return [...staffUsers]
      .sort((left, right) => left.fullName.localeCompare(right.fullName, 'id-ID'))
      .map((staff) => {
        const summary = staffAttendanceSummaryByStaffId.get(staff.id) ?? null
        const checkInAt = summary?.checkInAt ?? ''
        const checkOutAt = summary?.checkOutAt ?? ''
        const dutyMinutes = calculateDutyMinutes(checkInAt, checkOutAt)
        const pay =
          dutyMinutes === null
            ? null
            : (() => {
              const { honor, transport } = calculateStaffPay(
                dutyMinutes / 60,
                calculateIsSenior(staff.tanggalMasuk),
              )
              return {
                honor,
                transport,
                total: honor + transport,
              }
            })()

        return {
          staff,
          summary,
          checkInAt,
          checkOutAt,
          dutyMinutes,
          pay,
        }
      })
  }, [staffAttendanceSummaryByStaffId, staffUsers])

  const activeStaffAttendanceDailyRows = useMemo(
    () => staffAttendanceDailyRows.filter((row) => row.staff.isActive),
    [staffAttendanceDailyRows],
  )

  const staffBelumAbsenMasuk = useMemo(
    () => activeStaffAttendanceDailyRows.filter((row) => !row.checkInAt),
    [activeStaffAttendanceDailyRows],
  )

  const staffSudahAbsenMasukRows = useMemo(
    () => staffAttendanceDailyRows.filter((row) => Boolean(row.checkInAt)),
    [staffAttendanceDailyRows],
  )

  const staffBertugasRows = useMemo(
    () =>
      activeStaffAttendanceDailyRows
        .filter((row) => Boolean(row.checkInAt))
        .sort((left, right) => {
          const leftDone = Boolean(left.checkOutAt)
          const rightDone = Boolean(right.checkOutAt)
          if (leftDone !== rightDone) {
            return leftDone ? 1 : -1
          }
          return left.staff.fullName.localeCompare(right.staff.fullName, 'id-ID')
        }),
    [activeStaffAttendanceDailyRows],
  )

  const handleDownloadStaffAttendancePdf = () => {
    if (staffUsers.length === 0) {
      setStaffAttendancePdfNotice({
        type: 'error',
        text: 'Belum ada data petugas untuk diunduh.',
      })
      return
    }
    if (staffAttendancePdfMode === 'yearly' && !/^\d{4}$/.test(staffAttendancePdfYear)) {
      setStaffAttendancePdfNotice({
        type: 'error',
        text: 'Tahun unduhan harus diisi 4 digit.',
      })
      return
    }

    const HONOR_PER_DAY = 50000
    const TRANSPORT_PER_DAY = 20000
    setDownloadingStaffAttendancePdf(true)
    setStaffAttendancePdfNotice(null)

    try {
      const sortedStaff = [...staffUsers].sort((left, right) =>
        left.fullName.localeCompare(right.fullName, 'id-ID'),
      )

      const rows = sortedStaff.map((staff) => {
        const summary = staffAttendanceSummaryByStaffId.get(staff.id)
        const monthlyTotal = Math.max(0, summary?.monthlyAttendanceCount ?? 0)

        if (staffAttendancePdfMode === 'monthly') {
          return {
            fullName: staff.fullName,
            account: staff.email,
            attendanceDateLabel: selectedStaffAttendanceMonthLabel,
            checkInTime: '-',
            checkOutTime: '-',
            dutyDuration: '-',
            monthlyAttendanceTotal: monthlyTotal,
            honor: monthlyTotal * HONOR_PER_DAY,
            transport: monthlyTotal * TRANSPORT_PER_DAY,
          }
        }

        const estimatedYearlyAttendance = monthlyTotal * 12
        return {
          fullName: staff.fullName,
          account: staff.email,
          attendanceDateLabel: `Tahun ${staffAttendancePdfYear}`,
          checkInTime: '-',
          checkOutTime: '-',
          dutyDuration: '-',
          monthlyAttendanceTotal: estimatedYearlyAttendance,
          honor: estimatedYearlyAttendance * HONOR_PER_DAY,
          transport: estimatedYearlyAttendance * TRANSPORT_PER_DAY,
        }
      })

      const hasDataToDownload = rows.some((row) => row.monthlyAttendanceTotal > 0)
      if (!hasDataToDownload) {
        setStaffAttendancePdfNotice({
          type: 'error',
          text: 'Belum ada data kehadiran petugas yang bisa diunduh untuk pilihan ini.',
        })
        return
      }

      downloadStaffAttendancePdf({
        filterDate: '',
        filterMonth:
          staffAttendancePdfMode === 'yearly'
            ? staffAttendancePdfYear
            : staffAttendanceFilterMonth,
        rows,
      })

      setStaffAttendancePdfDialogOpen(false)
      setStaffAttendancePdfNotice({
        type: 'success',
        text:
          staffAttendancePdfMode === 'monthly'
            ? `PDF rekap bulanan ${selectedStaffAttendanceMonthLabel} berhasil diunduh.`
            : `PDF rekap tahunan ${staffAttendancePdfYear} berhasil diunduh.`,
      })
    } catch {
      setStaffAttendancePdfNotice({
        type: 'error',
        text: 'Gagal membuat PDF rekap kehadiran petugas.',
      })
    } finally {
      setDownloadingStaffAttendancePdf(false)
    }
  }

  const serviceChildMap = useMemo(
    () => new Map(appData.children.map((child) => [child.id, child])),
    [appData.children],
  )

  const serviceRecapYearOptions = useMemo(() => {
    const years = new Set<string>([todayYearKey])

    for (const record of appData.attendanceRecords) {
      const localDate = toLocalDateKey(record.date)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
        continue
      }
      years.add(localDate.slice(0, 4))
    }

    return Array.from(years).sort((left, right) => Number(right) - Number(left))
  }, [appData.attendanceRecords, todayYearKey])

  useEffect(() => {
    if (serviceRecapYearOptions.includes(serviceRecapYear)) {
      return
    }

    setServiceRecapYear(serviceRecapYearOptions[0] ?? todayYearKey)
  }, [serviceRecapYear, serviceRecapYearOptions, todayYearKey])

  const serviceMonthlyRecapRows = useMemo<ServiceMonthlyRecapRow[]>(() => {
    if (!/^\d{4}$/.test(serviceRecapYear)) {
      return []
    }

    const monthMap = new Map<
      string,
      {
        childIds: Set<string>
        serviceDayCounts: Record<ServicePackage, number>
      }
    >()

    const maxMonthIndexForYear =
      serviceRecapYear === todayYearKey
        ? Number(todayMonthKey.slice(5, 7))
        : 12

    for (let monthIndex = 1; monthIndex <= maxMonthIndexForYear; monthIndex += 1) {
      const monthKey = `${serviceRecapYear}-${String(monthIndex).padStart(2, '0')}`
      monthMap.set(monthKey, {
        childIds: new Set<string>(),
        serviceDayCounts: createServicePackageCounter(),
      })
    }

    for (const record of appData.attendanceRecords) {
      const localDate = toLocalDateKey(record.date)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
        continue
      }

      const monthKey = localDate.slice(0, 7)
      const monthEntry = monthMap.get(monthKey)
      if (!monthEntry) {
        continue
      }

      const child = serviceChildMap.get(record.childId)
      if (!child) {
        continue
      }

      const servicePackage = child.servicePackage as ServicePackage
      monthEntry.childIds.add(child.id)
      monthEntry.serviceDayCounts[servicePackage] += 1
    }

    return Array.from(monthMap.entries()).map(([monthKey, monthEntry]) => {
      const packageCounts = createServicePackageCounter()

      for (const childId of monthEntry.childIds) {
        const child = serviceChildMap.get(childId)
        if (!child) {
          continue
        }
        const servicePackage = child.servicePackage as ServicePackage
        packageCounts[servicePackage] += 1
      }

      const totalServiceDays =
        monthEntry.serviceDayCounts.harian +
        monthEntry.serviceDayCounts['2-mingguan'] +
        monthEntry.serviceDayCounts.bulanan

      const estimatedCharge =
        packageCounts.bulanan * serviceRates.bulanan +
        packageCounts['2-mingguan'] * serviceRates['2-mingguan'] +
        packageCounts.harian * serviceRates.harian

      return {
        monthKey,
        monthLabel: formatMonthLabel(monthKey),
        totalChildren: monthEntry.childIds.size,
        packageCounts,
        serviceDayCounts: monthEntry.serviceDayCounts,
        totalServiceDays,
        estimatedCharge,
      }
    })
  }, [appData.attendanceRecords, serviceChildMap, serviceRates, serviceRecapYear, todayMonthKey, todayYearKey])

  useEffect(() => {
    if (serviceMonthlyRecapRows.some((row) => row.monthKey === serviceRecapMonth)) {
      return
    }

    const fallbackMonth =
      serviceMonthlyRecapRows.find((row) => row.totalServiceDays > 0)?.monthKey ??
      serviceMonthlyRecapRows[0]?.monthKey

    if (fallbackMonth) {
      setServiceRecapMonth(fallbackMonth)
    }
  }, [serviceMonthlyRecapRows, serviceRecapMonth])

  const selectedServiceMonthlyRecap = useMemo(
    () =>
      serviceMonthlyRecapRows.find((row) => row.monthKey === serviceRecapMonth) ??
      serviceMonthlyRecapRows[0] ??
      null,
    [serviceMonthlyRecapRows, serviceRecapMonth],
  )

  const serviceMonthlyDetail = useMemo<ServiceMonthlyDetail | null>(() => {
    if (!selectedServiceMonthlyRecap) {
      return null
    }

    const attendanceByChild = new Map<string, number>()
    for (const record of appData.attendanceRecords) {
      const localDate = toLocalDateKey(record.date)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
        continue
      }
      if (localDate.slice(0, 7) !== selectedServiceMonthlyRecap.monthKey) {
        continue
      }
      attendanceByChild.set(record.childId, (attendanceByChild.get(record.childId) ?? 0) + 1)
    }

    const byPackage: Record<ServicePackage, ServiceMonthChildRow[]> = {
      harian: [],
      '2-mingguan': [],
      bulanan: [],
    }

    const genderCounts: Record<ServiceGenderKey, number> = {
      L: 0,
      P: 0,
      other: 0,
    }

    for (const [childId, attendanceCount] of attendanceByChild.entries()) {
      const child = serviceChildMap.get(childId)
      if (!child) {
        continue
      }

      const servicePackage = child.servicePackage as ServicePackage
      const genderKey = resolveServiceGenderKey(child.gender)
      genderCounts[genderKey] += 1
      byPackage[servicePackage].push({
        childName: child.fullName,
        attendanceCount,
        genderKey,
      })
    }

    for (const option of servicePackageOptions) {
      byPackage[option.value as ServicePackage].sort((left: ServiceMonthChildRow, right: ServiceMonthChildRow) =>
        left.childName.localeCompare(right.childName, 'id-ID'),
      )
    }

    return {
      monthKey: selectedServiceMonthlyRecap.monthKey,
      monthLabel: selectedServiceMonthlyRecap.monthLabel,
      totalChildren: attendanceByChild.size,
      genderCounts,
      byPackage,
    }
  }, [appData.attendanceRecords, selectedServiceMonthlyRecap, serviceChildMap])

  const serviceMonthlyDetailMaxRows = useMemo(() => {
    if (!serviceMonthlyDetail) {
      return 0
    }

    return Math.max(
      1,
      ...servicePackageOptions.map(
        (option) => serviceMonthlyDetail.byPackage[option.value as ServicePackage].length,
      ),
    )
  }, [serviceMonthlyDetail])

  void serviceMonthlyDetailMaxRows

  const serviceBillingArrearsRows = useMemo<ServiceBillingArrearsRow[]>(
    () =>
      (serviceBillingSummary?.rows ?? [])
        .filter((row) => row.totalOutstanding > 0)
        .map((row) => ({
          childId: row.childId,
          childName: row.childName,
          packageKey: row.displayServicePackage,
          packageLabel: servicePackageLabels[row.displayServicePackage],
          unpaidAttendanceDays: toUnpaidAttendanceDays(
            row,
            serviceBillingSummary?.rates ?? serviceRates,
          ),
          totalOutstanding: Math.max(0, Math.round(row.totalOutstanding)),
          activePeriodId: row.activePeriod?.id ?? '',
          currentServicePackage: row.currentServicePackage,
          isMigrated: row.migrationInfo !== null,
        }))
        .sort((left: ServiceBillingArrearsRow, right: ServiceBillingArrearsRow) => {
          if (left.totalOutstanding !== right.totalOutstanding) {
            return right.totalOutstanding - left.totalOutstanding
          }
          return left.childName.localeCompare(right.childName, 'id-ID')
        }),
    [serviceBillingSummary?.rates, serviceBillingSummary?.rows, serviceRates],
  )

  const serviceBillingPaidRows = useMemo(
    () =>
      (serviceBillingSummary?.rows ?? [])
        .filter((row) => {
          if (row.totalOutstanding > 0) return false
          const hasPeriod = row.status !== 'belum-periode'
          const hasPaidInfo = row.paidPeriod > 0 || row.paidArrears > 0 || row.arrearsAttendanceDays > 0
          return hasPeriod || hasPaidInfo
        })
        .map((row) => ({
          childId: row.childId,
          childName: row.childName,
          packageKey: row.displayServicePackage,
          packageLabel: servicePackageLabels[row.displayServicePackage],
          attendanceCount: Math.max(0, row.attendanceInActivePeriod),
          paidAmount: Math.max(0, Math.round(row.paidPeriod + row.paidArrears)),
          paymentProofDataUrl: row.lastPaymentProofDataUrl || '',
          paymentProofName: row.lastPaymentProofName || '',
          lastPaymentAt: row.lastPaymentAt || '',
        }))
        .sort((left, right) =>
          right.lastPaymentAt.localeCompare(left.lastPaymentAt, 'id-ID') ||
          left.childName.localeCompare(right.childName, 'id-ID'),
        ),
    [serviceBillingSummary?.rows],
  )

  const serviceBillingPaidTotalPages = Math.max(
    1,
    Math.ceil(serviceBillingPaidRows.length / SERVICE_BILLING_PAID_PAGE_SIZE),
  )

  const paginatedServiceBillingPaidRows = useMemo(() => {
    const start = (serviceBillingPaidPage - 1) * SERVICE_BILLING_PAID_PAGE_SIZE
    return serviceBillingPaidRows.slice(
      start,
      start + SERVICE_BILLING_PAID_PAGE_SIZE,
    )
  }, [SERVICE_BILLING_PAID_PAGE_SIZE, serviceBillingPaidPage, serviceBillingPaidRows])


  const selectedServiceBillingSummary = useMemo(
    () =>
      serviceBillingSummary?.rows.find((row) => row.childId === selectedBillingChildId) ??
      null,
    [selectedBillingChildId, serviceBillingSummary?.rows],
  )

  const selectedServiceBillingArrearsRow = useMemo(
    () =>
      serviceBillingArrearsRows.find((row) => row.childId === selectedBillingChildId) ??
      null,
    [selectedBillingChildId, serviceBillingArrearsRows],
  )

  const selectedServiceBillingPeriods = serviceBillingHistory?.periods ?? []
  const selectedServiceBillingTransactions = serviceBillingHistory?.transactions ?? []

  const parentAccountMonitoringRows = useMemo(() => {
    const childPackageById = new Map(
      appData.children.map((child) => [
        child.id,
        servicePackageLabels[child.servicePackage] ?? '-',
      ]),
    )

    const rows = parentAccounts.flatMap((account) => {
      const parentNames = [
        account.parentProfile.fatherName.trim(),
        account.parentProfile.motherName.trim(),
      ].filter(Boolean)
      const parentName = parentNames.length > 0 ? parentNames.join(' / ') : account.username

      if (account.children.length === 0) {
        return [
          {
            id: `${account.id}-childless`,
            accountId: account.id,
            parentName,
            childName: '-',
            registeredAt: account.createdAt,
            packageLabel: '-',
            isActive: account.isActive,
          },
        ]
      }

      return account.children.map((child) => ({
        id: `${account.id}-${child.id}`,
        accountId: account.id,
        parentName,
        childName: child.fullName || '-',
        registeredAt: account.createdAt,
        packageLabel: childPackageById.get(child.id) ?? '-',
        isActive: account.isActive,
      }))
    })

    return rows.sort((left, right) => right.registeredAt.localeCompare(left.registeredAt))
  }, [appData.children, parentAccounts])

  useEffect(() => {
    if (serviceBillingArrearsRows.length === 0) {
      return
    }
    const hasSelectedArrears = serviceBillingArrearsRows.some(
      (row) => row.childId === selectedBillingChildId,
    )
    if (hasSelectedArrears) {
      return
    }
    handleSelectServiceBillingArrearsChild(serviceBillingArrearsRows[0].childId)
  }, [
    handleSelectServiceBillingArrearsChild,
    selectedBillingChildId,
    serviceBillingArrearsRows,
  ])

  useEffect(() => {
    setServiceBillingPaidPage((previous) =>
      previous > serviceBillingPaidTotalPages
        ? serviceBillingPaidTotalPages
        : previous,
    )
  }, [serviceBillingPaidTotalPages])

  const unusedServiceBillingAdvancedRefs = {
    handleCreateBillingPeriod,
    handleCreateBillingPayment,
    handleCreateBillingRefund,
    selectedServiceBillingPeriods,
    selectedServiceBillingTransactions,
  }
  void unusedServiceBillingAdvancedRefs

  // --- Render sub-tab pills ---
  const renderSubTabPills = () => {
    if (activeSidebar === 'monitoring') {
      return (
        <div className="admin-monitoring-lane">
          <div className="admin-monitoring-tabs" role="tablist" aria-label="Menu Rekap Admin">
            {monitoringSubTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`admin-monitoring-tab ${monitoringTab === tab.key ? 'is-active' : ''}`}
                onClick={() => {
                  setMonitoringTab(tab.key)
                  setMessage(null)
                  setErrorMessage(null)
                }}
                aria-pressed={monitoringTab === tab.key}
              >
                <span className="admin-monitoring-tab__icon" aria-hidden="true">
                  <tab.icon size={18} />
                </span>
                <span className="admin-monitoring-tab__content">
                  <span className="admin-monitoring-tab__label">{tab.label}</span>
                  <span className="admin-monitoring-tab__desc">{tab.description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )
    }

    if (activeSidebar === 'settings') {
      return (
        <div className="admin-monitoring-lane admin-monitoring-lane--settings">
          <div className="admin-monitoring-tabs" role="tablist" aria-label="Menu Pengaturan Admin">
            {settingsSubTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`admin-monitoring-tab ${settingsTab === tab.key ? 'is-active' : ''}`}
                onClick={() => {
                  setSettingsTab(tab.key)
                  setMessage(null)
                  setErrorMessage(null)
                }}
                aria-pressed={settingsTab === tab.key}
              >
                <span className="admin-monitoring-tab__icon" aria-hidden="true">
                  <tab.icon size={18} />
                </span>
                <span className="admin-monitoring-tab__content">
                  <span className="admin-monitoring-tab__label">{tab.label}</span>
                  <span className="admin-monitoring-tab__desc">{tab.description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )
    }
  }

  const renderContent = () => {
    if (activeSidebar === 'monitoring') {
      switch (monitoringTab) {
        case 'kehadiran-anak': {
          const kehadiranFilteredRecords = appData.attendanceRecords
            .filter((record) => record.date.startsWith(staffAttendanceFilterMonth))
            .sort((left, right) => right.date.localeCompare(left.date))
          const kehadiranTotalPages = Math.max(
            1,
            Math.ceil(kehadiranFilteredRecords.length / KEHADIRAN_ANAK_PAGE_SIZE),
          )
          const kehadiranPageStart = (kehadiranAnakPage - 1) * KEHADIRAN_ANAK_PAGE_SIZE
          const kehadiranPagedRecords = kehadiranFilteredRecords.slice(
            kehadiranPageStart,
            kehadiranPageStart + KEHADIRAN_ANAK_PAGE_SIZE,
          )

          const handleDownloadKehadiranAnakPdf = async () => {
            setDownloadingKehadiranAnakPdf(true)
            setKehadiranAnakPdfNotice(null)
            try {
              const monthKey = staffAttendanceFilterMonth
              const parsed = monthKey.split('-')
              const year = Number(parsed[0])
              const monthIndex = Number(parsed[1]) - 1
              const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
              const monthPrefix = monthKey
              const weekdays: string[] = []
              for (let day = 1; day <= daysInMonth; day += 1) {
                const date = new Date(year, monthIndex, day)
                const dow = date.getDay()
                if (dow >= 1 && dow <= 5) {
                  weekdays.push(`${monthPrefix}-${String(day).padStart(2, '0')}`)
                }
              }
              const sortedChildren = [...appData.children].sort((left, right) =>
                left.fullName.localeCompare(right.fullName, 'id', { sensitivity: 'base' }),
              )
              const attendanceDateMap = new Map<string, Set<string>>()
              for (const record of appData.attendanceRecords) {
                if (!record.date.startsWith(monthKey)) continue
                if (!record.arrivalTime && !record.departureTime) continue
                const dates = attendanceDateMap.get(record.childId) ?? new Set<string>()
                dates.add(record.date)
                attendanceDateMap.set(record.childId, dates)
              }
              const rows = sortedChildren.map((child) => {
                const attendedDates = attendanceDateMap.get(child.id) ?? new Set<string>()
                const attendanceByDate: Record<string, boolean> = {}
                let totalAttendance = 0
                for (const date of weekdays) {
                  const isPresent = attendedDates.has(date)
                  attendanceByDate[date] = isPresent
                  if (isPresent) totalAttendance += 1
                }
                const packageLabels: Record<string, string> = {
                  harian: 'Harian',
                  '2-mingguan': '2 Mingguan',
                  bulanan: 'Bulanan',
                }
                return {
                  childName: child.fullName,
                  packageLabel: packageLabels[child.servicePackage] ?? child.servicePackage,
                  attendanceByDate,
                  totalAttendance,
                }
              })
              const totalByDate = weekdays.map((date) =>
                rows.reduce((sum, row) => sum + (row.attendanceByDate[date] ? 1 : 0), 0),
              )
              const grandTotal = totalByDate.reduce((sum, value) => sum + value, 0)
              const monthNames = [
                'Januari',
                'Februari',
                'Maret',
                'April',
                'Mei',
                'Juni',
                'Juli',
                'Agustus',
                'September',
                'Oktober',
                'November',
                'Desember',
              ]
              const monthLabel = `${monthNames[monthIndex]} ${year}`
              const result = await downloadRekapAttendancePdf({
                selectedMonth: monthKey,
                monthLabel,
                internalHolidayDates: [],
                workingDates: weekdays,
                rows,
                totalByDate,
                grandTotal,
                logoPath: `${import.meta.env.BASE_URL}UBAYA-noBG.png`,
              })
              setKehadiranAnakPdfNotice({
                type: result.logoLoaded ? 'success' : 'warning',
                text: result.logoLoaded
                  ? 'PDF rekap kehadiran anak berhasil diunduh.'
                  : 'PDF berhasil diunduh, tetapi logo tidak ditemukan.',
              })
            } catch {
              setKehadiranAnakPdfNotice({
                type: 'error',
                text: 'Gagal membuat PDF rekap kehadiran anak.',
              })
            } finally {
              setDownloadingKehadiranAnakPdf(false)
            }
          }

          return (
            <KehadiranAnakPage
              notice={kehadiranAnakPdfNotice}
              monthValue={staffAttendanceFilterMonth}
              monthMax={todayMonthKey}
              onChangeMonth={(value) => {
                handleStaffAttendanceMonthFilterChange(value)
                setKehadiranAnakPage(1)
              }}
              onDownloadPdf={handleDownloadKehadiranAnakPdf}
              isDownloadingPdf={isDownloadingKehadiranAnakPdf}
              isLoading={isLoadingServices}
              pagedRecords={kehadiranPagedRecords}
              totalRecords={kehadiranFilteredRecords.length}
              page={kehadiranAnakPage}
              totalPages={kehadiranTotalPages}
              childNameById={childNameById}
              onPrevPage={() => setKehadiranAnakPage((page) => Math.max(1, page - 1))}
              onNextPage={() =>
                setKehadiranAnakPage((page) => Math.min(kehadiranTotalPages, page + 1))
              }
              formatDateWithWeekday={formatDateWithWeekday}
            />
          )
        }

        case 'observasi-anak': {
          const handleDownloadObservationChildPdf = async (childId: string) => {
            const childRecords = resolveObservationMonthlyRecordsByChild(childId)
            if (childRecords.length === 0) {
              setObservationPdfNotice({
                type: 'warning',
                text: 'Tidak ada data observasi untuk anak dan bulan yang dipilih.',
              })
              return
            }

            setDownloadingObservationChildId(childId)
            setObservationPdfNotice(null)
            try {
              const result = await downloadObservationBatchPdf({
                filterDate: observationFilterDate || observationFilterMonth,
                filterGroupLabel: selectedObservationGroupLabel || '-',
                records: childRecords,
                childrenData: appData.children,
                logoPath: `${import.meta.env.BASE_URL}UBAYA-noBG.png`,
              })

              setObservationPdfNotice({
                type: result.logoLoaded ? 'success' : 'warning',
                text: result.logoLoaded
                  ? `Data observasi berhasil diunduh (${result.pageCount} lembar).`
                  : `Data observasi berhasil diunduh (${result.pageCount} lembar), tetapi logo tidak ditemukan.`,
              })
            } catch {
              setObservationPdfNotice({
                type: 'error',
                text: 'Gagal membuat PDF observasi.',
              })
            } finally {
              setDownloadingObservationChildId(null)
            }
          }

          const handleDownloadObservationAll = async () => {
            if (!observationFilterChild || !observationFilterGroup) {
              return
            }

            const childRecords = resolveObservationMonthlyRecordsByChild(observationFilterChild)
            if (childRecords.length === 0) {
              setObservationPdfNotice({
                type: 'warning',
                text: 'Tidak ada data observasi untuk anak dan bulan yang dipilih.',
              })
              return
            }

            setDownloadingObservationPdf(true)
            setObservationPdfNotice(null)
            try {
              const result = await downloadObservationBatchPdf({
                filterDate: observationFilterDate || observationFilterMonth,
                filterGroupLabel: selectedObservationGroupLabel || '-',
                records: childRecords,
                childrenData: appData.children,
                logoPath: `${import.meta.env.BASE_URL}UBAYA-noBG.png`,
              })

              setObservationPdfNotice({
                type: result.logoLoaded ? 'success' : 'warning',
                text: result.logoLoaded
                  ? `Unduh semua observasi berhasil (${result.pageCount} lembar).`
                  : `Unduh semua observasi berhasil (${result.pageCount} lembar), tetapi logo tidak ditemukan.`,
              })
            } catch {
              setObservationPdfNotice({
                type: 'error',
                text: 'Gagal membuat PDF observasi.',
              })
            } finally {
              setDownloadingObservationPdf(false)
            }
          }

          return (
            <ObservasiAnakPage
              notice={observationPdfNotice}
              filterDate={observationFilterDate}
              filterDateMax={todayIso}
              onChangeFilterDate={handleObservationFilterPickerChange}
              filterGroup={observationFilterGroup}
              onChangeFilterGroup={handleObservationGroupFilterChange}
              groupOptions={observationGroupOptions}
              filterChild={observationFilterChild}
              onChangeFilterChild={setObservationFilterChild}
              childOptions={observationChildFilterOptions}
              onDownloadAll={handleDownloadObservationAll}
              isDownloadingAll={isDownloadingObservationPdf}
              canDownloadAll={canDownloadObservationAll}
              isLoading={isLoadingServices}
              rows={sortedObservationRecapRows}
              downloadingChildId={downloadingObservationChildId}
              downloadableChildIds={observationChildIdsWithMonthlyRecords}
              onDownloadChild={handleDownloadObservationChildPdf}
              formatDateOnly={formatDateOnly}
            />
          )
        }

        case 'berita-acara': {
          const incidentRows = incidentFilteredList.slice(0, 20)

          return (
            <BeritaAcaraPage
              notice={incidentPdfNotice}
              recapTotals={incidentRecapTotals}
              filterDate={incidentFilterDate}
              dateMax={todayIso}
              onChangeFilterDate={handleIncidentFilterPickerChange}
              filterChild={incidentFilterChild}
              onChangeFilterChild={setIncidentFilterChild}
              childOptions={incidentChildFilterOptions}
              onOpenDownloadDialog={openIncidentPdfDialog}
              isDownloadingPdf={isDownloadingIncidentPdf}
              isLoading={isLoadingServices}
              filteredList={incidentFilteredList}
              rows={incidentRows}
              companionByChildDate={incidentCompanionByChildDate}
              childNameById={childNameById}
              formatDateOnly={formatDateOnly}
            />
          )
        }

        case 'kehadiran-petugas': {
          const staffAttendanceDateBounds = getMonthDateBounds(staffAttendanceFilterMonth, todayIso)
          return (
            <KehadiranPetugasPage
              selectedDateLabel={selectedStaffAttendanceDateLabel}
              notice={staffAttendancePdfNotice}
              monthValue={staffAttendanceFilterMonth}
              monthMax={todayMonthKey}
              onChangeMonth={handleStaffAttendanceMonthFilterChange}
              dateValue={staffAttendanceFilterDate}
              dateMin={staffAttendanceDateBounds.min}
              dateMax={staffAttendanceDateBounds.max}
              onChangeDate={handleStaffAttendanceDateFilterChange}
              onOpenDownloadDialog={openStaffAttendancePdfDialog}
              isDownloadingPdf={isDownloadingStaffAttendancePdf}
              actionState={staffAttendanceActionState}
              belumAbsenMasukRows={staffBelumAbsenMasuk}
              bertugasRows={staffBertugasRows}
              sudahAbsenMasukRows={staffSudahAbsenMasukRows}
              onCheckInStaff={handleAdminCheckInStaff}
              onCheckOutStaff={handleAdminCheckOutStaff}
              isLoadingRecap={isLoadingStaffAttendance}
              formatTimeOnly={formatTimeOnly}
              formatDutyDuration={formatDutyDuration}
              formatRupiah={formatRupiah}
            />
          )
        }

        case 'layanan':
          return (
            <BillingPage
              isSettlementOpen={isServiceBillingSettlementOpen}
              onToggleSettlementOpen={setServiceBillingSettlementOpen}
              onSelectBillingChild={handleSelectServiceBillingArrearsChild}
              selectedArrearsRow={selectedServiceBillingArrearsRow}
              isMutating={isMutatingServiceBilling}
              paymentForm={serviceBillingPaymentForm}
              onPaymentProofChange={handleServicePaymentProofChange}
              onClearPaymentProof={clearServicePaymentProof}
              onQuickPayment={handleQuickServicePayment}
              formatCurrency={formatCurrency}
              isLoadingPaidRows={isLoadingServiceBilling}
              paidRows={paginatedServiceBillingPaidRows}
              paidPage={serviceBillingPaidPage}
              paidTotalPages={serviceBillingPaidTotalPages}
              onPrevPaidPage={() => setServiceBillingPaidPage((previous) => Math.max(1, previous - 1))}
              onNextPaidPage={() =>
                setServiceBillingPaidPage((previous) =>
                  Math.min(serviceBillingPaidTotalPages, previous + 1),
                )
              }
              arrearsRows={serviceBillingArrearsRows}
            />
          )

        default:
          return null
      }
    }

    if (activeSidebar === 'data-anak') {
      if (isLoadingServices) {
        return (
          <section className="page">
            <div className="card">
              <p>Memuat data anak...</p>
            </div>
          </section>
        )
      }

      return (
        <DataAnakPage
          childrenData={appData.children}
          viewerRole="ADMIN"
          canManageData
          registrationCodesByChildId={childRegistrationCodesById}
          onSave={upsertChildProfileAdmin}
          onDelete={removeChildProfileAdmin}
          onLoadRegistrationCode={loadChildRegistrationCode}
          onGenerateRegistrationCode={async (childId) => {
            const code = await generateChildRegistrationCodeForAdmin(childId)
            return Boolean(code)
          }}
          onRequestConfirm={requestConfirm}
        />
      )
    }

    switch (settingsTab) {
      case 'petugas':
        return (
          <ManajemenPetugasPage
            editingStaffId={editingStaffId}
            staffCountLabel={staffCountLabel}
            onSubmitStaff={handleSubmitStaff}
            staffForm={staffForm}
            setStaffForm={setStaffForm}
            showStaffPassword={showStaffPassword}
            setShowStaffPassword={setShowStaffPassword}
            todayIso={todayIso}
            onResetStaffForm={resetStaffForm}
            isLoadingStaff={isLoadingStaff}
            staffUsers={staffUsers}
            pendingStaffRequests={pendingStaffRequests}
            isLoadingPendingStaffRequests={isLoadingPendingStaffRequests}
            processingStaffRequestId={processingStaffRequestId}
            formatDateOnly={formatDateOnly}
            formatDateTime={formatDateTime}
            calculateServiceLength={calculateServiceLength}
            onStartEditStaff={startEditStaff}
            onDeleteStaff={handleDeleteStaff}
            onToggleStaffStatus={handleToggleStaffStatus}
            onApproveStaffRequest={handleApproveStaffRequest}
            onRejectStaffRequest={handleRejectStaffRequest}
          />
        )

      case 'orang-tua':
        return (
          <ManajemenAkunOrangTuaPage
            rows={parentAccountMonitoringRows}
            totalAccounts={parentAccounts.length}
            isLoading={isLoadingParentAccounts}
            togglingAccountIds={togglingParentAccountIds}
            onToggleAccountStatus={handleToggleParentAccountStatus}
            formatDateOnly={formatDateOnly}
          />
        )

      case 'update-pengumuman':
        return (
          <UpdatePengumumanPage
            announcements={landingAnnouncements}
            form={landingAnnouncementForm}
            setForm={setLandingAnnouncementForm}
            editingAnnouncementId={editingLandingAnnouncementId}
            isLoading={isLoadingLandingAnnouncements}
            isSaving={isSavingLandingAnnouncement}
            deletingAnnouncementId={deletingLandingAnnouncementId}
            onSubmit={handleSubmitLandingAnnouncement}
            onResetForm={resetLandingAnnouncementForm}
            onSelectAnnouncement={handleSelectLandingAnnouncement}
            onDeleteAnnouncement={handleDeleteLandingAnnouncement}
            onUploadCoverImage={handleUploadLandingAnnouncementCover}
            onClearCoverImage={clearLandingAnnouncementCover}
            formatDateOnly={formatDateOnly}
            formatDateTime={formatDateTime}
          />
        )

      case 'logs':
        return (
          <LogAktivitasPage
            searchLogs={searchLogs}
            onChangeSearchLogs={setSearchLogs}
            activityLogDateFilter={activityLogDateFilter}
            todayIso={todayIso}
            onChangeActivityLogDateFilter={setActivityLogDateFilter}
            activityLogLimit={activityLogLimit}
            limitOptions={ACTIVITY_LOG_LIMIT_OPTIONS}
            onChangeActivityLogLimit={handleActivityLogLimitChange}
            onApplyFilter={() => loadLogs(searchLogs)}
            isLoadingLogs={isLoadingLogs}
            logs={filteredActivityLogs}
            formatLogDateTimeParts={formatLogDateTimeParts}
            formatActivityActionSummary={formatActivityActionSummary}
            activityLogPage={activityLogPage}
            activityLogHasMore={activityLogHasMore}
            activityLogNextCursor={activityLogNextCursor}
            onLoadNext={handleLoadNextLogs}
          />
        )

      case 'backup':
        return (
          <BackupPage
            isProcessingBackup={isProcessingBackup}
            onBackup={handleBackup}
          />
        )

      default:
        return null
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        activeMenu={activeSidebar}
        menus={adminMenus}
        isOpen={isSidebarOpen}
        onMenuSelect={selectMenu}
        onClose={() => setSidebarOpen(false)}
        onLogout={onLogout}
        userLabel={user.displayName}
        accountLabel="Akun Admin"
        panelTitle="Panel Admin"
        menuLabel="Menu Admin"
        chipLabel=""
      />

      <div className="app-main">
        <header className={`topbar topbar--admin ${isTopbarHidden ? 'is-hidden' : ''}`}>
          <button
            type="button"
            className="topbar__menu"
            onClick={() => setSidebarOpen(true)}
            aria-label="Buka menu"
          >
            <Menu size={18} />
          </button>
          <div className="topbar__title-wrap topbar__title-wrap--admin">
            <h1>{activeHeader.title}</h1>
            <p>{activeHeader.subtitle}</p>
          </div>
        </header>

        <main className="app-content">
          {renderSubTabPills()}

          {errorMessage ? (
            <section className="page">
              <div className="card">
                <p className="field-error">{errorMessage}</p>
              </div>
            </section>
          ) : null}

          {renderContent()}
        </main>
      </div>

      {message ? (
        <div className="app-toast app-toast--success" role="status" aria-live="polite">
          <CheckCircle2 size={18} />
          <span>{message}</span>
        </div>
      ) : null}

      {isIncidentPdfDialogOpen ? (
        <div
          className="app-confirm-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIncidentPdfDialogOpen(false)
            }
          }}
        >
          <div className="app-confirm-dialog" role="dialog" aria-modal="true" style={{ maxWidth: '460px' }}>
            <h3>Unduh PDF Berita Acara</h3>
            <p>Pilih tipe unduhan per tanggal atau per bulan.</p>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div className="field-group">
                <label className="label">Tipe Unduhan</label>
                <select
                  className="input"
                  value={incidentPdfMode}
                  onChange={(event) => {
                    const nextMode = event.target.value as IncidentPdfMode
                    setIncidentPdfMode(nextMode)
                    if (nextMode === 'month') {
                      setIncidentPdfFilterDate('')
                    }
                  }}
                >
                  <option value="date">Per Tanggal</option>
                  <option value="month">Per Bulan</option>
                </select>
              </div>
              <div className="field-group">
                <label className="label">Bulan</label>
                <AppMonthPickerField
                  value={incidentPdfFilterMonth}
                  max={todayMonthKey}
                  onChange={(value) => {
                    const nextMonth = clampMonthKeyToServerToday(value)
                    setIncidentPdfFilterMonth(nextMonth)
                    if (incidentPdfFilterDate && !incidentPdfFilterDate.startsWith(nextMonth)) {
                      setIncidentPdfFilterDate('')
                    }
                  }}
                />
              </div>
              {incidentPdfMode === 'date' ? (
                <div className="field-group">
                  <label className="label">Tanggal</label>
                  <AppDatePickerField
                    value={incidentPdfFilterDate}
                    min={incidentPdfDateBounds.min}
                    max={incidentPdfDateBounds.max}
                    onChange={(value) =>
                      setIncidentPdfFilterDate(clampOptionalDateKeyToServerToday(value))
                    }
                  />
                </div>
              ) : null}
            </div>
            <div className="app-confirm-actions" style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setIncidentPdfDialogOpen(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="button button--download-pdf"
                onClick={() => void handleDownloadIncidentPdf()}
                disabled={isDownloadingIncidentPdf}
              >
                {isDownloadingIncidentPdf ? 'Mengunduh...' : (
                  <>
                    <Download size={14} />
                    <span>Unduh PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isStaffAttendancePdfDialogOpen ? (
        <div
          className="app-confirm-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setStaffAttendancePdfDialogOpen(false)
            }
          }}
        >
          <div className="app-confirm-dialog" role="dialog" aria-modal="true" style={{ maxWidth: '460px' }}>
            <h3>Unduh PDF Kehadiran Petugas</h3>
            <p>Pilih data bulanan atau tahunan.</p>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div className="field-group">
                <label className="label">Tipe Unduhan</label>
                <select
                  className="input"
                  value={staffAttendancePdfMode}
                  onChange={(event) => setStaffAttendancePdfMode(event.target.value as StaffAttendancePdfMode)}
                >
                  <option value="monthly">Bulanan</option>
                  <option value="yearly">Tahunan</option>
                </select>
              </div>
              {staffAttendancePdfMode === 'monthly' ? (
                <div className="field-group">
                  <label className="label">Bulan</label>
                  <AppMonthPickerField
                    value={staffAttendanceFilterMonth}
                    max={todayMonthKey}
                    onChange={(value) => handleStaffAttendanceMonthFilterChange(value)}
                  />
                </div>
              ) : null}
              {staffAttendancePdfMode === 'yearly' ? (
                <div className="field-group">
                  <label className="label">Tahun</label>
                  <input
                    type="number"
                    className="input"
                    min={2000}
                    max={Number(todayYearKey)}
                    value={staffAttendancePdfYear}
                    onChange={(event) => setStaffAttendancePdfYear(event.target.value.replace(/[^\d]/g, '').slice(0, 4))}
                  />
                </div>
              ) : null}
            </div>
            <div className="app-confirm-actions" style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setStaffAttendancePdfDialogOpen(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="button button--download-pdf"
                onClick={handleDownloadStaffAttendancePdf}
                disabled={isDownloadingStaffAttendancePdf}
              >
                {isDownloadingStaffAttendancePdf ? 'Mengunduh...' : (
                  <>
                    <Download size={14} />
                    <span>Unduh PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDialog ? (
        <div
          className="app-confirm-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeConfirmDialog(false)
            }
          }}
        >
          <div className="app-confirm-dialog" role="alertdialog" aria-modal="true">
            <h3>{confirmDialog.title}</h3>
            <p>{confirmDialog.message}</p>
            <div className="app-confirm-actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => closeConfirmDialog(false)}
              >
                {confirmDialog.cancelLabel}
              </button>
              <button
                type="button"
                className={`button ${confirmDialog.tone === 'danger' ? 'button--danger' : ''}`}
                onClick={() => closeConfirmDialog(true)}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isSyncingAppData ? (
        <div className="app-loading-overlay" role="status" aria-live="polite">
          <div className="app-loading-dialog">
            <div className="app-loading-spinner" aria-hidden="true" />
            <p>Menyimpan perubahan...</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default AdminSection

