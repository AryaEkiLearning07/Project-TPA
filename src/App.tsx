import { useEffect, useState, useRef } from 'react'
import './App.css'
import LoginPage from './features/auth/LoginPage'
import PetugasSection from './features/petugas/PetugasSection'
import AdminSection from './features/admin/AdminSection'
import ParentPortalSection from './features/parent/ParentPortalSection'
import AppLoader from './components/common/AppLoader'
import { authApi } from './services/api'
import type { AuthSession } from './types'
import {
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
} from './utils/auth-storage'

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
      const nextSession = await authApi.registerParentWithCode(payload)
      const normalizedSession: AuthSession = {
        user: nextSession.user,
        expiresAt: nextSession.expiresAt,
      }
      saveAuthSession(normalizedSession)
      setSession(normalizedSession)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Pendaftaran akun orang tua gagal.'
      setAuthError(message)
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
  }, [session])

  if (isBootstrapping) {
    return <AppLoader />
  }

  if (!session) {
    const searchParams = new URLSearchParams(window.location.search)
    const normalizedPath = (window.location.pathname || '/').replace(/\/+$/, '') || '/'
    const isParentPortalEntry =
      normalizedPath === '/portal-orang-tua' || searchParams.get('portal') === 'parent'
    const initialAuthMode = searchParams.get('mode') === 'register' ? 'register' : 'login'

    return (
      <LoginPage
        isLoading={isSubmittingAuth}
        errorMessage={authError}
        variant={isParentPortalEntry ? 'parent-portal' : 'default'}
        initialMode={initialAuthMode}
        onSubmit={handleLogin}
        onRegisterParent={isParentPortalEntry ? handleRegisterParent : undefined}
      />
    )
  }

  if (session.user.role === 'PETUGAS') {
    return <PetugasSection user={session.user} onLogout={handleLogout} />
  }

  if (session.user.role === 'ADMIN') {
    return <AdminSection user={session.user} onLogout={handleLogout} />
  }

  if (session.user.role === 'ORANG_TUA') {
    return <ParentPortalSection user={session.user} onLogout={handleLogout} />
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
