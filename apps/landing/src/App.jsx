import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

const logoTpaSrc = `${import.meta.env.BASE_URL}logo_TPA.jpg`
const heroPhotoDesktopSrc = `${import.meta.env.BASE_URL}hero2-desktop.jpg`
const heroPhotoMobileSrc = `${import.meta.env.BASE_URL}hero2-mobile.jpg`
const headPhotoSrc = `${import.meta.env.BASE_URL}hero1.png`
const activityPhotoSrc = logoTpaSrc
const cookingEventPhotoSrc = `${import.meta.env.BASE_URL}event.jpg`

const defaultWhatsAppNumber = '62818304608'
const configuredWhatsAppNumber = import.meta.env.VITE_LANDING_WHATSAPP_NUMBER?.trim() || defaultWhatsAppNumber
const normalizedWhatsAppNumber = configuredWhatsAppNumber.replace(/\D+/g, '')
const whatsappUrl = normalizedWhatsAppNumber
  ? `https://wa.me/${normalizedWhatsAppNumber}?text=Halo%20TPA%20Rumah%20Ceria%20UBAYA,%20saya%20ingin%20bertanya.`
  : '#cta'
const instagramUrl = 'https://www.instagram.com/tparumahceria_ubaya?igsh=ZHNodnhzdXQzMnpi'
const API_BASE_URL = '/api/v1'
const PARENT_PORTAL_PATH = '/portal-orang-tua'
const ENFORCE_PARENT_SUBDOMAIN = import.meta.env.PROD
  ? import.meta.env.VITE_ENFORCE_PARENT_SUBDOMAIN !== 'false'
  : import.meta.env.VITE_ENFORCE_PARENT_SUBDOMAIN === 'true'
const LEGACY_PARENT_PORTAL_PRODUCTION_HOST = 'apps.tparumahceria.my.id'
const PARENT_PORTAL_CANONICAL_HOST = 'parent.tparumahceria.my.id'
const PARENT_PORTAL_HOST_ALIASES = new Set([
  PARENT_PORTAL_CANONICAL_HOST,
  'ortu.tparumahceria.my.id',
])
const PARENT_CHILD_SESSION_KEY_PREFIX = 'tpa-parent-selected-child:'
const LOW_STOCK_THRESHOLD = 2

const resolveParentPortalBaseUrl = () => {
  const configuredUrl = import.meta.env.VITE_PARENT_PORTAL_URL?.trim()
  if (configuredUrl) return configuredUrl

  const { protocol, hostname, port, origin } = window.location
  if (port === '5174') {
    return `${protocol}//${hostname}:5173${PARENT_PORTAL_PATH}`
  }
  if (port === '4174') {
    return `${protocol}//${hostname}:4173${PARENT_PORTAL_PATH}`
  }
  if (hostname === 'tparumahceria.my.id' || hostname === 'www.tparumahceria.my.id') {
    if (!ENFORCE_PARENT_SUBDOMAIN) {
      return `https://${LEGACY_PARENT_PORTAL_PRODUCTION_HOST}${PARENT_PORTAL_PATH}`
    }
    return `https://${PARENT_PORTAL_CANONICAL_HOST}/`
  }
  if (hostname === 'apps.tparumahceria.my.id') {
    if (!ENFORCE_PARENT_SUBDOMAIN) {
      return `${origin}${PARENT_PORTAL_PATH}`
    }
    return `https://${PARENT_PORTAL_CANONICAL_HOST}/`
  }
  if (PARENT_PORTAL_HOST_ALIASES.has(hostname)) {
    return `${origin}/`
  }

  return `${origin}${PARENT_PORTAL_PATH}`
}

const buildParentPortalUrl = (mode = 'login') => {
  const url = new URL(resolveParentPortalBaseUrl(), window.location.origin)
  if (mode === 'register') {
    url.searchParams.set('mode', 'register')
  } else {
    url.searchParams.delete('mode')
  }
  return url.toString()
}

const packageLabelMap = {
  DAILY: 'Harian',
  BIWEEKLY: '2 Mingguan',
  MONTHLY: 'Bulanan',
  harian: 'Harian',
  '2-mingguan': '2 Mingguan',
  bulanan: 'Bulanan',
}

const genderLabelMap = {
  L: 'Laki-laki',
  P: 'Perempuan',
  laki_laki: 'Laki-laki',
  perempuan: 'Perempuan',
}

const formatConditionLabel = (value) => {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) return '-'
  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

const formatPackageLabel = (value) => {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) return '-'
  return packageLabelMap[normalized] || packageLabelMap[normalized.toUpperCase()] || formatConditionLabel(normalized)
}

const formatGenderLabel = (value) => {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) return '-'
  return genderLabelMap[normalized] || genderLabelMap[normalized.toLowerCase()] || formatConditionLabel(normalized)
}

