import { type ComponentType, useEffect } from 'react'
import {
  BadgeCheck,
  CalendarClock,
  LogOut,
  Sparkles,
  X,
} from 'lucide-react'

export interface SidebarMenuItem {
  key: string
  label: string
  icon: ComponentType<{ size?: number }>
}

export interface SidebarProfileItem {
  id: string
  label: string
  subtitle?: string
  photoDataUrl?: string
}

interface SidebarProps {
  activeMenu: string
  menus: SidebarMenuItem[]
  isOpen: boolean
  onMenuSelect: (menu: string) => void
  onClose: () => void
  onLogout: () => Promise<void> | void
  userLabel?: string
  userSubtitle?: string
  userPhotoDataUrl?: string
  userAvatarFallback?: string
  accountLabel?: string
  panelTitle?: string
  menuLabel?: string
  chipLabel?: string
  logoutLabel?: string
  profileListLabel?: string
  profileItems?: SidebarProfileItem[]
  activeProfileId?: string
  onProfileSelect?: (profileId: string) => void
}

const Sidebar = ({
  activeMenu,
  menus,
  isOpen,
  onMenuSelect,
  onClose,
  onLogout,
  userLabel,
  userSubtitle,
  userPhotoDataUrl,
  userAvatarFallback,
  accountLabel = 'Akun Aktif',
  panelTitle = 'Panel Aplikasi',
  menuLabel = 'Menu Utama',
  chipLabel = 'Operasional Harian',
  logoutLabel = 'Logout',
  profileListLabel = 'Profil',
  profileItems = [],
  activeProfileId,
  onProfileSelect,
}: SidebarProps) => {
  const todayLabel = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())
  const shouldShowUserAvatar = Boolean(userPhotoDataUrl || userAvatarFallback)
  const userAvatarInitial = (userAvatarFallback || userLabel || '-')
    .slice(0, 1)
    .toUpperCase()

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return undefined
    }
    if (!isOpen || !window.matchMedia('(max-width: 960px)').matches) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    const previousTouchAction = document.body.style.touchAction
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'

    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.touchAction = previousTouchAction
    }
  }, [isOpen])

  return (
    <>
      <button
        type="button"
        className={`sidebar-backdrop ${isOpen ? 'is-visible' : ''}`}
        onClick={onClose}
        aria-label="Tutup menu"
      />

      <aside className={`sidebar ${isOpen ? 'is-open' : ''}`}>
        <div className="sidebar__surface">
          <header className="sidebar__header">
            <div className="sidebar__brand">
              <div className="sidebar__logo-wrap">
                <img
                  src="/logo_TPA.jpg"
                  alt="Logo TPA UBAYA"
                  className="sidebar__logo"
                />
              </div>
              <div>
                <p className="sidebar__eyebrow">TPA UBAYA</p>
                <p className="sidebar__title">{panelTitle}</p>
              </div>
            </div>
            <button
              type="button"
              className="sidebar__close"
              onClick={onClose}
              aria-label="Tutup sidebar"
            >
              <X size={18} />
            </button>
          </header>

          <section id="tour-sidebar-profile" className="sidebar__panel sidebar__panel--user">
            {shouldShowUserAvatar ? (
              <span className="sidebar__panel-avatar">
                {userPhotoDataUrl ? (
                  <img src={userPhotoDataUrl} alt={userLabel || 'Profil'} />
                ) : (
                  <span>{userAvatarInitial}</span>
                )}
              </span>
            ) : (
              <div className="sidebar__panel-icon">
                <BadgeCheck size={18} />
              </div>
            )}
            <div className="sidebar__panel-meta">
              {accountLabel ? <p className="sidebar__panel-label">{accountLabel}</p> : null}
              <p className="sidebar__panel-title">{userLabel || '-'}</p>
              {userSubtitle ? (
                <p className="sidebar__panel-subtitle">{userSubtitle}</p>
              ) : null}
            </div>
          </section>

          <section id="tour-sidebar-date" className="sidebar__panel sidebar__panel--date">
            <CalendarClock size={16} />
            <span>{todayLabel}</span>
          </section>

          {profileItems.length > 0 ? (
            <section className="sidebar__panel sidebar__panel--profiles">
              <p className="sidebar__menu-label">{profileListLabel}</p>
              <div className="sidebar__child-list">
                {profileItems.map((profile) => {
                  const isActive = activeProfileId === profile.id
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      className={`sidebar__child-item ${isActive ? 'is-active' : ''}`}
                      onClick={() => onProfileSelect?.(profile.id)}
                    >
                      <span className="sidebar__child-avatar">
                        {profile.photoDataUrl ? (
                          <img src={profile.photoDataUrl} alt={profile.label} />
                        ) : (
                          <span>{profile.label.slice(0, 1).toUpperCase()}</span>
                        )}
                      </span>
                      <span className="sidebar__child-meta">
                        <strong>{profile.label}</strong>
                        <small>{profile.subtitle || 'Lihat profil anak'}</small>
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          ) : null}

          <nav className="sidebar__menu" aria-label="Menu utama">
            <p className="sidebar__menu-label">{menuLabel}</p>
            <div className="sidebar__menu-list">
              {menus.map((menu) => {
                const Icon = menu.icon
                const isActive = activeMenu === menu.key

                return (
                  <button
                    id={`tour-menu-${menu.key}`}
                    key={menu.key}
                    type="button"
                    className={`sidebar__item ${isActive ? 'is-active' : ''}`}
                    onClick={() => onMenuSelect(menu.key)}
                  >
                    <span className="sidebar__item-icon">
                      <Icon size={18} />
                    </span>
                    <span>{menu.label}</span>
                  </button>
                )
              })}
            </div>
          </nav>

          <footer className="sidebar__footer">
            {chipLabel ? (
              <span className="sidebar__chip">
                <Sparkles size={14} />
                {chipLabel}
              </span>
            ) : null}
            <button
              id="tour-logout-btn"
              type="button"
              className="sidebar__logout"
              onClick={() => void onLogout()}
            >
              <LogOut size={15} />
              <span>{logoutLabel}</span>
            </button>
          </footer>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
