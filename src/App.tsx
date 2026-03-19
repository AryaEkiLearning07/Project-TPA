import { useEffect, useState } from 'react'
import './App.css'
import LoginPage from './features/auth/LoginPage'
import PetugasSection from './features/petugas/PetugasSection'
import AdminSection from './features/admin/AdminSection'
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
  const [isSubmittingLogin, setSubmittingLogin] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

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
    setSubmittingLogin(true)
    setLoginError(null)
    try {
      const nextSession = await authApi.login(payload)
      saveAuthSession(nextSession)
      setSession(nextSession)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login gagal.'
      setLoginError(message)
    } finally {
      setSubmittingLogin(false)
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
      setLoginError(null)
    }
  }

  if (isBootstrapping) {
    return (
      <section className="auth-shell">
        <div className="auth-card">
          <h2>Memuat sesi...</h2>
          <p className="card__description">Sedang memverifikasi login Anda.</p>
        </div>
      </section>
    )
  }

  if (!session) {
    return (
      <LoginPage
        isLoading={isSubmittingLogin}
        errorMessage={loginError}
        onSubmit={handleLogin}
      />
    )
  }

  if (session.user.role === 'PETUGAS') {
    return <PetugasSection user={session.user} onLogout={handleLogout} />
  }

  if (session.user.role === 'ADMIN') {
    return <AdminSection user={session.user} onLogout={handleLogout} />
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
