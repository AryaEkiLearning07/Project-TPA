import { useEffect, useRef, useState } from 'react'
import './App.css'
import LoginPage from './features/auth/LoginPage'
import AppLoader from './components/common/AppLoader'
import AppErrorBoundary from './components/common/AppErrorBoundary'
import PetugasApp from './features/petugas/PetugasApp'
import AdminApp from './features/admin/AdminApp'
import ParentPortalSection from './features/parent/ParentPortalSection'
import { authApi } from './services/api'
import type { AuthSession } from './types'
import {
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
} from './utils/auth-storage'

const STAFF_PORTAL_HOST = 'apps.tparumahceria.my.id'
const PARENT_PORTAL_HOST = 'parent.tparumahceria.my.id'
const ENFORCE_PARENT_SUBDOMAIN = import.meta.env.PROD
  ? import.meta.env.VITE_ENFORCE_PARENT_SUBDOMAIN !== 'false'
  : import.meta.env.VITE_ENFORCE_PARENT_SUBDOMAIN === 'true'
const PARENT_PORTAL_HOST_ALIASES = new Set([
  PARENT_PORTAL_HOST,
  'ortu.tparumahceria.my.id',
])
const LEGACY_PARENT_ENTRY_PATH = '/portal-orang-tua'

const normalizeHost = (host: string): string =>
  host
    .split(':')[0]
    .trim()
    .toLowerCase()

const isLikelyLocalHost = (host: string): boolean => {
  if (!host) {
    return true
  }
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    return true
  }
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)
}

const isManagedPublicHost = (host: string): boolean =>
  host === 'tparumahceria.my.id' || host.endsWith('.tparumahceria.my.id')

const resolveRedirectHostByRole = (role: AuthSession['user']['role']): string | null => {
  if (role === 'ORANG_TUA') {
    return ENFORCE_PARENT_SUBDOMAIN ? PARENT_PORTAL_HOST : null
  }

  if (role === 'ADMIN' || role === 'PETUGAS') {
    return STAFF_PORTAL_HOST
  }

  return null
}

const isAllowedHostByRole = (
  role: AuthSession['user']['role'],
  host: string,
): boolean => {
  if (role === 'ORANG_TUA') {
    if (!ENFORCE_PARENT_SUBDOMAIN) {
      return host === STAFF_PORTAL_HOST || PARENT_PORTAL_HOST_ALIASES.has(host)
    }
    return PARENT_PORTAL_HOST_ALIASES.has(host)
  }

  if (role === 'ADMIN' || role === 'PETUGAS') {
    return host === STAFF_PORTAL_HOST
  }

  return false
}

