import { useEffect, useMemo, useRef, useState } from 'react'

const logoTpaSrc = `${import.meta.env.BASE_URL}logo_TPA.jpg`
const platformLogoSrc = logoTpaSrc
const headPhotoSrc = logoTpaSrc
const activityPhotoSrc = logoTpaSrc

const whatsappUrl = 'https://wa.me/628155042120?text=Halo%20TPA%20Rumah%20Ceria%20UBAYA,%20saya%20ingin%20bertanya.'
const validRegistrationCodes = ['TPA-UBAYA-2026-001', 'TPA-UBAYA-2026-002', 'TPA-UBAYA-2026-003']

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
    image: activityPhotoSrc,
  },
  {
    name: 'Ruang Tidur Anak',
    description: 'Area istirahat siang yang tenang untuk mendukung rutinitas tidur anak.',
    image: activityPhotoSrc,
  },
  {
    name: 'Ruang Makan',
    description: 'Area makan bersama untuk membangun kebiasaan makan teratur dan mandiri.',
    image: activityPhotoSrc,
  },
  {
    name: 'Dapur Sehat',
    description: 'Dapur pendukung untuk menyiapkan kebutuhan makan dan minum anak.',
    image: activityPhotoSrc,
  },
  {
    name: 'Kamar Mandi Anak',
    description: 'Fasilitas kamar mandi anak untuk pembiasaan kebersihan dan toilet training.',
    image: activityPhotoSrc,
  },
  {
    name: 'Permainan Edukatif',
    description: 'Permainan edukatif untuk stimulasi motorik, bahasa, dan interaksi sosial.',
    image: activityPhotoSrc,
  },
  {
    name: 'Area Indoor (Soft Play)',
    description: 'Area indoor dengan konsep soft play yang aman untuk eksplorasi anak.',
    image: activityPhotoSrc,
  },
  {
    name: 'Area Outdoor (Playground)',
    description: 'Playground outdoor untuk aktivitas fisik, koordinasi, dan keberanian anak.',
    image: activityPhotoSrc,
  },
  {
    name: 'Ruang Pendampingan',
    description: 'Ruang pendampingan untuk kegiatan terarah sesuai tahap perkembangan anak.',
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

const loopCopies = 3
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
    price: 150000,
    unit: '/hari',
    benefits: ['Makan siang anak', 'Snack sore', 'Buah', 'Pendampingan aktivitas harian'],
  },
  {
    title: 'Paket 2 Minggu (10 hari)',
    price: 1100000,
    unit: '/paket',
    benefits: ['Makan siang anak', 'Snack sore', 'Buah', 'Laporan perkembangan singkat'],
  },
  {
    title: 'Paket Bulanan',
    price: 1750000,
    unit: '/bulan',
    benefits: ['Makan siang anak', 'Snack sore', 'Buah', 'Program pembiasaan terstruktur'],
  },
]

const registrationCosts = [
  'Administrasi: Rp 250.000 (tas baju kotor, buku penghubung, map hasil karya, tempat makan)',
  'Uang Pengembangan: Rp 1.000.000 (dapat diangsur 2 kali)',
  'Seragam TPA: Rp 150.000 / 1 stel',
  'Piyama Anak: Rp 125.000 / 1 stel',
]

const allAnimatedSections = ['home', 'tentang-kami', 'fasilitas', 'galery', 'biaya-layanan', 'cta']

