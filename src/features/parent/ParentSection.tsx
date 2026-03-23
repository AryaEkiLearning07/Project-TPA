import { useEffect, useState } from 'react'
import {
  Home,
  LogOut,
  Menu,
  User,
  LayoutDashboard,
  Activity,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Bell,
  CreditCard,
  Image as ImageIcon,
  Camera,
  Download,
  Lock,
  Settings,
  RefreshCw,
} from 'lucide-react'
import DashboardPage from './dashboard/DashboardPage'
import type {
  ParentAuthUser,
  ParentMenuKey,
} from '../../types'

const parentMenus: { key: ParentMenuKey; label: string; icon: ComponentType<any> }[] = [
  { key: 'dashboard', label: 'Beranda', icon: Home },
  { key: 'daily-logs', label: 'Laporan', icon: LayoutDashboard },
  { key: 'gallery', label: 'Galeri', icon: Image as ImageIcon },
  { key: 'billing', label: 'Tagihan', icon: CreditCard },
  { key: 'profile', label: 'Profil', icon: User },
]

interface ParentSectionProps {
  user: ParentAuthUser
  onLogout: () => Promise<void>
}

interface ActivityCardProps {
  card: {
    id: string
    type: 'attendance' | 'meal' | 'sleep' | 'bathroom' | 'note'
    time: string
    title: string
    description: string
  }
}

function ActivityCard({ card }: ActivityCardProps) {
  const icons: Record<string, ComponentType<any>> = {
    attendance: Home,
    meal: Activity,
    sleep: LayoutDashboard,
    bathroom: Bell,
    note: Menu,
  }

  const icon = icons[card.type]

  return (
    <div className="parent-activity-card">
      <div className="activity-card__header">
        <div className="activity-card__icon-wrap">{icon}</div>
        <div className="activity-card__content">
          <h4 className="activity-card__time">{card.time}</h4>
          <h3 className="activity-card__title">{card.title}</h3>
          <p className="activity-card__desc">{card.description}</p>
        </div>
      </div>
    </div>
  )
}

