import { useEffect, useMemo, useRef, useState } from 'react'

const logoTpaSrc = `${import.meta.env.BASE_URL}logo_TPA.jpg`
const headPhotoSrc = logoTpaSrc
const activityPhotoSrc = logoTpaSrc

const whatsappUrl = 'https://wa.me/628155042120?text=Halo%20TPA%20Rumah%20Ceria%20UBAYA,%20saya%20ingin%20bertanya.'
const API_BASE_URL = '/api/v1'
const PARENT_PORTAL_PATH = '/portal-orang-tua'
const PARENT_PORTAL_PRODUCTION_HOST = 'apps.tparumahceria.my.id'
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
    return `https://${PARENT_PORTAL_PRODUCTION_HOST}${PARENT_PORTAL_PATH}`
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
    const matched = line.match(/^(\d{1,2}[:.]\d{2})\s*[-â€“]\s*(\d{1,2}[:.]\d{2})\s*[:\-]\s*(.+)$/)
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
  { id: 'home', label: 'Home' },
  { id: 'tentang-kami', label: 'Tentang Kami' },
  { id: 'fasilitas', label: 'Fasilitas' },
  { id: 'galery', label: 'Galery' },
  { id: 'biaya-layanan', label: 'Biaya Layanan' },
]

const programItems = [
  'Melatih kemandirian dalam aktivitas rutin sehari-hari',
  'Aktivitas toilet training',
  'Bermain bersama dan belajar sosial',
  'Psikodrama',
  'Olahraga dan gerak lagu',
  'Menyanyi dan stimulasi bahasa',
]

const facilityItems = [
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

const galleryItems = [
  { title: 'Belajar Sambil Bermain', image: activityPhotoSrc },
  { title: 'Stimulasi Motorik', image: activityPhotoSrc },
  { title: 'Aktivitas Kelompok', image: activityPhotoSrc },
  { title: 'Waktu Makan Bersama', image: activityPhotoSrc },
  { title: 'Istirahat Siang', image: activityPhotoSrc },
  { title: 'Gerak dan Lagu', image: activityPhotoSrc },
]

const loopCopies = 4
const facilityLoopItems = Array.from({ length: loopCopies }, (_, copy) =>
  facilityItems.map((item, index) => ({
    ...item,
    originalIndex: index,
    loopKey: `facility-${copy}-${index}-${item.name}`,
  })),
).flat()
const galleryLoopItems = Array.from({ length: loopCopies }, (_, copy) =>
  galleryItems.map((item, index) => ({
    ...item,
    originalIndex: index,
    loopKey: `gallery-${copy}-${index}-${item.title}`,
  })),
).flat()
const defaultFacilityIndex = Math.floor(facilityItems.length / 2)

const pricingPlans = [
  {
    title: 'Paket Harian',
    tag: 'Fleksibel',
    summary: 'Pilihan harian untuk kebutuhan penitipan yang insidental.',
    price: 150000,
    unit: '/hari',
    isPopular: false,
    benefits: ['Makan siang anak', 'Snack sore', 'Buah', 'Pendampingan aktivitas harian', 'Monitoring anak digital'],
  },
  {
    title: 'Paket 2 Minggu (10 hari)',
    tag: 'Hemat',
    summary: 'Durasi menengah untuk rutinitas yang mulai terjadwal.',
    price: 1100000,
    unit: '/paket',
    isPopular: false,
    benefits: ['Makan siang anak', 'Snack sore', 'Buah', 'Laporan perkembangan singkat', 'Monitoring anak digital'],
  },
  {
    title: 'Paket Bulanan',
    tag: 'Rekomendasi',
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

const allAnimatedSections = ['home', 'tentang-kami', 'fasilitas', 'galery', 'biaya-layanan', 'cta']

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="10" fill="#25d366" />
    <path
      d="M12 5.1a6.9 6.9 0 0 0-5.9 10.6l-.4 2 2-.5a6.9 6.9 0 1 0 4.3-12.1zm0 12.6a5.7 5.7 0 0 1-2.9-.8l-.2-.1-1.2.3.3-1.2-.1-.2A5.7 5.7 0 1 1 12 17.7z"
      fill="#ffffff"
    />
    <path
      d="M16.9 14.1c-.2-.1-1.3-.6-1.5-.7-.2-.1-.4-.1-.5.1-.2.2-.6.7-.7.8-.1.1-.3.2-.5.1-.3-.1-1-.4-1.9-1.2-.7-.6-1.2-1.3-1.3-1.6-.1-.2 0-.3.1-.4.1-.1.2-.2.3-.4.1-.1.2-.2.2-.4.1-.1 0-.3 0-.4 0-.1-.5-1.2-.7-1.7-.2-.4-.4-.4-.5-.4h-.4c-.1 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.3c.1.2 1.7 2.6 4.1 3.6.6.2 1 .4 1.4.5.6.2 1.1.1 1.5.1.5-.1 1.3-.5 1.5-1 .2-.6.2-1 .2-1.1-.1-.1-.2-.1-.4-.2z"
      fill="#25d366"
    />
  </svg>
)

const MessageOutlineIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M4 6.5a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 20 6.5v8A2.5 2.5 0 0 1 17.5 17H8l-4 3v-13.5z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6.8 8.2L12 11.8l5.2-3.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const SunIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M12 2.8v2.2M12 19v2.2M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.8 12H5M19 12h2.2M4.4 19.6L6 18M18 6l1.6-1.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
)

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M20.2 14.5a8.3 8.3 0 0 1-10.7-10.7A8.8 8.8 0 1 0 20.2 14.5z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
  </svg>
)