export default function App() {
  const [activeSection, setActiveSection] = useState('home')
  const [activeFacilityIndex, setActiveFacilityIndex] = useState(defaultFacilityIndex)
  const [visibleSections, setVisibleSections] = useState(() =>
    allAnimatedSections.reduce((result, id) => ({ ...result, [id]: id === 'home' }), {}),
  )
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  const [scrolled, setScrolled] = useState(false)
  const [pauseGallery, setPauseGallery] = useState(false)
  const [authModal, setAuthModal] = useState('none')
  const [authNotice, setAuthNotice] = useState(null)
  const [parentLoginForm, setParentLoginForm] = useState({
    username: '',
    password: '',
  })
  const [parentRegisterForm, setParentRegisterForm] = useState({
    username: '',
    password: '',
    registrationCode: '',
  })

  const menuRef = useRef(null)
  const navItemRefs = useRef({})
  const galleryRef = useRef(null)
  const facilityTrackRef = useRef(null)
  const facilityCardRefs = useRef([])

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
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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
    if (pauseGallery) return undefined

    const container = galleryRef.current
    if (!container) return undefined

    const timer = window.setInterval(() => {
      recenterInfiniteTrack(container)
      container.scrollLeft += 1
      recenterInfiniteTrack(container)
    }, 22)

    return () => window.clearInterval(timer)
  }, [pauseGallery])

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
    const initialIndex = defaultFacilityIndex
    const timer = window.setTimeout(() => {
      const track = facilityTrackRef.current
      if (track) {
        const segmentWidth = track.scrollWidth / loopCopies
        if (segmentWidth > 0) {
          track.scrollLeft = segmentWidth
        }
      }

      scrollFacilityToIndex(initialIndex, 'auto')
    }, 120)

    return () => window.clearTimeout(timer)
  }, [])

  const scrollToSection = (id) => {
    const target = document.getElementById(id)
    if (!target) return

    setActiveSection(id)
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const scrollFacilityToIndex = (index, behavior = 'smooth') => {
    const total = facilityItems.length
    if (!total) return

    const nextIndex = ((index % total) + total) % total
    const track = facilityTrackRef.current
    if (!track) return

    recenterInfiniteTrack(track)

    const trackCenter = track.scrollLeft + track.clientWidth / 2
    const candidateLoopIndices = Array.from({ length: loopCopies }, (_, copy) => nextIndex + copy * total)

    let nearestLoopIndex = candidateLoopIndices[Math.floor(loopCopies / 2)]
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

    recenterInfiniteTrack(track)

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

  const handleGalleryTrackScroll = () => {
    const container = galleryRef.current
    if (!container) return

    recenterInfiniteTrack(container)
  }

  useEffect(() => {
    const onResize = () => scrollFacilityToIndex(activeFacilityIndex, 'auto')
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [activeFacilityIndex])

  const openAuthModal = (mode) => {
    setAuthNotice(null)
    setAuthModal(mode)
  }

  const closeAuthModal = () => {
    setAuthModal('none')
    setAuthNotice(null)
  }

  const handleParentLoginSubmit = (event) => {
    event.preventDefault()
    if (!parentLoginForm.username.trim() || !parentLoginForm.password.trim()) {
      setAuthNotice({
        type: 'error',
        text: 'Username dan password wajib diisi.',
      })
      return
    }

    setAuthNotice({
      type: 'info',
      text: 'Login orang tua sedang disiapkan. Setelah role ORANG TUA aktif, akun ini bisa langsung digunakan.',
    })
  }

  const handleParentRegisterSubmit = (event) => {
    event.preventDefault()

    const username = parentRegisterForm.username.trim()
    const password = parentRegisterForm.password.trim()
    const registrationCode = parentRegisterForm.registrationCode.trim().toUpperCase()

    if (!username || !password || !registrationCode) {
      setAuthNotice({
        type: 'error',
        text: 'Username, password, dan kode registrasi wajib diisi.',
      })
      return
    }

    if (!validRegistrationCodes.includes(registrationCode)) {
      setAuthNotice({
        type: 'error',
        text: 'Kode registrasi tidak valid. Gunakan kode resmi dari TPA.',
      })
      return
    }

    try {
      const storageKey = 'tpaParentPendingRegistrations'
      const existingRaw = localStorage.getItem(storageKey)
      const existing = existingRaw ? JSON.parse(existingRaw) : []
      const isDuplicate = existing.some((entry) => entry.username === username)

      if (isDuplicate) {
        setAuthNotice({
          type: 'error',
          text: 'Username sudah terdaftar. Gunakan username lain.',
        })
        return
      }

      const nextEntry = {
        username,
        registrationCode,
        createdAt: new Date().toISOString(),
      }
      localStorage.setItem(storageKey, JSON.stringify([nextEntry, ...existing]))

      setAuthNotice({
        type: 'success',
        text: 'Pendaftaran diterima. Akun orang tua akan aktif setelah proses verifikasi.',
      })
      setParentRegisterForm({
        username: '',
        password: '',
        registrationCode: '',
      })
    } catch {
      setAuthNotice({
        type: 'error',
        text: 'Gagal menyimpan pendaftaran. Silakan coba lagi.',
      })
    }
  }

  return (
    <div className="landing-page">
      <header className={`topbar ${scrolled ? 'topbar--scrolled' : ''}`}>
        <div className="topbar__inner section-shell">
          <a href="#home" className="brand" aria-label="TPA Rumah Ceria UBAYA">
            <span className="brand__logo-wrap">
              <img src={platformLogoSrc} alt="Logo TPA UBAYA" className="brand__logo" />
            </span>
            <span className="brand__text">
              <strong>TPA Rumah Ceria UBAYA</strong>
              <small>Taman Penitipan Anak</small>
            </span>
          </a>

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
              className="topbar__auth-btn topbar__auth-btn--login"
              onClick={() => openAuthModal('login')}
            >
              Login
            </button>
            <button
              type="button"
              className="topbar__auth-btn topbar__auth-btn--register"
              onClick={() => openAuthModal('register')}
            >
              Daftar
            </button>
          </div>
        </div>
      </header>

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
                ‹
              </button>

              <div className="facility-slider__viewport">
                <div
                  ref={facilityTrackRef}
                  className="facility-slider__track"
                  onScroll={handleFacilityTrackScroll}
                >
                  {facilityLoopItems.map((item, index) => (
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
                ›
              </button>
            </div>

            <article className="facility-description" aria-live="polite">
              <h3>{facilityItems[activeFacilityIndex]?.name}</h3>
              <p>{facilityItems[activeFacilityIndex]?.description}</p>
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
              onMouseEnter={() => setPauseGallery(true)}
              onMouseLeave={() => setPauseGallery(false)}
              onTouchStart={() => setPauseGallery(true)}
              onTouchEnd={() => setPauseGallery(false)}
            >
              {galleryLoopItems.map((item) => (
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
                <article key={plan.title} className="pricing-card">
                  <h3>{plan.title}</h3>
                  <p className="pricing-price">
                    {priceFormatter.format(plan.price)} <span>{plan.unit}</span>
                  </p>
                  <ul className="bullet-list">
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
                className="button button--cta-primary"
              >
                WhatsApp Kami
              </a>
              <a href="mailto:info@ubaya.ac.id" className="button button--cta-secondary">
                Email Kami
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
          <p>Copyright {new Date().getFullYear()} TPA Rumah Ceria UBAYA. Hak cipta dilindungi.</p>
          <button type="button" className="footer__privacy-btn" onClick={() => scrollToSection('home')}>
            Kebijakan Privasi
          </button>
        </div>
      </footer>

      {authModal !== 'none' ? (
        <div className="auth-modal-overlay" onClick={closeAuthModal}>
          <div
            className="auth-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="auth-modal__close" onClick={closeAuthModal} aria-label="Tutup">
              ×
            </button>

            {authModal === 'login' ? (
              <>
                <h3>Login Orang Tua</h3>
                <p className="auth-modal__subtitle">
                  Gunakan akun orang tua. Nantinya akun ini akan masuk ke role orang tua.
                </p>
                <form className="auth-form" onSubmit={handleParentLoginSubmit}>
                  <label className="auth-field">
                    Username / Email
                    <input
                      type="text"
                      className="auth-input"
                      value={parentLoginForm.username}
                      onChange={(event) =>
                        setParentLoginForm((previous) => ({
                          ...previous,
                          username: event.target.value,
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
                      onChange={(event) =>
                        setParentLoginForm((previous) => ({
                          ...previous,
                          password: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <button type="submit" className="button button--primary auth-submit">
                    Login
                  </button>
                </form>
              </>
            ) : (
              <>
                <h3>Daftar Akun Orang Tua</h3>
                <p className="auth-modal__subtitle">
                  Pendaftaran memerlukan kode registrasi resmi dari TPA. Akun tanpa kode tidak bisa dibuat.
                </p>
                <form className="auth-form" onSubmit={handleParentRegisterSubmit}>
                  <label className="auth-field">
                    Username
                    <input
                      type="text"
                      className="auth-input"
                      value={parentRegisterForm.username}
                      onChange={(event) =>
                        setParentRegisterForm((previous) => ({
                          ...previous,
                          username: event.target.value,
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
                      placeholder="Contoh: TPA-UBAYA-2026-001"
                      value={parentRegisterForm.registrationCode}
                      onChange={(event) =>
                        setParentRegisterForm((previous) => ({
                          ...previous,
                          registrationCode: event.target.value.toUpperCase(),
                        }))
                      }
                    />
                  </label>
                  <button type="submit" className="button button--primary auth-submit">
                    Daftar
                  </button>
                </form>
              </>
            )}

            {authNotice ? (
              <p className={`auth-notice auth-notice--${authNotice.type}`}>{authNotice.text}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