export default function ParentSection({ user, onLogout }: ParentSectionProps) {
  const [activeMenu, setActiveMenu] = useState<ParentMenuKey>('dashboard')
  const [isLoading, setIsLoading] = useState(false)
  const [dashboardData, setDashboardData] = useState<ParentDashboardData | null>(null)
  const [activeChildId, setActiveChildId] = useState<string | null>(null)

  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true)
      try {
        // TODO: Fetch from API
        const mockData: ParentDashboardData = {
          children: [
            {
              id: 'child-1',
              fullName: 'Budi Setiawan',
              nickName: 'Budi',
              gender: 'Laki-laki',
              photoDataUrl: '/logo_TPA.jpg',
              birthDate: '2022-05-15',
            },
          ],
          attendanceRecords: [],
          incidentReports: [],
          observationRecords: [],
          communicationEntries: [],
        }
        setDashboardData(mockData)
      } catch (error) {
        console.error('Failed to load dashboard data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadDashboardData()
  }, [])

  const handleMenuSelect = (menu: ParentMenuKey) => {
    setActiveMenu(menu)
  }

  const handleLogout = async () => {
    await onLogout()
  }

  return (
    <div className="parent-shell">
      <header className="parent-topbar">
        <div className="parent-topbar__brand">
          <div className="parent-topbar__logo">
            <img src="/logo_TPA.jpg" alt="TPA" className="parent-topbar__logo-img" />
          </div>
          <div className="parent-topbar__brand-text">
            <h2>TPA Rumah Ceria UBAYA</h2>
            <p>Orang Tua</p>
          </div>
        </div>
        <div className="parent-topbar__user">
          <div className="parent-topbar__avatar">
            <img src={user.parentAccount?.parentProfile?.fatherName ? '/logo_TPA.jpg' : '/logo_TPA.jpg'} alt="" className="parent-topbar__avatar-img" />
          </div>
          <div className="parent-topbar__user-info">
            <p className="parent-topbar__greeting">Halo Mama,</p>
            <p className="parent-topbar__child-name">
              {dashboardData?.children?.[0]?.fullName || 'Anak'}
            </p>
          </div>
          <button onClick={handleLogout} className="parent-topbar__logout">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="parent-main">
        {activeChildId && (
          <div className="parent-child-selector">
            <div className="parent-child-selector__label">Anak:</div>
            <select
              className="parent-child-selector__select"
              value={activeChildId}
              onChange={(e) => setActiveChildId(e.target.value)}
            >
              <option value="child-1">Budi Setiawan</option>
            </select>
          </div>
        )}

        {isLoading && !dashboardData ? (
          <div className="parent-loading">
            <RefreshCw className="parent-loading__spinner" />
            <p>Memuat data...</p>
          </div>
        ) : dashboardData && (
          <>
            {activeMenu === 'dashboard' && (
              <div className="parent-dashboard">
                <div className="dashboard-header">
                  <div className="dashboard-header__child-profile">
                    <div className="dashboard-header__avatar">
                      <img
                        src={dashboardData.children?.find((c) => c.id === activeChildId)?.photoDataUrl || '/logo_TPA.jpg'}
                        alt="Foto Anak"
                        className="dashboard-header__avatar-img"
                      />
                    </div>
                    <div className="dashboard-header__child-info">
                      <h2 className="dashboard-header__child-name">
                        {dashboardData.children?.find((c) => c.id === activeChildId)?.fullName || 'Anak'}
                      </h2>
                      <div className="dashboard-header__child-status">
                        <span className="dashboard-header__status-badge">
                          {dashboardData.children?.find((c) => c.id === activeChildId)?.nickName}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="dashboard-header__status-card">
                    <div className="dashboard-header__status-item">
                      <span className="dashboard-header__status-label">Status Hari Ini:</span>
                      <span className="dashboard-header__status-value">Sedang Tidur Siang</span>
                    </div>
                    <div className="dashboard-header__status-item">
                      <span className="dashboard-header__status-label">Petugas Jaga:</span>
                      <span className="dashboard-header__status-value">Ibu Siti</span>
                    </div>
                  </div>
                </div>

                <div className="dashboard-activities">
                  <h3 className="dashboard-activities__title">Aktivitas Terkini</h3>
                  <div className="dashboard-activities__list">
                    <ActivityCard card={{
                      id: '1',
                      type: 'attendance',
                      time: '08:00',
                      title: 'Check-in',
                      description: 'Budi tiba di TPA',
                    }} />
                    <ActivityCard card={{
                      id: '2',
                      type: 'meal',
                      time: '09:30',
                      title: 'Sarapan',
                      description: 'Nasi goreng telur',
                    }} />
                    <ActivityCard card={{
                      id: '3',
                      type: 'sleep',
                      time: '11:00',
                      title: 'Tidur Siang',
                      description: 'Istirahat siang hari ini',
                    }} />
                  </div>
                </div>
              </div>
            )}

            {activeMenu === 'daily-logs' && (
              <div className="parent-daily-logs">
                <h2 className="parent-daily-logs__title">Laporan Harian</h2>
                <div className="parent-daily-logs__date-filter">
                  <ChevronLeft size={16} />
                  <span>22 Maret 2026</span>
                  <ChevronRight size={16} />
                </div>
                <div className="parent-daily-logs__content">
                  <div className="parent-daily-logs__meal-section">
                    <h4 className="parent-daily-logs__section-title">Makan & Minum</h4>
                    <div className="parent-daily-logs__meal-item">
                      <span>08:00 - Sarapan</span>
                      <span className="parent-daily-logs__meal-status parent-daily-logs__meal-status--habis">Habis</span>
                      <span className="parent-daily-logs__meal-amount">200 ml</span>
                    </div>
                    <div className="parent-daily-logs__sleep-section">
                      <h4 className="parent-daily-logs__section-title">Istirahat</h4>
                      <div className="parent-daily-logs__sleep-item">
                        <span>11:00 - 13:00</span>
                        <span className="parent-daily-logs__sleep-duration">2 jam</span>
                      </div>
                    </div>
                    <div className="parent-daily-logs__mood-section">
                      <h4 className="parent-daily-logs__section-title">Mood</h4>
                      <div className="parent-daily-logs__mood-emoji">😊</div>
                      <span className="parent-daily-logs__mood-label">Ceria</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeMenu === 'gallery' && (
              <div className="parent-gallery">
                <h2 className="parent-gallery__title">Galeri Anak</h2>
                <div className="parent-gallery__filter">
                  <ChevronLeft size={16} />
                  <span>Maret 2026</span>
                  <ChevronRight size={16} />
                </div>
                <div className="parent-gallery__grid">
                  <div className="parent-gallery__item">
                    <div className="parent-gallery__item__image">
                      <img src="/logo_TPA.jpg" alt="Foto Anak" />
                    </div>
                    <div className="parent-gallery__item__download">
                      <Download size={16} />
                    </div>
                  </div>
                  <div className="parent-gallery__item">
                    <div className="parent-gallery__item__image">
                      <img src="/logo_TPA.jpg" alt="Foto Anak" />
                    </div>
                    <div className="parent-gallery__item__download">
                      <Download size={16} />
                    </div>
                  </div>
                  <div className="parent-gallery__item">
                    <div className="parent-gallery__item__image">
                      <img src="/logo_TPA.jpg" alt="Foto Anak" />
                    </div>
                    <div className="parent-gallery__item__download">
                      <Download size={16} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeMenu === 'billing' && (
              <div className="parent-billing">
                <h2 className="parent-billing__title">Tagihan & Keuangan</h2>
                <div className="parent-billing__current-month">
                  <div className="parent-billing__month-card">
                    <h3 className="parent-billing__month">April 2026</h3>
                    <span className="parent-billing__status parent-billing__status--belum-lunas">Belum Lunas</span>
                    <span className="parent-billing__amount">Rp 1.500.000</span>
                  </div>
                  <div className="parent-billing__history">
                    <h4 className="parent-billing__history-title">Riwayat Pembayaran</h4>
                    <div className="parent-billing__history-item">
                      <span className="parent-billing__history-date">Maret 2026</span>
                      <span className="parent-billing__history-amount">Rp 1.500.000</span>
                      <span className="parent-billing__history-status parent-billing__history-status--lunas">Lunas</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeMenu === 'profile' && (
              <div className="parent-profile">
                <h2 className="parent-profile__title">Profil Anak</h2>
                <div className="parent-profile__content">
                  <div className="parent-profile__section">
                    <div className="parent-profile__section-header">
                      <div className="parent-profile__header-icon">
                        <User size={20} />
                      </div>
                      <h3 className="parent-profile__section-title">Data Diri</h3>
                    </div>
                    <div className="parent-profile__section-body">
                      <div className="parent-profile__info">
                        <span className="parent-profile__label">Nama Lengkap:</span>
                        <span className="parent-profile__value">{dashboardData?.children?.[0]?.fullName || 'Budi Setiawan'}</span>
                      </div>
                      <div className="parent-profile__info">
                        <span className="parent-profile__label">Tanggal Lahir:</span>
                        <span className="parent-profile__value">15 Mei 2022</span>
                      </div>
                      <div className="parent-profile__info">
                        <span className="parent-profile__label">Usia:</span>
                        <span className="parent-profile__value">3 Tahun 8 Bulan</span>
                      </div>
                    </div>
                  </div>
                  <div className="parent-profile__section">
                    <div className="parent-profile__section-header">
                      <div className="parent-profile__header-icon">
                        <Settings size={20} />
                      </div>
                      <h3 className="parent-profile__section-title">Orang Tua</h3>
                    </div>
                    <div className="parent-profile__section-body">
                      <div className="parent-profile__info">
                        <span className="parent-profile__label">Nama Ayah:</span>
                        <span className="parent-profile__value">Budi Santoso</span>
                      </div>
                      <div className="parent-profile__info">
                        <span className="parent-profile__label">Nama Ibu:</span>
                        <span className="parent-profile__value">Siti Aminah</span>
                      </div>
                      <div className="parent-profile__page">
                        <span className="parent-profile__label">WhatsApp:</span>
                        <span className="parent-profile__value">08123456789</span>
                      </div>
                    </div>
                  </div>
                  <div className="parent-profile__section">
                    <div className="parent-profile__section-header">
                      <div className="parent-profile__header-icon">
                        <LayoutDashboard size={20} />
                      </div>
                      <h3 className="parent-profile__section-title">Penjemput/Pengantar</h3>
                    </div>
                    <div className="parent-profile__section-body">
                      <div className="parent-profile__pickup-item">
                        <div className="parent-profile__pickup-header">
                          <span className="parent-profile__pickup-icon">👤</span>
                          <div>
                            <span className="parent-profile__pickup-name">Pak Joko</span>
                            <span className="parent-profile__pickup-relation">Ayah</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="parent-profile__section">
                    <div className="parent-profile__section-header">
                      <div className="parent-profile__section-title">Data Tambahan</h3>
                    </div>
                    <div className="parent-profile__section-body">
                      <div className="parent-profile__info">
                        <span className="parent-profile__label">Alergi:</span>
                        <span className="parent-profile__value">Tidak ada</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

      <nav className="parent-bottom-nav">
        {parentMenus.map((menu) => (
          <button
            key={menu.key}
            onClick={() => handleMenuSelect(menu.key)}
            className={`parent-bottom-nav__item ${activeMenu === menu.key ? 'is-active' : ''}`}
          >
            {menu.icon && <menu.icon size={20} />}
            <span>{menu.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
