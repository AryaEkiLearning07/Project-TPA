
import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bell,
  Camera,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ChevronDown,
  ChevronUp,
  CreditCard,
  HeartPulse,
  Home,
  House,
  LogOut,
  Mail,
  MapPin,
  MessageSquare,
  Moon,
  Package,
  Phone,
  PlusCircle,
  RefreshCw,
  ScrollText,
  SendHorizontal,
  Sun,
  UserRound,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import type {
  AuthUser,
  CarriedItem,
  ChildProfile,
  ChildProfileInput,
  ParentDashboardData,
  ParentProfile,
  ServiceBillingPeriod,
  ServiceBillingSummaryRow,
  ServiceBillingTransaction,
  SupplyInventoryItem,
} from '../../types'
import { religionOptions, servicePackageOptions } from '../../constants/options'
import { parentApi } from '../../services/api'
import { AppDatePickerField, AppMonthPickerField } from '../../components/common/DatePickerFields'
import {
  parseNavigationState,
  pushNavigationState,
  readNavigationState,
  replaceNavigationState,
} from '../../utils/browser-history'
import { useHideOnScroll } from '../../utils/useHideOnScroll'
import { type FieldErrors, validateChildProfileInput } from '../../utils/validators'
import './parent-portal.css'

const LOGO_SRC = `${import.meta.env.BASE_URL}logo_TPA.jpg`
const ACTIVE_CHILD_STORAGE_KEY = 'tpa-parent-active-child'
const PARENT_THEME_STORAGE_KEY = 'tpa-parent-theme'
const PARENT_DASHBOARD_BACKGROUND_SYNC_MS = 15000
const PARENT_WELCOME_POPUP_STORAGE_PREFIX = 'tpa-parent:welcome-popup'
const DAILY_REPORT_FALLBACK_LIMIT = 7
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const ISO_MONTH_PATTERN = /^\d{4}-\d{2}$/

type ParentMenuKey = 'dashboard' | 'daily-logs' | 'billing' | 'profile' | 'inventory'
type ParentTheme = 'light' | 'dark'
type ProfileDisclosureKey =
  | 'child-biodata'
  | 'parent-biodata'
  | 'service-data'
  | 'development-health'
  | 'daily-habits'
  | 'settings'

interface ParentProfileEditDraft {
  fatherName: string
  motherName: string
  email: string
  whatsappNumber: string
  homePhone: string
  otherPhone: string
  homeAddress: string
  officeAddress: string
}

interface ParentPasswordChangeDraft {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

type ProfileEditSectionKey =
  | 'child'
  | 'parent'
  | 'service'
  | 'development'
  | 'habits'

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

interface ParentActivityPhoto {
  id: string
  imageUrl: string
  caption: string
  imageName: string
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

type DashboardAlertTone = 'info' | 'warning' | 'danger'

interface DashboardAlertItem {
  id: string
  tone: DashboardAlertTone
  title: string
  description: string
  icon: LucideIcon
  unreadKey: string
  alwaysUnread?: boolean
  targetMenu: ParentMenuKey
  action: 'open-menu' | 'open-latest-reply'
}

const EMPTY_PROFILE_EDIT_DRAFT: ParentProfileEditDraft = {
  fatherName: '',
  motherName: '',
  email: '',
  whatsappNumber: '',
  homePhone: '',
  otherPhone: '',
  homeAddress: '',
  officeAddress: '',
}

const EMPTY_PARENT_PASSWORD_CHANGE_DRAFT: ParentPasswordChangeDraft = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
}

const EMPTY_CHILD_PROFILE_EDIT_DRAFT: ChildProfileInput = {
  fullName: '',
  nickName: '',
  gender: 'L',
  photoDataUrl: '',
  birthPlace: '',
  birthDate: '',
  childOrder: '',
  religion: 'islam',
  outsideActivities: '',
  fatherName: '',
  motherName: '',
  homeAddress: '',
  homePhone: '',
  officeAddress: '',
  otherPhone: '',
  email: '',
  whatsappNumber: '',
  allergy: '',
  servicePackage: 'harian',
  serviceStartDate: '',
  arrivalTime: '',
  departureTime: '',
  pickupPersons: [],
  depositPurpose: '',
  prenatalPeriod: '',
  partusPeriod: '',
  postNatalPeriod: '',
  motorSkill: '',
  languageSkill: '',
  healthHistory: '',
  toiletTrainingBab: '',
  toiletTrainingBak: '',
  toiletTrainingBath: '',
  brushingTeeth: '',
  eating: '',
  drinkingMilk: '',
  whenCrying: '',
  whenPlaying: '',
  sleeping: '',
  otherHabits: '',
}

const MAX_CHILD_PHOTO_FILE_SIZE_BYTES = 12 * 1024 * 1024
const SUPPORTED_CHILD_PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
])
const SUPPORTED_CHILD_PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']

const menus: { key: ParentMenuKey; label: string; icon: LucideIcon }[] = [
  { key: 'dashboard', label: 'Beranda', icon: Home },
  { key: 'daily-logs', label: 'Laporan', icon: ScrollText },
  { key: 'billing', label: 'Keuangan', icon: CreditCard },
  { key: 'profile', label: 'Profil', icon: UserRound },
]

interface ParentNavigationState {
  menu: ParentMenuKey
  childId: string | null
}

const parentMenuKeySet = new Set<ParentMenuKey>([
  'dashboard',
  'daily-logs',
  'billing',
  'profile',
  'inventory',
])

const isParentMenuKey = (value: unknown): value is ParentMenuKey =>
  typeof value === 'string' && parentMenuKeySet.has(value as ParentMenuKey)

const isParentNavigationState = (value: unknown): value is ParentNavigationState => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    isParentMenuKey(record.menu) &&
    (typeof record.childId === 'string' || record.childId === null)
  )
}

const buildParentNavigationState = (
  menu: ParentMenuKey,
  childId: string | null,
): ParentNavigationState => ({
  menu,
  childId,
})

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

const formatLongDateWithWeekday = (value: string) =>
  formatDate(value, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

const formatShortDate = (value: string) =>
  formatDate(value, { day: '2-digit', month: 'short', year: 'numeric' })

const formatMonthYear = (value: string) => {
  if (!ISO_MONTH_PATTERN.test(value)) return value || '-'
  return formatDate(`${value}-01`, { month: 'long', year: 'numeric' })
}

const formatDateTime = (value: string) =>
  formatDate(value, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

const formatDateRange = (startDate: string, endDate: string) => {
  if (!startDate && !endDate) return '-'
  if (!startDate || !endDate) return formatLongDate(startDate || endDate)
  if (startDate === endDate) return formatLongDate(startDate)
  return `${formatShortDate(startDate)} - ${formatShortDate(endDate)}`
}

const formatTime = (value: string) => {
  if (!value) return '--:--'
  const [hours = '--', minutes = '--'] = value.split(':')
  return `${hours}:${minutes}`
}

const getMonthDateBounds = (monthKey: string, todayDate: string): { min: string; max: string } => {
  if (!ISO_MONTH_PATTERN.test(monthKey)) {
    return {
      min: todayDate,
      max: todayDate,
    }
  }

  const [yearText, monthText] = monthKey.split('-')
  const year = Number(yearText)
  const month = Number(monthText)

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return {
      min: todayDate,
      max: todayDate,
    }
  }

  const daysInMonth = new Date(year, month, 0).getDate()
  const monthEndDate = `${monthKey}-${String(daysInMonth).padStart(2, '0')}`

  return {
    min: `${monthKey}-01`,
    max: monthEndDate > todayDate ? todayDate : monthEndDate,
  }
}

const formatClockTime = (value: Date) =>
  new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)

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
const getParentWelcomePopupStorageKey = (userId: string) =>
  `${PARENT_WELCOME_POPUP_STORAGE_PREFIX}:${userId}`

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

const asText = (value: unknown) => (typeof value === 'string' ? value : '')

const hasText = (value: unknown) => asText(value).trim().length > 0

const toChildProfileInput = (
  child: ChildProfile,
  parentProfile?: ParentProfile | null,
): ChildProfileInput => ({
  fullName: child.fullName,
  nickName: child.nickName,
  gender: child.gender,
  photoDataUrl: child.photoDataUrl,
  birthPlace: child.birthPlace,
  birthDate: child.birthDate,
  childOrder: child.childOrder,
  religion: child.religion,
  outsideActivities: child.outsideActivities,
  fatherName: parentProfile?.fatherName || child.fatherName,
  motherName: parentProfile?.motherName || child.motherName,
  homeAddress: parentProfile?.homeAddress || child.homeAddress,
  homePhone: parentProfile?.homePhone || child.homePhone,
  officeAddress: parentProfile?.officeAddress || child.officeAddress,
  otherPhone: parentProfile?.otherPhone || child.otherPhone,
  email: parentProfile?.email || child.email,
  whatsappNumber: parentProfile?.whatsappNumber || child.whatsappNumber,
  allergy: child.allergy,
  servicePackage: child.servicePackage,
  serviceStartDate: child.serviceStartDate,
  arrivalTime: child.arrivalTime,
  departureTime: child.departureTime,
  pickupPersons: Array.isArray(child.pickupPersons) ? [...child.pickupPersons] : [],
  depositPurpose: child.depositPurpose,
  prenatalPeriod: child.prenatalPeriod,
  partusPeriod: child.partusPeriod,
  postNatalPeriod: child.postNatalPeriod,
  motorSkill: child.motorSkill,
  languageSkill: child.languageSkill,
  healthHistory: child.healthHistory,
  toiletTrainingBab: child.toiletTrainingBab,
  toiletTrainingBak: child.toiletTrainingBak,
  toiletTrainingBath: child.toiletTrainingBath,
  brushingTeeth: child.brushingTeeth,
  eating: child.eating,
  drinkingMilk: child.drinkingMilk,
  whenCrying: child.whenCrying,
  whenPlaying: child.whenPlaying,
  sleeping: child.sleeping,
  otherHabits: child.otherHabits,
})

const toSafeCarriedItems = (items: CarriedItem[] | null | undefined): CarriedItem[] =>
  Array.isArray(items) ? items : []

const normalizePaymentMethod = (value: string) => {
  const raw = asText(value).trim()
  if (!raw) return '-'

  const normalized = raw.toLowerCase()
  if (normalized.includes('qris') || normalized.includes('qriss')) {
    return 'QRIS'
  }

  if (normalized.includes('tunai') || normalized === 'cash') {
    return 'Tunai'
  }

  const knownBanks = ['BCA', 'BRI', 'BNI', 'MANDIRI', 'BSI', 'CIMB', 'PERMATA', 'DANAMON']
  const matchedBank = knownBanks.find((bank) => normalized.includes(bank.toLowerCase()))
  if (matchedBank) {
    return matchedBank
  }

  if (normalized.includes('bank') || normalized === 'lainnya') {
    return 'Nama Bank'
  }

  return 'Nama Bank'
}

const createActivitySummary = (report: ParentDailyReport | null) => {
  if (!report) return []

  const carriedItems = toSafeCarriedItems(report.carriedItems)
  const summary: string[] = ['Pemantauan kedatangan dan kondisi awal anak.']

  if (carriedItems.length > 0) {
    summary.push(`Pengecekan barang bawaan (${carriedItems.length} item).`)
  }

  if (hasText(report.parentMessage)) {
    summary.push('Orang tua mengirim catatan untuk petugas.')
  }

  if (hasText(report.messageForParent)) {
    summary.push('Petugas mengirim catatan perkembangan untuk orang tua.')
  }

  if (report.departureTime || report.pickupName) {
    summary.push('Pemantauan penjemputan dan kondisi anak saat pulang.')
  }

  return summary
}