const App = () => {
  const [session, setSession] = useState<AuthSession | null>(() => loadAuthSession())
  const [isBootstrapping, setBootstrapping] = useState(true)
  const [isSubmittingAuth, setSubmittingAuth] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const lastActivityTimeRef = useRef(Date.now())
  const INACTIVITY_TIMEOUT = 10 * 60 * 1000 // 10 minutes

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const me = await authApi.me()
        const refreshedSession: AuthSession = {
          expiresAt: me.expiresAt,
          user: me.user,
        }
        saveAuthSession(refreshedSession)
        setSession(refreshedSession)
      } catch {
        clearAuthSession()
        setSession(null)
      } finally {
        setBootstrapping(false)
      }
    }

    void bootstrapAuth()
  }, [])

  const handleLogin = async (payload: {
    email: string
    password: string
    loginPreference?: 'STAFF_FIRST' | 'PARENT_FIRST'
  }) => {
    setSubmittingAuth(true)
    setAuthError(null)
    try {
      const nextSession = await authApi.login(payload)
      saveAuthSession(nextSession)
      setSession(nextSession)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login gagal.'
      setAuthError(message)
    } finally {
      setSubmittingAuth(false)
    }
  }

  const handleRegisterParent = async (payload: {
    email: string
    password: string
    registrationCode: string
  }) => {
    setSubmittingAuth(true)
    setAuthError(null)
    try {
      await authApi.registerParentWithCode(payload)
      try {
        await authApi.logout()
      } catch {
        // Abaikan kegagalan logout; sesi klien tetap dibersihkan agar kembali ke halaman login.
      }
      clearAuthSession()
      setSession(null)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Pendaftaran akun orang tua gagal.'
      setAuthError(message)
    } finally {
      setSubmittingAuth(false)
    }
  }

  const handleRegisterStaff = async (payload: {
    fullName: string
    email: string
    password: string
  }) => {
    setSubmittingAuth(true)
    setAuthError(null)
    try {
      await authApi.registerStaff(payload)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Pendaftaran akun petugas gagal.'
      setAuthError(message)
      throw error
    } finally {
      setSubmittingAuth(false)
    }
  }

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch {
      // Ignore logout network errors; session client tetap harus dibersihkan.
    } finally {
      clearAuthSession()
      setSession(null)
      setAuthError(null)
    }
  }

  useEffect(() => {
    if (!session) return undefined
    
    const resetTimer = () => {
      lastActivityTimeRef.current = Date.now()
    }

    const events = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click']
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))

    const interval = window.setInterval(() => {
      if (Date.now() - lastActivityTimeRef.current > INACTIVITY_TIMEOUT) {
        window.alert('Sesi Anda telah berakhir karena tidak ada aktivitas selama 10 menit. Sistem telah memproses logout otomatis demi keamanan akun Anda.')
        void handleLogout()
      }
    }, 15000)

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer))
      window.clearInterval(interval)
    }
  }, [INACTIVITY_TIMEOUT, session])

  const searchParams = new URLSearchParams(window.location.search)
  const normalizedPath = (window.location.pathname || '/').replace(/\/+$/, '') || '/'
  const normalizedHost = normalizeHost(window.location.hostname)
  const isKnownPublicHost =
    isManagedPublicHost(normalizedHost) && !isLikelyLocalHost(normalizedHost)
  const redirectHostByRole = session
    ? resolveRedirectHostByRole(session.user.role)
    : null
  const isHostAllowedForSession = session
    ? isAllowedHostByRole(session.user.role, normalizedHost)
    : false
  const shouldRedirectByRole = Boolean(
    !isBootstrapping &&
    session &&
    redirectHostByRole &&
    isKnownPublicHost &&
    !isHostAllowedForSession,
  )
  const isLegacyParentEntry =
    normalizedPath === LEGACY_PARENT_ENTRY_PATH || searchParams.get('portal') === 'parent'
  const isParentPortalHost = PARENT_PORTAL_HOST_ALIASES.has(normalizedHost)
  const shouldRedirectLegacyParentEntry = Boolean(
    !isBootstrapping &&
    !session &&
    ENFORCE_PARENT_SUBDOMAIN &&
    isKnownPublicHost &&
    isLegacyParentEntry &&
    !isParentPortalHost,
  )

  useEffect(() => {
    if (!shouldRedirectByRole || !redirectHostByRole) {
      return
    }

    const targetUrl = `${window.location.protocol}//${redirectHostByRole}${window.location.pathname}${window.location.search}${window.location.hash}`
    window.location.replace(targetUrl)
  }, [redirectHostByRole, shouldRedirectByRole])

  useEffect(() => {
    if (!shouldRedirectLegacyParentEntry) {
      return
    }

    const targetUrl = new URL(
      `${window.location.protocol}//${PARENT_PORTAL_HOST}/`,
    )
    const nextSearchParams = new URLSearchParams(window.location.search)
    nextSearchParams.delete('portal')
    const searchValue = nextSearchParams.toString()
    targetUrl.search = searchValue
    targetUrl.hash = window.location.hash
    window.location.replace(targetUrl.toString())
  }, [shouldRedirectLegacyParentEntry])

  if (isBootstrapping) {
    return <AppLoader />
  }

  if (shouldRedirectByRole || shouldRedirectLegacyParentEntry) {
    return <AppLoader />
  }

  if (!session) {
    const isParentPortalEntry =
      isParentPortalHost || isLegacyParentEntry
    const initialAuthMode = searchParams.get('mode') === 'register' ? 'register' : 'login'

    return (
      <LoginPage
        isLoading={isSubmittingAuth}
        errorMessage={authError}
        variant={isParentPortalEntry ? 'parent-portal' : 'default'}
        initialMode={initialAuthMode}
        onSubmit={handleLogin}
        onRegisterParent={isParentPortalEntry ? handleRegisterParent : undefined}
        onRegisterStaff={isParentPortalEntry ? undefined : handleRegisterStaff}
      />
    )
  }

  if (session.user.role === 'PETUGAS') {
    return (
      <AppErrorBoundary>
        <PetugasApp user={session.user} onLogout={handleLogout} />
      </AppErrorBoundary>
    )
  }

  if (session.user.role === 'ADMIN') {
    return (
      <AppErrorBoundary>
        <AdminApp user={session.user} onLogout={handleLogout} />
      </AppErrorBoundary>
    )
  }

  if (session.user.role === 'ORANG_TUA') {
    return (
      <AppErrorBoundary>
        <ParentPortalSection user={session.user} onLogout={handleLogout} />
      </AppErrorBoundary>
    )
  }

  return (
    <section className="auth-shell auth-shell--simple">
      <div className="auth-card">
        <h2>Akses Tidak Tersedia</h2>
        <p className="card__description">
          Role akun tidak dikenali. Silakan login ulang.
        </p>
        <div className="form-actions">
          <button type="button" className="button" onClick={() => void handleLogout()}>
            Logout
          </button>
        </div>
      </div>
    </section>
  )
}

export default App
