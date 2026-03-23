import {
  Clock3,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'

const PLATFORM_LOGO_SRC = `${import.meta.env.BASE_URL}logo_TPA.jpg`
const PARENT_DEACTIVATED_MESSAGE =
  'Akun Anda telah dinonaktifkan. Silahkan hubungi admin untuk mengaktifkan kembali.'

type AuthMode = 'login' | 'register'
type LoginPageVariant = 'default' | 'parent-portal'

interface LoginPageProps {
  isLoading: boolean
  errorMessage: string | null
  variant?: LoginPageVariant
  initialMode?: AuthMode
  onSubmit: (payload: { email: string; password: string }) => Promise<void>
  onRegisterParent?: (payload: {
    email: string
    password: string
    registrationCode: string
  }) => Promise<void>
}

const LoginPage = ({
  isLoading,
  errorMessage,
  variant = 'default',
  initialMode = 'login',
  onSubmit,
  onRegisterParent,
}: LoginPageProps) => {
  const [authMode, setAuthMode] = useState<AuthMode>(initialMode)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [registrationCode, setRegistrationCode] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const isParentPortalVariant = variant === 'parent-portal'

  useEffect(() => {
    setAuthMode(initialMode)
    setLocalError(null)
  }, [initialMode])

  useEffect(() => {
    if (!errorMessage) {
      return
    }
    if (!isParentPortalVariant) {
      return
    }
    if (errorMessage !== PARENT_DEACTIVATED_MESSAGE) {
      return
    }
    window.alert(PARENT_DEACTIVATED_MESSAGE)
  }, [errorMessage, isParentPortalVariant])

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLocalError(null)

    const normalizedEmail = loginEmail.trim().toLowerCase()
    if (!normalizedEmail) {
      setLocalError('Email wajib diisi.')
      return
    }
    if (!loginPassword.trim()) {
      setLocalError('Password wajib diisi.')
      return
    }

    try {
      await onSubmit({
        email: normalizedEmail,
        password: loginPassword,
      })
    } catch {
      // Error ditampilkan dari parent.
    }
  }

  const handleRegisterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLocalError(null)

    const normalizedEmail = registerEmail.trim().toLowerCase()
    if (!normalizedEmail) {
      setLocalError('Email wajib diisi.')
      return
    }
    if (!registerPassword.trim()) {
      setLocalError('Password wajib diisi.')
      return
    }
    if (!registrationCode.trim()) {
      setLocalError('Kode registrasi wajib diisi.')
      return
    }
    if (!onRegisterParent) {
      setLocalError('Pendaftaran akun orang tua belum tersedia di halaman ini.')
      return
    }

    try {
      await onRegisterParent({
        email: normalizedEmail,
        password: registerPassword,
        registrationCode: registrationCode.trim().toUpperCase(),
      })
    } catch {
      // Error ditampilkan dari parent.
    }
  }

  const title = isParentPortalVariant
    ? 'Portal Orang Tua Terpisah'
    : 'Selamat Datang di TPA Rumah Ceria'
  const description = isParentPortalVariant
    ? 'Login dan dashboard monitoring orang tua sekarang berdiri sendiri, tidak lagi berada di dalam landing page.'
    : 'Kelola aktivitas harian, pantau perkembangan anak, dan kelola operasional TPA dengan mudah dan terstruktur.'
  const cardEyebrow = isParentPortalVariant ? 'Portal Orang Tua' : 'Selamat Datang'
  const cardTitle =
    authMode === 'register' && isParentPortalVariant
      ? 'Daftar Akun Orang Tua'
      : 'Masuk ke Dashboard'
  const cardSubtitle =
    authMode === 'register' && isParentPortalVariant
      ? 'Silahkan daftarkan akun untuk dapat mengakses dashboard monitoring putra-putri Anda.'
      : isParentPortalVariant
        ? 'Silahkan login untuk membuka dashboard monitoring anak Anda.'
        : 'Masuk untuk mengakses panel pengelolaan TPA Anda.'

  return (
    <section className={`auth-shell ${isParentPortalVariant ? 'auth-shell--portal' : ''}`}>
      <aside className="auth-visual auth-visual--login">
        <h1>{title}</h1>
        <p>{description}</p>

        <div className="auth-visual__highlight">
          <div className="auth-visual__highlight-card">
            <ShieldCheck size={20} />
            <div>
              <strong>Akses Aman</strong>
              <span>Autentikasi akun orang tua, admin, dan petugas tetap terpusat dan aman.</span>
            </div>
          </div>
          <div className="auth-visual__feature-list">
            <article className="auth-visual__feature">
              <Users size={18} />
              <div>
                <strong>Portal Mandiri</strong>
                <span>Alur login parent berdiri sendiri sehingga tidak lagi terasa seperti overlay landing page.</span>
              </div>
            </article>
            <article className="auth-visual__feature">
              <Clock3 size={18} />
              <div>
                <strong>Mobile Lebih Natural</strong>
                <span>Scroll dan pull-to-refresh tetap mengikuti perilaku halaman biasa di perangkat mobile.</span>
              </div>
            </article>
            <article className="auth-visual__feature">
              <Sparkles size={18} />
              <div>
                <strong>Monitoring Langsung</strong>
                <span>Setelah login, orang tua langsung masuk ke portal monitoring anak full screen.</span>
              </div>
            </article>
          </div>
        </div>
      </aside>

      <div className={`auth-card auth-card--login ${isParentPortalVariant ? 'auth-card--portal' : ''}`}>
        <div className="auth-card__badge-block" aria-hidden="true">
          <div className="auth-card__badge">
            <img src={PLATFORM_LOGO_SRC} alt="" className="auth-card__logo" />
          </div>
          <p>{isParentPortalVariant ? 'PARENT PORTAL TPA' : 'DAYCARE TPA'}</p>
        </div>

        <div className="auth-card__header">
          <ShieldCheck size={24} className="auth-card__top-icon" />
          <span className="auth-card__eyebrow">{cardEyebrow}</span>
          <h2>{cardTitle}</h2>
          <p className="auth-card__subtitle">{cardSubtitle}</p>
        </div>

        {isParentPortalVariant && onRegisterParent ? (
          <div className="auth-mode-switch" role="tablist" aria-label="Pilih mode akun orang tua">
            <button
              type="button"
              role="tab"
              aria-selected={authMode === 'login'}
              className={authMode === 'login' ? 'is-active' : ''}
              onClick={() => {
                setAuthMode('login')
                setLocalError(null)
              }}
            >
              Login
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authMode === 'register'}
              className={authMode === 'register' ? 'is-active' : ''}
              onClick={() => {
                setAuthMode('register')
                setLocalError(null)
              }}
            >
              Daftar
            </button>
          </div>
        ) : null}

        {authMode === 'register' && isParentPortalVariant && onRegisterParent ? (
          <form className="auth-form auth-form--stacked" onSubmit={handleRegisterSubmit}>
            <div className="field-group">
              <label className="label" htmlFor="registerEmail">
                Email
              </label>
              <div className="input-with-icon">
                <Mail size={16} />
                <input
                  id="registerEmail"
                  className="input"
                  type="email"
                  autoComplete="email"
                  placeholder="Masukkan Email Anda"
                  value={registerEmail}
                  onChange={(event) => setRegisterEmail(event.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="field-group">
              <label className="label" htmlFor="registerPassword">
                Password
              </label>
              <div className="input-with-action">
                <div className="input-with-icon">
                  <Lock size={16} />
                  <input
                    id="registerPassword"
                    className="input"
                    type={showRegisterPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Masukkan Password Anda"
                    value={registerPassword}
                    onChange={(event) => setRegisterPassword(event.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShowRegisterPassword((previous) => !previous)}
                  aria-label={showRegisterPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showRegisterPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="field-group">
              <label className="label" htmlFor="registerCode">
                Kode Registrasi Anak
              </label>
              <div className="input-with-icon">
                <KeyRound size={16} />
                <input
                  id="registerCode"
                  className="input"
                  type="text"
                  autoCapitalize="characters"
                  placeholder="Masukkan Kode Registrasi"
                  value={registrationCode}
                  onChange={(event) => setRegistrationCode(event.target.value.toUpperCase())}
                  disabled={isLoading}
                />
              </div>
            </div>

            {localError ? <p className="field-error">{localError}</p> : null}
            {errorMessage ? <p className="field-error">{errorMessage}</p> : null}

            <div className="form-actions">
              <button type="submit" className="button button--auth-primary" disabled={isLoading}>
                {isLoading ? 'Memproses...' : 'Daftar Sekarang'}
              </button>
            </div>
          </form>
        ) : (
          <form className="auth-form auth-form--stacked" onSubmit={handleLoginSubmit}>
            <div className="field-group">
              <label className="label" htmlFor="loginEmail">
                Email
              </label>
              <div className="input-with-icon">
                <Mail size={16} />
                <input
                  id="loginEmail"
                  className="input"
                  type="email"
                  autoComplete="username"
                  placeholder={
                    isParentPortalVariant ? 'Masukkan Email Anda' : 'Masukkan akun email Anda'
                  }
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="field-group">
              <label className="label" htmlFor="loginPassword">
                Password
              </label>
              <div className="input-with-action">
                <div className="input-with-icon">
                  <Lock size={16} />
                  <input
                    id="loginPassword"
                    className="input"
                    type={showLoginPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder={
                      isParentPortalVariant
                        ? 'Masukkan Password Anda'
                        : 'Masukkan password Anda'
                    }
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShowLoginPassword((previous) => !previous)}
                  aria-label={showLoginPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {localError ? <p className="field-error">{localError}</p> : null}
            {errorMessage ? <p className="field-error">{errorMessage}</p> : null}

            <div className="form-actions">
              <button type="submit" className="button button--auth-primary" disabled={isLoading}>
                {isLoading ? 'Memproses...' : 'Masuk Sekarang'}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}

export default LoginPage