export default function App() {
  const [activeSection, setActiveSection] = useState('home')
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname || '/')
  const [colorMode, setColorMode] = useState(() => {
    try {
      return window.localStorage.getItem('tpa-landing-theme') === 'dark' ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })
  const [isCompactViewport, setCompactViewport] = useState(() => window.innerWidth <= 760)
  const [activeFacilityIndex, setActiveFacilityIndex] = useState(defaultFacilityIndex)
  const [visibleSections, setVisibleSections] = useState(() =>
    allAnimatedSections.reduce((result, id) => ({ ...result, [id]: id === 'home' }), {}),
  )
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  const [galleryScrollPaused, setGalleryScrollPaused] = useState(false)
  const [galleryScrollTimer, setGalleryScrollTimer] = useState(null)
  const galleryScrollPausedRef = useRef(false)
  const galleryScrollTimerRef = useRef(null)
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

  const menuRef = useRef(null)
  const navItemRefs = useRef({})
  const galleryRef = useRef(null)
  const linkChildPanelRef = useRef(null)
  const linkChildInputRef = useRef(null)
  const financePanelRef = useRef(null)
  const facilityTrackRef = useRef(null)
  const facilityCardRefs = useRef([])
  const lastScrollTimeRef = useRef(Date.now())
  const isFacilityScrollingRef = useRef(false)
  const SCROLL_DEBOUNCE_TIMEOUT = 120
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
  const isDarkMode = colorMode === 'dark'
  const platformLogoSrc = logoTpaSrc
  const renderedFacilityItems = facilityLoopItems
  const renderedGalleryItems = galleryLoopItems

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

  const recenterInfiniteTrack = (track, threshold = 0.45) => {
    const segmentWidth = track.scrollWidth / loopCopies
    if (!Number.isFinite(segmentWidth) || segmentWidth <= 0) return

    if (track.scrollLeft < segmentWidth * threshold) {
      track.scrollLeft += segmentWidth
      return
    }

    if (track.scrollLeft > segmentWidth * (loopCopies - threshold)) {
      track.scrollLeft -= segmentWidth
    }
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
    const appliedTheme = isParentPortalPage ? 'light' : colorMode
    document.documentElement.dataset.theme = appliedTheme

    if (!isParentPortalPage) {
      try {
        window.localStorage.setItem('tpa-landing-theme', colorMode)
      } catch {
        // Ignore storage errors and keep theme in memory.
      }
    }
  }, [colorMode, isParentPortalPage])

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

  // Gallery pause/resume logic
  useEffect(() => {
    const container = galleryRef.current
    if (!container) return undefined

    let intervalId = null
    let scrollTimeout = null

    const startScroll = () => {
      if (intervalId) return

      intervalId = window.setInterval(() => {
        recenterInfiniteTrack(container)
        container.scrollLeft += 1
        recenterInfiniteTrack(container)
      }, 40)
      setGalleryScrollTimer(intervalId)
      galleryScrollTimerRef.current = intervalId
    }

    const stopScroll = () => {
      if (intervalId) {
        window.clearInterval(intervalId)
        setGalleryScrollTimer(null)
        galleryScrollTimerRef.current = null
        intervalId = null
      }
    }

    const handleInteractionStart = () => {
      galleryScrollPausedRef.current = true
      setGalleryScrollPaused(true)
      stopScroll()
      if (scrollTimeout) window.clearTimeout(scrollTimeout)
    }

    const handleInteractionEnd = () => {
      galleryScrollPausedRef.current = false
      setGalleryScrollPaused(false)
      stopScroll()

      // Start 3 second countdown before resuming
      galleryScrollTimerRef.current = window.setTimeout(() => {
        startScroll()
      }, 3000)
      setGalleryScrollTimer(galleryScrollTimerRef.current)
    }

    const handleScrollEnd = () => {
      handleInteractionEnd()
    }

    const handleScrollEvent = () => {
      galleryScrollPausedRef.current = true
      setGalleryScrollPaused(true)
      stopScroll()

      // Debounce scroll end detection
      if (scrollTimeout) window.clearTimeout(scrollTimeout)
      scrollTimeout = window.setTimeout(() => {
        handleScrollEnd()
      }, 200)
    }

    // Add scroll listeners
    container.addEventListener('scroll', handleScrollEvent, { passive: true })

    container.addEventListener('mouseenter', handleInteractionStart)
    container.addEventListener('mouseleave', handleScrollEnd)
    container.addEventListener('touchstart', handleInteractionStart, { passive: true })
    container.addEventListener('touchend', handleScrollEnd, { passive: true })

    // Auto-start scroll
    startScroll()

    return () => {
      stopScroll()
      if (scrollTimeout) window.clearTimeout(scrollTimeout)
      const timer = galleryScrollTimerRef.current
      if (timer) {
        window.clearTimeout(timer)
      }
      container.removeEventListener('scroll', handleScrollEvent)
      container.removeEventListener('mouseenter', handleInteractionStart)
      container.removeEventListener('mouseleave', handleScrollEnd)
      container.removeEventListener('touchstart', handleInteractionStart)
      container.removeEventListener('touchend', handleInteractionEnd)
    }
  }, [])

  useEffect(() => {
    // Cleanup timer on unmount
    return () => {
      const timer = galleryScrollTimerRef.current
      if (timer) {
        window.clearTimeout(timer)
      }
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const container = galleryRef.current
      if (!container) return

      const segmentWidth = container.scrollWidth / loopCopies
      if (segmentWidth > 0) {
        container.scrollLeft = segmentWidth
      }
    }, 120)

    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const initialIndex = isCompactViewport ? 0 : defaultFacilityIndex
    const timer = window.setTimeout(() => {
      const track = facilityTrackRef.current
      if (track) {
        const segmentWidth = track.scrollWidth / loopCopies
        if (!isCompactViewport && segmentWidth > 0) {
          track.scrollLeft = segmentWidth
        }
      }

      if (!isCompactViewport) {
        scrollFacilityToIndex(initialIndex, 'auto')
      } else {
        setActiveFacilityIndex(0)
      }
    }, 120)

    return () => window.clearTimeout(timer)
  }, [isCompactViewport])

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

    const nextIndex = ((index % total) + total) % total
    const track = facilityTrackRef.current
    if (!track) return

    recenterInfiniteTrack(track, 0.2)

    const trackCenter = track.scrollLeft + track.clientWidth / 2
    const candidateLoopIndices = Array.from({ length: loopCopies }, (_, copy) => nextIndex + copy * total)

    let nearestLoopIndex =
      candidateLoopIndices[Math.min(Math.floor(loopCopies / 2), candidateLoopIndices.length - 1)]
    let nearestDistance = Number.POSITIVE_INFINITY

    candidateLoopIndices.forEach((loopIndex) => {
      const card = facilityCardRefs.current[loopIndex]
      if (!card) return

      const cardCenter = card.offsetLeft + card.clientWidth / 2
      const distance = Math.abs(cardCenter - trackCenter)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestLoopIndex = loopIndex
      }
    })

    const targetCard = facilityCardRefs.current[nearestLoopIndex]
    if (!targetCard) return

    const targetLeft = targetCard.offsetLeft - (track.clientWidth - targetCard.clientWidth) / 2
    track.scrollTo({ left: targetLeft, behavior })
    setActiveFacilityIndex(nextIndex)
  }

  const handleFacilityPrev = () => scrollFacilityToIndex(activeFacilityIndex - 1)
  const handleFacilityNext = () => scrollFacilityToIndex(activeFacilityIndex + 1)

  const handleFacilityTrackScroll = () => {
    const track = facilityTrackRef.current
    if (!track) return

    if (!isFacilityInteractingRef.current) {
      recenterInfiniteTrack(track, 0.2)
    }

    const center = track.scrollLeft + track.clientWidth / 2
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

    if (nearestLoopIndex < 0) return

    const nearestBaseIndex = nearestLoopIndex % facilityItems.length
    if (nearestBaseIndex !== activeFacilityIndex) {
      setActiveFacilityIndex(nearestBaseIndex)
    }
  }

  const handleFacilityInteractionStart = () => {
    isFacilityInteractingRef.current = true
  }

  const handleFacilityInteractionEnd = () => {
    isFacilityInteractingRef.current = false
    const track = facilityTrackRef.current
    if (!track) return
    recenterInfiniteTrack(track, 0.2)
  }

  const handleGalleryTrackScroll = () => {
    const container = galleryRef.current
    if (!container) return

    recenterInfiniteTrack(container)
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

  const toggleColorMode = () => {
    setColorMode((previous) => (previous === 'dark' ? 'light' : 'dark'))
  }

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
              <span className="brand__logo-shell">
                <img src={platformLogoSrc} alt="Logo TPA UBAYA" className="brand__logo" />
              </span>
            </span>
            <span className="brand__text">
              <strong>TPA Rumah Ceria UBAYA</strong>
              <small>Taman Penitipan Anak</small>
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
              className="theme-toggle"
              onClick={toggleColorMode}
              aria-label={isDarkMode ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
              title={isDarkMode ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
            >
              <span className="theme-toggle__icon" aria-hidden="true">
                {isDarkMode ? <SunIcon /> : <MoonIcon />}
              </span>
              <span className="theme-toggle__label">
                {isDarkMode ? 'Mode Gelap' : 'Mode Terang'}
              </span>
            </button>

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
        <section id="home" className={`page-section ${visibleSections.home ? 'is-visible' : ''}`}>
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

              <div className="home-actions">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="button button--primary"
                >
                  Hubungi Kami
                </a>
                <button type="button" className="button button--secondary" onClick={() => openAuthModal('register')}>
                  Daftar Sekarang
                </button>
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
              >
                â€¹
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
              >
                â€º
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

        <section id="galery" className={`page-section ${visibleSections.galery ? 'is-visible' : ''}`}>
          <div className="section-shell gallery-section">
            <div className="section-head">
              <h2>Galery Aktivitas Anak</h2>
            </div>

            <div
              ref={galleryRef}
              className="gallery-track"
              onScroll={handleGalleryTrackScroll}
            >
              {renderedGalleryItems.map((item) => (
                <article key={item.loopKey} className="gallery-card">
                  <img src={item.image} alt={item.title} className="gallery-card__image" />
                  <p>{item.title}</p>
                </article>
              ))}
            </div>

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
                  {plan.isPopular ? <p className="pricing-card__ribbon">Recomended</p> : null}

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
                WhatsApp Kami
              </a>
              <a href="mailto:info@ubaya.ac.id" className="button button--cta-email">
                <span className="cta-action__icon" aria-hidden="true">
                  <MessageOutlineIcon />
                </span>
                Email Kami
              </a>
            </div>
            <p className="cta-section__location">
              Fakultas Psikologi, Universitas Surabaya Â· Jl. Raya Kali Rungkut, Surabaya
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
                <p>Taman Penitipan Anak</p>
              </div>
            </div>
            <p className="footer__brand-text">
              Layanan penitipan anak berbasis pendampingan tumbuh kembang, di bawah naungan
              Universitas Surabaya.
            </p>
          </section>

          <section className="footer__column">
            <h4>Layanan</h4>
            <ul>
              <li><a href="#tentang-kami">Program Pendampingan</a></li>
              <li><a href="#fasilitas">Fasilitas TPA</a></li>
              <li><a href="#galery">Galery Aktivitas</a></li>
              <li><a href="#biaya-layanan">Paket Biaya Layanan</a></li>
            </ul>
          </section>

          <section className="footer__column">
            <h4>Informasi</h4>
            <ul>
              <li><a href="#tentang-kami">Tentang Kami</a></li>
              <li><a href="#tentang-kami">Visi dan Program</a></li>
              <li><a href="#cta">Pendaftaran Akun Orang Tua</a></li>
              <li><a href="#biaya-layanan">Biaya Pendaftaran</a></li>
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
          <p><span style={{ marginRight: '4px', opacity: 0.7 }}>Â©</span> {new Date().getFullYear()} TPA Rumah Ceria UBAYA. Hak cipta dilindungi.</p>
          <button type="button" className="footer__privacy-btn" onClick={() => scrollToSection('home')}>
            Kebijakan Privasi
          </button>
        </div>
      </footer>

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
              <span>ðŸ” Akses aman dan terverifikasi</span>
              <span>ðŸ‘¶ Terhubung langsung ke data anak</span>
              <span>âš¡ Login dan daftar lebih cepat</span>
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