const calculateAgeInYears = (birthDate) => {
  if (!birthDate) return '-'
  const date = new Date(`${birthDate}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '-'
  const now = new Date()
  let age = now.getFullYear() - date.getFullYear()
  const monthGap = now.getMonth() - date.getMonth()
  if (monthGap < 0 || (monthGap === 0 && now.getDate() < date.getDate())) {
    age -= 1
  }
  return age >= 0 ? `${age} tahun` : '-'
}

const normalizeClockValue = (value) => {
  if (typeof value !== 'string') return ''
  const normalized = value.trim()
  if (!normalized) return ''
  const match = normalized.match(/^(\d{1,2})[:.](\d{2})$/)
  if (!match) return normalized
  return `${match[1].padStart(2, '0')}:${match[2]}`
}

const buildActivityTimeline = (report) => {
  if (!report) return []
  const timeline = []
  const notes = typeof report.departureNotes === 'string' ? report.departureNotes.trim() : ''
  const lines = notes
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  lines.forEach((line, index) => {
    const matched = line.match(/^(\d{1,2}[:.]\d{2})\s*[-\u2013]\s*(\d{1,2}[:.]\d{2})\s*[:\-]\s*(.+)$/)
    if (matched) {
      timeline.push({
        id: `notes-${index}`,
        start: normalizeClockValue(matched[1]),
        end: normalizeClockValue(matched[2]),
        description: matched[3].trim(),
      })
      return
    }
    timeline.push({
      id: `notes-${index}`,
      start: '-',
      end: '-',
      description: line,
    })
  })

  if (timeline.length === 0 && report.arrivalTime && report.departureTime) {
    timeline.push({
      id: 'default-routine',
      start: report.arrivalTime,
      end: report.departureTime,
      description: 'Aktivitas harian terpantau oleh petugas.',
    })
  }

  return timeline
}

const getParentChildStorageKey = (userId) => `${PARENT_CHILD_SESSION_KEY_PREFIX}${userId}`

const readStoredChildId = (userId) => {
  if (!userId) return ''
  try {
    return window.localStorage.getItem(getParentChildStorageKey(userId)) || ''
  } catch {
    return ''
  }
}

const writeStoredChildId = (userId, childId) => {
  if (!userId || !childId) return
  try {
    window.localStorage.setItem(getParentChildStorageKey(userId), childId)
  } catch {
    // Ignore storage failure.
  }
}

const clearStoredChildId = (userId) => {
  if (!userId) return
  try {
    window.localStorage.removeItem(getParentChildStorageKey(userId))
  } catch {
    // Ignore storage failure.
  }
}

const apiRequest = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })

  const text = await response.text()
  let payload = null

  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || 'Permintaan gagal diproses.')
  }

  return payload.data
}

const navSections = [
  { id: 'home', label: 'Beranda' },
  { id: 'tentang-kami', label: 'Tentang Kami' },
  { id: 'fasilitas', label: 'Fasilitas' },
  { id: 'kegiatan', label: 'Kegiatan' },
  { id: 'biaya-layanan', label: 'Paket Layanan' },
]

const programItems = [
  'Melatih kemandirian dalam aktivitas rutin sehari-hari',
  'Aktivitas toilet training',
  'Bermain bersama dan belajar sosial',
  'Psikodrama',
  'Olahraga dan gerak lagu',
  'Menyanyi dan stimulasi bahasa',
]

const defaultFacilityItems = [
  {
    name: 'Ruangan Ber-AC',
    description: 'Ruang belajar dan bermain ber-AC untuk menjaga anak tetap nyaman selama kegiatan.',
    detail: 'Fungsi: menjaga suhu ruang stabil agar anak fokus saat belajar dan bermain.',
    image: activityPhotoSrc,
  },
  {
    name: 'Ruang Tidur Anak',
    description: 'Area istirahat siang yang tenang untuk mendukung rutinitas tidur anak.',
    detail: 'Fungsi: membantu pemulihan energi dan menjaga pola tidur siang yang teratur.',
    image: activityPhotoSrc,
  },
  {
    name: 'Ruang Makan',
    description: 'Area makan bersama untuk membangun kebiasaan makan teratur dan mandiri.',
    detail: 'Fungsi: melatih kemandirian makan dan etika makan bersama teman sebaya.',
    image: activityPhotoSrc,
  },
  {
    name: 'Dapur Sehat',
    description: 'Dapur pendukung untuk menyiapkan kebutuhan makan dan minum anak.',
    detail: 'Fungsi: memastikan makanan dan minuman anak disiapkan dengan higienis.',
    image: activityPhotoSrc,
  },
  {
    name: 'Kamar Mandi Anak',
    description: 'Fasilitas kamar mandi anak untuk pembiasaan kebersihan dan toilet training.',
    detail: 'Fungsi: mendukung toilet training dan kebiasaan hidup bersih sejak dini.',
    image: activityPhotoSrc,
  },
  {
    name: 'Permainan Edukatif',
    description: 'Permainan edukatif untuk stimulasi motorik, bahasa, dan interaksi sosial.',
    detail: 'Fungsi: menstimulasi perkembangan kognitif, motorik, dan komunikasi anak.',
    image: activityPhotoSrc,
  },
  {
    name: 'Area Indoor (Soft Play)',
    description: 'Area indoor dengan konsep soft play yang aman untuk eksplorasi anak.',
    detail: 'Fungsi: memberi ruang eksplorasi aktif saat cuaca kurang mendukung aktivitas luar.',
    image: activityPhotoSrc,
  },
  {
    name: 'Area Outdoor (Playground)',
    description: 'Playground outdoor untuk aktivitas fisik, koordinasi, dan keberanian anak.',
    detail: 'Fungsi: melatih motorik kasar, koordinasi tubuh, dan rasa percaya diri anak.',
    image: activityPhotoSrc,
  },
  {
    name: 'Ruang Pendampingan',
    description: 'Ruang pendampingan untuk kegiatan terarah sesuai tahap perkembangan anak.',
    detail: 'Fungsi: mendukung observasi dan pendampingan perkembangan anak secara terarah.',
    image: activityPhotoSrc,
  },
]

const announcementCategoryLabelMap = {
  event: 'Event',
  fasilitas: 'Fasilitas',
  tim: 'Tim Kami',
  promosi: 'Promosi',
  ucapan: 'Ucapan',
}
const eventCategorySet = new Set(['event'])
const fasilitasCategorySet = new Set(['fasilitas'])
const teamCategorySet = new Set(['tim'])
const kegiatanCategorySet = new Set([...eventCategorySet])
const promoHeroCategorySet = new Set(['promosi', 'ucapan'])

const formatAnnouncementDateLabel = (value) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return ''
  }

  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(parsed)
}

const buildAnnouncementPeriodLabel = (item) => {
  const startLabel = formatAnnouncementDateLabel(item.publishStartDate)
  const endLabel = formatAnnouncementDateLabel(item.publishEndDate)

  if (startLabel && endLabel) {
    return `${startLabel} - ${endLabel}`
  }
  if (startLabel) {
    return startLabel
  }
  if (endLabel) {
    return `Sampai ${endLabel}`
  }
  return item.publishedAtLabel || ''
}

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value))

const fallbackLandingAnnouncements = [
  {
    title: 'Cooking Class',
    category: 'event',
    publishStartDate: '2026-02-16',
    publishEndDate: '',
    excerpt:
      'Kelas memasak seru untuk melatih kemandirian, motorik halus, dan keberanian anak mencoba menu sehat bersama teman-teman.',
    image: cookingEventPhotoSrc,
    ctaLabel: '',
    ctaUrl: '',
  },
]

const galleryLoopBaseCopies = 5
const galleryLoopTargetCardCount = 30
const galleryLoopMinimumItems = 1
const galleryLoopRecenterThreshold = 0.35
const createGalleryDragState = () => ({
  pointerId: null,
  isDragging: false,
  startClientX: 0,
  startScrollLeft: 0,
})
const createDeckDragState = () => ({
  pointerId: null,
  pointerType: '',
  isDragging: false,
  startClientX: 0,
  startClientY: 0,
  hasMoved: false,
  lastClientX: 0,
  lastTimestamp: 0,
  velocityX: 0,
})
const eventDeckVisibleDepth = 3
const deckClickMoveThreshold = 10
const deckSwipeThreshold = 64
const deckDragClamp = 170
const deckDragElasticLimit = 34
const deckDragResistance = 0.36
const deckFlickVelocityThreshold = 0.42
const deckThrowDurationMs = 220
const deckThrowDistance = 84
const applyDeckDragResistance = (value, min, max) => {
  const elasticMin = min - deckDragElasticLimit
  const elasticMax = max + deckDragElasticLimit
  const elasticValue = clampNumber(value, elasticMin, elasticMax)
  if (elasticValue < min) {
    return min + (elasticValue - min) * deckDragResistance
  }
  if (elasticValue > max) {
    return max + (elasticValue - max) * deckDragResistance
  }
  return elasticValue
}
const toLoopIndex = (index, total) => {
  if (total <= 0) return 0
  return ((index % total) + total) % total
}
const buildForwardStackIndices = (activeIndex, total, depth = 3) => {
  if (total <= 0) return []
  const normalizedActive = toLoopIndex(activeIndex, total)
  const maxDepth = Math.min(Math.max(depth, 1), total)
  return Array.from({ length: maxDepth }, (_, position) =>
    toLoopIndex(normalizedActive + position, total),
  )
}
const buildDynamicStackIndices = (activeIndex, total, depth = 3, dragDirection = 0) => {
  // dragDirection > 0 = swipe right (showing previous cards)
  // dragDirection <= 0 = swipe left (showing next cards)
  if (total <= 0) return []
  const normalizedActive = toLoopIndex(activeIndex, total)
  const maxDepth = Math.min(Math.max(depth, 1), total)
  return Array.from({ length: maxDepth }, (_, position) =>
    toLoopIndex(
      position === 0
        ? normalizedActive
        : dragDirection > 0
          ? normalizedActive - position
          : normalizedActive + position,
      total,
    ),
  )
}
const pricingPlans = [
  {
    title: 'Paket Harian',
    summary: 'Pilihan harian untuk kebutuhan pengasuhan yang insidental.',
    price: 150000,
    unit: '/hari',
    isPopular: false,
    benefits: ['Makan siang anak', 'Snack sore', 'Buah', 'Pendampingan aktivitas harian', 'Monitoring anak digital'],
  },
  {
    title: 'Paket 2 Minggu (10 hari)',
    summary: 'Durasi menengah untuk rutinitas yang mulai terjadwal.',
    price: 1100000,
    unit: '/paket',
    isPopular: false,
    benefits: ['Makan siang anak', 'Snack sore', 'Buah', 'Laporan perkembangan singkat', 'Monitoring anak digital'],
  },
  {
    title: 'Paket Bulanan',
    summary: 'Pilihan terbaik untuk pendampingan konsisten setiap bulan.',
    price: 1750000,
    unit: '/bulan',
    isPopular: true,
    benefits: ['Makan siang anak', 'Snack sore', 'Buah', 'Program pembiasaan terstruktur', 'Monitoring anak digital'],
  },
]

const registrationCosts = [
  'Administrasi: Rp 250.000 (tas baju kotor, buku penghubung, map hasil karya, tempat makan)',
  'Uang Pengembangan: Rp 1.000.000 (dapat diangsur 2 kali)',
  'Seragam TPA: Rp 150.000 / 1 stel',
  'Piyama Anak: Rp 125.000 / 1 stel',
]

const testimonialItems = [
  {
    quote:
      'Anak kami jadi lebih mandiri dan komunikatif. Update harian dari tim TPA juga membantu kami memantau perkembangan dengan tenang.',
    author: 'Orang Tua A',
    context: 'Wali anak usia 4 tahun',
  },
  {
    quote:
      'Lingkungannya hangat, terstruktur, dan aman. Kami merasa terbantu karena jadwal kegiatan anak jelas dan konsisten.',
    author: 'Orang Tua B',
    context: 'Wali anak usia 3 tahun',
  },
  {
    quote:
      'Program pembiasaan di TPA sangat terasa dampaknya di rumah, terutama rutinitas makan dan interaksi sosial anak.',
    author: 'Orang Tua C',
    context: 'Wali anak usia 5 tahun',
  },
]

const allAnimatedSections = ['home', 'tentang-kami', 'tim-kami', 'fasilitas', 'kegiatan', 'biaya-layanan', 'testimoni', 'cta']

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M13.601 2.326a7.854 7.854 0 0 0-6.883 12.417L6 18l3.339-.702a7.862 7.862 0 0 0 4.267 1.233h.003a7.854 7.854 0 0 0-.008-15.705zm4.124 11.105c-.227-.113-1.343-.664-1.551-.739-.208-.076-.36-.113-.511.113-.151.227-.587.738-.719.889-.133.151-.265.17-.492.057-.227-.114-.958-.353-1.824-1.124-.674-.601-1.13-1.344-1.263-1.571-.132-.227-.014-.35.1-.463.102-.102.226-.265.34-.397.113-.133.151-.227.227-.378.076-.151.038-.284-.019-.397-.057-.114-.511-1.23-.7-1.684-.184-.442-.372-.382-.511-.389l-.435-.008c-.151 0-.397.057-.606.284-.208.227-.795.776-.795 1.892s.814 2.195.928 2.346c.113.151 1.603 2.45 3.885 3.436.543.235.967.375 1.297.48.545.173 1.041.149 1.433.09.437-.065 1.343-.549 1.533-1.079.189-.53.189-.984.132-1.078-.057-.095-.208-.151-.435-.265z"
      fill="currentColor"
    />
  </svg>
)

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M7 3.5h10a3.5 3.5 0 0 1 3.5 3.5v10A3.5 3.5 0 0 1 17 20.5H7A3.5 3.5 0 0 1 3.5 17V7A3.5 3.5 0 0 1 7 3.5z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M15.6 12a3.6 3.6 0 1 1-7.2 0 3.6 3.6 0 0 1 7.2 0z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
  </svg>
)

const ChevronLeftIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M14.5 6.5L9 12l5.5 5.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const ChevronRightIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M9.5 6.5L15 12l-5.5 5.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export default function App() {
  const [activeSection, setActiveSection] = useState('home')
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname || '/')
  const [isCompactViewport, setCompactViewport] = useState(() => window.innerWidth <= 760)
  const [isNarrowViewport, setNarrowViewport] = useState(() => window.innerWidth <= 480)
  const [activeFacilityIndex, setActiveFacilityIndex] = useState(0)
  const [visibleSections, setVisibleSections] = useState(() =>
    allAnimatedSections.reduce((result, id) => ({ ...result, [id]: id === 'home' }), {}),
  )
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [authModal, setAuthModal] = useState('none')
  const [authDirection, setAuthDirection] = useState('forward')
  const [portalAuthMode, setPortalAuthMode] = useState('login')
  const [authNotice, setAuthNotice] = useState(null)
  const [parentSession, setParentSession] = useState(null)
  const [parentDashboard, setParentDashboard] = useState(null)
  const [activeChildId, setActiveChildId] = useState('')
  const [linkChildForm, setLinkChildForm] = useState({ registrationCode: '' })
  const [parentPortalView, setParentPortalView] = useState('picker')
  const [parentDashboardTab, setParentDashboardTab] = useState('beranda')
  const [selectedReportId, setSelectedReportId] = useState('')
  const [isInventoryOpen, setInventoryOpen] = useState(true)
  const [isCarriedItemsDetailOpen, setCarriedItemsDetailOpen] = useState(false)
  const [activeFinanceCard, setActiveFinanceCard] = useState('')
  const [activeLunasItemId, setActiveLunasItemId] = useState('')
  const [showLinkChildPanel, setShowLinkChildPanel] = useState(false)
  const [isBootstrappingParent, setBootstrappingParent] = useState(true)
  const [isSubmittingAuth, setSubmittingAuth] = useState(false)
  const [isSubmittingLinkChild, setSubmittingLinkChild] = useState(false)
  const [parentLoginForm, setParentLoginForm] = useState({
    email: '',
    password: '',
  })
  const [parentRegisterForm, setParentRegisterForm] = useState({
    email: '',
    password: '',
    registrationCode: '',
  })
  const [landingAnnouncements, setLandingAnnouncements] = useState([])
  const [isLoadingLandingAnnouncements, setLoadingLandingAnnouncements] = useState(false)
  const [dismissedPopupAnnouncementId, setDismissedPopupAnnouncementId] = useState('')
  const [activeEventSnapIndex, setActiveEventSnapIndex] = useState(0)
  const [activeGallerySnapIndex, setActiveGallerySnapIndex] = useState(0)
  const [eventSnapDragOffset, setEventSnapDragOffset] = useState(0)
  const [gallerySnapDragOffset, setGallerySnapDragOffset] = useState(0)
  const [isEventSnapDragging, setIsEventSnapDragging] = useState(false)
  const [isGallerySnapDragging, setIsGallerySnapDragging] = useState(false)
  const [activeEventDeckIndex, setActiveEventDeckIndex] = useState(0)
  const [, setEventDeckDragOffset] = useState(0)
  const [isEventDeckDragging, setEventDeckDragging] = useState(false)
  const [isEventDeckThrowing, setEventDeckThrowing] = useState(false)
  const [isEventDeckFlipped, setEventDeckFlipped] = useState(false)
  const [activeGalleryDeckIndex, setActiveGalleryDeckIndex] = useState(0)
  const [, setGalleryDeckDragOffset] = useState(0)
  const [isGalleryDeckDragging, setGalleryDeckDragging] = useState(false)
  const [isGalleryDeckThrowing, setGalleryDeckThrowing] = useState(false)
  const [isGalleryDeckFlipped, setGalleryDeckFlipped] = useState(false)
  const menuRef = useRef(null)
  const navItemRefs = useRef({})
  const linkChildPanelRef = useRef(null)
  const linkChildInputRef = useRef(null)
  const financePanelRef = useRef(null)
  const facilityTrackRef = useRef(null)
  const galleryTrackRef = useRef(null)
  const eventSnapDragStateRef = useRef({
    startX: 0,
    currentX: 0,
    isDragging: false,
    pointerId: null,
    lastX: 0,
    lastTime: 0,
    velocityX: 0,
  })
  const gallerySnapDragStateRef = useRef({
    startX: 0,
    currentX: 0,
    isDragging: false,
    pointerId: null,
    lastX: 0,
    lastTime: 0,
    velocityX: 0,
  })
  const eventSnapContainerRef = useRef(null)
  const gallerySnapContainerRef = useRef(null)
  const eventDeckDragStateRef = useRef(createDeckDragState())
  const galleryDeckDragStateRef = useRef(createDeckDragState())
  const eventDeckThrowTimeoutRef = useRef(null)
  const galleryDeckThrowTimeoutRef = useRef(null)
  const activeEventDeckCardRef = useRef(null)
  const activeGalleryDeckCardRef = useRef(null)
  const eventDeckStageRef = useRef(null)
  const galleryDeckStageRef = useRef(null)
  const eventDeckDragOffsetRef = useRef(0)
  const galleryDeckDragOffsetRef = useRef(0)
  const eventDeckPendingOffsetRef = useRef(0)
  const galleryDeckPendingOffsetRef = useRef(0)
  const eventDeckDragFrameRef = useRef(null)
  const galleryDeckDragFrameRef = useRef(null)
  const eventDeckReleaseFrameRef = useRef(null)
  const galleryDeckReleaseFrameRef = useRef(null)
  const eventDeckMotionRef = useRef({ next: 0, prev: 0, stage: null })
  const galleryDeckMotionRef = useRef({ next: 0, prev: 0, stage: null })
  const facilityCardRefs = useRef([])
  const lastScrollTimeRef = useRef(Date.now())
  const isFacilityScrollingRef = useRef(false)
  const facilityInteractionTimeoutRef = useRef(null)
  const facilityScrollFrameRef = useRef(null)
  const galleryInteractionTimeoutRef = useRef(null)
  const galleryAutoScrollFrameRef = useRef(null)
  const galleryDragStateRef = useRef(createGalleryDragState())
  const isGalleryInteractingRef = useRef(false)
  const SCROLL_DEBOUNCE_TIMEOUT = 120
  const GALLERY_INTERACTION_DEBOUNCE_TIMEOUT = 520
  const SCROLL_THROTTLE_DELAY = 50
  const isFacilityInteractingRef = useRef(false)

  const priceFormatter = useMemo(
    () =>
      new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    [],
  )
  const isParentPortalPage = currentPath === PARENT_PORTAL_PATH
  const platformLogoSrc = logoTpaSrc
  const facilityItems = useMemo(() => {
    const dynamicFacilityItems = landingAnnouncements
      .filter((item) => fasilitasCategorySet.has(item.category || ''))
      .map((item, index) => {
        const title = (item.title || '').trim() || `Fasilitas ${index + 1}`
        const shortDescription = (item.excerpt || '').trim()
        const functionDescription = (item.content || '').trim()
        return {
          id: item.id || `fasilitas-${index + 1}`,
          name: title,
          description: shortDescription || 'Informasi fasilitas belum ditambahkan.',
          detail: functionDescription
            ? `Fungsi: ${functionDescription}`
            : 'Fungsi: Informasi fungsi belum ditambahkan.',
          image: item.coverImageDataUrl || activityPhotoSrc,
        }
      })

    if (dynamicFacilityItems.length > 0) {
      return dynamicFacilityItems
    }

    return defaultFacilityItems
  }, [landingAnnouncements])
  const defaultFacilityIndex = useMemo(
    () => Math.floor(facilityItems.length / 2),
    [facilityItems.length],
  )
  const canNavigateFacility = facilityItems.length > 1
  const renderedFacilityItems = useMemo(
    () =>
      facilityItems.map((item, index) => ({
        ...item,
        originalIndex: index,
        loopKey: `facility-${index}-${item.id || item.name}`,
      })),
    [facilityItems],
  )
  const kegiatanItems = useMemo(() => {
    const dynamicItems = landingAnnouncements
      .filter((item) => kegiatanCategorySet.has(item.category || ''))
      .map((item) => ({
        id: item.id || '',
        title: item.title,
        category: item.category || 'event',
        publishStartDate: item.publishStartDate || '',
        publishEndDate: item.publishEndDate || '',
        excerpt: item.excerpt || item.content || '',
        image: item.coverImageDataUrl || activityPhotoSrc,
        ctaLabel: item.ctaLabel || '',
        ctaUrl: item.ctaUrl || '',
        publishedAtLabel: item.publishedAt
          ? new Intl.DateTimeFormat('id-ID', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          }).format(new Date(item.publishedAt))
          : '',
      }))

    const seenKeys = new Set(
      dynamicItems.map((item) =>
        `${item.title.trim().toLowerCase()}|${item.category}|${item.publishStartDate}`),
    )
    const fallbackItems = fallbackLandingAnnouncements.filter((item) => {
      const key = `${item.title.trim().toLowerCase()}|${item.category}|${item.publishStartDate}`
      return !seenKeys.has(key)
    })
    const source = [...dynamicItems, ...fallbackItems]

    return source.map((item) => ({
      ...item,
      period: buildAnnouncementPeriodLabel(item) || 'Tanpa jadwal',
    }))
  }, [landingAnnouncements])
  const eventItems = useMemo(
    () => kegiatanItems.filter((item) => eventCategorySet.has(item.category || '')),
    [kegiatanItems],
  )
  const teamItems = useMemo(
    () =>
      landingAnnouncements
        .filter((item) => teamCategorySet.has(item.category || ''))
        .map((item, index) => ({
          id: item.id || `tim-${index + 1}`,
          title: (item.title || '').trim() || `Tim ${index + 1}`,
          excerpt: (item.excerpt || '').trim(),
          content: (item.content || '').trim(),
          image: item.coverImageDataUrl || activityPhotoSrc,
        })),
    [landingAnnouncements],
  )
  const galleryItems = useMemo(() => teamItems, [teamItems])
  const eventDeckItems = useMemo(
    () =>
      eventItems.map((item, index) => ({
        ...item,
        deckKey: `event-${item.id || item.title}-${index}`,
      })),
    [eventItems],
  )
  const galleryDeckItems = useMemo(
    () =>
      galleryItems.map((item, index) => ({
        ...item,
        deckIndex: index,
        deckKey: `gallery-${index}`,
      })),
    [galleryItems],
  )
  const activeEventDeckItem = eventDeckItems[activeEventDeckIndex] || null
  const activeGalleryDeckItem = galleryDeckItems[activeGalleryDeckIndex] || null
  const eventDeckDepth = Math.max(eventDeckItems.length, 1)
  const galleryDeckDepth = Math.max(galleryDeckItems.length, 1)
  const visibleEventLeftDeckItems = useMemo(
    () =>
      eventDeckItems
        .slice(Math.max(0, activeEventDeckIndex - (eventDeckDepth - 1)), activeEventDeckIndex)
        .reverse()
        .map((item, depth) => ({ ...item, stackDepth: depth + 1 })),
    [activeEventDeckIndex, eventDeckDepth, eventDeckItems],
  )
  const visibleEventRightDeckItems = useMemo(
    () =>
      eventDeckItems
        .slice(activeEventDeckIndex + 1, activeEventDeckIndex + eventDeckDepth)
        .map((item, depth) => ({ ...item, stackDepth: depth + 1 })),
    [activeEventDeckIndex, eventDeckDepth, eventDeckItems],
  )
  const visibleGalleryLeftDeckItems = useMemo(
    () =>
      galleryDeckItems
        .slice(Math.max(0, activeGalleryDeckIndex - (galleryDeckDepth - 1)), activeGalleryDeckIndex)
        .reverse()
        .map((item, depth) => ({ ...item, stackDepth: depth + 1 })),
    [activeGalleryDeckIndex, galleryDeckDepth, galleryDeckItems],
  )
  const visibleGalleryRightDeckItems = useMemo(
    () =>
      galleryDeckItems
        .slice(activeGalleryDeckIndex + 1, activeGalleryDeckIndex + galleryDeckDepth)
        .map((item, depth) => ({ ...item, stackDepth: depth + 1 })),
    [activeGalleryDeckIndex, galleryDeckDepth, galleryDeckItems],
  )
  const canShiftEventNext = activeEventDeckIndex < eventDeckItems.length - 1
  const canShiftEventPrev = activeEventDeckIndex > 0
  const canShiftGalleryNext = activeGalleryDeckIndex < galleryDeckItems.length - 1
  const canShiftGalleryPrev = activeGalleryDeckIndex > 0
  const activeDeckClickMoveThreshold = isCompactViewport ? 6 : deckClickMoveThreshold
  const activeDeckSwipeThreshold = isCompactViewport ? 40 : deckSwipeThreshold
  const activeDeckFlickVelocityThreshold = isCompactViewport ? 0.24 : deckFlickVelocityThreshold
  const isKegiatanDeckUnified = true
  const isEventDeckTransitioning = isEventDeckThrowing
  const isGalleryDeckTransitioning = isGalleryDeckThrowing
  const snapNearOffsetPercent = isNarrowViewport ? 8 : isCompactViewport ? 12 : 18
  const snapFarOffsetPercent = isNarrowViewport ? 14 : isCompactViewport ? 20 : 30
  const isGalleryLoopEnabled = galleryItems.length >= galleryLoopMinimumItems
  const galleryActiveLoopCopies = useMemo(() => {
    if (!isGalleryLoopEnabled) {
      return 1
    }
    const itemCount = Math.max(galleryItems.length, 1)
    const requiredCopies = Math.max(
      galleryLoopBaseCopies,
      Math.ceil(galleryLoopTargetCardCount / itemCount),
    )
    return requiredCopies % 2 === 0 ? requiredCopies + 1 : requiredCopies
  }, [galleryItems.length, isGalleryLoopEnabled])
  const galleryLoopItems = useMemo(() => {
    if (!galleryItems.length) {
      return []
    }

    if (!isGalleryLoopEnabled) {
      return galleryItems.map((item, index) => ({
        ...item,
        loopKey: `gallery-single-${item.id || item.title}-${index}`,
      }))
    }

    return Array.from({ length: galleryActiveLoopCopies }, (_, copy) =>
      galleryItems.map((item, index) => ({
        ...item,
        loopKey: `gallery-${copy}-${item.id || item.title}-${index}`,
      })),
    ).flat()
  }, [galleryActiveLoopCopies, galleryItems, isGalleryLoopEnabled])
  const heroAnnouncement = useMemo(
    () =>
      landingAnnouncements.find(
        (item) =>
          promoHeroCategorySet.has(item.category || '') &&
          (item.displayMode || 'section') === 'hero',
      ) || null,
    [landingAnnouncements],
  )
  const popupAnnouncement = useMemo(
    () =>
      landingAnnouncements.find(
        (item) =>
          promoHeroCategorySet.has(item.category || '') &&
          (item.displayMode || 'section') === 'popup',
      ) || null,
    [landingAnnouncements],
  )
  const isPopupAnnouncementVisible = Boolean(
    popupAnnouncement &&
    dismissedPopupAnnouncementId !== popupAnnouncement.id &&
    authModal === 'none',
  )
  const heroAnnouncementLabel = heroAnnouncement
    ? announcementCategoryLabelMap[heroAnnouncement.category] || 'Info'
    : ''
  const popupAnnouncementLabel = popupAnnouncement
    ? announcementCategoryLabelMap[popupAnnouncement.category] || 'Info'
    : ''

  useEffect(() => {
    clearEventDeckTransitionTimers()
    setActiveEventDeckIndex((previous) => {
      if (!eventDeckItems.length) return 0
      return Math.min(previous, eventDeckItems.length - 1)
    })
    setEventDeckDragOffsetImmediate(0)
    setEventDeckDragging(false)
    setEventDeckThrowing(false)
    setEventDeckFlipped(false)
    eventDeckDragStateRef.current = createDeckDragState()
  }, [eventDeckItems.length])

  useEffect(() => {
    setActiveEventSnapIndex((previous) => toLoopIndex(previous, eventDeckItems.length))
  }, [eventDeckItems.length])

  useEffect(() => {
    setEventDeckFlipped(false)
  }, [activeEventDeckIndex])

  useEffect(() => {
    clearGalleryDeckTransitionTimers()
    setActiveGalleryDeckIndex((previous) => {
      if (!galleryDeckItems.length) return 0
      return Math.min(previous, galleryDeckItems.length - 1)
    })
    setGalleryDeckDragOffsetImmediate(0)
    setGalleryDeckDragging(false)
    setGalleryDeckThrowing(false)
    setGalleryDeckFlipped(false)
    galleryDeckDragStateRef.current = createDeckDragState()
  }, [galleryDeckItems.length])

  useEffect(() => {
    setActiveGallerySnapIndex((previous) => toLoopIndex(previous, galleryDeckItems.length))
  }, [galleryDeckItems.length])

  useEffect(() => {
    setGalleryDeckFlipped(false)
  }, [activeGalleryDeckIndex])

  const navigateToPath = (path) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path)
    }
    setCurrentPath(path)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setMobileMenuOpen(false)
    setAuthModal('none')
    setMobileMenuOpen(false)
    setAuthModal('none')
  }

  const navigateToLanding = () => navigateToPath('/')
  const navigateToParentPortal = (mode = 'login', replace = false) => {
    const targetUrl = buildParentPortalUrl(mode)
    if (replace) {
      window.location.replace(targetUrl)
      return
    }
    window.location.assign(targetUrl)
  }

  const syncParentDashboardState = (dashboard, preferredChildId = '') => {
    setParentDashboard(dashboard)
    setActiveChildId((previous) => {
      const childIds = dashboard?.children?.map((child) => child.id) ?? []
      if (preferredChildId && childIds.includes(preferredChildId)) {
        return preferredChildId
      }
      if (previous && childIds.includes(previous)) {
        return previous
      }
      return childIds[0] ?? ''
    })
  }

  const loadParentDashboard = async (preferredChildId = '') => {
    const data = await apiRequest('/parent/dashboard')
    syncParentDashboardState(data, preferredChildId)
    return data
  }

  const focusLinkChildForm = () => {
    if (parentPortalView === 'dashboard') {
      setParentDashboardTab('profil')
    }
    setShowLinkChildPanel(true)
    window.setTimeout(() => {
      linkChildPanelRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
      linkChildInputRef.current?.focus()
    }, 80)
  }

  useEffect(() => {
    if (!isParentPortalPage) return
    navigateToParentPortal('login', true)
  }, [isParentPortalPage])

  useEffect(() => {
    if (isParentPortalPage) {
      return undefined
    }

    let isMounted = true

    const loadLandingAnnouncements = async () => {
      setLoadingLandingAnnouncements(true)
      try {
        const data = await apiRequest('/landing-announcements?limit=48')
        if (!isMounted) {
          return
        }
        setLandingAnnouncements(Array.isArray(data) ? data : [])
      } catch {
        if (!isMounted) {
          return
        }
        setLandingAnnouncements([])
      } finally {
        if (isMounted) {
          setLoadingLandingAnnouncements(false)
        }
      }
    }

    void loadLandingAnnouncements()

    return () => {
      isMounted = false
    }
  }, [isParentPortalPage])

  useEffect(() => {
    if (!popupAnnouncement?.id) {
      setDismissedPopupAnnouncementId('')
      return
    }

    setDismissedPopupAnnouncementId((previous) =>
      previous === popupAnnouncement.id ? previous : '',
    )
  }, [popupAnnouncement?.id])

  const closePopupAnnouncement = () => {
    if (!popupAnnouncement?.id) {
      return
    }
    setDismissedPopupAnnouncementId(popupAnnouncement.id)
  }

  const recenterInfiniteTrack = (track, copies, threshold = 0.45) => {
    if (copies <= 1) return
    const segmentWidth = track.scrollWidth / copies
    if (!Number.isFinite(segmentWidth) || segmentWidth <= 0) return

    const maxScrollable = track.scrollWidth - track.clientWidth
    if (!Number.isFinite(maxScrollable) || maxScrollable <= 0) return

    const minScroll = Math.max(0, Math.min(segmentWidth * threshold, maxScrollable))
    const maxScroll = Math.max(minScroll, maxScrollable - segmentWidth * threshold)
    if (maxScroll - minScroll < 1) return

    let guard = 0
    while (track.scrollLeft < minScroll && guard <= copies + 1) {
      track.scrollLeft += segmentWidth
      guard += 1
    }

    guard = 0
    while (track.scrollLeft > maxScroll && guard <= copies + 1) {
      track.scrollLeft -= segmentWidth
      guard += 1
    }
  }

  const clearFacilityInteractionTimeout = () => {
    if (!facilityInteractionTimeoutRef.current) return
    window.clearTimeout(facilityInteractionTimeoutRef.current)
    facilityInteractionTimeoutRef.current = null
  }

  const queueFacilityInteractionEnd = () => {
    clearFacilityInteractionTimeout()
    facilityInteractionTimeoutRef.current = window.setTimeout(() => {
      isFacilityInteractingRef.current = false
    }, SCROLL_DEBOUNCE_TIMEOUT)
  }

  const clearGalleryInteractionTimeout = () => {
    if (!galleryInteractionTimeoutRef.current) return
    window.clearTimeout(galleryInteractionTimeoutRef.current)
    galleryInteractionTimeoutRef.current = null
  }

  const clearEventDeckTransitionTimers = () => {
    if (eventDeckThrowTimeoutRef.current) {
      window.clearTimeout(eventDeckThrowTimeoutRef.current)
      eventDeckThrowTimeoutRef.current = null
    }
  }

  const clearGalleryDeckTransitionTimers = () => {
    if (galleryDeckThrowTimeoutRef.current) {
      window.clearTimeout(galleryDeckThrowTimeoutRef.current)
      galleryDeckThrowTimeoutRef.current = null
    }
  }

  const cancelEventDeckDragFrame = () => {
    if (eventDeckDragFrameRef.current !== null) {
      window.cancelAnimationFrame(eventDeckDragFrameRef.current)
      eventDeckDragFrameRef.current = null
    }
  }

  const cancelGalleryDeckDragFrame = () => {
    if (galleryDeckDragFrameRef.current !== null) {
      window.cancelAnimationFrame(galleryDeckDragFrameRef.current)
      galleryDeckDragFrameRef.current = null
    }
  }

  const cancelEventDeckReleaseFrame = () => {
    if (eventDeckReleaseFrameRef.current !== null) {
      window.cancelAnimationFrame(eventDeckReleaseFrameRef.current)
      eventDeckReleaseFrameRef.current = null
    }
  }

  const cancelGalleryDeckReleaseFrame = () => {
    if (galleryDeckReleaseFrameRef.current !== null) {
      window.cancelAnimationFrame(galleryDeckReleaseFrameRef.current)
      galleryDeckReleaseFrameRef.current = null
    }
  }

  const syncDeckStageMotion = (stage, motionRef, nextValue, prevValue) => {
    if (!stage) return
    if (motionRef.current.stage !== stage) {
      motionRef.current.stage = stage
      motionRef.current.next = Number.NaN
      motionRef.current.prev = Number.NaN
    }
    if (motionRef.current.next !== nextValue) {
      stage.style.setProperty('--deck-motion-next', `${nextValue}`)
      motionRef.current.next = nextValue
    }
    if (motionRef.current.prev !== prevValue) {
      stage.style.setProperty('--deck-motion-prev', `${prevValue}`)
      motionRef.current.prev = prevValue
    }
  }

  const syncDeckDragVisual = ({
    nextOffset,
    dragOffsetRef,
    activeCardRef,
    stageRef,
    motionRef,
  }) => {
    dragOffsetRef.current = nextOffset
    const activeCard = activeCardRef.current
    if (activeCard) {
      activeCard.style.setProperty('--deck-drag-x', `${nextOffset}px`)
      activeCard.style.setProperty(
        '--deck-drag-rotate',
        `${clampNumber(nextOffset * 0.02, -4, 4)}deg`,
      )
    }

    const stage = stageRef.current
    const motionNext = isCompactViewport ? 0 : clampNumber(-nextOffset / activeDeckSwipeThreshold, 0, 1)
    const motionPrev = isCompactViewport ? 0 : clampNumber(nextOffset / activeDeckSwipeThreshold, 0, 1)
    syncDeckStageMotion(stage, motionRef, motionNext, motionPrev)
  }

  const syncEventDeckDragVisual = (nextOffset) => {
    syncDeckDragVisual({
      nextOffset,
      dragOffsetRef: eventDeckDragOffsetRef,
      activeCardRef: activeEventDeckCardRef,
      stageRef: eventDeckStageRef,
      motionRef: eventDeckMotionRef,
    })
  }

  const syncGalleryDeckDragVisual = (nextOffset) => {
    syncDeckDragVisual({
      nextOffset,
      dragOffsetRef: galleryDeckDragOffsetRef,
      activeCardRef: activeGalleryDeckCardRef,
      stageRef: galleryDeckStageRef,
      motionRef: galleryDeckMotionRef,
    })
  }

  const setEventDeckDragOffsetImmediate = (nextOffset) => {
    cancelEventDeckDragFrame()
    eventDeckPendingOffsetRef.current = nextOffset
    syncEventDeckDragVisual(nextOffset)
    setEventDeckDragOffset(nextOffset)
  }

  const setGalleryDeckDragOffsetImmediate = (nextOffset) => {
    cancelGalleryDeckDragFrame()
    galleryDeckPendingOffsetRef.current = nextOffset
    syncGalleryDeckDragVisual(nextOffset)
    setGalleryDeckDragOffset(nextOffset)
  }

  const queueEventDeckDragOffset = (nextOffset) => {
    eventDeckPendingOffsetRef.current = nextOffset
    if (eventDeckDragFrameRef.current !== null) return
    eventDeckDragFrameRef.current = window.requestAnimationFrame(() => {
      eventDeckDragFrameRef.current = null
      const flushedOffset = eventDeckPendingOffsetRef.current
      if (Math.abs(flushedOffset - eventDeckDragOffsetRef.current) < 0.05) {
        return
      }
      syncEventDeckDragVisual(flushedOffset)
    })
  }

  const queueGalleryDeckDragOffset = (nextOffset) => {
    galleryDeckPendingOffsetRef.current = nextOffset
    if (galleryDeckDragFrameRef.current !== null) return
    galleryDeckDragFrameRef.current = window.requestAnimationFrame(() => {
      galleryDeckDragFrameRef.current = null
      const flushedOffset = galleryDeckPendingOffsetRef.current
      if (Math.abs(flushedOffset - galleryDeckDragOffsetRef.current) < 0.05) {
        return
      }
      syncGalleryDeckDragVisual(flushedOffset)
    })
  }

  const flushEventDeckDragOffset = () => {
    if (eventDeckDragFrameRef.current !== null) {
      cancelEventDeckDragFrame()
      const flushedOffset = eventDeckPendingOffsetRef.current
      syncEventDeckDragVisual(flushedOffset)
      return flushedOffset
    }
    return eventDeckDragOffsetRef.current
  }

  const flushGalleryDeckDragOffset = () => {
    if (galleryDeckDragFrameRef.current !== null) {
      cancelGalleryDeckDragFrame()
      const flushedOffset = galleryDeckPendingOffsetRef.current
      syncGalleryDeckDragVisual(flushedOffset)
      return flushedOffset
    }
    return galleryDeckDragOffsetRef.current
  }

  const resetGalleryDragState = () => {
    galleryDragStateRef.current = createGalleryDragState()
  }

  const queueGalleryInteractionEnd = () => {
    clearGalleryInteractionTimeout()
    galleryInteractionTimeoutRef.current = window.setTimeout(() => {
      isGalleryInteractingRef.current = false
      const track = galleryTrackRef.current
      if (!track) return
      if (isGalleryLoopEnabled) {
        recenterInfiniteTrack(track, galleryActiveLoopCopies, galleryLoopRecenterThreshold)
      }
    }, GALLERY_INTERACTION_DEBOUNCE_TIMEOUT)
  }

  useEffect(() => {
    let isMounted = true

    const bootstrapParentSession = async () => {
      if (isParentPortalPage) {
        setBootstrappingParent(false)
        return
      }
      try {
        const session = await apiRequest('/auth/me')
        if (!isMounted || session?.user?.role !== 'ORANG_TUA') {
          return
        }
        setParentSession({
          user: session.user,
          expiresAt: session.expiresAt,
        })
        const dashboard = await apiRequest('/parent/dashboard')
        if (!isMounted) {
          return
        }
        const storedChildId = readStoredChildId(session.user.id)
        const childIds = dashboard?.children?.map((child) => child.id) ?? []
        const hasStoredChild = Boolean(storedChildId && childIds.includes(storedChildId))
        if (!hasStoredChild) {
          clearStoredChildId(session.user.id)
        }

        syncParentDashboardState(dashboard, hasStoredChild ? storedChildId : '')
        setParentPortalView(hasStoredChild ? 'dashboard' : 'picker')
        setParentDashboardTab('beranda')
        setSelectedReportId('')
        setShowLinkChildPanel(false)
      } catch {
        if (!isMounted) {
          return
        }
        setParentSession(null)
        setParentDashboard(null)
        setActiveChildId('')
        setSelectedReportId('')
      } finally {
        if (isMounted) {
          setBootstrappingParent(false)
        }
      }
    }

    void bootstrapParentSession()

    return () => {
      isMounted = false
    }
  }, [isParentPortalPage])

  useEffect(() => {
    const handlePopState = () => {
      const nextPath = window.location.pathname || '/'
      const shouldLogoutParent =
        parentSession?.user?.role === 'ORANG_TUA' &&
        currentPath === PARENT_PORTAL_PATH &&
        nextPath !== PARENT_PORTAL_PATH

      if (shouldLogoutParent) {
        void (async () => {
          try {
            await apiRequest('/auth/logout', {
              method: 'POST',
              body: JSON.stringify({}),
            })
          } catch {
            // Ignore network error and continue local logout.
          } finally {
            clearStoredChildId(parentSession?.user?.id)
            setParentSession(null)
            setParentDashboard(null)
            setActiveChildId('')
            setParentPortalView('picker')
            setParentDashboardTab('beranda')
            setSelectedReportId('')
            setInventoryOpen(true)
            setCarriedItemsDetailOpen(false)
            setActiveFinanceCard('')
            setActiveLunasItemId('')
            setShowLinkChildPanel(false)
            setLinkChildForm({ registrationCode: '' })
            setAuthNotice(null)
          }
        })()
      }

      setCurrentPath(nextPath)
      window.scrollTo({ top: 0, behavior: 'auto' })
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [parentSession, currentPath])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = 'light'
  }, [])

  // FIX: Force reset overflow and interactions on the parent portal
  useEffect(() => {
    if (isParentPortalPage) {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
      document.body.style.pointerEvents = 'auto'
      document.body.style.touchAction = 'auto'
    }
  }, [isParentPortalPage, parentPortalView])

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 760) {
        setMobileMenuOpen(false)
      }
      setCompactViewport(window.innerWidth <= 760)
      setNarrowViewport(window.innerWidth <= 480)
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!mobileMenuOpen) return undefined

    const previousOverflow = document.body.style.overflow
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    if (authModal === 'none') return undefined

    const previousOverflow = document.body.style.overflow
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setAuthModal('none')
        setAuthNotice(null)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [authModal])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.id
          if (entry.isIntersecting) {
            setVisibleSections((previous) =>
              previous[id] ? previous : { ...previous, [id]: true },
            )
          }
        })
      },
      {
        root: null,
        rootMargin: '-45% 0px -45% 0px',
        threshold: 0.01,
      },
    )

    allAnimatedSections.forEach((id) => {
      const element = document.getElementById(id)
      if (element) observer.observe(element)
    })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const sections = navSections
      .map((item) => document.getElementById(item.id))
      .filter(Boolean)

    if (!sections.length) return undefined

    const updateActiveByScroll = () => {
      const topbarHeight = document.querySelector('.topbar')?.getBoundingClientRect().height ?? 96
      const activationLine = topbarHeight + 22

      let currentId = navSections[0].id
      sections.forEach((section) => {
        if (section.getBoundingClientRect().top <= activationLine) {
          currentId = section.id
        }
      })

      setActiveSection((previous) => (previous === currentId ? previous : currentId))
    }

    updateActiveByScroll()
    window.addEventListener('scroll', updateActiveByScroll, { passive: true })
    window.addEventListener('resize', updateActiveByScroll)

    return () => {
      window.removeEventListener('scroll', updateActiveByScroll)
      window.removeEventListener('resize', updateActiveByScroll)
    }
  }, [])

  useEffect(() => {
    const updateIndicator = () => {
      const menuElement = menuRef.current
      const activeElement = navItemRefs.current[activeSection]
      if (!menuElement || !activeElement) return

      setIndicatorStyle({
        left: activeElement.offsetLeft,
        width: activeElement.offsetWidth,
      })
    }

    updateIndicator()
    window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [activeSection])

  useEffect(() => {
    setActiveFacilityIndex((previous) => {
      if (!facilityItems.length) {
        return 0
      }
      if (previous >= facilityItems.length) {
        return 0
      }
      return previous
    })
  }, [facilityItems.length])

  useEffect(() => {
    if (!facilityItems.length) {
      return undefined
    }

    const initialIndex = isCompactViewport ? 0 : defaultFacilityIndex
    const timer = window.setTimeout(() => {
      if (!isCompactViewport) {
        scrollFacilityToIndex(initialIndex, 'auto')
      } else {
        setActiveFacilityIndex(0)
      }
    }, 120)

    return () => window.clearTimeout(timer)
  }, [defaultFacilityIndex, facilityItems.length, isCompactViewport])

  useEffect(() => {
    const track = galleryTrackRef.current
    if (!track || !galleryItems.length || !isGalleryLoopEnabled) {
      return undefined
    }

    const frameId = window.requestAnimationFrame(() => {
      const segmentWidth = track.scrollWidth / galleryActiveLoopCopies
      if (!Number.isFinite(segmentWidth) || segmentWidth <= 0) {
        return
      }
      track.scrollLeft = segmentWidth * Math.floor(galleryActiveLoopCopies / 2)
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [galleryActiveLoopCopies, galleryItems.length, isGalleryLoopEnabled])

  useEffect(() => {
    const track = galleryTrackRef.current
    if (!track || !galleryItems.length || !isGalleryLoopEnabled) {
      return undefined
    }

    let lastFrameTime = performance.now()

    const animate = (now) => {
      const activeTrack = galleryTrackRef.current
      if (!activeTrack) {
        galleryAutoScrollFrameRef.current = null
        return
      }

      if (!isGalleryInteractingRef.current) {
        const delta = now - lastFrameTime
        const speed = isCompactViewport ? 0.028 : 0.042
        activeTrack.scrollLeft += delta * speed
        recenterInfiniteTrack(activeTrack, galleryActiveLoopCopies, galleryLoopRecenterThreshold)
      }

      lastFrameTime = now
      galleryAutoScrollFrameRef.current = window.requestAnimationFrame(animate)
    }

    galleryAutoScrollFrameRef.current = window.requestAnimationFrame(animate)

    return () => {
      if (galleryAutoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(galleryAutoScrollFrameRef.current)
        galleryAutoScrollFrameRef.current = null
      }
    }
  }, [galleryActiveLoopCopies, galleryItems.length, isCompactViewport, isGalleryLoopEnabled])

  const scrollToSection = (id) => {
    const target = document.getElementById(id)
    if (!target) return

    setMobileMenuOpen(false)
    setActiveSection(id)
    setVisibleSections((previous) => (previous[id] ? previous : { ...previous, [id]: true }))
    const topbarHeight = document.querySelector('.topbar')?.getBoundingClientRect().height ?? 88
    const nextTop = target.getBoundingClientRect().top + window.scrollY - topbarHeight
    window.scrollTo({ top: Math.max(0, Math.round(nextTop)), behavior: 'smooth' })
  }

  const scrollFacilityToIndex = (index, behavior = 'smooth') => {
    const total = facilityItems.length
    if (!total) return

    const nextIndex = Math.max(0, Math.min(index, total - 1))
    const track = facilityTrackRef.current
    if (!track) return

    const targetCard = facilityCardRefs.current[nextIndex]
    if (!targetCard) return

    const targetLeft = targetCard.offsetLeft - (track.clientWidth - targetCard.clientWidth) / 2
    track.scrollTo({ left: targetLeft, behavior })
    setActiveFacilityIndex(nextIndex)
  }

  const handleFacilityPrev = () => {
    if (!canNavigateFacility) return
    scrollFacilityToIndex(activeFacilityIndex - 1)
  }
  const handleFacilityNext = () => {
    if (!canNavigateFacility) return
    scrollFacilityToIndex(activeFacilityIndex + 1)
  }

  const handleFacilityTrackScroll = () => {
    const track = facilityTrackRef.current
    if (!track) return

    const now = Date.now()
    if (now - lastScrollTimeRef.current < SCROLL_THROTTLE_DELAY && isFacilityScrollingRef.current) {
      return
    }
    lastScrollTimeRef.current = now

    if (isFacilityInteractingRef.current) {
      queueFacilityInteractionEnd()
    }

    if (isFacilityScrollingRef.current) {
      return
    }

    isFacilityScrollingRef.current = true
    facilityScrollFrameRef.current = window.requestAnimationFrame(() => {
      const activeTrack = facilityTrackRef.current
      if (!activeTrack) {
        isFacilityScrollingRef.current = false
        facilityScrollFrameRef.current = null
        return
      }

      const center = activeTrack.scrollLeft + activeTrack.clientWidth / 2
      let nearestLoopIndex = -1
      let nearestDistance = Number.POSITIVE_INFINITY

      facilityCardRefs.current.forEach((card, loopIndex) => {
        if (!card) return
        const cardCenter = card.offsetLeft + card.clientWidth / 2
        const distance = Math.abs(center - cardCenter)

        if (distance < nearestDistance) {
          nearestDistance = distance
          nearestLoopIndex = loopIndex
        }
      })

      if (nearestLoopIndex >= 0) {
        const nearestBaseIndex = nearestLoopIndex
        if (nearestBaseIndex !== activeFacilityIndex) {
          setActiveFacilityIndex(nearestBaseIndex)
        }
      }

      isFacilityScrollingRef.current = false
      facilityScrollFrameRef.current = null
    })
  }

  const handleFacilityInteractionStart = () => {
    isFacilityInteractingRef.current = true
    clearFacilityInteractionTimeout()
  }

  const handleFacilityInteractionEnd = () => {
    queueFacilityInteractionEnd()
  }

  const handleGalleryTrackScroll = () => {
    const track = galleryTrackRef.current
    if (!track || !galleryItems.length) return

    if (isGalleryInteractingRef.current) {
      queueGalleryInteractionEnd()
    }

    if (isGalleryLoopEnabled) {
      recenterInfiniteTrack(track, galleryActiveLoopCopies, galleryLoopRecenterThreshold)
    }
  }

  const handleGalleryInteractionStart = () => {
    if (!galleryItems.length) return
    isGalleryInteractingRef.current = true
    clearGalleryInteractionTimeout()
    const track = galleryTrackRef.current
    if (track && isGalleryLoopEnabled) {
      recenterInfiniteTrack(track, galleryActiveLoopCopies, galleryLoopRecenterThreshold)
    }
  }

  const handleGalleryInteractionEnd = () => {
    if (galleryDragStateRef.current.isDragging) return
    queueGalleryInteractionEnd()
  }

  const finishGalleryPointerInteraction = (pointerId = null) => {
    const track = galleryTrackRef.current
    const dragState = galleryDragStateRef.current
    if (!dragState.isDragging) return
    if (pointerId !== null && dragState.pointerId !== pointerId) return

    if (track) {
      if (
        dragState.pointerId !== null &&
        typeof track.hasPointerCapture === 'function' &&
        track.hasPointerCapture(dragState.pointerId)
      ) {
        track.releasePointerCapture(dragState.pointerId)
      }
      track.classList.remove('is-dragging')
    }

    resetGalleryDragState()
    queueGalleryInteractionEnd()
  }

  const handleGalleryPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const track = galleryTrackRef.current
    if (!track || !galleryItems.length) return

    isGalleryInteractingRef.current = true
    clearGalleryInteractionTimeout()
    galleryDragStateRef.current = {
      pointerId: event.pointerId,
      isDragging: true,
      startClientX: event.clientX,
      startScrollLeft: track.scrollLeft,
    }
    track.classList.add('is-dragging')
    if (typeof track.setPointerCapture === 'function') {
      track.setPointerCapture(event.pointerId)
    }
  }

  const handleGalleryPointerMove = (event) => {
    const track = galleryTrackRef.current
    const dragState = galleryDragStateRef.current
    if (!track || !dragState.isDragging || dragState.pointerId !== event.pointerId) return

    const deltaX = event.clientX - dragState.startClientX
    track.scrollLeft = dragState.startScrollLeft - deltaX
    if (isGalleryLoopEnabled) {
      recenterInfiniteTrack(track, galleryActiveLoopCopies, galleryLoopRecenterThreshold)
    }
  }

  const handleGalleryPointerUp = (event) => {
    finishGalleryPointerInteraction(event.pointerId)
  }

  const handleGalleryPointerCancel = (event) => {
    finishGalleryPointerInteraction(event.pointerId)
  }

  const handleGalleryPointerCaptureLost = (event) => {
    finishGalleryPointerInteraction(event.pointerId)
  }

  const handleGalleryWheel = (event) => {
    const track = galleryTrackRef.current
    if (!track || !galleryItems.length) return

    const horizontalDelta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
    if (!Number.isFinite(horizontalDelta) || horizontalDelta === 0) {
      return
    }

    isGalleryInteractingRef.current = true
    clearGalleryInteractionTimeout()
    track.scrollLeft += horizontalDelta
    if (isGalleryLoopEnabled) {
      recenterInfiniteTrack(track, galleryActiveLoopCopies, galleryLoopRecenterThreshold)
    }
    event.preventDefault()
    queueGalleryInteractionEnd()
  }

  const SNAP_SWIPE_THRESHOLD = 12
  const SNAP_SWIPE_VELOCITY = 0.18

  const handleEventSnapPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (e.target instanceof HTMLElement && e.target.closest('a, button')) return
    const dragState = eventSnapDragStateRef.current
    const now = performance.now()
    dragState.startX = e.clientX
    dragState.currentX = e.clientX
    dragState.lastX = e.clientX
    dragState.lastTime = now
    dragState.velocityX = 0
    dragState.isDragging = true
    dragState.pointerId = e.pointerId
    setIsEventSnapDragging(true)
    setEventSnapDragOffset(0)
    if (typeof e.currentTarget.setPointerCapture === 'function') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // Ignore unsupported pointer capture edge cases.
      }
    }
  }

  const handleEventSnapPointerMove = (e) => {
    const dragState = eventSnapDragStateRef.current
    if (!dragState.isDragging || dragState.pointerId !== e.pointerId) return
    const now = performance.now()
    const deltaX = e.clientX - dragState.startX
    const deltaTime = Math.max(now - dragState.lastTime, 1)
    const instantVelocity = (e.clientX - dragState.lastX) / deltaTime
    dragState.velocityX = dragState.velocityX * 0.6 + instantVelocity * 0.4
    dragState.currentX = e.clientX
    dragState.lastX = e.clientX
    dragState.lastTime = now
    setEventSnapDragOffset(deltaX)
  }

  const finishEventSnapPointerInteraction = (e) => {
    const dragState = eventSnapDragStateRef.current
    if (!dragState.isDragging || dragState.pointerId !== e.pointerId) return

    const deltaX = dragState.currentX - dragState.startX
    const velocityX = dragState.velocityX
    const totalItems = eventDeckItems.length
    if (totalItems <= 1) {
      dragState.isDragging = false
      dragState.pointerId = null
      setIsEventSnapDragging(false)
      setEventSnapDragOffset(0)
      return
    }
    let nextIndex = activeEventSnapIndex

    if (deltaX > SNAP_SWIPE_THRESHOLD || velocityX > SNAP_SWIPE_VELOCITY) {
      // Swipe ke kanan: kartu aktif masuk paling belakang.
      nextIndex = toLoopIndex(activeEventSnapIndex + 1, totalItems)
    } else if (deltaX < -SNAP_SWIPE_THRESHOLD || velocityX < -SNAP_SWIPE_VELOCITY) {
      // Swipe ke kiri: rotasi kebalikan.
      nextIndex = toLoopIndex(activeEventSnapIndex - 1, totalItems)
    }

    if (
      typeof e.currentTarget.hasPointerCapture === 'function' &&
      e.currentTarget.hasPointerCapture(e.pointerId)
    ) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }

    dragState.isDragging = false
    dragState.pointerId = null
    flushSync(() => {
      if (nextIndex !== activeEventSnapIndex) {
        setActiveEventSnapIndex(nextIndex)
      }
      setIsEventSnapDragging(false)
      setEventSnapDragOffset(0)
    })
  }

  const handleEventSnapPointerUp = (e) => {
    finishEventSnapPointerInteraction(e)
  }

  const handleEventSnapPointerCancel = (e) => {
    finishEventSnapPointerInteraction(e)
  }

  const handleEventSnapPointerCaptureLost = (e) => {
    finishEventSnapPointerInteraction(e)
  }

  const handleGallerySnapPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (e.target instanceof HTMLElement && e.target.closest('a, button')) return
    const dragState = gallerySnapDragStateRef.current
    const now = performance.now()
    dragState.startX = e.clientX
    dragState.currentX = e.clientX
    dragState.lastX = e.clientX
    dragState.lastTime = now
    dragState.velocityX = 0
    dragState.isDragging = true
    dragState.pointerId = e.pointerId
    setIsGallerySnapDragging(true)
    setGallerySnapDragOffset(0)
    if (typeof e.currentTarget.setPointerCapture === 'function') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // Ignore unsupported pointer capture edge cases.
      }
    }
  }

  const handleGallerySnapPointerMove = (e) => {
    const dragState = gallerySnapDragStateRef.current
    if (!dragState.isDragging || dragState.pointerId !== e.pointerId) return
    const now = performance.now()
    const deltaX = e.clientX - dragState.startX
    const deltaTime = Math.max(now - dragState.lastTime, 1)
    const instantVelocity = (e.clientX - dragState.lastX) / deltaTime
    dragState.velocityX = dragState.velocityX * 0.6 + instantVelocity * 0.4
    dragState.currentX = e.clientX
    dragState.lastX = e.clientX
    dragState.lastTime = now
    setGallerySnapDragOffset(deltaX)
  }

  const finishGallerySnapPointerInteraction = (e) => {
    const dragState = gallerySnapDragStateRef.current
    if (!dragState.isDragging || dragState.pointerId !== e.pointerId) return

    const deltaX = dragState.currentX - dragState.startX
    const velocityX = dragState.velocityX
    const totalItems = galleryDeckItems.length
    if (totalItems <= 1) {
      dragState.isDragging = false
      dragState.pointerId = null
      setIsGallerySnapDragging(false)
      setGallerySnapDragOffset(0)
      return
    }
    let nextIndex = activeGallerySnapIndex

    if (deltaX > SNAP_SWIPE_THRESHOLD || velocityX > SNAP_SWIPE_VELOCITY) {
      // Swipe ke kanan: kartu aktif masuk paling belakang.
      nextIndex = toLoopIndex(activeGallerySnapIndex + 1, totalItems)
    } else if (deltaX < -SNAP_SWIPE_THRESHOLD || velocityX < -SNAP_SWIPE_VELOCITY) {
      // Swipe ke kiri: rotasi kebalikan.
      nextIndex = toLoopIndex(activeGallerySnapIndex - 1, totalItems)
    }

    if (
      typeof e.currentTarget.hasPointerCapture === 'function' &&
      e.currentTarget.hasPointerCapture(e.pointerId)
    ) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }

    dragState.isDragging = false
    dragState.pointerId = null
    flushSync(() => {
      if (nextIndex !== activeGallerySnapIndex) {
        setActiveGallerySnapIndex(nextIndex)
      }
      setIsGallerySnapDragging(false)
      setGallerySnapDragOffset(0)
    })
  }

  const handleGallerySnapPointerUp = (e) => {
    finishGallerySnapPointerInteraction(e)
  }

  const handleGallerySnapPointerCancel = (e) => {
    finishGallerySnapPointerInteraction(e)
  }

  const handleGallerySnapPointerCaptureLost = (e) => {
    finishGallerySnapPointerInteraction(e)
  }

  const finishEventDeckPointerInteraction = (pointerId = null, options = {}) => {
    const { skipSnapBackAnimation = false } = options
    const dragState = eventDeckDragStateRef.current
    if (!dragState.isDragging) return
    if (pointerId !== null && dragState.pointerId !== pointerId) return

    const currentOffset = flushEventDeckDragOffset()
    const releaseVelocityX = dragState.velocityX
    const currentIndex = activeEventDeckIndex
    const hasMoved = dragState.hasMoved
    eventDeckDragStateRef.current = createDeckDragState()
    setEventDeckDragging(false)
    const canShiftNext = currentIndex < eventDeckItems.length - 1
    const canShiftPrev = currentIndex > 0

    let direction = null
    let nextIndex = currentIndex
    if (currentOffset <= -activeDeckSwipeThreshold && canShiftNext) {
      direction = 'next'
      nextIndex = Math.min(currentIndex + 1, Math.max(eventDeckItems.length - 1, 0))
    } else if (currentOffset >= activeDeckSwipeThreshold && canShiftPrev) {
      direction = 'prev'
      nextIndex = Math.max(currentIndex - 1, 0)
    } else if (releaseVelocityX <= -activeDeckFlickVelocityThreshold && canShiftNext) {
      direction = 'next'
      nextIndex = Math.min(currentIndex + 1, Math.max(eventDeckItems.length - 1, 0))
    } else if (releaseVelocityX >= activeDeckFlickVelocityThreshold && canShiftPrev) {
      direction = 'prev'
      nextIndex = Math.max(currentIndex - 1, 0)
    }

    clearEventDeckTransitionTimers()
    cancelEventDeckReleaseFrame()

    if (!direction) {
      if (skipSnapBackAnimation || !hasMoved) {
        setEventDeckDragOffsetImmediate(0)
        setEventDeckThrowing(false)
        return
      }
      setEventDeckThrowing(true)
      eventDeckReleaseFrameRef.current = window.requestAnimationFrame(() => {
        eventDeckReleaseFrameRef.current = null
        setEventDeckDragOffsetImmediate(0)
      })
      eventDeckThrowTimeoutRef.current = window.setTimeout(() => {
        eventDeckThrowTimeoutRef.current = null
        setEventDeckThrowing(false)
      }, deckThrowDurationMs)
      return
    }

    setEventDeckThrowing(true)
    const throwDistance = deckThrowDistance
    eventDeckReleaseFrameRef.current = window.requestAnimationFrame(() => {
      eventDeckReleaseFrameRef.current = null
      setEventDeckDragOffsetImmediate(direction === 'next' ? -throwDistance : throwDistance)
    })
    eventDeckThrowTimeoutRef.current = window.setTimeout(() => {
      eventDeckThrowTimeoutRef.current = null
      setActiveEventDeckIndex(nextIndex)
      setEventDeckDragOffsetImmediate(0)
      setEventDeckThrowing(false)
    }, deckThrowDurationMs)
  }

  const handleEventDeckPointerDown = (event) => {
    if (!activeEventDeckItem || eventDeckItems.length <= 1 || isEventDeckTransitioning) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (event.target instanceof HTMLElement && event.target.closest('a, button')) {
      return
    }
    if (event.cancelable) {
      event.preventDefault()
    }

    eventDeckDragStateRef.current = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      isDragging: true,
      startClientX: event.clientX,
      startClientY: event.clientY,
      hasMoved: false,
      lastClientX: event.clientX,
      lastTimestamp: performance.now(),
      velocityX: 0,
    }
    setEventDeckDragging(true)

    if (typeof event.currentTarget.setPointerCapture === 'function') {
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Ignore browsers that reject pointer capture for some pointer types.
      }
    }
  }

  const handleEventDeckPointerMove = (event) => {
    const dragState = eventDeckDragStateRef.current
    if (!dragState.isDragging || dragState.pointerId !== event.pointerId) return
    if (event.cancelable) {
      event.preventDefault()
    }

    const deltaX = event.clientX - dragState.startClientX
    const deltaY = event.clientY - dragState.startClientY
    const now = performance.now()
    const deltaTime = Math.max(now - dragState.lastTimestamp, 1)
    const instantVelocity = (event.clientX - dragState.lastClientX) / deltaTime
    dragState.velocityX = dragState.velocityX * 0.62 + instantVelocity * 0.38
    dragState.lastClientX = event.clientX
    dragState.lastTimestamp = now
    if (Math.abs(deltaX) > activeDeckClickMoveThreshold || Math.abs(deltaY) > activeDeckClickMoveThreshold) {
      dragState.hasMoved = true
    }
    if (
      dragState.pointerType === 'touch' &&
      Math.abs(deltaY) > Math.abs(deltaX) &&
      Math.abs(deltaY) > 10
    ) {
      releaseEventDeckPointerCapture(event)
      eventDeckDragStateRef.current = createDeckDragState()
      setEventDeckDragging(false)
      setEventDeckDragOffsetImmediate(0)
      return
    }

    const minDragOffset = canShiftEventNext ? -deckDragClamp : 0
    const maxDragOffset = canShiftEventPrev ? deckDragClamp : 0
    const constrainedDeltaX = applyDeckDragResistance(deltaX, minDragOffset, maxDragOffset)
    queueEventDeckDragOffset(constrainedDeltaX)
  }

  const releaseEventDeckPointerCapture = (event) => {
    if (
      typeof event.currentTarget.hasPointerCapture === 'function' &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleEventDeckPointerUp = (event) => {
    const dragState = eventDeckDragStateRef.current
    const isTap =
      dragState.isDragging &&
      dragState.pointerId === event.pointerId &&
      !dragState.hasMoved
    releaseEventDeckPointerCapture(event)
    finishEventDeckPointerInteraction(event.pointerId, { skipSnapBackAnimation: isTap })
    if (isTap && activeEventDeckItem) {
      setEventDeckFlipped((previous) => !previous)
    }
  }

  const handleEventDeckPointerCancel = (event) => {
    releaseEventDeckPointerCapture(event)
    finishEventDeckPointerInteraction(event.pointerId)
  }

  const handleEventDeckPointerCaptureLost = (event) => {
    finishEventDeckPointerInteraction(event.pointerId)
  }

  const handleEventDeckCardKeyDown = (event) => {
    if (isEventDeckTransitioning || !activeEventDeckItem) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    setEventDeckFlipped((previous) => !previous)
  }

  const finishGalleryDeckPointerInteraction = (pointerId = null, options = {}) => {
    const { skipSnapBackAnimation = false } = options
    const dragState = galleryDeckDragStateRef.current
    if (!dragState.isDragging) return
    if (pointerId !== null && dragState.pointerId !== pointerId) return

    const currentOffset = flushGalleryDeckDragOffset()
    const releaseVelocityX = dragState.velocityX
    const currentIndex = activeGalleryDeckIndex
    const hasMoved = dragState.hasMoved
    galleryDeckDragStateRef.current = createDeckDragState()
    setGalleryDeckDragging(false)
    const canShiftNext = currentIndex < galleryDeckItems.length - 1
    const canShiftPrev = currentIndex > 0

    let direction = null
    let nextIndex = currentIndex
    if (currentOffset <= -activeDeckSwipeThreshold && canShiftNext) {
      direction = 'next'
      nextIndex = Math.min(currentIndex + 1, Math.max(galleryDeckItems.length - 1, 0))
    } else if (currentOffset >= activeDeckSwipeThreshold && canShiftPrev) {
      direction = 'prev'
      nextIndex = Math.max(currentIndex - 1, 0)
    } else if (releaseVelocityX <= -activeDeckFlickVelocityThreshold && canShiftNext) {
      direction = 'next'
      nextIndex = Math.min(currentIndex + 1, Math.max(galleryDeckItems.length - 1, 0))
    } else if (releaseVelocityX >= activeDeckFlickVelocityThreshold && canShiftPrev) {
      direction = 'prev'
      nextIndex = Math.max(currentIndex - 1, 0)
    }

    clearGalleryDeckTransitionTimers()
    cancelGalleryDeckReleaseFrame()

    if (!direction) {
      if (skipSnapBackAnimation || !hasMoved) {
        setGalleryDeckDragOffsetImmediate(0)
        setGalleryDeckThrowing(false)
        return
      }
      setGalleryDeckThrowing(true)
      galleryDeckReleaseFrameRef.current = window.requestAnimationFrame(() => {
        galleryDeckReleaseFrameRef.current = null
        setGalleryDeckDragOffsetImmediate(0)
      })
      galleryDeckThrowTimeoutRef.current = window.setTimeout(() => {
        galleryDeckThrowTimeoutRef.current = null
        setGalleryDeckThrowing(false)
      }, deckThrowDurationMs)
      return
    }

    setGalleryDeckThrowing(true)
    const throwDistance = deckThrowDistance
    galleryDeckReleaseFrameRef.current = window.requestAnimationFrame(() => {
      galleryDeckReleaseFrameRef.current = null
      setGalleryDeckDragOffsetImmediate(direction === 'next' ? -throwDistance : throwDistance)
    })
    galleryDeckThrowTimeoutRef.current = window.setTimeout(() => {
      galleryDeckThrowTimeoutRef.current = null
      setActiveGalleryDeckIndex(nextIndex)
      setGalleryDeckDragOffsetImmediate(0)
      setGalleryDeckThrowing(false)
    }, deckThrowDurationMs)
  }

  const handleGalleryDeckPointerDown = (event) => {
    if (!activeGalleryDeckItem || galleryDeckItems.length <= 1 || isGalleryDeckTransitioning) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (event.target instanceof HTMLElement && event.target.closest('a, button')) {
      return
    }
    if (event.cancelable) {
      event.preventDefault()
    }

    galleryDeckDragStateRef.current = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      isDragging: true,
      startClientX: event.clientX,
      startClientY: event.clientY,
      hasMoved: false,
      lastClientX: event.clientX,
      lastTimestamp: performance.now(),
      velocityX: 0,
    }
    setGalleryDeckDragging(true)

    if (typeof event.currentTarget.setPointerCapture === 'function') {
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Ignore browsers that reject pointer capture for some pointer types.
      }
    }
  }

  const handleGalleryDeckPointerMove = (event) => {
    const dragState = galleryDeckDragStateRef.current
    if (!dragState.isDragging || dragState.pointerId !== event.pointerId) return
    if (event.cancelable) {
      event.preventDefault()
    }

    const deltaX = event.clientX - dragState.startClientX
    const deltaY = event.clientY - dragState.startClientY
    const now = performance.now()
    const deltaTime = Math.max(now - dragState.lastTimestamp, 1)
    const instantVelocity = (event.clientX - dragState.lastClientX) / deltaTime
    dragState.velocityX = dragState.velocityX * 0.62 + instantVelocity * 0.38
    dragState.lastClientX = event.clientX
    dragState.lastTimestamp = now
    if (Math.abs(deltaX) > activeDeckClickMoveThreshold || Math.abs(deltaY) > activeDeckClickMoveThreshold) {
      dragState.hasMoved = true
    }
    if (
      dragState.pointerType === 'touch' &&
      Math.abs(deltaY) > Math.abs(deltaX) &&
      Math.abs(deltaY) > 10
    ) {
      releaseGalleryDeckPointerCapture(event)
      galleryDeckDragStateRef.current = createDeckDragState()
      setGalleryDeckDragging(false)
      setGalleryDeckDragOffsetImmediate(0)
      return
    }

    const minDragOffset = canShiftGalleryNext ? -deckDragClamp : 0
    const maxDragOffset = canShiftGalleryPrev ? deckDragClamp : 0
    const constrainedDeltaX = applyDeckDragResistance(deltaX, minDragOffset, maxDragOffset)
    queueGalleryDeckDragOffset(constrainedDeltaX)
  }

  const releaseGalleryDeckPointerCapture = (event) => {
    if (
      typeof event.currentTarget.hasPointerCapture === 'function' &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleGalleryDeckPointerUp = (event) => {
    const dragState = galleryDeckDragStateRef.current
    const isTap =
      dragState.isDragging &&
      dragState.pointerId === event.pointerId &&
      !dragState.hasMoved
    releaseGalleryDeckPointerCapture(event)
    finishGalleryDeckPointerInteraction(event.pointerId, { skipSnapBackAnimation: isTap })
    if (isTap && activeGalleryDeckItem) {
      setGalleryDeckFlipped((previous) => !previous)
    }
  }

  const handleGalleryDeckPointerCancel = (event) => {
    releaseGalleryDeckPointerCapture(event)
    finishGalleryDeckPointerInteraction(event.pointerId)
  }

  const handleGalleryDeckPointerCaptureLost = (event) => {
    finishGalleryDeckPointerInteraction(event.pointerId)
  }

  const handleGalleryDeckCardKeyDown = (event) => {
    if (isGalleryDeckTransitioning || !activeGalleryDeckItem) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    setGalleryDeckFlipped((previous) => !previous)
  }

  useEffect(() => {
    const onResize = () => {
      if (!isCompactViewport) {
        scrollFacilityToIndex(activeFacilityIndex, 'auto')
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [activeFacilityIndex, isCompactViewport])

  useEffect(
    () => () => {
      clearFacilityInteractionTimeout()
      clearGalleryInteractionTimeout()
      clearEventDeckTransitionTimers()
      clearGalleryDeckTransitionTimers()
      cancelEventDeckDragFrame()
      cancelGalleryDeckDragFrame()
      cancelEventDeckReleaseFrame()
      cancelGalleryDeckReleaseFrame()
      galleryTrackRef.current?.classList.remove('is-dragging')
      resetGalleryDragState()
      if (facilityScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(facilityScrollFrameRef.current)
      }
      if (galleryAutoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(galleryAutoScrollFrameRef.current)
      }
    },
    [],
  )

  const openAuthModal = (mode = 'login') => {
    setMobileMenuOpen(false)
    navigateToParentPortal(mode)
  }

  const switchAuthMode = (mode) => {
    if (mode === authModal) return

    setAuthNotice(null)
    setAuthDirection(mode === 'register' ? 'forward' : 'back')
    setAuthModal(mode)
  }

  const closeAuthModal = () => {
    setAuthModal('none')
    setAuthNotice(null)
  }

  const handleParentLoginSubmit = async (event) => {
    event.preventDefault()
    if (!parentLoginForm.email.trim() || !parentLoginForm.password.trim()) {
      setAuthNotice({
        type: 'error',
        text: 'Email dan password wajib diisi.',
      })
      return
    }

    setSubmittingAuth(true)
    setAuthNotice(null)
    try {
      const session = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: parentLoginForm.email,
          password: parentLoginForm.password,
          loginPreference: 'PARENT_FIRST',
        }),
      })
      if (session?.user?.role !== 'ORANG_TUA') {
        throw new Error('Akun ini bukan akun orang tua.')
      }

      setParentSession({
        user: session.user,
        expiresAt: session.expiresAt,
      })
      const storedChildId = readStoredChildId(session.user.id)
      const dashboard = await loadParentDashboard(storedChildId)
      const childIds = dashboard?.children?.map((child) => child.id) ?? []
      const hasStoredChild = Boolean(storedChildId && childIds.includes(storedChildId))
      if (!hasStoredChild) {
        clearStoredChildId(session.user.id)
      }
      setParentPortalView(hasStoredChild ? 'dashboard' : 'picker')
      setParentDashboardTab('beranda')
      setSelectedReportId('')
      setInventoryOpen(true)
      setCarriedItemsDetailOpen(false)
      setActiveFinanceCard('')
      setActiveLunasItemId('')
      setShowLinkChildPanel(false)
      setParentLoginForm({
        email: '',
        password: '',
      })
      closeAuthModal()
      navigateToParentPortal()
    } catch (error) {
      setAuthNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Login gagal.',
      })
    } finally {
      setSubmittingAuth(false)
    }
  }

  const handleParentRegisterSubmit = async (event) => {
    event.preventDefault()

    const email = parentRegisterForm.email.trim()
    const password = parentRegisterForm.password.trim()
    const registrationCode = parentRegisterForm.registrationCode.trim()

    if (!email || !password || !registrationCode) {
      setAuthNotice({
        type: 'error',
        text: 'Email, password, dan kode registrasi wajib diisi.',
      })
      return
    }

    setSubmittingAuth(true)
    setAuthNotice(null)
    try {
      const result = await apiRequest('/auth/register-parent-with-code', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          registrationCode,
        }),
      })

      setParentSession({
        user: result.user,
        expiresAt: result.expiresAt,
      })
      clearStoredChildId(result.user.id)
      syncParentDashboardState(result.dashboard)
      setParentPortalView('picker')
      setParentDashboardTab('beranda')
      setSelectedReportId('')
      setInventoryOpen(true)
      setCarriedItemsDetailOpen(false)
      setActiveFinanceCard('')
      setActiveLunasItemId('')
      setShowLinkChildPanel(false)
      setParentRegisterForm({
        email: '',
        password: '',
        registrationCode: '',
      })
      closeAuthModal()
      navigateToParentPortal()
    } catch (error) {
      setAuthNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Pendaftaran gagal.',
      })
    } finally {
      setSubmittingAuth(false)
    }
  }

  const handleParentLogout = async () => {
    try {
      await apiRequest('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({}),
      })
    } catch {
      // Ignore logout network error and clear local state anyway.
    } finally {
      clearStoredChildId(parentSession?.user?.id)
      setParentSession(null)
      setParentDashboard(null)
      setActiveChildId('')
      setParentPortalView('picker')
      setParentDashboardTab('beranda')
      setSelectedReportId('')
      setInventoryOpen(true)
      setCarriedItemsDetailOpen(false)
      setActiveFinanceCard('')
      setActiveLunasItemId('')
      setShowLinkChildPanel(false)
      setLinkChildForm({ registrationCode: '' })
      setAuthNotice(null)
      navigateToLanding()
    }
  }

  const handleLinkChildSubmit = async (event) => {
    event.preventDefault()
    if (!linkChildForm.registrationCode.trim()) {
      setAuthNotice({
        type: 'error',
        text: 'Masukkan kode registrasi anak terlebih dahulu.',
      })
      return
    }

    setSubmittingLinkChild(true)
    setAuthNotice(null)
    try {
      const dashboard = await apiRequest('/parent/link-child', {
        method: 'POST',
        body: JSON.stringify({
          registrationCode: linkChildForm.registrationCode,
        }),
      })
      syncParentDashboardState(dashboard)
      setLinkChildForm({ registrationCode: '' })
      setAuthNotice({
        type: 'success',
        text: 'Anak berhasil ditambahkan ke akun orang tua.',
      })
    } catch (error) {
      setAuthNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Gagal menautkan anak.',
      })
    } finally {
      setSubmittingLinkChild(false)
    }
  }

  const activeChild =
    parentDashboard?.children?.find((child) => child.id === activeChildId) ??
    parentDashboard?.children?.[0] ??
    null
  const activeDailyReport = activeChild
    ? parentDashboard?.dailyReports?.[activeChild.id] ?? null
    : null
  const activeCarriedItems = Array.isArray(activeDailyReport?.carriedItems)
    ? activeDailyReport.carriedItems
    : []
  const activeAttendanceReports = activeChild
    ? (parentDashboard?.attendanceRecords ?? []).filter(
      (report) => report.childId === activeChild.id,
    )
    : []
  const activeBillingSnapshot = activeChild
    ? parentDashboard?.billingByChild?.[activeChild.id] ?? null
    : null
  const activeInventoryItems = activeChild
    ? parentDashboard?.inventoryByChild?.[activeChild.id] ?? []
    : []
  const fallbackInventoryItems = Array.from(
    activeAttendanceReports.reduce((map, report) => {
      const reportItems = Array.isArray(report.carriedItems) ? report.carriedItems : []
      reportItems.forEach((item) => {
        const key = `${item.category || 'barang'}-${item.description || ''}`
        if (!map.has(key)) {
          map.set(key, {
            id: key,
            productName: item.category || 'Barang',
            description: item.description || '-',
            quantity: 1,
            imageDataUrl: item.imageDataUrl || '',
          })
        }
      })
      return map
    }, new Map()),
  )
  const resolvedInventoryItems = Array.isArray(activeInventoryItems) && activeInventoryItems.length > 0
    ? activeInventoryItems
    : fallbackInventoryItems
  const lowStockInventoryItems = Array.isArray(resolvedInventoryItems)
    ? resolvedInventoryItems.filter((item) => Number(item.quantity) <= LOW_STOCK_THRESHOLD)
    : []
  const selectedReport =
    activeAttendanceReports.find((report) => report.attendanceId === selectedReportId) ?? null
  const reportDetail = selectedReport || activeDailyReport
  const reportTimeline = buildActivityTimeline(reportDetail)
  const outstandingPeriods = activeBillingSnapshot?.periods?.filter(
    (period) => Number(period.outstandingAmount) > 0,
  ) ?? []
  const paidTransactions = activeBillingSnapshot?.transactions?.filter(
    (transaction) => transaction.transactionType === 'payment' && Number(transaction.amount) > 0,
  ) ?? []

  const formatReportDate = (dateValue) => {
    if (!dateValue) {
      return '-'
    }
    const parsed = new Date(`${dateValue}T00:00:00`)
    if (Number.isNaN(parsed.getTime())) {
      return dateValue
    }
    return parsed.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const formatCurrency = (amountValue) => {
    const amount = Number(amountValue)
    if (!Number.isFinite(amount)) {
      return 'Rp0'
    }
    return priceFormatter.format(amount)
  }

  const openChildDashboard = (childId) => {
    writeStoredChildId(parentSession?.user?.id, childId)
    setActiveChildId(childId)
    setParentPortalView('dashboard')
    setParentDashboardTab('beranda')
    setSelectedReportId('')
    setInventoryOpen(true)
    setCarriedItemsDetailOpen(false)
    setActiveFinanceCard('')
    setActiveLunasItemId('')
    setShowLinkChildPanel(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    if (parentPortalView === 'dashboard' && !activeChild) {
      setParentPortalView('picker')
    }
  }, [parentPortalView, activeChild])

  useEffect(() => {
    setSelectedReportId('')
    setInventoryOpen(true)
    setCarriedItemsDetailOpen(false)
    setActiveFinanceCard('')
    setActiveLunasItemId('')
  }, [activeChildId])

  useEffect(() => {
    if (parentDashboardTab !== 'laporan') {
      setSelectedReportId('')
    }
  }, [parentDashboardTab])

  useEffect(() => {
    if (parentDashboardTab !== 'keuangan') {
      setActiveFinanceCard('')
      setActiveLunasItemId('')
      return undefined
    }

    const handlePointerDown = (event) => {
      if (!financePanelRef.current) return
      if (financePanelRef.current.contains(event.target)) return
      setActiveFinanceCard('')
      setActiveLunasItemId('')
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
    }
  }, [parentDashboardTab])

  if (isParentPortalPage) {
    return (
      <section className="landing-loading">
        <div className="landing-loading__card">
          <h2>Mengarahkan ke Portal Orang Tua...</h2>
          <p>
            Login dan dashboard orang tua sekarang dibuka di portal terpisah agar
            tampil seperti website penuh dan tetap bisa scroll/refresh normal di mobile.
          </p>
        </div>
      </section>
    )
  }


  return (
    <div className="landing-page">
      <header className={`topbar ${scrolled ? 'topbar--scrolled' : ''}`}>
        <div className="topbar__inner section-shell">
          <a
            href="#home"
            className="brand"
            aria-label="TPA Rumah Ceria UBAYA"
            onClick={(event) => {
              event.preventDefault()
              scrollToSection('home')
            }}
          >
            <span className="brand__logo-wrap">
              <img src={platformLogoSrc} alt="Logo TPA UBAYA" className="brand__logo" />
            </span>
            <span className="brand__text">
              <strong>TPA Rumah Ceria UBAYA</strong>
              <small>Taman Pengasuhan Anak</small>
            </span>
          </a>

          <div className="topbar__right">
            <div className="topbar__desktop">
              <nav className="topbar__menu" ref={menuRef} aria-label="Navigasi halaman">
                <span
                  className="topbar__indicator"
                  style={{ transform: `translateX(${indicatorStyle.left}px)`, width: `${indicatorStyle.width}px` }}
                  aria-hidden="true"
                />
                {navSections.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    ref={(node) => {
                      navItemRefs.current[item.id] = node
                    }}
                    className={activeSection === item.id ? 'active' : ''}
                    onClick={() => scrollToSection(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>

              <div className="topbar__actions">
                <button
                  type="button"
                  className="topbar__auth-btn topbar__auth-btn--entry"
                  onClick={() => navigateToParentPortal()}
                >
                  Masuk
                </button>
              </div>
            </div>

            <button
              type="button"
              className={`topbar__burger ${mobileMenuOpen ? 'is-open' : ''}`}
              onClick={() => setMobileMenuOpen((previous) => !previous)}
              aria-controls="topbar-mobile-panel"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Tutup menu' : 'Buka menu'}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>

        <div
          id="topbar-mobile-panel"
          className={`topbar__mobile-panel ${mobileMenuOpen ? 'is-open' : ''}`}
          aria-hidden={!mobileMenuOpen}
        >
          <nav className="topbar__mobile-menu" aria-label="Navigasi mobile">
            {navSections.map((item) => (
              <button
                key={`mobile-${item.id}`}
                type="button"
                className={activeSection === item.id ? 'active' : ''}
                onClick={() => scrollToSection(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="topbar__mobile-actions">
            <button
              type="button"
              className="topbar__auth-btn topbar__auth-btn--entry"
              onClick={() => navigateToParentPortal()}
            >
              Masuk
            </button>
          </div>
        </div>
      </header>

      {mobileMenuOpen ? (
        <button
          type="button"
          className="topbar__mobile-backdrop"
          aria-label="Tutup menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      ) : null}

      <main>
        <section
          id="home"
          className={`page-section home-hero ${visibleSections.home ? 'is-visible' : ''}`}
          style={{
            '--home-bg-image': `url(${heroPhotoDesktopSrc})`,
            '--home-bg-image-mobile': `url(${heroPhotoMobileSrc})`,
            backgroundImage: `url(${heroPhotoDesktopSrc})`,
          }}
        >
          <div className="section-shell home-section">
            <div className="home-section__content">
              <h1>
                Tumbuh Ceria,
                <br />
                Bersama <span>TPA Rumah Ceria UBAYA</span>
              </h1>
              <p className="home-lead">
                TPA Rumah Ceria UBAYA menghadirkan lingkungan yang aman, suportif, dan penuh kasih untuk
                mendampingi perkembangan anak sejak dini melalui kegiatan terstruktur.
              </p>

              {heroAnnouncement ? (
                <article className="hero-announcement-banner">
                  {heroAnnouncement.coverImageDataUrl ? (
                    <img
                      src={heroAnnouncement.coverImageDataUrl}
                      alt={heroAnnouncement.title}
                      className="hero-announcement-banner__image"
                    />
                  ) : null}
                  <div className="hero-announcement-banner__content">
                    <p className="hero-announcement-banner__badge">{heroAnnouncementLabel}</p>
                    <h3>{heroAnnouncement.title}</h3>
                    <p>{heroAnnouncement.excerpt || heroAnnouncement.content}</p>
                    {heroAnnouncement.ctaLabel && heroAnnouncement.ctaUrl ? (
                      <a
                        href={heroAnnouncement.ctaUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="button button--ghost hero-announcement-banner__cta"
                      >
                        {heroAnnouncement.ctaLabel}
                      </a>
                    ) : null}
                  </div>
                </article>
              ) : null}

              <div className="home-actions">
                <a href={whatsappUrl} target="_blank" rel="noreferrer" className="button button--cta-whatsapp">
                  <span className="cta-action__icon" aria-hidden="true">
                    <WhatsAppIcon />
                  </span>
                  Daftar Sekarang
                </a>
                <a href={instagramUrl} target="_blank" rel="noreferrer" className="button button--cta-instagram">
                  <span className="cta-action__icon" aria-hidden="true">
                    <InstagramIcon />
                  </span>
                  Instagram
                </a>
              </div>
            </div>

            <figure className="home-section__media">
              <img src={activityPhotoSrc} alt="Kegiatan bersama anak di TPA" />
              <figcaption>Kegiatan bersama anak di TPA Rumah Ceria UBAYA</figcaption>
            </figure>
          </div>
        </section>

        <section
          id="tentang-kami"
          className={`page-section ${visibleSections['tentang-kami'] ? 'is-visible' : ''}`}
        >
          <div className="section-shell tentang-page">
            <div className="tentang-section">
              <figure className="tentang-section__photo">
                <img src={headPhotoSrc} alt="Foto kepala TPA Rumah Ceria UBAYA" />
              </figure>
              <article className="tentang-section__content">
                <h2>Tentang Kami</h2>
                <p>
                  TPA Rumah Ceria UBAYA berada di bawah naungan Fakultas Psikologi Universitas Surabaya
                  sebagai layanan pendampingan anak usia dini yang aman dan penuh kasih.
                </p>
                <p>
                  Pendampingan dilakukan dengan pendekatan psikologi perkembangan untuk membantu anak
                  membangun kemandirian, keterampilan dasar, dan kesiapan belajar secara seimbang.
                </p>
                <p>
                  Layanan ditujukan untuk anak usia 2 sampai 7 tahun melalui aktivitas harian terstruktur,
                  bermain bersama, serta pembiasaan yang sesuai tahap perkembangan.
                </p>
              </article>
            </div>

            <div className="visi-section">
              <div className="visi-grid">
                <article className="visi-pane">
                  <h2>Visi</h2>
                  <p>
                    Setiap fase dalam kehidupan anak merupakan saat berarti untuk mengembangkan diri.
                    Proses belajar yang dialami di usia dini menjadi bekal kokoh yang memantapkan anak
                    menghadapi berbagai tantangan. Mendampingi anak bertumbuh dan berkembang dengan ceria
                    adalah visi TPA Rumah Ceria UBAYA.
                  </p>
                </article>

                <article className="visi-pane">
                  <h2>Program Unggulan</h2>
                  <ul className="bullet-list">
                    {programItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section
          id="tim-kami"
          className={`page-section ${visibleSections['tim-kami'] ? 'is-visible' : ''}`}
        >
          <div className="section-shell tim-section">
            <div className="section-head">
              <h2>Tim Kami</h2>
            </div>
            <p className="tim-section__lead">
              Geser kartu untuk melihat anggota tim lain. Klik kartu untuk melihat pengalaman, jam terbang, atau
              sertifikat pada sisi belakang.
            </p>

            <div
              className="kegiatan-deck tim-deck"
              role="region"
              aria-label="Deck tim. Geser kartu ke kiri atau kanan untuk melihat anggota tim lain."
            >
              {galleryDeckItems.length === 0 ? (
                <article className="operational-grid__item kegiatan-event-card kegiatan-event-card--empty">
                  <h4>Data tim belum tersedia</h4>
                  <p className="kegiatan-event__description">
                    Tambahkan data tim melalui panel admin agar tampil di halaman ini.
                  </p>
                </article>
              ) : (
                <div
                  ref={galleryDeckStageRef}
                  className="kegiatan-deck__stage tim-deck__stage"
                >
                  {[...visibleGalleryLeftDeckItems].reverse().map((item) => (
                    <article
                      key={`${item.deckKey}-left-${item.stackDepth}`}
                      className="kegiatan-deck-card kegiatan-deck-card--team is-back is-left"
                      style={{ '--stack-depth': item.stackDepth }}
                      aria-hidden="true"
                    >
                      <img
                        src={item.image}
                        alt=""
                        className="kegiatan-deck-card__image"
                        draggable={false}
                      />
                      <h4 className="kegiatan-deck-card__title">{item.title}</h4>
                      <p className="kegiatan-deck-card__tap-hint">Klik untuk lihat profil lengkap</p>
                    </article>
                  ))}

                  {[...visibleGalleryRightDeckItems].reverse().map((item) => (
                    <article
                      key={`${item.deckKey}-right-${item.stackDepth}`}
                      className="kegiatan-deck-card kegiatan-deck-card--team is-back is-right"
                      style={{ '--stack-depth': item.stackDepth }}
                      aria-hidden="true"
                    >
                      <img
                        src={item.image}
                        alt=""
                        className="kegiatan-deck-card__image"
                        draggable={false}
                      />
                      <h4 className="kegiatan-deck-card__title">{item.title}</h4>
                      <p className="kegiatan-deck-card__tap-hint">Klik untuk lihat profil lengkap</p>
                    </article>
                  ))}

                  {activeGalleryDeckItem ? (
                    <article
                      key={`${activeGalleryDeckItem.deckKey}-active`}
                      ref={activeGalleryDeckCardRef}
                      className={`kegiatan-deck-card kegiatan-deck-card--team is-top ${isGalleryDeckFlipped ? 'is-flipped' : ''} ${isGalleryDeckDragging ? 'is-dragging' : ''} ${isGalleryDeckThrowing ? 'is-throwing' : ''}`}
                      onPointerDown={handleGalleryDeckPointerDown}
                      onPointerMove={handleGalleryDeckPointerMove}
                      onPointerUp={handleGalleryDeckPointerUp}
                      onPointerCancel={handleGalleryDeckPointerCancel}
                      onLostPointerCapture={handleGalleryDeckPointerCaptureLost}
                      onKeyDown={handleGalleryDeckCardKeyDown}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isGalleryDeckFlipped}
                      aria-label={`Kartu profil ${activeGalleryDeckItem.title}. Klik untuk ${isGalleryDeckFlipped ? 'kembali ke sisi depan' : 'melihat keterangan lengkap'}.`}
                    >
                      <div className="kegiatan-deck-card__flip-inner">
                        <div className="kegiatan-deck-card__face kegiatan-deck-card__face--front">
                          <img
                            src={activeGalleryDeckItem.image}
                            alt={activeGalleryDeckItem.title}
                            className="kegiatan-deck-card__image"
                            draggable={false}
                          />
                          <h4 className="kegiatan-deck-card__title">{activeGalleryDeckItem.title}</h4>
                          <p className="kegiatan-deck-card__tap-hint">Klik untuk lihat profil lengkap</p>
                        </div>
                        <div className="kegiatan-deck-card__face kegiatan-deck-card__face--back tim-deck-card__face--back">
                          <h4 className="kegiatan-deck-card__back-title">{activeGalleryDeckItem.title}</h4>
                          <p className="kegiatan-deck-card__back-description tim-deck-card__back-description">
                            {activeGalleryDeckItem.content || activeGalleryDeckItem.excerpt || 'Keterangan tim belum ditambahkan.'}
                          </p>
                          <p className="kegiatan-deck-card__flip-hint">
                            Klik kartu untuk kembali ke sisi depan.
                          </p>
                        </div>
                      </div>
                    </article>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="fasilitas" className={`page-section ${visibleSections.fasilitas ? 'is-visible' : ''}`}>
          <div className="section-shell fasilitas-section">
            <div className="section-head">
              <h2>Fasilitas TPA</h2>
            </div>

            <div className="facility-slider">
              <button
                type="button"
                className="facility-slider__nav facility-slider__nav--prev"
                onClick={handleFacilityPrev}
                aria-label="Fasilitas sebelumnya"
                disabled={!canNavigateFacility || activeFacilityIndex <= 0}
              >
                <span className="facility-slider__nav-icon" aria-hidden="true">
                  <ChevronLeftIcon />
                </span>
              </button>

              <div className="facility-slider__viewport">
                <div
                  ref={facilityTrackRef}
                  className="facility-slider__track"
                  onScroll={handleFacilityTrackScroll}
                  onMouseDown={handleFacilityInteractionStart}
                  onMouseUp={handleFacilityInteractionEnd}
                  onMouseLeave={handleFacilityInteractionEnd}
                  onTouchStart={handleFacilityInteractionStart}
                  onTouchEnd={handleFacilityInteractionEnd}
                  onTouchCancel={handleFacilityInteractionEnd}
                >
                  {renderedFacilityItems.map((item, index) => (
                    <article
                      key={item.loopKey}
                      ref={(node) => {
                        facilityCardRefs.current[index] = node
                      }}
                      className={`facility-slider__card ${activeFacilityIndex === item.originalIndex ? 'is-active' : ''}`}
                    >
                      <img src={item.image} alt={item.name} className="facility-slider__image" />
                      <p className="facility-slider__name">{item.name}</p>
                    </article>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="facility-slider__nav facility-slider__nav--next"
                onClick={handleFacilityNext}
                aria-label="Fasilitas berikutnya"
                disabled={!canNavigateFacility || activeFacilityIndex >= facilityItems.length - 1}
              >
                <span className="facility-slider__nav-icon" aria-hidden="true">
                  <ChevronRightIcon />
                </span>
              </button>
            </div>

            <article className="facility-description" aria-live="polite">
              <div key={`facility-description-${activeFacilityIndex}`} className="facility-description__content">
                <h3>{facilityItems[activeFacilityIndex]?.name}</h3>
                <p>{facilityItems[activeFacilityIndex]?.description}</p>
                <p className="facility-description__detail">{facilityItems[activeFacilityIndex]?.detail}</p>
              </div>
            </article>
          </div>
        </section>

        <section id="kegiatan" className={`page-section ${visibleSections.kegiatan ? 'is-visible' : ''}`}>
          <div className="section-shell kegiatan-section">
            <div className="section-head">
              <h2>Kegiatan</h2>
            </div>

            {isLoadingLandingAnnouncements ? (
              <p className="kegiatan-event__loading">Memuat update terbaru...</p>
            ) : null}

            <div className="kegiatan-layout">
              <article className="operational-card kegiatan-block">
                <div className="kegiatan-block__head">
                  <h3>Event</h3>
                  <p>Agenda kegiatan terjadwal yang bisa diikuti anak.</p>
                </div>
                {(isKegiatanDeckUnified || !isCompactViewport) ? (
                  <div
                    className="kegiatan-deck kegiatan-deck--event"
                    role="region"
                    aria-label="Deck event. Geser kartu ke kiri atau kanan untuk melihat event lain."
                  >
                    {eventDeckItems.length === 0 ? (
                      <article className="operational-grid__item kegiatan-event-card kegiatan-event-card--empty">
                        <h4>Belum ada event aktif</h4>
                        <p className="kegiatan-event__description">
                          Tambahkan data event melalui panel admin agar tampil di halaman ini.
                        </p>
                      </article>
                    ) : (
                      <>
                        <div
                          ref={eventDeckStageRef}
                          className="kegiatan-deck__stage kegiatan-deck__stage--event"
                        >
                          {[...visibleEventLeftDeckItems].reverse().map((item) => (
                            <article
                              key={`${item.deckKey}-left-${item.stackDepth}`}
                              className="kegiatan-deck-card kegiatan-deck-card--event is-back is-left"
                              style={{ '--stack-depth': item.stackDepth }}
                              aria-hidden="true"
                            >
                              <img
                                src={item.image}
                                alt=""
                                className="kegiatan-deck-card__image"
                                draggable={false}
                              />
                              <h4 className="kegiatan-deck-card__title">{item.title}</h4>
                              <p className="kegiatan-deck-card__tap-hint">Klik untuk lihat selengkapnya</p>
                              {item.period ? (
                                <p className="kegiatan-deck-card__badge" title={item.period}>
                                  {item.period}
                                </p>
                              ) : null}
                            </article>
                          ))}

                          {[...visibleEventRightDeckItems].reverse().map((item) => (
                            <article
                              key={`${item.deckKey}-right-${item.stackDepth}`}
                              className="kegiatan-deck-card kegiatan-deck-card--event is-back is-right"
                              style={{ '--stack-depth': item.stackDepth }}
                              aria-hidden="true"
                            >
                              <img
                                src={item.image}
                                alt=""
                                className="kegiatan-deck-card__image"
                                draggable={false}
                              />
                              <h4 className="kegiatan-deck-card__title">{item.title}</h4>
                              <p className="kegiatan-deck-card__tap-hint">Klik untuk lihat selengkapnya</p>
                              {item.period ? (
                                <p className="kegiatan-deck-card__badge" title={item.period}>
                                  {item.period}
                                </p>
                              ) : null}
                            </article>
                          ))}

                          {activeEventDeckItem ? (
                            <article
                              key={`${activeEventDeckItem.deckKey}-active`}
                              ref={activeEventDeckCardRef}
                              className={`kegiatan-deck-card kegiatan-deck-card--event is-top ${isEventDeckFlipped ? 'is-flipped' : ''} ${isEventDeckDragging ? 'is-dragging' : ''} ${isEventDeckThrowing ? 'is-throwing' : ''}`}
                              onPointerDown={handleEventDeckPointerDown}
                              onPointerMove={handleEventDeckPointerMove}
                              onPointerUp={handleEventDeckPointerUp}
                              onPointerCancel={handleEventDeckPointerCancel}
                              onLostPointerCapture={handleEventDeckPointerCaptureLost}
                              onKeyDown={handleEventDeckCardKeyDown}
                              role="button"
                              tabIndex={0}
                              aria-pressed={isEventDeckFlipped}
                              aria-label={`Kartu event ${activeEventDeckItem.title}. Klik untuk ${isEventDeckFlipped ? 'kembali ke sisi depan' : 'melihat keterangan lengkap'}.`}
                            >
                              <div className="kegiatan-deck-card__flip-inner">
                                <div className="kegiatan-deck-card__face kegiatan-deck-card__face--front">
                                  <img
                                    src={activeEventDeckItem.image}
                                    alt={activeEventDeckItem.title}
                                    className="kegiatan-deck-card__image"
                                    draggable={false}
                                  />
                                  <h4 className="kegiatan-deck-card__title">{activeEventDeckItem.title}</h4>
                                  <p className="kegiatan-deck-card__tap-hint">Klik untuk lihat selengkapnya</p>
                                  {activeEventDeckItem.period ? (
                                    <p className="kegiatan-deck-card__badge" title={activeEventDeckItem.period}>
                                      {activeEventDeckItem.period}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="kegiatan-deck-card__face kegiatan-deck-card__face--back">
                                  {activeEventDeckItem.period ? (
                                    <p className="kegiatan-deck-card__back-period">{activeEventDeckItem.period}</p>
                                  ) : null}
                                  <h4 className="kegiatan-deck-card__back-title">{activeEventDeckItem.title}</h4>
                                  <p className="kegiatan-deck-card__back-description">
                                    {activeEventDeckItem.excerpt || 'Keterangan event belum tersedia.'}
                                  </p>
                                  {activeEventDeckItem.ctaLabel && activeEventDeckItem.ctaUrl ? (
                                    <a
                                      href={activeEventDeckItem.ctaUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="button button--ghost kegiatan-event__cta"
                                    >
                                      {activeEventDeckItem.ctaLabel}
                                    </a>
                                  ) : null}
                                  <p className="kegiatan-deck-card__flip-hint">
                                    Klik kartu untuk kembali ke sisi depan.
                                  </p>
                                </div>
                              </div>
                            </article>
                          ) : null}
                        </div>

                      </>
                    )}
                  </div>
                ) : (
                  <div className="kegiatan-event-scroll" role="region" aria-label="Daftar event yang bisa digeser">
                    <div className="kegiatan-event-track">
                      {eventItems.length === 0 ? (
                        <article className="operational-grid__item kegiatan-event-card kegiatan-event-card--empty">
                          <h4>Belum ada event aktif</h4>
                          <p className="kegiatan-event__description">
                            Tambahkan data event melalui panel admin agar tampil di halaman ini.
                          </p>
                        </article>
                      ) : (
                        eventItems.map((item) => (
                          <article
                            key={`${item.id || item.title}-${item.category}-${item.publishStartDate || item.period}`}
                            className="operational-grid__item kegiatan-event-card"
                          >
                            <div className="kegiatan-card-stack">
                              <img src={item.image} alt={item.title} className="kegiatan-event__image kegiatan-card-stack__image" />
                              <h4 className="kegiatan-card-stack__title">{item.title}</h4>
                              <p className="kegiatan-card-stack__hint">Klik untuk lihat selengkapnya</p>
                              {item.period ? (
                                <p className="kegiatan-card-stack__badge" title={item.period}>
                                  {item.period}
                                </p>
                              ) : null}
                            </div>
                            <div className="kegiatan-event-card__meta">
                              <p className="kegiatan-event__period">{item.period}</p>
                              {item.excerpt ? (
                                <p className="kegiatan-event__description">{item.excerpt}</p>
                              ) : null}
                              {item.ctaLabel && item.ctaUrl ? (
                                <a
                                  href={item.ctaUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="button button--ghost kegiatan-event__cta"
                                >
                                  {item.ctaLabel}
                                </a>
                              ) : null}
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </article>
            </div>
          </div>
        </section>

        <section id="biaya-layanan" className={`page-section ${visibleSections['biaya-layanan'] ? 'is-visible' : ''}`}>
          <div className="section-shell pricing-section">
            <div className="section-head">
              <h2>Paket Layanan TPA</h2>
            </div>

            <div className="pricing-grid">
              {pricingPlans.map((plan) => (
                <article
                  key={plan.title}
                  className={`pricing-card ${plan.isPopular ? 'pricing-card--popular' : ''}`}
                >
                  {plan.isPopular ? <p className="pricing-card__ribbon">Populer</p> : null}

                  <div className="pricing-card__head">
                    <h3>{plan.title}</h3>
                  </div>

                  <p className="pricing-price">
                    {priceFormatter.format(plan.price)} <span>{plan.unit}</span>
                  </p>
                  <p className="pricing-card__summary">{plan.summary}</p>

                  <ul className="bullet-list pricing-benefits">
                    {plan.benefits.map((benefit) => (
                      <li key={benefit}>{benefit}</li>
                    ))}
                  </ul>

                  <a href={whatsappUrl} target="_blank" rel="noreferrer" className="button pricing-card__action">
                    Pilih Paket
                  </a>
                </article>
              ))}
            </div>

            <article className="registration-card">
              <h3>Biaya Pendaftaran</h3>
              <ul className="bullet-list">
                {registrationCosts.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="operational-card">
              <h3>Jam Operasional</h3>
              <div className="operational-grid">
                <article className="operational-grid__item">
                  <h4>Normal</h4>
                  <ul className="operational-list">
                    <li><span>Hari</span><strong>Senin - Jumat</strong></li>
                    <li><span>Jam Operasional</span><strong>08.00 - 16.30 WIB</strong></li>
                    <li><span>Denda Overtime</span><strong>Rp 20.000 / hari (jika dijemput lewat 17.00 WIB)</strong></li>
                    <li><span>Batas Jemput</span><strong>Maksimal 17.30 WIB</strong></li>
                  </ul>
                </article>

                <article className="operational-grid__item">
                  <h4>Khusus Ramadhan</h4>
                  <ul className="operational-list">
                    <li><span>Hari</span><strong>Senin - Jumat</strong></li>
                    <li><span>Jam Operasional</span><strong>08.00 - 16.00 WIB</strong></li>
                    <li><span>Denda Overtime</span><strong>Rp 20.000 / hari (jika dijemput lewat 16.00 WIB)</strong></li>
                    <li><span>Batas Jemput</span><strong>Maksimal 16.30 WIB</strong></li>
                  </ul>
                </article>
              </div>
            </article>
          </div>
        </section>

        <section id="testimoni" className={`page-section ${visibleSections.testimoni ? 'is-visible' : ''}`}>
          <div className="section-shell testimonial-section">
            <div className="section-head">
              <h2>Testimoni Orang Tua</h2>
            </div>
            <div className="testimonial-grid">
              {testimonialItems.map((item) => (
                <article key={item.author} className="testimonial-card">
                  <p className="testimonial-card__quote">"{item.quote}"</p>
                  <p className="testimonial-card__author">{item.author}</p>
                  <p className="testimonial-card__context">{item.context}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="cta" className={`page-section ${visibleSections.cta ? 'is-visible' : ''}`}>
          <div className="section-shell cta-section">
            <p className="cta-section__tag">Mulai Sekarang</p>
            <h2>
              Daftarkan Buah Hati Anda
              <br />
              Hari Ini
            </h2>
            <p>
              Kuota terbatas untuk memastikan setiap anak mendapat perhatian penuh.
              Hubungi kami sekarang untuk jadwal kunjungan dan konsultasi layanan.
            </p>
            <div className="cta-actions">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="button button--cta-whatsapp"
              >
                <span className="cta-action__icon" aria-hidden="true">
                  <WhatsAppIcon />
                </span>
                Whatsapp
              </a>
              <a
                href={instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="button button--cta-instagram"
              >
                <span className="cta-action__icon" aria-hidden="true">
                  <InstagramIcon />
                </span>
                Instagram
              </a>
            </div>
            <p className="cta-section__location">
              Fakultas Psikologi, Universitas Surabaya · Jl. Raya Kali Rungkut, Surabaya
            </p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="section-shell footer__grid">
          <section className="footer__brand">
            <div className="footer__brand-head">
              <span className="footer__brand-logo-wrap">
                <img src={platformLogoSrc} alt="Logo TPA UBAYA" className="footer__brand-logo" />
              </span>
              <div>
                <h3>TPA Rumah Ceria UBAYA</h3>
                <p>Taman Pengasuhan Anak</p>
              </div>
            </div>
            <p className="footer__brand-text">
              Layanan pengasuhan anak berbasis pendampingan tumbuh kembang, di bawah naungan
              Universitas Surabaya.
            </p>
          </section>

          <section className="footer__column">
            <h4>Layanan</h4>
            <ul>
              <li><a href="#tentang-kami">Program Pendampingan</a></li>
              <li><a href="#tim-kami">Tim Kami</a></li>
              <li><a href="#fasilitas">Fasilitas TPA</a></li>
              <li><a href="#kegiatan">Kegiatan</a></li>
              <li><a href="#biaya-layanan">Paket Biaya Layanan</a></li>
            </ul>
          </section>

          <section className="footer__column">
            <h4>Informasi</h4>
            <ul>
              <li><a href="#tentang-kami">Tentang Kami</a></li>
              <li><a href="#tim-kami">Profil Tim</a></li>
              <li><a href="#tentang-kami">Visi dan Program</a></li>
              <li><a href="/privacy-policy">Kebijakan Privasi</a></li>
              <li><a href="/terms-of-service">Syarat Layanan</a></li>
              <li><a href="/cookie-policy">Kebijakan Cookie</a></li>
              <li><a href="/data-consent-form">Form Persetujuan Data</a></li>
            </ul>
          </section>

          <section className="footer__column">
            <h4>Kontak</h4>
            <ul>
              <li>(031) 298 1277</li>
              <li>Jl. Raya Kali Rungkut</li>
              <li>Surabaya</li>
            </ul>
          </section>
        </div>

        <div className="section-shell footer__bottom">
          <p>&copy; {new Date().getFullYear()} TPA Rumah Ceria UBAYA. Hak cipta dilindungi.</p>
          <a href="/privacy-policy" className="footer__privacy-btn">
            Kebijakan Privasi
          </a>
        </div>
      </footer>

      {isPopupAnnouncementVisible && popupAnnouncement ? (
        <section
          className="landing-announcement-popup"
          role="dialog"
          aria-modal="true"
          aria-label={`${popupAnnouncementLabel} terbaru`}
        >
          <button
            type="button"
            className="landing-announcement-popup__backdrop"
            aria-label="Tutup popup pengumuman"
            onClick={closePopupAnnouncement}
          />
          <article className="landing-announcement-popup__card">
            <button
              type="button"
              className="landing-announcement-popup__close"
              onClick={closePopupAnnouncement}
              aria-label="Tutup"
            >
              &times;
            </button>
            {popupAnnouncement.coverImageDataUrl ? (
              <img
                src={popupAnnouncement.coverImageDataUrl}
                alt={popupAnnouncement.title}
                className="landing-announcement-popup__image"
              />
            ) : null}
            <div className="landing-announcement-popup__content">
              <p className="landing-announcement-popup__badge">{popupAnnouncementLabel}</p>
              <h3>{popupAnnouncement.title}</h3>
              {popupAnnouncement.excerpt || popupAnnouncement.content ? (
                <p>{popupAnnouncement.excerpt || popupAnnouncement.content}</p>
              ) : null}
              {popupAnnouncement.ctaLabel && popupAnnouncement.ctaUrl ? (
                <a
                  href={popupAnnouncement.ctaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="button button--ghost landing-announcement-popup__cta"
                >
                  {popupAnnouncement.ctaLabel}
                </a>
              ) : null}
            </div>
          </article>
        </section>
      ) : null}

      {authModal !== 'none' ? (
        <section className="auth-page" role="dialog" aria-modal="true" aria-label="Akses orang tua TPA">
          <div className="auth-page__card">
            <button type="button" className="auth-page__close" onClick={closeAuthModal} aria-label="Tutup">
              &times;
            </button>

            <div className="auth-page__brand">
              <span className="auth-page__logo-wrap">
                <img src={platformLogoSrc} alt="Logo TPA UBAYA" className="auth-page__logo" />
              </span>
              <span className="auth-page__brand-text">
                <strong>TPA Rumah Ceria UBAYA</strong>
                <small>Akses Orang Tua</small>
              </span>
            </div>

            <h3>Selamat Datang Ayah dan Bunda</h3>
            <p className="auth-page__subtitle">
              Silakan masuk atau daftar akun orang tua untuk memantau informasi buah hati di TPA.
            </p>

            <div className="auth-page__hero">
              <span>Akses aman dan terverifikasi</span>
              <span>Terhubung langsung ke data anak</span>
              <span>Login dan daftar lebih cepat</span>
            </div>

            <div className="auth-switch" role="tablist" aria-label="Pilih akses akun orang tua">
              <button
                type="button"
                role="tab"
                aria-selected={authModal === 'login'}
                className={authModal === 'login' ? 'is-active' : ''}
                onClick={() => switchAuthMode('login')}
              >
                Login
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authModal === 'register'}
                className={authModal === 'register' ? 'is-active' : ''}
                onClick={() => switchAuthMode('register')}
              >
                Daftar
              </button>
            </div>

            <p className="auth-form__note">
              {authModal === 'login'
                ? 'Silahkan login untuk membuka dashboard monitoring anak Anda.'
                : 'Silahkan daftarkan akun untuk dapat mengakses dashboard monitoring putra-putri Anda.'}
            </p>

            <div
              key={authModal}
              className={`auth-form-stage auth-form-stage--${authDirection}`}
            >
              {authModal === 'login' ? (
                <form className="auth-form" onSubmit={handleParentLoginSubmit}>
                  <label className="auth-field">
                    Email
                    <input
                      type="email"
                      className="auth-input"
                      value={parentLoginForm.email}
                      placeholder="Masukkan Email Anda"
                      onChange={(event) =>
                        setParentLoginForm((previous) => ({
                          ...previous,
                          email: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="auth-field">
                    Password
                    <input
                      type="password"
                      className="auth-input"
                      value={parentLoginForm.password}
                      placeholder="Masukkan Password Anda"
                      onChange={(event) =>
                        setParentLoginForm((previous) => ({
                          ...previous,
                          password: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <button type="submit" className="button button--primary auth-submit" disabled={isSubmittingAuth}>
                    {isSubmittingAuth ? 'Memproses...' : 'Login'}
                  </button>
                </form>
              ) : (
                <form className="auth-form" onSubmit={handleParentRegisterSubmit}>
                  <label className="auth-field">
                    Email
                    <input
                      type="email"
                      className="auth-input"
                      value={parentRegisterForm.email}
                      placeholder="Masukkan Email Anda"
                      onChange={(event) =>
                        setParentRegisterForm((previous) => ({
                          ...previous,
                          email: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="auth-field">
                    Password
                    <input
                      type="password"
                      className="auth-input"
                      value={parentRegisterForm.password}
                      placeholder="Masukkan Password Anda"
                      onChange={(event) =>
                        setParentRegisterForm((previous) => ({
                          ...previous,
                          password: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="auth-field">
                    Kode Registrasi
                    <input
                      type="text"
                      className="auth-input"
                      value={parentRegisterForm.registrationCode}
                      placeholder="Masukkan Kode Registrasi"
                      onChange={(event) =>
                        setParentRegisterForm((previous) => ({
                          ...previous,
                          registrationCode: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <button type="submit" className="button button--primary auth-submit" disabled={isSubmittingAuth}>
                    {isSubmittingAuth ? 'Memproses...' : 'Daftar'}
                  </button>
                </form>
              )}
            </div>

            {authNotice ? (
              <p className={`auth-notice auth-notice--${authNotice.type}`}>{authNotice.text}</p>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  )
}