export default function ParentPortalSection({
  user,
  onLogout,
}: ParentPortalSectionProps) {
  const [theme, setTheme] = useState<ParentTheme>(() => getInitialTheme())
  const [activeMenu, setActiveMenu] = useState<ParentMenuKey>('dashboard')
  const [dashboardData, setDashboardData] = useState<ParentDashboardPayload | null>(null)
  const [activeChildId, setActiveChildId] = useState<string | null>(null)
  const [selectedChildCandidateId, setSelectedChildCandidateId] = useState<string | null>(null)
  const [registrationCode, setRegistrationCode] = useState('')
  const [isLinkFormOpen, setLinkFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLinking, setIsLinking] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null)
  const [expandedMessageReportId, setExpandedMessageReportId] = useState<string | null>(null)
  const [reportFilterMonth, setReportFilterMonth] = useState('')
  const [reportFilterDate, setReportFilterDate] = useState('')
  const [expandedFinanceId, setExpandedFinanceId] = useState<string | null>(null)
  const [parentMessageDraft, setParentMessageDraft] = useState('')
  const [messageDraftReportId, setMessageDraftReportId] = useState<string | null>(null)
  const [isParentMessageDirty, setIsParentMessageDirty] = useState(false)
  const [isSavingParentMessage, setIsSavingParentMessage] = useState(false)
  const [parentMessageSaveInfo, setParentMessageSaveInfo] = useState<string | null>(null)
  const [isWelcomePopupVisible, setWelcomePopupVisible] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false)
  const [isNotificationDropdownOpen, setNotificationDropdownOpen] = useState(false)
  const [readNotificationKeys, setReadNotificationKeys] = useState<string[]>([])
  const [expandedProfileSection, setExpandedProfileSection] = useState<ProfileDisclosureKey | null>(null)
  const [isProfileEditOpen, setProfileEditOpen] = useState(false)
  const [isSavingProfileEdit, setIsSavingProfileEdit] = useState(false)
  const [profileEditDraft, setProfileEditDraft] = useState<ParentProfileEditDraft>(
    EMPTY_PROFILE_EDIT_DRAFT,
  )
  const [profileEditChildDraft, setProfileEditChildDraft] = useState<ChildProfileInput>(
    EMPTY_CHILD_PROFILE_EDIT_DRAFT,
  )
  const [profileEditSection, setProfileEditSection] = useState<ProfileEditSectionKey>('child')
  const [profileEditFieldErrors, setProfileEditFieldErrors] = useState<FieldErrors>({})
  const [profileEditError, setProfileEditError] = useState<string | null>(null)
  const [isPasswordEditorOpen, setPasswordEditorOpen] = useState(false)
  const [passwordChangeDraft, setPasswordChangeDraft] = useState<ParentPasswordChangeDraft>(
    EMPTY_PARENT_PASSWORD_CHANGE_DRAFT,
  )
  const [isSavingPasswordChange, setIsSavingPasswordChange] = useState(false)
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null)
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState<string | null>(null)
  const dashboardRequestIdRef = useRef(0)
  const hasInitializedNavigationHistoryRef = useRef(false)
  const isApplyingNavigationHistoryRef = useRef(false)
  const messageEditorRef = useRef<HTMLTextAreaElement | null>(null)
  const messageReplyRef = useRef<HTMLDivElement | null>(null)
  const notificationPanelRef = useRef<HTMLDivElement | null>(null)
  const profileEditPhotoInputRef = useRef<HTMLInputElement | null>(null)
  const isHeaderHidden = useHideOnScroll()

  useEffect(() => {
    setExpandedProfileSection(null)
  }, [activeChildId, activeMenu])

  useEffect(() => {
    const restoredState = readNavigationState(isParentNavigationState)

    if (restoredState) {
      if (restoredState.menu !== activeMenu) {
        isApplyingNavigationHistoryRef.current = true
        setActiveMenu(restoredState.menu)
      }

      if (restoredState.childId !== activeChildId) {
        isApplyingNavigationHistoryRef.current = true
        setActiveChildId(restoredState.childId)
        setSelectedChildCandidateId(restoredState.childId)
      }
    } else {
      replaceNavigationState(buildParentNavigationState(activeMenu, activeChildId))
    }

    hasInitializedNavigationHistoryRef.current = true

    const handlePopState = (event: PopStateEvent) => {
      const nextState = parseNavigationState(event.state, isParentNavigationState)
      if (!nextState) {
        return
      }

      isApplyingNavigationHistoryRef.current = true
      setActiveMenu(nextState.menu)
      setActiveChildId(nextState.childId)
      setSelectedChildCandidateId(nextState.childId)
      setExpandedProfileSection(null)
      setNotificationDropdownOpen(false)
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

    const currentState = readNavigationState(isParentNavigationState)
    if (currentState?.menu === activeMenu && currentState?.childId === activeChildId) {
      return
    }

    pushNavigationState(buildParentNavigationState(activeMenu, activeChildId))
  }, [activeChildId, activeMenu])

  useEffect(() => {
    if (!isProfileEditOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSavingProfileEdit) {
        setProfileEditOpen(false)
        setProfileEditError(null)
      }
    }

    document.addEventListener('keydown', handleEscapeKey)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [isProfileEditOpen, isSavingProfileEdit])

  const clearSelectedChildSession = useCallback(() => {
    window.localStorage.removeItem(getChildStorageKey(user.id))
  }, [user.id])

  const saveSelectedChildSession = useCallback((childId: string) => {
    window.localStorage.setItem(getChildStorageKey(user.id), childId)
  }, [user.id])

  const loadDashboard = useCallback(async (options?: { silent?: boolean }) => {
    const requestId = ++dashboardRequestIdRef.current
    if (!options?.silent) {
      setIsLoading(true)
      setErrorMessage(null)
    } else {
      setIsBackgroundSyncing(true)
    }

    try {
      const data = asPayload(await parentApi.getDashboardData())
      if (requestId !== dashboardRequestIdRef.current) {
        return
      }
      setDashboardData(data)
      setLastSyncedAt(new Date())

      const hasActiveChild =
        !!activeChildId && data.children.some((child) => child.id === activeChildId)

      if (data.children.length === 1) {
        const onlyChildId = data.children[0]?.id
        if (onlyChildId) {
          saveSelectedChildSession(onlyChildId)
          setActiveChildId(onlyChildId)
          setSelectedChildCandidateId(onlyChildId)
          return
        }
      }

      if (hasActiveChild) {
        setActiveChildId(activeChildId)
        setSelectedChildCandidateId(activeChildId)
      } else {
        clearSelectedChildSession()
        setActiveChildId(null)
        setSelectedChildCandidateId((previous) =>
          previous && data.children.some((child) => child.id === previous)
            ? previous
            : data.children[0]?.id ?? null,
        )
      }
    } catch (error) {
      if (!options?.silent) {
        setErrorMessage(error instanceof Error ? error.message : 'Gagal memuat portal orang tua.')
      }
    } finally {
      if (!options?.silent && requestId === dashboardRequestIdRef.current) {
        setIsLoading(false)
      }
      if (options?.silent && requestId === dashboardRequestIdRef.current) {
        setIsBackgroundSyncing(false)
      }
    }
  }, [activeChildId, clearSelectedChildSession, saveSelectedChildSession])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    if (!dashboardData) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      if (isLinking) {
        return
      }
      void loadDashboard({ silent: true })
    }, PARENT_DASHBOARD_BACKGROUND_SYNC_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [dashboardData, isLinking, loadDashboard])

  useEffect(() => {
    window.localStorage.setItem(PARENT_THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    setExpandedReportId(null)
    setExpandedMessageReportId(null)
    setReportFilterMonth('')
    setReportFilterDate('')
    setExpandedFinanceId(null)
    setMessageDraftReportId(null)
    setIsParentMessageDirty(false)
    setNotificationDropdownOpen(false)
    setProfileEditOpen(false)
    setIsSavingProfileEdit(false)
    setProfileEditError(null)
    setProfileEditDraft(EMPTY_PROFILE_EDIT_DRAFT)
    setProfileEditChildDraft(EMPTY_CHILD_PROFILE_EDIT_DRAFT)
    setProfileEditFieldErrors({})
    setProfileEditSection('child')
    setPasswordEditorOpen(false)
    setPasswordChangeDraft(EMPTY_PARENT_PASSWORD_CHANGE_DRAFT)
    setIsSavingPasswordChange(false)
    setPasswordChangeError(null)
    setPasswordChangeSuccess(null)
  }, [activeChildId])

  useEffect(() => {
    if (activeMenu !== 'profile') {
      setProfileEditOpen(false)
      setProfileEditError(null)
      setProfileEditFieldErrors({})
      setPasswordEditorOpen(false)
      setPasswordChangeDraft(EMPTY_PARENT_PASSWORD_CHANGE_DRAFT)
      setPasswordChangeError(null)
      setPasswordChangeSuccess(null)
    }
  }, [activeMenu])

  const children = useMemo(
    () => dashboardData?.children ?? [],
    [dashboardData?.children],
  )
  const activeChild = useMemo(
    () => children.find((child) => child.id === activeChildId) ?? null,
    [activeChildId, children],
  )
  const reports = useMemo(() => {
    if (!activeChild) return []

    const rawAttendanceRecords = (dashboardData?.attendanceRecords ?? []) as Array<
      ParentDailyReport | null | undefined
    >

    return rawAttendanceRecords
      .filter((record): record is ParentDailyReport => {
        if (!record) {
          return false
        }
        return record.childId === activeChild.id
      })
      .sort((left, right) =>
        `${asText(right.date)}${asText(right.createdAt)}`.localeCompare(
          `${asText(left.date)}${asText(left.createdAt)}`,
          'id',
        ),
      )
  }, [activeChild, dashboardData?.attendanceRecords])
  const todayDateKey = useMemo(() => {
    const candidate = dashboardData?.todayDate
    if (candidate && ISO_DATE_PATTERN.test(candidate)) {
      return candidate
    }
    return new Date().toISOString().slice(0, 10)
  }, [dashboardData?.todayDate])
  const todayMonthKey = todayDateKey.slice(0, 7)
  const latestReportMonthKey = useMemo(() => {
    const latestDate = reports[0]?.date ?? ''
    return ISO_DATE_PATTERN.test(latestDate) ? latestDate.slice(0, 7) : ''
  }, [reports])
  const earliestReportMonthKey = useMemo(() => {
    const earliestDate = reports[reports.length - 1]?.date ?? ''
    return ISO_DATE_PATTERN.test(earliestDate) ? earliestDate.slice(0, 7) : todayMonthKey
  }, [reports, todayMonthKey])
  const activeReportFilterMonth = reportFilterMonth || latestReportMonthKey || todayMonthKey
  const reportDateBounds = useMemo(
    () => getMonthDateBounds(activeReportFilterMonth, todayDateKey),
    [activeReportFilterMonth, todayDateKey],
  )
  const recapReports = useMemo(() => {
    const reportsInMonth = reports.filter((report) =>
      asText(report.date).startsWith(activeReportFilterMonth),
    )
    if (reportFilterDate) {
      return reportsInMonth.filter((report) => asText(report.date) === reportFilterDate)
    }
    return reportsInMonth.slice(0, DAILY_REPORT_FALLBACK_LIMIT)
  }, [activeReportFilterMonth, reportFilterDate, reports])
  const reportFilterDescription = useMemo(() => {
    if (reportFilterDate) {
      return `Filter tanggal aktif: ${formatLongDate(reportFilterDate)}.`
    }
    return `Tanpa filter tanggal, rekap menampilkan maksimal ${DAILY_REPORT_FALLBACK_LIMIT} tanggal/laporan terakhir pada ${formatMonthYear(activeReportFilterMonth)}.`
  }, [activeReportFilterMonth, reportFilterDate])

  const todayReport = useMemo(() => {
    if (!activeChild) {
      return null
    }

    const fromDailyReports = dashboardData?.dailyReports?.[activeChild.id] ?? null
    if (fromDailyReports && asText(fromDailyReports.date) === todayDateKey) {
      return fromDailyReports
    }

    return reports.find((report) => asText(report.date) === todayDateKey) ?? null
  }, [activeChild, dashboardData?.dailyReports, reports, todayDateKey])
  const messageTargetReport = todayReport ?? reports[0] ?? null

  useEffect(() => {
    if (!reportFilterDate) {
      return
    }
    if (!reportFilterDate.startsWith(activeReportFilterMonth)) {
      setReportFilterDate('')
    }
  }, [activeReportFilterMonth, reportFilterDate])

  useEffect(() => {
    const targetReportId = messageTargetReport?.attendanceId ?? null
    const targetDraft = messageTargetReport?.parentMessage ?? ''

    if (targetReportId !== messageDraftReportId) {
      setParentMessageDraft(targetDraft)
      setMessageDraftReportId(targetReportId)
      setIsParentMessageDirty(false)
      setParentMessageSaveInfo(null)
      return
    }

    if (!isParentMessageDirty) {
      setParentMessageDraft(targetDraft)
    }

    setParentMessageSaveInfo(null)
  }, [
    activeChildId,
    isParentMessageDirty,
    messageDraftReportId,
    messageTargetReport?.attendanceId,
    messageTargetReport?.parentMessage,
  ])

  useEffect(() => {
    if (expandedReportId && !recapReports.some((report) => report.attendanceId === expandedReportId)) {
      setExpandedReportId(null)
      setExpandedMessageReportId(null)
      return
    }

    if (
      expandedMessageReportId &&
      !recapReports.some((report) => report.attendanceId === expandedMessageReportId)
    ) {
      setExpandedMessageReportId(null)
    }
  }, [expandedMessageReportId, expandedReportId, recapReports])

  useEffect(() => {
    if (!activeChild) {
      setWelcomePopupVisible(false)
      return
    }

    const storageKey = getParentWelcomePopupStorageKey(user.id)
    const hasShownPopup = window.localStorage.getItem(storageKey) === '1'
    if (hasShownPopup) {
      return
    }

    setWelcomePopupVisible(true)
  }, [activeChild, user.id])

  const billing = activeChild
    ? dashboardData?.billingByChild?.[activeChild.id] ?? null
    : null

  const parentAccount = dashboardData?.parentAccount ?? null
  const parentProfile = parentAccount?.parentProfile
  const inventoryItems = useMemo(() => {
    if (!activeChild) return []

    const fromInventory = dashboardData?.supplyInventoryByChild?.[activeChild.id] ?? []
    if (fromInventory.length > 0) {
      return fromInventory
    }

    return toSafeCarriedItems(todayReport?.carriedItems).map((item, index) => ({
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

  const paidTransactionsSorted = useMemo(
    () =>
      [...paidTransactions].sort((left, right) =>
        right.transactedAt.localeCompare(left.transactedAt, 'id'),
      ),
    [paidTransactions],
  )

  const billingPeriodsSorted = useMemo(
    () =>
      [...(billing?.periods ?? [])].sort((left, right) =>
        right.endDate.localeCompare(left.endDate, 'id'),
      ),
    [billing?.periods],
  )

  const reportsWithMessagesCount = useMemo(
    () =>
      reports.filter((report) =>
        hasText(report.parentMessage) || hasText(report.messageForParent),
      ).length,
    [reports],
  )

  const reportsWithNotesCount = useMemo(
    () => reports.filter((report) => hasText(report.departureNotes)).length,
    [reports],
  )

  const totalPaidAmount = useMemo(
    () => paidTransactions.reduce((sum, transaction) => sum + transaction.amount, 0),
    [paidTransactions],
  )

  const nextArrearsPeriod = useMemo(
    () =>
      [...arrearsPeriods].sort((left, right) =>
        left.endDate.localeCompare(right.endDate, 'id'),
      )[0] ?? null,
    [arrearsPeriods],
  )

  const latestPaymentByPeriod = useMemo(() => {
    const entries = new Map<string, ServiceBillingTransaction>()
    paidTransactionsSorted.forEach((transaction) => {
      if (!entries.has(transaction.periodId)) {
        entries.set(transaction.periodId, transaction)
      }
    })
    return entries
  }, [paidTransactionsSorted])

  const latestPaymentMethodByPeriod = useMemo(() => {
    const entries = new Map<string, string>()
    latestPaymentByPeriod.forEach((transaction, periodId) => {
      entries.set(periodId, normalizePaymentMethod(transaction.notes || ''))
    })
    return entries
  }, [latestPaymentByPeriod])

  const handleSelectChild = (childId: string) => {
    saveSelectedChildSession(childId)
    setActiveChildId(childId)
    setSelectedChildCandidateId(childId)
    setActiveMenu('dashboard')
    setLinkFormOpen(false)
    setParentMessageSaveInfo(null)
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
        setSelectedChildCandidateId(newlyLinkedChild.id)
        if (data.children.length === 1) {
          saveSelectedChildSession(newlyLinkedChild.id)
          setActiveChildId(newlyLinkedChild.id)
        } else {
          clearSelectedChildSession()
          setActiveChildId(null)
        }
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

  const handleChangeReportMonth = (nextMonth: string) => {
    if (!nextMonth) {
      return
    }

    setReportFilterMonth(nextMonth)
    setReportFilterDate((previous) => {
      if (!previous) {
        return previous
      }
      return previous.startsWith(nextMonth) ? previous : ''
    })
    setExpandedReportId(null)
    setExpandedMessageReportId(null)
  }

  const handleChangeReportDate = (nextDate: string) => {
    setReportFilterDate(nextDate)
    if (nextDate) {
      setReportFilterMonth(nextDate.slice(0, 7))
    }
    setExpandedReportId(null)
    setExpandedMessageReportId(null)
  }

  const closeWelcomePopup = () => {
    const storageKey = getParentWelcomePopupStorageKey(user.id)
    window.localStorage.setItem(storageKey, '1')
    setWelcomePopupVisible(false)
  }

  const handleSaveParentMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setParentMessageSaveInfo(null)
    setErrorMessage(null)

    if (!messageTargetReport?.attendanceId) {
      setErrorMessage('Data kehadiran belum tersedia untuk menyimpan pesan.')
      return
    }

    setIsSavingParentMessage(true)
    try {
      await parentApi.updateParentMessage({
        attendanceId: messageTargetReport.attendanceId,
        parentMessage: parentMessageDraft,
      })
      await loadDashboard({ silent: true })
      setMessageDraftReportId(messageTargetReport.attendanceId)
      setIsParentMessageDirty(false)
      setParentMessageSaveInfo('Pesan berhasil disimpan.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Gagal menyimpan pesan.')
    } finally {
      setIsSavingParentMessage(false)
    }
  }

  const toggleTheme = () => {
    setTheme((previous) => (previous === 'dark' ? 'light' : 'dark'))
  }

  const todaysActivityPhotos = useMemo<ParentActivityPhoto[]>(() => {
    if (!todayReport || !dashboardData?.todayDate || todayReport.date !== dashboardData.todayDate) {
      return []
    }

    return toSafeCarriedItems(todayReport.carriedItems)
      .filter((item) => hasText(item.imageDataUrl))
      .slice(0, 5)
      .map((item, index) => ({
        id: item.id || `activity-${index}`,
        imageUrl: item.imageDataUrl,
        caption: hasText(item.description) ? item.description : item.category || `Aktivitas ${index + 1}`,
        imageName: item.imageName || `kegiatan-${todayReport.date}-${index + 1}.jpg`,
      }))
  }, [dashboardData?.todayDate, todayReport])

  const totalOutstanding = billing?.summary?.totalOutstanding ?? 0
  const dashboardSyncLabel = isBackgroundSyncing
    ? 'Sinkronisasi data...'
    : lastSyncedAt
      ? `Sinkron terakhir ${formatClockTime(lastSyncedAt)}`
      : 'Menunggu sinkronisasi data'

  const dashboardAlerts = useMemo<DashboardAlertItem[]>(() => {
    const alerts: DashboardAlertItem[] = []

    if (lowStockItems.length > 0) {
      const lowStockSignature = lowStockItems
        .map((item) => item.id)
        .sort((left, right) => left.localeCompare(right, 'id'))
        .join('|')
      alerts.push({
        id: 'inventory',
        tone: 'warning',
        title: 'Inventori menipis',
        description: `${lowStockItems.length} item perlu segera dilengkapi.`,
        icon: Package,
        unreadKey: `inventory:${lowStockItems.length}:${lowStockSignature}`,
        targetMenu: 'inventory',
        action: 'open-menu',
      })
    }

    if (totalOutstanding > 0) {
      alerts.push({
        id: 'billing',
        tone: 'danger',
        title: 'Tagihan aktif',
        description: `Total sisa tagihan saat ini ${formatCurrency(totalOutstanding)}.`,
        icon: Wallet,
        unreadKey: `billing:${Math.round(totalOutstanding)}`,
        alwaysUnread: true,
        targetMenu: 'billing',
        action: 'open-menu',
      })
    }

    if (hasText(todayReport?.messageForParent)) {
      const latestMessage = asText(todayReport?.messageForParent).trim()
      alerts.push({
        id: 'message',
        tone: 'info',
        title: 'Pesan baru dari petugas',
        description: 'Buka kartu Komunikasi untuk membaca balasan terbaru.',
        icon: MessageSquare,
        unreadKey: `message:${todayReport?.attendanceId || ''}:${todayReport?.updatedAt || ''}:${latestMessage}`,
        targetMenu: 'dashboard',
        action: 'open-latest-reply',
      })
    }

    return alerts
  }, [lowStockItems, todayReport?.attendanceId, todayReport?.messageForParent, todayReport?.updatedAt, totalOutstanding])

  const unreadNotificationCount = useMemo(() => {
    return dashboardAlerts.filter(
      (alert) => alert.alwaysUnread || !readNotificationKeys.includes(alert.unreadKey),
    ).length
  }, [dashboardAlerts, readNotificationKeys])

  const hasUnreadNotifications = unreadNotificationCount > 0

  useEffect(() => {
    setReadNotificationKeys((previous) =>
      previous.filter((key) => dashboardAlerts.some((alert) => alert.unreadKey === key)),
    )
  }, [dashboardAlerts])

  useEffect(() => {
    if (!isNotificationDropdownOpen) {
      return
    }
    setReadNotificationKeys((previous) => {
      const next = new Set(previous)
      dashboardAlerts.forEach((alert) => {
        if (!alert.alwaysUnread) {
          next.add(alert.unreadKey)
        }
      })
      return Array.from(next)
    })
  }, [dashboardAlerts, isNotificationDropdownOpen])

  useEffect(() => {
    if (!isNotificationDropdownOpen) {
      return undefined
    }

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (!target) {
        return
      }
      if (notificationPanelRef.current?.contains(target)) {
        return
      }
      setNotificationDropdownOpen(false)
    }

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNotificationDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('touchstart', handleOutsideClick)
    document.addEventListener('keydown', handleEscapeKey)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('touchstart', handleOutsideClick)
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [isNotificationDropdownOpen])

  const handleToggleNotificationDropdown = () => {
    setNotificationDropdownOpen((previous) => !previous)
  }

  const scrollToDashboardTarget = (
    resolveTarget: () => HTMLElement | null,
    options?: { block?: ScrollLogicalPosition; focus?: boolean },
  ) => {
    let attempts = 0
    const maxAttempts = 8

    const tryScroll = () => {
      const target = resolveTarget()
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: options?.block || 'center' })
        if (options?.focus) {
          target.focus({ preventScroll: true })
        }
        return
      }

      if (attempts >= maxAttempts) {
        return
      }

      attempts += 1
      window.requestAnimationFrame(tryScroll)
    }

    window.requestAnimationFrame(tryScroll)
  }

  const handleOpenLatestReply = () => {
    setActiveMenu('dashboard')
    scrollToDashboardTarget(
      () => messageReplyRef.current ?? messageEditorRef.current,
      { block: 'start' },
    )
  }

  const handleOpenMessageComposer = () => {
    setActiveMenu('dashboard')
    scrollToDashboardTarget(
      () => messageEditorRef.current,
      { block: 'center', focus: true },
    )
  }

  const handleDashboardAlertClick = (alert: DashboardAlertItem) => {
    setNotificationDropdownOpen(false)

    if (alert.action === 'open-latest-reply') {
      handleOpenLatestReply()
      return
    }

    setActiveMenu(alert.targetMenu)
  }

  const renderNotificationDropdown = () => {
    return (
      <div className="parent-solid-notification-dropdown" role="menu" aria-label="Daftar notifikasi">
        <div className="parent-solid-notification-dropdown__header">
          <strong>Notifikasi</strong>
          <span>{dashboardAlerts.length} item</span>
        </div>

        {dashboardAlerts.length === 0 ? (
          <p className="parent-solid-notification-dropdown__empty">Belum ada notifikasi.</p>
        ) : (
          <div className="parent-solid-notification-dropdown__list">
            {dashboardAlerts.map((alert) => {
              const AlertIcon = alert.icon
              return (
                <button
                  type="button"
                  key={alert.unreadKey}
                  className={`parent-solid-notification-dropdown__item parent-solid-notification-dropdown__item--${alert.tone}`}
                  onClick={() => handleDashboardAlertClick(alert)}
                  role="menuitem"
                >
                  <span className="parent-solid-notification-dropdown__icon" aria-hidden="true">
                    <AlertIcon size={16} />
                  </span>
                  <div className="parent-solid-notification-dropdown__content">
                    <strong>{alert.title}</strong>
                    <p>{alert.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
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
        <h4 className="parent-solid-status-card__title">{params.title}</h4>
        <div className="parent-solid-status-card__meta-row">
          <div>
            <span>Jam</span>
            <strong>{formatTime(params.time)}</strong>
          </div>
          <div>
            <span>{params.state === 'arrival' ? 'Pengantar' : 'Penjemput'}</span>
            <strong>{params.personName || '-'}</strong>
          </div>
        </div>
        <div className="parent-solid-status-card__divider" />
        <div className="parent-solid-status-card__condition">
          <span>Kondisi Anak</span>
          <strong>
            {params.physical || '-'} | {params.emotional || '-'}
          </strong>
        </div>
      </article>
    )
  }

  const renderCarriedItemList = (items: CarriedItem[], emptyLabel: string) => {
    if (items.length === 0) {
      return <p className="parent-solid-empty">{emptyLabel}</p>
    }

    return (
      <ul className="parent-solid-carried-list parent-solid-carried-list--report">
        {items.map((item, index) => (
          <li key={`${item.id || item.category}-${index}`}>
            <strong>{item.category || `Barang ${index + 1}`}</strong>
            <span>{item.description || '-'}</span>
          </li>
        ))}
      </ul>
    )
  }

  const renderDashboard = () => {
    const todayCarriedItems = toSafeCarriedItems(todayReport?.carriedItems)
    const todayLabel = formatLongDateWithWeekday(
      dashboardData?.todayDate || new Date().toISOString().slice(0, 10),
    )
    const dayLabel = new Date().toLocaleDateString('id-ID', { weekday: 'long' })
    const hasNewMessage = hasText(todayReport?.messageForParent)

    return (
      <section className="parent-solid-section parent-solid-section--stacked parent-solid-home-shell">
        <article className="parent-solid-card parent-solid-card--hero">
          <div className="parent-solid-home-hero">
            <div className="parent-solid-home-hero__identity">
              {activeChild?.photoDataUrl ? (
                <img
                  src={activeChild.photoDataUrl}
                  alt={activeChild.fullName}
                  className="parent-solid-home-hero__avatar"
                />
              ) : (
                <div className="parent-solid-home-hero__avatar parent-solid-home-hero__avatar--placeholder">
                  {getInitials(activeChild?.fullName || 'A')}
                </div>
              )}
              <div className="parent-solid-home-hero__copy">
                <span className="parent-solid-home-hero__eyebrow">Ringkasan Monitoring</span>
                <h2>{activeChild?.fullName || 'Anak'}</h2>
                <p>{getAgeLabel(activeChild?.birthDate || '')} • {dashboardSyncLabel}</p>
              </div>
            </div>
            <div className="parent-solid-home-hero__date">
              <span>{dayLabel}</span>
              <strong>{todayLabel}</strong>
            </div>
          </div>
        </article>

        <div className="parent-solid-quick-status-grid">
          <button
            type="button"
            className={`parent-solid-quick-status-card parent-solid-quick-status-card--message ${
              hasNewMessage ? 'has-message' : 'is-pending'
            }`}
            onClick={hasNewMessage ? handleOpenLatestReply : handleOpenMessageComposer}
          >
            <div className="parent-solid-quick-status-card__header">
              <span className="parent-solid-quick-status-card__icon" aria-hidden="true">
                <MessageSquare size={17} />
              </span>
              <span className="parent-solid-quick-status-card__label">Pesan</span>
            </div>
            <strong className="parent-solid-quick-status-card__value">
              {hasNewMessage ? 'Ada Pesan Baru' : 'Belum Ada Pesan Baru'}
            </strong>
            <p className="parent-solid-quick-status-card__hint">
              {hasNewMessage ? 'Klik untuk baca balasan petugas' : 'Klik untuk kirim pesan ke petugas'}
            </p>
            {hasNewMessage ? (
              <p className="parent-solid-quick-status-card__snippet">{asText(todayReport?.messageForParent).trim()}</p>
            ) : null}
          </button>
        </div>

        <div className="parent-solid-home-grid">
          <article className="parent-solid-card parent-solid-card--attendance-detail">
            <div className="parent-solid-card__header">
              <h3>Datang & Pulang</h3>
            </div>

            <div className="parent-solid-attendance-grid">
              <div className={`parent-solid-attendance-card ${todayReport?.arrivalTime ? 'is-arrived' : 'is-pending'}`}>
                <div className="parent-solid-attendance-card__header">
                  <span className="parent-solid-attendance-card__icon" aria-hidden="true">
                    <MapPin size={18} />
                  </span>
                  <strong>Datang</strong>
                </div>
                <div className="parent-solid-attendance-card__time">
                  {todayReport?.arrivalTime ? formatTime(todayReport.arrivalTime) : '--:--'}
                </div>
                <div className="parent-solid-attendance-card__details">
                  <div>
                    <span>Pengantar</span>
                    <strong>{todayReport?.escortName || '-'}</strong>
                  </div>
                  <div>
                    <span>Kondisi Fisik</span>
                    <strong>{todayReport?.arrivalPhysicalCondition || '-'}</strong>
                  </div>
                  <div>
                    <span>Kondisi Emosi</span>
                    <strong>{todayReport?.arrivalEmotionalCondition || '-'}</strong>
                  </div>
                </div>
              </div>

              <div className={`parent-solid-attendance-card ${todayReport?.departureTime ? 'is-departed' : 'is-pending'}`}>
                <div className="parent-solid-attendance-card__header">
                  <span className="parent-solid-attendance-card__icon" aria-hidden="true">
                    <House size={18} />
                  </span>
                  <strong>Pulang</strong>
                </div>
                <div className="parent-solid-attendance-card__time">
                  {todayReport?.departureTime ? formatTime(todayReport.departureTime) : '--:--'}
                </div>
                <div className="parent-solid-attendance-card__details">
                  <div>
                    <span>Penjemput</span>
                    <strong>{todayReport?.pickupName || '-'}</strong>
                  </div>
                  <div>
                    <span>Kondisi Fisik</span>
                    <strong>{todayReport?.departurePhysicalCondition || '-'}</strong>
                  </div>
                  <div>
                    <span>Kondisi Emosi</span>
                    <strong>{todayReport?.departureEmotionalCondition || '-'}</strong>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <article className="parent-solid-card parent-solid-card--communication">
            <div className="parent-solid-card__header">
              <h3>Komunikasi</h3>
              <button
                type="button"
                className="parent-solid-inline-button"
                onClick={handleOpenMessageComposer}
              >
                Fokus Pesan
              </button>
            </div>

            <div className="parent-solid-communication-grid parent-solid-communication-grid--single">
              <div className="parent-solid-communication-box parent-solid-communication-box--sent">
                {hasNewMessage ? (
                  <div ref={messageReplyRef} className="parent-solid-message-reply-inline" tabIndex={-1}>
                    <div className="parent-solid-message-reply-inline__header">
                      <MessageSquare size={14} />
                      <strong>Pesan Terbaru dari Petugas</strong>
                    </div>
                    <p>{todayReport?.messageForParent}</p>
                  </div>
                ) : null}

                <div className="parent-solid-communication-box__header">
                  <SendHorizontal size={16} />
                  <strong>Pesan untuk Petugas</strong>
                </div>
                <form className="parent-solid-message-form" onSubmit={handleSaveParentMessage}>
                  <textarea
                    ref={messageEditorRef}
                    className="parent-solid-message-input"
                    placeholder="Tulis pesan untuk petugas..."
                    value={parentMessageDraft}
                    onChange={(event) => {
                      setParentMessageDraft(event.target.value)
                      setIsParentMessageDirty(true)
                      if (parentMessageSaveInfo) {
                        setParentMessageSaveInfo(null)
                      }
                    }}
                    disabled={isSavingParentMessage || !messageTargetReport}
                  />
                  <div className="parent-solid-message-form__footer">
                    {parentMessageSaveInfo && (
                      <span className="parent-solid-message-form__success">{parentMessageSaveInfo}</span>
                    )}
                    <button
                      type="submit"
                      className="parent-solid-button parent-solid-button--primary"
                      disabled={isSavingParentMessage || !messageTargetReport}
                    >
                      {isSavingParentMessage ? 'Menyimpan...' : 'Kirim Pesan'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </article>
        </div>

        <div className="parent-solid-home-grid parent-solid-home-grid--media">
        <article className="parent-solid-card parent-solid-card--carried">
          <div className="parent-solid-card__header">
            <h3>Barang Bawaan</h3>
            {todayCarriedItems.length > 0 && (
              <span className="parent-solid-card__badge">{todayCarriedItems.length} item</span>
            )}
          </div>

          {todayCarriedItems.length > 0 ? (
            <div className="parent-solid-carried-grid">
              {todayCarriedItems.map((item, index) => (
                <div key={item.id || index} className="parent-solid-carried-item">
                  {item.imageDataUrl ? (
                    <img src={item.imageDataUrl} alt={item.category} className="parent-solid-carried-item__image" />
                  ) : (
                    <div className="parent-solid-carried-item__placeholder">
                      <Package size={24} />
                    </div>
                  )}
                  <div className="parent-solid-carried-item__info">
                    <strong>{item.category || `Barang ${index + 1}`}</strong>
                    <p>{item.description || '-'}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="parent-solid-empty-state">
              <Package size={28} />
              <p>Belum ada data barang bawaan hari ini</p>
            </div>
          )}
        </article>

        <article className="parent-solid-card parent-solid-card--activity">
          <div className="parent-solid-card__header">
            <h3>Foto Kegiatan Hari Ini</h3>
            {todaysActivityPhotos.length > 0 && (
              <span className="parent-solid-card__badge">{todaysActivityPhotos.length} foto</span>
            )}
          </div>

          {todaysActivityPhotos.length > 0 ? (
            <div className="parent-solid-activity-grid">
              {todaysActivityPhotos.map((photo, index) => (
                <div key={photo.id} className="parent-solid-activity-item">
                  <img src={photo.imageUrl} alt={`Aktivitas ${index + 1}`} className="parent-solid-activity-item__image" />
                  <div className="parent-solid-activity-item__overlay">
                    <p>{photo.caption}</p>
                    <a
                      href={photo.imageUrl}
                      download={photo.imageName}
                      className="parent-solid-activity-item__download"
                    >
                      Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="parent-solid-empty-state">
              <Camera size={28} />
              <p>Belum ada foto kegiatan hari ini</p>
            </div>
          )}
        </article>
        </div>
      </section>
    )
  }

  const renderDailyLogs = () => {
    const latestReport = reports[0] ?? null

    return (
      <section className="parent-solid-section parent-solid-section--stacked">
        <article className="parent-solid-page-head parent-solid-page-head--report">
          <h2>Laporan Harian Anak</h2>
          <p>
            {`Pantau riwayat kehadiran dan komunikasi untuk ${activeChild?.fullName || 'anak'}.`}
          </p>
        </article>

        <div className="parent-solid-summary-grid parent-solid-summary-grid--report">
          <article className="parent-solid-summary-card">
            <div className="parent-solid-summary-card__icon" aria-hidden="true">
              <ScrollText size={16} />
            </div>
            <span>Total Laporan</span>
            <strong>{reports.length}</strong>
            <p>
              {latestReport
                ? `Terbaru: ${formatLongDate(latestReport.date)}`
                : 'Belum ada laporan harian.'}
            </p>
          </article>
          <article className="parent-solid-summary-card">
            <div className="parent-solid-summary-card__icon" aria-hidden="true">
              <MessageSquare size={16} />
            </div>
            <span>Komunikasi Aktif</span>
            <strong>{reportsWithMessagesCount}</strong>
            <p>{`${reportsWithNotesCount} laporan berisi catatan pulang dari petugas.`}</p>
          </article>
        </div>

        <article className="parent-solid-card parent-solid-card--report-hub">
          <div className="parent-solid-card__header">
            <div>
              <h3>Inventori Pendukung Laporan</h3>
              <p className="parent-solid-card__lead">
                {`Persediaan kebutuhan ${activeChild?.fullName || 'anak'} untuk aktivitas harian di TPA.`}
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
              Peringatan: {lowStockItems.length} barang memiliki stok menipis.
            </p>
          ) : (
            <p className="parent-solid-empty">Seluruh stok inventori anak masih aman.</p>
          )}
        </article>

        <article className="parent-solid-card">
          <div className="parent-solid-card__header parent-solid-card__header--stack">
            <h3>Rekap Laporan Harian</h3>
            <p className="parent-solid-card__lead">
              Klik tanggal untuk membuka detail kehadiran, pesan, dan barang bawaan.
            </p>
            <div className="parent-solid-report-filter-grid">
              <div className="parent-solid-report-filter-field">
                <label htmlFor="parent-report-filter-month">Bulan / Tahun</label>
                <AppMonthPickerField
                  id="parent-report-filter-month"
                  value={activeReportFilterMonth}
                  min={earliestReportMonthKey}
                  max={todayMonthKey}
                  onChange={handleChangeReportMonth}
                  allowEmpty={false}
                />
              </div>
              <div className="parent-solid-report-filter-field">
                <label htmlFor="parent-report-filter-date">Tanggal (Harian)</label>
                <AppDatePickerField
                  id="parent-report-filter-date"
                  value={reportFilterDate}
                  min={reportDateBounds.min}
                  max={reportDateBounds.max}
                  onChange={handleChangeReportDate}
                />
              </div>
            </div>
            <p className="parent-solid-report-filter-note">{reportFilterDescription}</p>
          </div>

          {reports.length === 0 ? (
            <p className="parent-solid-empty">Belum ada laporan harian.</p>
          ) : recapReports.length === 0 ? (
            <p className="parent-solid-empty">Tidak ada laporan pada filter yang dipilih.</p>
          ) : (
            <div className="parent-solid-report-list">
              {recapReports.map((report) => {
                const isExpanded = expandedReportId === report.attendanceId
                const isMessageExpanded = expandedMessageReportId === report.attendanceId
                const activitySummary = createActivitySummary(report)
                const reportCarriedItems = toSafeCarriedItems(report.carriedItems)

                return (
                  <article
                    key={report.attendanceId}
                    className={`parent-solid-report-item ${isExpanded ? 'is-open' : ''}`}
                  >
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
                        <strong>{formatLongDateWithWeekday(report.date)}</strong>
                        <div className="parent-solid-report-item__summary-row">
                          <span className="parent-solid-report-item__summary-arrival">
                            {`Datang ${formatTime(report.arrivalTime)}`}
                          </span>
                          <span className="parent-solid-report-item__summary-departure">
                            {`Pulang ${formatTime(report.departureTime)}`}
                          </span>
                          {hasText(report.parentMessage) || hasText(report.messageForParent) ? (
                            <span className="parent-solid-report-item__summary-chip">Ada pesan</span>
                          ) : null}
                          {hasText(report.departureNotes) ? (
                            <span className="parent-solid-report-item__summary-chip parent-solid-report-item__summary-chip--note">
                              Catatan pulang
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <p className="parent-solid-report-item__updated">
                      {`Pengantar: ${report.escortName || '-'} • Penjemput: ${report.pickupName || '-'} • Diperbarui ${formatDateTime(report.updatedAt)}`}
                    </p>

                    {isExpanded ? (
                      <div className="parent-solid-report-item__dropdown">
                        <div className="parent-solid-grid parent-solid-grid--status parent-solid-grid--status-report">
                          {renderStatusCard({
                            title: 'Status Datang',
                            state: 'arrival',
                            time: report.arrivalTime,
                            personName: report.escortName,
                            physical: report.arrivalPhysicalCondition,
                            emotional: report.arrivalEmotionalCondition,
                          })}
                          {renderStatusCard({
                            title: 'Status Pulang',
                            state: 'departure',
                            time: report.departureTime,
                            personName: report.pickupName,
                            physical: report.departurePhysicalCondition,
                            emotional: report.departureEmotionalCondition,
                          })}
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
                                <label>Pesan Ayah/Bunda untuk Petugas</label>
                                <p>{hasText(report.parentMessage) ? report.parentMessage : 'Belum ada pesan untuk petugas.'}</p>
                              </div>
                              <div className="parent-solid-message-box">
                                <label>Pesan Petugas untuk Ayah/Bunda</label>
                                <p>{hasText(report.messageForParent) ? report.messageForParent : 'Belum ada pesan dari petugas.'}</p>
                              </div>
                            </div>
                          ) : null}
                        </article>

                        <article className="parent-solid-card parent-solid-card--nested">
                          <h4>Catatan Petugas Saat Pulang</h4>
                          <p className="parent-solid-note">
                            {hasText(report.departureNotes)
                              ? report.departureNotes
                              : 'Belum ada catatan tambahan saat penjemputan.'}
                          </p>
                        </article>

                        <article className="parent-solid-card parent-solid-card--nested">
                          <h4>Barang Bawaan</h4>
                          {renderCarriedItemList(
                            reportCarriedItems,
                            'Tidak ada detail barang bawaan.',
                          )}
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
            <h3>INVENTORI</h3>
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
            Peringatan: {lowStockItems.length} barang memiliki stok menipis.
          </p>
        ) : null}

        {inventoryItems.length === 0 ? (
          <p className="parent-solid-empty">Belum ada data inventori anak.</p>
        ) : (
          <div className="parent-solid-inventory-shop-grid">
            {inventoryItems.map((item) => (
              <article key={item.id} className="parent-solid-inventory-shop-card">
                <div className="parent-solid-inventory-shop-card__image-wrap">
                  {item.imageDataUrl ? (
                    <img src={item.imageDataUrl} alt={item.productName} />
                  ) : (
                    <span>Tidak ada foto</span>
                  )}
                </div>
                <div className="parent-solid-inventory-shop-card__meta">
                  <strong>{item.productName}</strong>
                  <span>{`Sisa stok: ${item.quantity}`}</span>
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
    title: string
    subtitle: string
    totalPaid: number
    totalDue: number
    packageLabel: string
    outstandingAmount: number
    paymentMethod: string
  }) => {
    const isExpanded = expandedFinanceId === params.id
    const isSettled = params.outstandingAmount <= 0

    return (
      <article className={`parent-solid-finance-disclosure ${isExpanded ? 'is-open' : ''}`}>
        <button
          type="button"
          className="parent-solid-finance-disclosure__trigger"
          onClick={() =>
            setExpandedFinanceId((previous) => (previous === params.id ? null : params.id))
          }
        >
          <div className="parent-solid-finance-disclosure__heading">
            <strong>{params.title}</strong>
            <small>{params.subtitle}</small>
          </div>
          <div className="parent-solid-finance-disclosure__summary">
            <span
              className={`parent-solid-finance-disclosure__pill ${
                isSettled ? 'is-settled' : 'is-outstanding'
              }`}
            >
              {isSettled ? 'Lunas' : 'Belum Lunas'}
            </span>
            <span className="parent-solid-finance-disclosure__trigger-total">
              {formatCurrency(params.totalPaid)}
            </span>
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
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
              <div>
                <span>Total Tagihan</span>
                <strong>{formatCurrency(params.totalDue)}</strong>
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
      <article className="parent-solid-page-head parent-solid-page-head--finance">
        <h2>Ringkasan Keuangan</h2>
        <p>
          {`Monitoring pembayaran layanan ${activeChild?.fullName || 'anak'} berikut status tagihan yang masih berjalan.`}
        </p>
      </article>

      <div className="parent-solid-summary-grid parent-solid-summary-grid--finance">
        <article
          className={`parent-solid-summary-card parent-solid-summary-card--arrears ${
            arrearsPeriods.length > 0 ? 'has-arrears' : 'is-clear'
          }`}
        >
          <div className="parent-solid-summary-card__icon" aria-hidden="true">
            <Wallet size={16} />
          </div>
          <span>Tunggakan Aktif</span>
          <strong>{formatCurrency(billing?.summary?.totalOutstanding ?? 0)}</strong>
          <p>
            {arrearsPeriods.length > 0
              ? `${arrearsPeriods.length} periode belum lunas${
                  nextArrearsPeriod
                    ? `, jatuh tempo terdekat ${formatLongDate(nextArrearsPeriod.endDate || nextArrearsPeriod.startDate)}.`
                    : '.'
                }`
              : 'Tidak ada tunggakan aktif.'}
          </p>
        </article>
        <article className="parent-solid-summary-card parent-solid-summary-card--payment">
          <div className="parent-solid-summary-card__icon" aria-hidden="true">
            <CreditCard size={16} />
          </div>
          <span>Pembayaran Tercatat</span>
          <strong>{formatCurrency(totalPaidAmount)}</strong>
          <p>
            {paidTransactionsSorted[0]
              ? `Total ${paidTransactionsSorted.length} transaksi, terakhir ${formatLongDate(paidTransactionsSorted[0].transactedAt)}.`
              : 'Belum ada transaksi pembayaran.'}
          </p>
        </article>
      </div>

      <article className="parent-solid-card parent-solid-card--finance parent-solid-card--recap">
        <div className="parent-solid-card__header parent-solid-card__header--stack">
          <h3>Rekap Pembayaran</h3>
          <p className="parent-solid-card__lead">
            {billingPeriodsSorted.length > 0
              ? `${billingPeriodsSorted.length} periode tercatat. Buka setiap periode untuk melihat detail pembayaran.`
              : 'Data periode pembayaran belum tersedia.'}
          </p>
        </div>

        {billingPeriodsSorted.length === 0 ? (
          <p className="parent-solid-empty">Belum ada data rekap pembayaran.</p>
        ) : (
          <div className="parent-solid-finance-detail">
            {billingPeriodsSorted.map((period) => {
              const latestPayment = latestPaymentByPeriod.get(period.id)
              const isOutstanding = period.outstandingAmount > 0
              return (
                <div key={period.id}>
                  {renderFinanceDisclosure({
                    id: `period-${period.id}`,
                    title: `Periode ${formatDateRange(period.startDate, period.endDate)}`,
                    subtitle: isOutstanding
                      ? `Tunggakan ${formatCurrency(period.outstandingAmount)}. Jatuh tempo ${formatLongDate(period.endDate || period.startDate)}`
                      : latestPayment
                        ? `Lunas pada ${formatLongDate(latestPayment.transactedAt)}`
                        : 'Periode tercatat tanpa tunggakan.',
                    totalPaid: period.paidAmount,
                    totalDue:
                      period.dueAmount > 0
                        ? period.dueAmount
                        : Math.max(period.paidAmount + period.outstandingAmount, 0),
                    packageLabel: formatPackage(period.packageKey),
                    outstandingAmount: period.outstandingAmount,
                    paymentMethod: latestPaymentMethodByPeriod.get(period.id) || '-',
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
    const pickupPersons = Array.isArray(activeChild.pickupPersons)
      ? activeChild.pickupPersons.filter((person) => typeof person === 'string' && person.trim().length > 0)
      : []
    const toDisplayValue = (value: string) => (hasText(value) ? value : '-')
    const birthDateLabel = formatLongDate(activeChild.birthDate)
    const birthInfo = [toDisplayValue(activeChild.birthPlace), birthDateLabel]
      .filter((part) => part !== '-')
      .join(', ') || '-'
    const fullAgeLabel = getAgeLabel(activeChild.birthDate)
    const compactAgeLabel = (() => {
      if (fullAgeLabel === '-') return '-'
      const yearMatch = fullAgeLabel.match(/^(\d+)\s+tahun/i)
      if (yearMatch?.[1]) {
        return yearMatch[1]
      }
      const monthMatch = fullAgeLabel.match(/^(\d+)\s+bulan/i)
      if (monthMatch?.[1]) {
        return `${monthMatch[1]} bln`
      }
      return fullAgeLabel
    })()
    const normalizedChildId = activeChild.id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    const childProfileCode = `IDN-${(normalizedChildId.slice(-4) || '0000').padStart(4, '0')}`
    const parentGuardianLabel =
      [parentProfile?.fatherName, parentProfile?.motherName]
        .map((name) => asText(name).trim())
        .filter(Boolean)
        .join(' / ') || 'Orang tua / wali'
    const profileEditIdLabel = `ID Anak: ${childProfileCode}`
    const profileEditPickupPersonsLabel = profileEditChildDraft.pickupPersons.join(', ')

    const openProfileEditDialog = () => {
      setProfileEditDraft({
        fatherName: parentProfile?.fatherName || '',
        motherName: parentProfile?.motherName || '',
        email: parentProfile?.email || user.email || '',
        whatsappNumber: parentProfile?.whatsappNumber || '',
        homePhone: parentProfile?.homePhone || '',
        otherPhone: parentProfile?.otherPhone || '',
        homeAddress: parentProfile?.homeAddress || '',
        officeAddress: parentProfile?.officeAddress || '',
      })
      setProfileEditChildDraft(toChildProfileInput(activeChild, parentProfile))
      setProfileEditFieldErrors({})
      setProfileEditError(null)
      setProfileEditSection('child')
      setProfileEditOpen(true)
    }

    const closeProfileEditDialog = () => {
      if (isSavingProfileEdit) {
        return
      }
      setProfileEditOpen(false)
      setProfileEditError(null)
      setProfileEditFieldErrors({})
    }

    const updateProfileEditField = (field: keyof ParentProfileEditDraft, value: string) => {
      setProfileEditDraft((previous) => ({
        ...previous,
        [field]: value,
      }))
      setProfileEditFieldErrors((previous) => {
        const next = { ...previous }
        delete next.parentEmail
        delete next.email
        return next
      })
    }

    const updateChildProfileEditField = <K extends keyof ChildProfileInput>(
      field: K,
      value: ChildProfileInput[K],
    ) => {
      setProfileEditChildDraft((previous) => ({
        ...previous,
        [field]: value,
      }))
      setProfileEditFieldErrors((previous) => {
        const next = { ...previous }
        delete next[String(field)]
        return next
      })
    }

    const handleProfilePhotoUpload = (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      const normalizedMimeType = file.type.toLowerCase()
      const normalizedFileName = file.name.toLowerCase()
      const isSupportedByMime = SUPPORTED_CHILD_PHOTO_MIME_TYPES.has(normalizedMimeType)
      const isSupportedByExtension = SUPPORTED_CHILD_PHOTO_EXTENSIONS.some((extension) =>
        normalizedFileName.endsWith(extension),
      )

      if (!isSupportedByMime && !isSupportedByExtension) {
        setProfileEditFieldErrors((previous) => ({
          ...previous,
          photoDataUrl: 'Format foto tidak didukung. Gunakan JPG, JPEG, PNG, WEBP, GIF, atau AVIF.',
        }))
        event.target.value = ''
        return
      }

      if (file.size > MAX_CHILD_PHOTO_FILE_SIZE_BYTES) {
        setProfileEditFieldErrors((previous) => ({
          ...previous,
          photoDataUrl: 'Ukuran foto maksimal 12 MB.',
        }))
        event.target.value = ''
        return
      }

      const reader = new FileReader()
      reader.onload = (loadEvent) => {
        updateChildProfileEditField('photoDataUrl', (loadEvent.target?.result as string) || '')
      }
      reader.onerror = () => {
        setProfileEditFieldErrors((previous) => ({
          ...previous,
          photoDataUrl: 'Foto anak tidak dapat dibaca. Pilih file lain.',
        }))
        event.target.value = ''
      }
      reader.readAsDataURL(file)
    }

    const handleRemoveProfilePhoto = () => {
      updateChildProfileEditField('photoDataUrl', '')
      if (profileEditPhotoInputRef.current) {
        profileEditPhotoInputRef.current.value = ''
      }
    }

    const profileEditSections: Array<{
      key: ProfileEditSectionKey
      label: string
      icon: LucideIcon
      description: string
    }> = [
      {
        key: 'child',
        label: 'Biodata Anak',
        icon: UserRound,
        description: 'Perbarui identitas dasar dan informasi kelahiran anak.',
      },
      {
        key: 'parent',
        label: 'Biodata Orang Tua',
        icon: Users,
        description: 'Perbarui kontak utama orang tua dan wali.',
      },
      {
        key: 'service',
        label: 'Data Layanan',
        icon: CreditCard,
        description: 'Atur paket, jadwal, penjemput, dan kebutuhan layanan.',
      },
      {
        key: 'development',
        label: 'Kesehatan',
        icon: HeartPulse,
        description: 'Lengkapi catatan kesehatan dan riwayat perkembangan anak.',
      },
      {
        key: 'habits',
        label: 'Kebiasaan',
        icon: ScrollText,
        description: 'Atur rutinitas harian anak untuk referensi pengasuhan di TPA.',
      },
    ]

    const activeProfileEditSectionMeta =
      profileEditSections.find((section) => section.key === profileEditSection) ??
      profileEditSections[0]
    const getProfileEditSectionFromField = (field: string): ProfileEditSectionKey => {
      if (field === 'photoDataUrl') return 'child'
      if (
        [
          'fullName',
          'nickName',
          'gender',
          'birthPlace',
          'birthDate',
          'childOrder',
          'religion',
          'allergy',
        ].includes(field)
      ) {
        return 'child'
      }
      if (
        [
          'fatherName',
          'motherName',
          'email',
          'parentEmail',
          'whatsappNumber',
          'homePhone',
          'otherPhone',
          'homeAddress',
          'officeAddress',
        ].includes(field)
      ) {
        return 'parent'
      }
      if (
        [
          'servicePackage',
          'serviceStartDate',
          'arrivalTime',
          'departureTime',
          'pickupPersons',
          'depositPurpose',
          'outsideActivities',
        ].includes(field)
      ) {
        return 'service'
      }
      if (
        [
          'prenatalPeriod',
          'partusPeriod',
          'postNatalPeriod',
          'motorSkill',
          'languageSkill',
          'healthHistory',
        ].includes(field)
      ) {
        return 'development'
      }
      return 'habits'
    }

    const renderProfileEditField = (params: {
      label: string
      value: string
      onChange: (value: string) => void
      type?: string
      placeholder?: string
      autoComplete?: string
      error?: string
      hint?: string
      className?: string
    }) => (
      <label
        className={`parent-solid-profile-edit-field ${params.className || ''}`.trim()}
      >
        <span className="parent-solid-profile-edit-field__label">{params.label}</span>
        <span className={`parent-solid-profile-edit-field__control ${params.error ? 'is-error' : ''}`}>
          <input
            type={params.type || 'text'}
            className="parent-solid-profile-edit-input"
            value={params.value}
            onChange={(event) => params.onChange(event.target.value)}
            placeholder={params.placeholder}
            autoComplete={params.autoComplete}
          />
        </span>
        {params.hint ? <small>{params.hint}</small> : null}
        {params.error ? <small className="is-error">{params.error}</small> : null}
      </label>
    )

    const renderProfileEditTextarea = (params: {
      label: string
      value: string
      onChange: (value: string) => void
      placeholder?: string
      rows?: number
      error?: string
      hint?: string
      className?: string
    }) => (
      <label
        className={`parent-solid-profile-edit-field ${params.className || ''}`.trim()}
      >
        <span className="parent-solid-profile-edit-field__label">{params.label}</span>
        <span className={`parent-solid-profile-edit-field__control ${params.error ? 'is-error' : ''}`}>
          <textarea
            className="parent-solid-profile-edit-input parent-solid-profile-edit-input--textarea"
            value={params.value}
            onChange={(event) => params.onChange(event.target.value)}
            placeholder={params.placeholder}
            rows={params.rows ?? 3}
          />
        </span>
        {params.hint ? <small>{params.hint}</small> : null}
        {params.error ? <small className="is-error">{params.error}</small> : null}
      </label>
    )

    const renderProfileEditSelect = <T extends string>(params: {
      label: string
      value: T
      onChange: (value: T) => void
      options: Array<{ value: T; label: string }>
      error?: string
      hint?: string
      className?: string
    }) => (
      <label
        className={`parent-solid-profile-edit-field ${params.className || ''}`.trim()}
      >
        <span className="parent-solid-profile-edit-field__label">{params.label}</span>
        <span className={`parent-solid-profile-edit-field__control ${params.error ? 'is-error' : ''}`}>
          <select
            className="parent-solid-profile-edit-input parent-solid-profile-edit-input--select"
            value={params.value}
            onChange={(event) => params.onChange(event.target.value as T)}
          >
            {params.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </span>
        {params.hint ? <small>{params.hint}</small> : null}
        {params.error ? <small className="is-error">{params.error}</small> : null}
      </label>
    )

    const renderProfileEditSectionContent = () => {
      switch (profileEditSection) {
        case 'child':
          return (
            <div className="parent-solid-profile-edit-grid">
              {renderProfileEditField({
                label: 'Nama lengkap anak',
                value: profileEditChildDraft.fullName,
                onChange: (value) => updateChildProfileEditField('fullName', value),
                autoComplete: 'name',
                error: profileEditFieldErrors.fullName,
              })}
              {renderProfileEditField({
                label: 'Nama panggilan',
                value: profileEditChildDraft.nickName,
                onChange: (value) => updateChildProfileEditField('nickName', value),
              })}
              {renderProfileEditSelect({
                label: 'Jenis kelamin',
                value: profileEditChildDraft.gender as 'L' | 'P',
                onChange: (value) => updateChildProfileEditField('gender', value),
                options: [
                  { value: 'L', label: 'Laki-laki' },
                  { value: 'P', label: 'Perempuan' },
                ],
              })}
              {renderProfileEditField({
                label: 'Anak ke',
                value: profileEditChildDraft.childOrder,
                onChange: (value) => updateChildProfileEditField('childOrder', value),
                placeholder: 'Contoh: 1',
              })}
              {renderProfileEditField({
                label: 'Tempat lahir',
                value: profileEditChildDraft.birthPlace,
                onChange: (value) => updateChildProfileEditField('birthPlace', value),
              })}
              {renderProfileEditField({
                label: 'Tanggal lahir',
                value: profileEditChildDraft.birthDate,
                onChange: (value) => updateChildProfileEditField('birthDate', value),
                type: 'date',
              })}
              {renderProfileEditSelect({
                label: 'Agama',
                value: profileEditChildDraft.religion,
                onChange: (value) => updateChildProfileEditField('religion', value),
                options: religionOptions,
              })}
              {renderProfileEditTextarea({
                label: 'Alergi atau kebutuhan khusus',
                value: profileEditChildDraft.allergy,
                onChange: (value) => updateChildProfileEditField('allergy', value),
                rows: 3,
                className: 'parent-solid-profile-edit-field--full',
              })}
            </div>
          )

        case 'parent':
          return (
            <div className="parent-solid-profile-edit-grid">
              {renderProfileEditField({
                label: 'Nama ayah',
                value: profileEditDraft.fatherName,
                onChange: (value) => updateProfileEditField('fatherName', value),
                autoComplete: 'name',
              })}
              {renderProfileEditField({
                label: 'Nama ibu',
                value: profileEditDraft.motherName,
                onChange: (value) => updateProfileEditField('motherName', value),
                autoComplete: 'name',
              })}
              {renderProfileEditField({
                label: 'Email',
                value: profileEditDraft.email,
                onChange: (value) => updateProfileEditField('email', value),
                type: 'email',
                autoComplete: 'email',
                error: profileEditFieldErrors.parentEmail || profileEditFieldErrors.email,
              })}
              {renderProfileEditField({
                label: 'WhatsApp',
                value: profileEditDraft.whatsappNumber,
                onChange: (value) => updateProfileEditField('whatsappNumber', value),
                type: 'tel',
                autoComplete: 'tel',
              })}
              {renderProfileEditField({
                label: 'Telepon rumah',
                value: profileEditDraft.homePhone,
                onChange: (value) => updateProfileEditField('homePhone', value),
                type: 'tel',
              })}
              {renderProfileEditField({
                label: 'Telepon lainnya',
                value: profileEditDraft.otherPhone,
                onChange: (value) => updateProfileEditField('otherPhone', value),
                type: 'tel',
              })}
              {renderProfileEditTextarea({
                label: 'Alamat rumah',
                value: profileEditDraft.homeAddress,
                onChange: (value) => updateProfileEditField('homeAddress', value),
                rows: 3,
                className: 'parent-solid-profile-edit-field--full',
              })}
              {renderProfileEditTextarea({
                label: 'Alamat kantor',
                value: profileEditDraft.officeAddress,
                onChange: (value) => updateProfileEditField('officeAddress', value),
                rows: 3,
                className: 'parent-solid-profile-edit-field--full',
              })}
            </div>
          )

        case 'service':
          return (
            <div className="parent-solid-profile-edit-grid">
              {renderProfileEditSelect({
                label: 'Paket layanan',
                value: profileEditChildDraft.servicePackage,
                onChange: (value) => updateChildProfileEditField('servicePackage', value),
                options: servicePackageOptions,
                error: profileEditFieldErrors.servicePackage,
              })}
              {renderProfileEditField({
                label: 'Tanggal mulai layanan',
                value: profileEditChildDraft.serviceStartDate,
                onChange: (value) => updateChildProfileEditField('serviceStartDate', value),
                type: 'date',
                error: profileEditFieldErrors.serviceStartDate,
              })}
              {renderProfileEditField({
                label: 'Jam datang',
                value: profileEditChildDraft.arrivalTime,
                onChange: (value) => updateChildProfileEditField('arrivalTime', value),
                type: 'time',
              })}
              {renderProfileEditField({
                label: 'Jam pulang',
                value: profileEditChildDraft.departureTime,
                onChange: (value) => updateChildProfileEditField('departureTime', value),
                type: 'time',
                error: profileEditFieldErrors.departureTime,
              })}
              {renderProfileEditTextarea({
                label: 'Pengantar dan penjemput',
                value: profileEditPickupPersonsLabel,
                onChange: (value) =>
                  updateChildProfileEditField(
                    'pickupPersons',
                    value
                      .split(',')
                      .map((name) => name.trim())
                      .filter(Boolean),
                  ),
                rows: 3,
                hint: 'Pisahkan setiap nama dengan koma.',
                className: 'parent-solid-profile-edit-field--full',
              })}
              {renderProfileEditTextarea({
                label: 'Tujuan layanan / titip',
                value: profileEditChildDraft.depositPurpose,
                onChange: (value) => updateChildProfileEditField('depositPurpose', value),
                rows: 3,
                className: 'parent-solid-profile-edit-field--full',
              })}
              {renderProfileEditTextarea({
                label: 'Aktivitas di luar TPA',
                value: profileEditChildDraft.outsideActivities,
                onChange: (value) => updateChildProfileEditField('outsideActivities', value),
                rows: 3,
                className: 'parent-solid-profile-edit-field--full',
              })}
            </div>
          )

        case 'development':
          return (
            <div className="parent-solid-profile-edit-grid">
              {renderProfileEditTextarea({
                label: 'Masa prenatal',
                value: profileEditChildDraft.prenatalPeriod,
                onChange: (value) => updateChildProfileEditField('prenatalPeriod', value),
                rows: 3,
              })}
              {renderProfileEditTextarea({
                label: 'Masa partus',
                value: profileEditChildDraft.partusPeriod,
                onChange: (value) => updateChildProfileEditField('partusPeriod', value),
                rows: 3,
              })}
              {renderProfileEditTextarea({
                label: 'Masa post-natal',
                value: profileEditChildDraft.postNatalPeriod,
                onChange: (value) => updateChildProfileEditField('postNatalPeriod', value),
                rows: 3,
              })}
              {renderProfileEditTextarea({
                label: 'Kemampuan motorik',
                value: profileEditChildDraft.motorSkill,
                onChange: (value) => updateChildProfileEditField('motorSkill', value),
                rows: 3,
              })}
              {renderProfileEditTextarea({
                label: 'Kemampuan bahasa',
                value: profileEditChildDraft.languageSkill,
                onChange: (value) => updateChildProfileEditField('languageSkill', value),
                rows: 3,
              })}
              {renderProfileEditTextarea({
                label: 'Riwayat kesehatan',
                value: profileEditChildDraft.healthHistory,
                onChange: (value) => updateChildProfileEditField('healthHistory', value),
                rows: 4,
                className: 'parent-solid-profile-edit-field--full',
              })}
            </div>
          )

        case 'habits':
          return (
            <div className="parent-solid-profile-edit-grid">
              {renderProfileEditTextarea({
                label: 'Toilet training BAB',
                value: profileEditChildDraft.toiletTrainingBab,
                onChange: (value) => updateChildProfileEditField('toiletTrainingBab', value),
                rows: 2,
              })}
              {renderProfileEditTextarea({
                label: 'Toilet training BAK',
                value: profileEditChildDraft.toiletTrainingBak,
                onChange: (value) => updateChildProfileEditField('toiletTrainingBak', value),
                rows: 2,
              })}
              {renderProfileEditTextarea({
                label: 'Kebiasaan mandi',
                value: profileEditChildDraft.toiletTrainingBath,
                onChange: (value) => updateChildProfileEditField('toiletTrainingBath', value),
                rows: 2,
              })}
              {renderProfileEditTextarea({
                label: 'Gosok gigi',
                value: profileEditChildDraft.brushingTeeth,
                onChange: (value) => updateChildProfileEditField('brushingTeeth', value),
                rows: 2,
              })}
              {renderProfileEditTextarea({
                label: 'Makan',
                value: profileEditChildDraft.eating,
                onChange: (value) => updateChildProfileEditField('eating', value),
                rows: 2,
              })}
              {renderProfileEditTextarea({
                label: 'Minum susu',
                value: profileEditChildDraft.drinkingMilk,
                onChange: (value) => updateChildProfileEditField('drinkingMilk', value),
                rows: 2,
              })}
              {renderProfileEditTextarea({
                label: 'Saat menangis',
                value: profileEditChildDraft.whenCrying,
                onChange: (value) => updateChildProfileEditField('whenCrying', value),
                rows: 2,
              })}
              {renderProfileEditTextarea({
                label: 'Saat bermain',
                value: profileEditChildDraft.whenPlaying,
                onChange: (value) => updateChildProfileEditField('whenPlaying', value),
                rows: 2,
              })}
              {renderProfileEditTextarea({
                label: 'Tidur',
                value: profileEditChildDraft.sleeping,
                onChange: (value) => updateChildProfileEditField('sleeping', value),
                rows: 2,
              })}
              {renderProfileEditTextarea({
                label: 'Catatan kebiasaan lainnya',
                value: profileEditChildDraft.otherHabits,
                onChange: (value) => updateChildProfileEditField('otherHabits', value),
                rows: 3,
                className: 'parent-solid-profile-edit-field--full',
              })}
            </div>
          )
      }
    }

    const handleSaveProfileEdit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      if (!parentAccount || !activeChild) {
        setProfileEditError('Data profil tidak ditemukan.')
        return
      }

      const nextEmail = profileEditDraft.email.trim().toLowerCase()
      if (!nextEmail) {
        setProfileEditFieldErrors((previous) => ({
          ...previous,
          parentEmail: 'Email wajib diisi.',
        }))
        setProfileEditSection('parent')
        setProfileEditError('Lengkapi data email orang tua.')
        return
      }

      const nextChildDraft: ChildProfileInput = {
        ...profileEditChildDraft,
        fatherName: profileEditDraft.fatherName.trim(),
        motherName: profileEditDraft.motherName.trim(),
        homeAddress: profileEditDraft.homeAddress.trim(),
        homePhone: profileEditDraft.homePhone.trim(),
        officeAddress: profileEditDraft.officeAddress.trim(),
        otherPhone: profileEditDraft.otherPhone.trim(),
        email: nextEmail,
        whatsappNumber: profileEditDraft.whatsappNumber.trim(),
        pickupPersons: profileEditPickupPersonsLabel
          .split(',')
          .map((name) => name.trim())
          .filter(Boolean),
      }

      const nextFieldErrors = validateChildProfileInput(nextChildDraft)
      if (Object.keys(nextFieldErrors).length > 0) {
        setProfileEditFieldErrors(nextFieldErrors)
        const [firstErrorField] = Object.keys(nextFieldErrors)
        if (firstErrorField) {
          setProfileEditSection(getProfileEditSectionFromField(firstErrorField))
        }
        setProfileEditError('Masih ada data anak yang belum valid.')
        return
      }

      setIsSavingProfileEdit(true)
      setProfileEditError(null)
      setProfileEditFieldErrors({})

      try {
        const updatedDashboard = await parentApi.updateProfile({
          childId: activeChild.id,
          childProfile: nextChildDraft,
          parentProfile: {
            fatherName: profileEditDraft.fatherName.trim(),
            motherName: profileEditDraft.motherName.trim(),
            email: nextEmail,
            whatsappNumber: profileEditDraft.whatsappNumber.trim(),
            homePhone: profileEditDraft.homePhone.trim(),
            otherPhone: profileEditDraft.otherPhone.trim(),
            homeAddress: profileEditDraft.homeAddress.trim(),
            officeAddress: profileEditDraft.officeAddress.trim(),
          },
        })

        setDashboardData(asPayload(updatedDashboard))
        setProfileEditOpen(false)
        setProfileEditDraft(EMPTY_PROFILE_EDIT_DRAFT)
        setProfileEditChildDraft(EMPTY_CHILD_PROFILE_EDIT_DRAFT)
        setProfileEditSection('child')
      } catch (error) {
        setProfileEditError(error instanceof Error ? error.message : 'Gagal menyimpan profil.')
      } finally {
        setIsSavingProfileEdit(false)
      }
    }

    const childIdentityRows: Array<{ label: string; value: string }> = [
      { label: 'Nama Lengkap', value: toDisplayValue(activeChild.fullName) },
      { label: 'Nama Panggilan', value: toDisplayValue(activeChild.nickName) },
      { label: 'Jenis Kelamin', value: toDisplayValue(activeChild.gender) },
      { label: 'Tempat, Tanggal Lahir', value: birthInfo },
      { label: 'Usia', value: fullAgeLabel },
      { label: 'Anak Ke', value: toDisplayValue(activeChild.childOrder) },
      { label: 'Agama', value: toDisplayValue(activeChild.religion) },
      { label: 'Alergi', value: toDisplayValue(activeChild.allergy) },
    ]
    const parentRows: Array<{ label: string; value: string }> = [
      { label: 'Nama Ayah', value: toDisplayValue(parentProfile?.fatherName || '') },
      { label: 'Nama Ibu', value: toDisplayValue(parentProfile?.motherName || '') },
      { label: 'Email', value: toDisplayValue(parentProfile?.email || user.email) },
      { label: 'WhatsApp', value: toDisplayValue(parentProfile?.whatsappNumber || '') },
      { label: 'Telepon Rumah', value: toDisplayValue(parentProfile?.homePhone || '') },
      { label: 'Telepon Lainnya', value: toDisplayValue(parentProfile?.otherPhone || '') },
      { label: 'Alamat Rumah', value: toDisplayValue(parentProfile?.homeAddress || '') },
      { label: 'Alamat Kantor', value: toDisplayValue(parentProfile?.officeAddress || '') },
    ]
    const serviceRows: Array<{ label: string; value: string }> = [
      { label: 'Paket Layanan', value: formatPackage(activeChild.servicePackage) },
      { label: 'Mulai Layanan', value: formatLongDate(activeChild.serviceStartDate) },
      { label: 'Jam Datang', value: formatTime(activeChild.arrivalTime) },
      { label: 'Jam Pulang', value: formatTime(activeChild.departureTime) },
      { label: 'Pengantar & Penjemput', value: pickupPersons.length > 0 ? pickupPersons.join(', ') : '-' },
      { label: 'Tujuan Layanan', value: toDisplayValue(activeChild.depositPurpose) },
      { label: 'Aktivitas Luar', value: toDisplayValue(activeChild.outsideActivities) },
    ]
    const developmentRows: Array<{ label: string; value: string }> = [
      { label: 'Masa Prenatal', value: toDisplayValue(activeChild.prenatalPeriod) },
      { label: 'Masa Partus', value: toDisplayValue(activeChild.partusPeriod) },
      { label: 'Masa Post-natal', value: toDisplayValue(activeChild.postNatalPeriod) },
      { label: 'Kemampuan Motorik', value: toDisplayValue(activeChild.motorSkill) },
      { label: 'Kemampuan Bahasa', value: toDisplayValue(activeChild.languageSkill) },
      { label: 'Riwayat Kesehatan', value: toDisplayValue(activeChild.healthHistory) },
    ]
    const habitRows: Array<{ label: string; value: string }> = [
      { label: 'Toilet BAB', value: toDisplayValue(activeChild.toiletTrainingBab) },
      { label: 'Toilet BAK', value: toDisplayValue(activeChild.toiletTrainingBak) },
      { label: 'Mandi', value: toDisplayValue(activeChild.toiletTrainingBath) },
      { label: 'Gosok Gigi', value: toDisplayValue(activeChild.brushingTeeth) },
      { label: 'Makan', value: toDisplayValue(activeChild.eating) },
      { label: 'Minum Susu', value: toDisplayValue(activeChild.drinkingMilk) },
      { label: 'Saat Menangis', value: toDisplayValue(activeChild.whenCrying) },
      { label: 'Saat Bermain', value: toDisplayValue(activeChild.whenPlaying) },
      { label: 'Tidur', value: toDisplayValue(activeChild.sleeping) },
      { label: 'Lain-lain', value: toDisplayValue(activeChild.otherHabits) },
    ]
    const accountIdentity = toDisplayValue(
      parentProfile?.email || parentAccount?.username || user.email,
    )
    const maskedAccountPassword = '********'
    const settingsRows: Array<{ label: string; value: string }> = [
      { label: 'Akun', value: accountIdentity },
      { label: 'Password', value: maskedAccountPassword },
    ]

    const updatePasswordChangeField = (
      field: keyof ParentPasswordChangeDraft,
      value: string,
    ) => {
      setPasswordChangeDraft((previous) => ({
        ...previous,
        [field]: value,
      }))
      setPasswordChangeError(null)
      setPasswordChangeSuccess(null)
    }

    const openPasswordEditor = () => {
      setPasswordEditorOpen(true)
      setPasswordChangeError(null)
      setPasswordChangeSuccess(null)
    }

    const closePasswordEditor = () => {
      if (isSavingPasswordChange) {
        return
      }
      setPasswordEditorOpen(false)
      setPasswordChangeDraft(EMPTY_PARENT_PASSWORD_CHANGE_DRAFT)
      setPasswordChangeError(null)
    }

    const handleSubmitPasswordChange = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      const currentPassword = passwordChangeDraft.currentPassword.trim()
      const newPassword = passwordChangeDraft.newPassword.trim()
      const confirmPassword = passwordChangeDraft.confirmPassword.trim()

      if (!currentPassword || !newPassword || !confirmPassword) {
        setPasswordChangeError('Isi password saat ini, password baru, dan konfirmasi password.')
        return
      }
      if (newPassword.length < 8) {
        setPasswordChangeError('Password baru minimal 8 karakter.')
        return
      }
      if (newPassword !== confirmPassword) {
        setPasswordChangeError('Konfirmasi password tidak sesuai.')
        return
      }
      if (newPassword === currentPassword) {
        setPasswordChangeError('Password baru harus berbeda dari password saat ini.')
        return
      }

      setIsSavingPasswordChange(true)
      setPasswordChangeError(null)
      setPasswordChangeSuccess(null)

      try {
        await parentApi.changePassword({
          currentPassword,
          newPassword,
        })
        setPasswordEditorOpen(false)
        setPasswordChangeDraft(EMPTY_PARENT_PASSWORD_CHANGE_DRAFT)
        setPasswordChangeSuccess('Password berhasil diperbarui.')
      } catch (error) {
        setPasswordChangeError(
          error instanceof Error ? error.message : 'Gagal memperbarui password akun.',
        )
      } finally {
        setIsSavingPasswordChange(false)
      }
    }

    const renderPasswordChangeControls = (options?: { mobile?: boolean }) => (
      <div
        className={`parent-solid-profile-settings-actions ${options?.mobile ? 'parent-solid-profile-settings-actions--mobile' : ''}`}
      >
        {passwordChangeSuccess ? (
          <p className="parent-solid-profile-settings-feedback is-success">
            {passwordChangeSuccess}
          </p>
        ) : null}

        {passwordChangeError ? (
          <p className="parent-solid-profile-settings-feedback is-error">{passwordChangeError}</p>
        ) : null}

        {isPasswordEditorOpen ? (
          <form
            className="parent-solid-profile-settings-form"
            onSubmit={handleSubmitPasswordChange}
          >
            <input
              type="password"
              className="parent-solid-input"
              placeholder="Password saat ini"
              autoComplete="current-password"
              value={passwordChangeDraft.currentPassword}
              onChange={(event) =>
                updatePasswordChangeField('currentPassword', event.target.value)
              }
              disabled={isSavingPasswordChange}
            />
            <input
              type="password"
              className="parent-solid-input"
              placeholder="Password baru"
              autoComplete="new-password"
              value={passwordChangeDraft.newPassword}
              onChange={(event) =>
                updatePasswordChangeField('newPassword', event.target.value)
              }
              disabled={isSavingPasswordChange}
            />
            <input
              type="password"
              className="parent-solid-input"
              placeholder="Konfirmasi password baru"
              autoComplete="new-password"
              value={passwordChangeDraft.confirmPassword}
              onChange={(event) =>
                updatePasswordChangeField('confirmPassword', event.target.value)
              }
              disabled={isSavingPasswordChange}
            />
            <div className="parent-solid-profile-settings-form-actions">
              <button
                type="button"
                className="parent-solid-button parent-solid-button--ghost"
                onClick={closePasswordEditor}
                disabled={isSavingPasswordChange}
              >
                Batal
              </button>
              <button
                type="submit"
                className="parent-solid-button"
                disabled={isSavingPasswordChange}
              >
                {isSavingPasswordChange ? 'Menyimpan...' : 'Simpan Password'}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="parent-solid-button parent-solid-button--ghost parent-solid-profile-settings-button"
            onClick={openPasswordEditor}
            disabled={isSavingPasswordChange}
          >
            Ganti Password
          </button>
        )}
      </div>
    )

    const renderBiodataGrid = (
      rows: Array<{ label: string; value: string }>,
      options?: { columns?: 'two' | 'three' },
    ) => (
      <div
        className={`parent-solid-detail-grid parent-solid-detail-grid--biodata ${
          options?.columns === 'three' ? 'is-three' : ''
        }`}
      >
        {rows.map((row) => (
          <div key={row.label} className="parent-solid-biodata-item">
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
    )

    const getProfileRowIcon = (label: string): LucideIcon => {
      if (label.includes('Email')) return Mail
      if (label.includes('WhatsApp') || label.includes('Telepon')) return Phone
      if (label.includes('Akun')) return UserRound
      if (label.includes('Password')) return House
      if (label.includes('Alamat')) return MapPin
      if (label.includes('Tanggal') || label.includes('Lahir') || label.includes('Mulai')) {
        return CalendarDays
      }
      if (label.includes('Jam') || label.includes('Usia')) return Clock3
      if (label.includes('Paket')) return CreditCard
      if (label.includes('Alergi') || label.includes('Kesehatan')) return HeartPulse
      if (label.includes('Kemampuan')) return CheckCircle2
      if (
        label.includes('Pengantar') ||
        label.includes('Tujuan') ||
        label.includes('Aktivitas') ||
        label.includes('Toilet') ||
        label.includes('Mandi') ||
        label.includes('Gosok Gigi') ||
        label.includes('Makan') ||
        label.includes('Minum') ||
        label.includes('Saat') ||
        label.includes('Tidur')
      ) {
        return ScrollText
      }
      return UserRound
    }

    const renderMobileProfileList = (rows: Array<{ label: string; value: string }>) => (
      <div className="parent-solid-profile-mobile-list" role="list">
        {rows.map((row) => {
          const RowIcon = getProfileRowIcon(row.label)
          return (
            <div key={row.label} className="parent-solid-profile-mobile-list__item" role="listitem">
              <span className="parent-solid-profile-mobile-list__icon" aria-hidden="true">
                <RowIcon size={15} />
              </span>
              <span className="parent-solid-profile-mobile-list__label">{row.label}</span>
              <strong className="parent-solid-profile-mobile-list__value">{row.value}</strong>
            </div>
          )
        })}
      </div>
    )

    const mobileProfileSections: Array<{
      key: ProfileDisclosureKey
      icon: LucideIcon
      label: string
      meta: string
      description: string
      rows: Array<{ label: string; value: string }>
      columns?: 'two' | 'three'
    }> = [
      {
        key: 'child-biodata',
        icon: UserRound,
        label: 'Biodata Anak',
        meta: 'Lihat data lengkap anak',
        description: 'Informasi identitas dasar, kelahiran, dan kondisi kesehatan anak.',
        rows: childIdentityRows,
        columns: 'three',
      },
      {
        key: 'parent-biodata',
        icon: Users,
        label: 'Biodata Orang Tua',
        meta: 'Kontak keluarga utama',
        description: 'Kontak utama keluarga yang dapat dihubungi oleh pihak TPA.',
        rows: parentRows,
      },
      {
        key: 'service-data',
        icon: CreditCard,
        label: 'Data Layanan',
        meta: formatPackage(activeChild.servicePackage),
        description: 'Ringkasan paket, jadwal, dan kebiasaan pengantaran anak.',
        rows: serviceRows,
      },
      {
        key: 'development-health',
        icon: Package,
        label: 'Perkembangan & Kesehatan',
        meta: 'Catatan tumbuh kembang anak',
        description: 'Catatan perkembangan fisik dan riwayat kondisi anak.',
        rows: developmentRows,
      },
      {
        key: 'daily-habits',
        icon: ScrollText,
        label: 'Kebiasaan Harian',
        meta: 'Pola asuh dan rutinitas anak',
        description: 'Referensi kebiasaan anak untuk menjaga konsistensi pola asuh di TPA.',
        rows: habitRows,
        columns: 'three',
      },
      {
        key: 'settings',
        icon: House,
        label: 'Pengaturan',
        meta: 'Akun dan keamanan',
        description: 'Lihat akun parent portal dan ubah password.',
        rows: settingsRows,
      },
    ]

    const renderMobileProfileDisclosure = (params: (typeof mobileProfileSections)[number]) => {
      const Icon = params.icon
      const isExpanded = expandedProfileSection === params.key

      return (
        <article
          key={params.key}
          className={`parent-solid-profile-mobile-disclosure ${isExpanded ? 'is-open' : ''}`}
        >
          <button
            type="button"
            className={`parent-solid-profile-mobile-row parent-solid-profile-mobile-row--disclosure ${
              isExpanded ? 'is-open' : ''
            }`}
            onClick={() =>
              setExpandedProfileSection((previous) => (previous === params.key ? null : params.key))
            }
            aria-expanded={isExpanded}
            aria-controls={`parent-mobile-profile-panel-${params.key}`}
          >
            <span className="parent-solid-profile-mobile-row__icon" aria-hidden="true">
              <Icon size={16} />
            </span>
            <span className="parent-solid-profile-mobile-row__content">
              <strong>{params.label}</strong>
              <small>{params.meta}</small>
            </span>
            {isExpanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
          </button>

          {isExpanded ? (
            <div
              id={`parent-mobile-profile-panel-${params.key}`}
              className="parent-solid-profile-mobile-panel"
            >
              <div className="parent-solid-profile-mobile-panel__header">
                <span>Informasi</span>
                <strong>{params.label}</strong>
              </div>
              {renderMobileProfileList(params.rows)}
              {params.key === 'settings' ? renderPasswordChangeControls({ mobile: true }) : null}
            </div>
          ) : null}
        </article>
      )
    }

    return (
      <>
        <section className="parent-solid-section parent-solid-section--stacked">
        <article className="parent-solid-profile-mobile-shell">
          <article className="parent-solid-card parent-solid-profile-mobile-card">
            <div className="parent-solid-profile-mobile-card__avatar">
              <div className="parent-solid-profile-avatar parent-solid-profile-avatar--mobile">
                {activeChild.photoDataUrl ? (
                  <img src={activeChild.photoDataUrl} alt={activeChild.fullName} />
                ) : (
                  <span>{getInitials(activeChild.fullName)}</span>
                )}
              </div>
              <button
                type="button"
                className="parent-solid-profile-mobile-edit"
                onClick={openProfileEditDialog}
              >
                Edit Profil
              </button>
            </div>
            <h3>{activeChild.fullName}</h3>
            <p>{parentGuardianLabel}</p>
            <div className="parent-solid-profile-mobile-metrics">
              <div>
                <span>Gender</span>
                <strong>{toDisplayValue(activeChild.gender)}</strong>
              </div>
              <div>
                <span>Usia</span>
                <strong>{compactAgeLabel}</strong>
              </div>
              <div>
                <span>ID Anak</span>
                <strong>{childProfileCode}</strong>
              </div>
            </div>
          </article>

          <article className="parent-solid-card parent-solid-profile-mobile-menu">
            <div className="parent-solid-profile-mobile-menu-group">
              {mobileProfileSections.map((section) => renderMobileProfileDisclosure(section))}
            </div>
          </article>
        </article>

        <article
          id="parent-profile-child-biodata"
          className="parent-solid-card parent-solid-profile-section"
        >
          <div className="parent-solid-card__header parent-solid-card__header--stack">
            <h3>Biodata Anak</h3>
            <p className="parent-solid-card__lead">
              Informasi identitas dasar, kelahiran, dan kondisi kesehatan anak.
            </p>
          </div>
          {renderBiodataGrid(childIdentityRows, { columns: 'three' })}
        </article>

        <article
          id="parent-profile-parent-biodata"
          className="parent-solid-card parent-solid-profile-section"
        >
          <div className="parent-solid-card__header parent-solid-card__header--stack">
            <h3>Biodata Orang Tua</h3>
            <p className="parent-solid-card__lead">
              Kontak utama keluarga yang dapat dihubungi oleh pihak TPA.
            </p>
          </div>
          {renderBiodataGrid(parentRows)}
        </article>

        <article
          id="parent-profile-service-data"
          className="parent-solid-card parent-solid-profile-section"
        >
          <div className="parent-solid-card__header parent-solid-card__header--stack">
            <h3>Data Layanan</h3>
            <p className="parent-solid-card__lead">
              Ringkasan paket, jadwal, dan kebiasaan pengantaran anak.
            </p>
          </div>
          {renderBiodataGrid(serviceRows)}
        </article>

        <article
          id="parent-profile-development-health"
          className="parent-solid-card parent-solid-profile-section"
        >
          <div className="parent-solid-card__header parent-solid-card__header--stack">
            <h3>Perkembangan & Kesehatan</h3>
            <p className="parent-solid-card__lead">
              Catatan perkembangan fisik dan riwayat kondisi anak.
            </p>
          </div>
          {renderBiodataGrid(developmentRows)}
        </article>

        <article
          id="parent-profile-daily-habits"
          className="parent-solid-card parent-solid-profile-section"
        >
          <div className="parent-solid-card__header parent-solid-card__header--stack">
            <h3>Kebiasaan Sehari-hari</h3>
            <p className="parent-solid-card__lead">
              Referensi kebiasaan anak untuk menjaga konsistensi pola asuh di TPA.
            </p>
          </div>
          {renderBiodataGrid(habitRows, { columns: 'three' })}
        </article>

        <article
          id="parent-profile-settings"
          className="parent-solid-card parent-solid-profile-section parent-solid-profile-section--settings"
        >
          <div className="parent-solid-card__header parent-solid-card__header--stack">
            <h3>Pengaturan</h3>
            <p className="parent-solid-card__lead">
              Lihat akun parent portal dan kelola perubahan password.
            </p>
          </div>
          <div className="parent-solid-profile-settings-grid">
            <div className="parent-solid-profile-settings-item">
              <span>Akun</span>
              <strong>{accountIdentity}</strong>
            </div>
            <div className="parent-solid-profile-settings-item">
              <span>Password</span>
              <strong className="parent-solid-profile-settings-secret">{maskedAccountPassword}</strong>
            </div>
          </div>
          {renderPasswordChangeControls()}
        </article>

        <div className="parent-solid-logout-wrap parent-solid-logout-wrap--profile">
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
        </div>
        </section>

        {isProfileEditOpen ? (
          <div
            className="app-confirm-overlay parent-solid-profile-edit-overlay"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                closeProfileEditDialog()
              }
            }}
          >
            <div
              className="parent-solid-profile-edit-dialog"
              role="dialog"
              aria-modal="true"
              aria-label={`Edit profil ${activeChild.fullName}`}
            >
              <div className="parent-solid-profile-edit-dialog__hero">
                <button
                  type="button"
                  className="parent-solid-profile-edit-dialog__close"
                  onClick={closeProfileEditDialog}
                  aria-label="Tutup edit profil"
                  disabled={isSavingProfileEdit}
                >
                  <X size={16} />
                </button>

                <input
                  ref={profileEditPhotoInputRef}
                  type="file"
                  accept={`image/*,${SUPPORTED_CHILD_PHOTO_EXTENSIONS.join(',')}`}
                  className="parent-solid-profile-edit-photo-input"
                  onChange={handleProfilePhotoUpload}
                />
                <button
                  type="button"
                  className="parent-solid-profile-edit-dialog__avatar-button"
                  onClick={() => profileEditPhotoInputRef.current?.click()}
                  aria-label="Ubah foto profil anak"
                  disabled={isSavingProfileEdit}
                >
                  <div className="parent-solid-profile-edit-dialog__avatar">
                    {profileEditChildDraft.photoDataUrl ? (
                      <img
                        src={profileEditChildDraft.photoDataUrl}
                        alt={profileEditChildDraft.fullName || activeChild.fullName}
                      />
                    ) : (
                      <span>
                        {getInitials(profileEditChildDraft.fullName || activeChild.fullName)}
                      </span>
                    )}
                  </div>
                </button>
                <h3>{profileEditChildDraft.fullName || activeChild.fullName}</h3>
                <p>{profileEditIdLabel}</p>
                <span className="parent-solid-profile-edit-dialog__hero-subtitle">
                  {parentGuardianLabel}
                </span>
                <div className="parent-solid-profile-edit-dialog__photo-actions">
                  <span className="parent-solid-profile-edit-dialog__photo-hint">
                    Klik border foto untuk upload
                  </span>
                  {profileEditChildDraft.photoDataUrl ? (
                    <button
                      type="button"
                      className="parent-solid-profile-edit-dialog__photo-clear"
                      onClick={handleRemoveProfilePhoto}
                      disabled={isSavingProfileEdit}
                    >
                      Hapus foto
                    </button>
                  ) : null}
                </div>
                {profileEditFieldErrors.photoDataUrl ? (
                  <p className="parent-solid-profile-edit-dialog__photo-error">
                    {profileEditFieldErrors.photoDataUrl}
                  </p>
                ) : null}

                <div
                  className="parent-solid-profile-edit-dialog__quick-actions"
                  aria-label="Navigasi edit profil"
                >
                  {profileEditSections.map((section) => {
                    const Icon = section.icon
                    const isActive = section.key === profileEditSection

                    return (
                      <button
                        key={section.key}
                        type="button"
                        className={`parent-solid-profile-edit-dialog__quick-action ${
                          isActive ? 'is-active' : ''
                        }`}
                        onClick={() => setProfileEditSection(section.key)}
                        aria-label={section.label}
                        title={section.label}
                        aria-pressed={isActive}
                      >
                        <Icon size={16} aria-hidden="true" />
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="parent-solid-profile-edit-dialog__body">
                <form className="parent-solid-profile-edit-form" onSubmit={handleSaveProfileEdit}>
                  <div className="parent-solid-profile-edit-dialog__heading">
                    <div>
                      <span>Edit profile</span>
                      <h4>{activeProfileEditSectionMeta.label}</h4>
                    </div>
                    <p>{activeProfileEditSectionMeta.description}</p>
                  </div>

                  <div className="parent-solid-profile-edit-section">
                    {renderProfileEditSectionContent()}
                  </div>

                  {profileEditError ? (
                    <p className="parent-solid-profile-edit-error">{profileEditError}</p>
                  ) : null}

                  <div className="parent-solid-profile-edit-actions">
                    <button
                      type="button"
                      className="parent-solid-profile-edit-secondary is-muted"
                      onClick={closeProfileEditDialog}
                      disabled={isSavingProfileEdit}
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="parent-solid-profile-edit-submit"
                      disabled={isSavingProfileEdit}
                    >
                      {isSavingProfileEdit ? 'Menyimpan...' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        ) : null}
      </>
    )
  }

  const renderPortalContent = () => {
    if (!activeChild) return null

    return (
      <>
        {activeMenu === 'dashboard' ? renderDashboard() : null}
        {activeMenu === 'daily-logs' ? renderDailyLogs() : null}
        {activeMenu === 'inventory' ? renderInventoryPage() : null}
        {activeMenu === 'billing' ? renderBilling() : null}
        {activeMenu === 'profile' ? renderProfile() : null}
      </>
    )
  }
  const isChildSelectorMode = Boolean(dashboardData && children.length > 0 && !activeChild)
  const shouldHideHeaderOnScroll = Boolean(activeChild && isHeaderHidden)
  const activeNavigationKey = activeMenu === 'inventory' ? 'daily-logs' : activeMenu
  const activeNavigationIndex = Math.max(
    0,
    menus.findIndex((menu) => menu.key === activeNavigationKey),
  )

  return (
    <div className="parent-solid" data-theme={theme}>
      {!isChildSelectorMode ? (
        <header
          className={`parent-solid-header ${shouldHideHeaderOnScroll ? 'is-hidden' : ''} ${
            activeMenu === 'profile' ? 'is-profile-mobile' : ''
          }`}
        >
          <div className="parent-solid-brand">
            <span className="parent-solid-brand__logo">
              <img src={LOGO_SRC} alt="Logo TPA Rumah Ceria UBAYA" />
            </span>
            <div>
              <h1>TPA RUMAH CERIA UBAYA</h1>
              <p>DASHBOARD MONITORING</p>
            </div>
          </div>

          {activeChild ? (
            <div className="parent-solid-header__right">
              <nav
                className={`parent-solid-desktop-nav parent-solid-desktop-nav--slider active-${activeNavigationIndex}`}
                aria-label="Navigasi orang tua"
              >
                <span className="parent-solid-nav-slider" aria-hidden="true" />
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

              <div className="parent-solid-notification" ref={notificationPanelRef}>
                <button
                  type="button"
                  className={`parent-solid-notification-btn ${hasUnreadNotifications ? 'is-ringing' : ''}`}
                  onClick={handleToggleNotificationDropdown}
                  aria-label="Notifikasi"
                  aria-expanded={isNotificationDropdownOpen}
                  aria-haspopup="menu"
                >
                  <Bell size={18} />
                  {unreadNotificationCount > 0 && (
                    <span className="parent-solid-notification-btn__badge">{unreadNotificationCount}</span>
                  )}
                </button>
                {isNotificationDropdownOpen ? renderNotificationDropdown() : null}
              </div>

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
          ) : null}
        </header>
      ) : null}

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
                  {isLinking ? 'Memproses...' : 'Daftar'}
                </button>
              </form>
            </article>
          </section>
        ) : null}

        {dashboardData && children.length > 0 && !activeChild ? (
          <section className="parent-solid-selector parent-solid-selector--account">
            <article className="parent-solid-card parent-solid-selector__account-card">
              <span className="parent-solid-selector__logo" aria-hidden="true">
                <img src={LOGO_SRC} alt="" />
              </span>
              <h2>Pilih Profil Anak</h2>
              <p className="parent-solid-selector__lead">
                Pilih profil anak untuk melanjutkan dashboard monitoring.
              </p>

              <div className="parent-solid-account-list">
                {children.map((child) => {
                  const isSelected = selectedChildCandidateId === child.id
                  return (
                    <button
                      key={child.id}
                      type="button"
                      className={`parent-solid-account-card ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => handleSelectChild(child.id)}
                    >
                      <span className="parent-solid-account-card__avatar">
                        {child.photoDataUrl ? (
                          <img src={child.photoDataUrl} alt={child.fullName} />
                        ) : (
                          <span>{getInitials(child.fullName)}</span>
                        )}
                      </span>
                      <span className="parent-solid-account-card__content">
                        <strong>{child.fullName}</strong>
                        <span>{getAgeLabel(child.birthDate)}</span>
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="parent-solid-selector__link-child">
                {!isLinkFormOpen ? (
                  <button
                    type="button"
                    className="parent-solid-button parent-solid-button--ghost parent-solid-selector__add-account"
                    onClick={() => setLinkFormOpen(true)}
                    disabled={isLinking}
                  >
                    <PlusCircle size={16} />
                    <span>Tambah akun</span>
                  </button>
                ) : (
                  <form className="parent-solid-link-form parent-solid-link-form--selector" onSubmit={handleLinkChild}>
                    <input
                      type="text"
                      className="parent-solid-input"
                      placeholder="Masukkan Kode Registrasi"
                      value={registrationCode}
                      onChange={(event) => setRegistrationCode(event.target.value.toUpperCase())}
                      disabled={isLinking}
                    />
                    <button type="submit" className="parent-solid-button" disabled={isLinking}>
                      {isLinking ? 'Memproses...' : 'Daftar'}
                    </button>
                  </form>
                )}
              </div>
            </article>
          </section>
        ) : null}

        {dashboardData && activeChild ? renderPortalContent() : null}
      </main>

      {isWelcomePopupVisible && activeChild ? (
        <div
          className="app-confirm-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeWelcomePopup()
            }
          }}
        >
          <div className="app-greeting-dialog" role="dialog" aria-modal="true" aria-label="Ucapan selamat datang orang tua">
            <div className="app-greeting-dialog__badge">
              <img src={LOGO_SRC} alt="Logo TPA Rumah Ceria" />
              <span>Selamat Datang</span>
            </div>
            <h3>Selamat datang Ayah/Bunda</h3>
            <p>
              Terimakasih telah mempercayai TPA RUMAH CERIA UBAYA untuk menjadi bagian dari perkembangan anak anda.
            </p>
            <div className="app-greeting-dialog__footer">
              <button type="button" className="button" onClick={closeWelcomePopup}>
                Mulai Monitoring
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeChild ? (
        <nav
          className={`parent-solid-mobile-nav parent-solid-mobile-nav--slider active-${activeNavigationIndex}`}
          aria-label="Bottom navigation orang tua"
        >
          <span className="parent-solid-nav-slider" aria-hidden="true" />
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
      ) : null}
    </div>
  )
}

