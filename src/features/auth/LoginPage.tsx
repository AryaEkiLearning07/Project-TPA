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
const STAFF_PENDING_APPROVAL_KEYWORD = 'menunggu persetujuan admin'

type AuthMode = 'login' | 'register'
type LoginPageVariant = 'default' | 'parent-portal'

interface LoginPageProps {
  isLoading: boolean
  errorMessage: string | null
  variant?: LoginPageVariant
  initialMode?: AuthMode
  onSubmit: (payload: {
    email: string
    password: string
    loginPreference?: 'STAFF_FIRST' | 'PARENT_FIRST'
  }) => Promise<void>
  onRegisterParent?: (payload: {
    email: string
    password: string
    registrationCode: string
  }) => Promise<void>
  onRegisterStaff?: (payload: {
    fullName: string
    email: string
    password: string
  }) => Promise<void>
}

const LoginPage = ({
  isLoading,
  errorMessage,
  variant = 'default',
  initialMode = 'login',
  onSubmit,
  onRegisterParent,
  onRegisterStaff,
}: LoginPageProps) => {
  const [authMode, setAuthMode] = useState<AuthMode>(initialMode)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [registerFullName, setRegisterFullName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [registrationCode, setRegistrationCode] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const isParentPortalVariant = variant === 'parent-portal'
  const isStaffPendingApproval = Boolean(
    !isParentPortalVariant &&
      errorMessage &&
      errorMessage.toLowerCase().includes(STAFF_PENDING_APPROVAL_KEYWORD),
  )

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
    setSuccessMessage(null)

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
        loginPreference: isParentPortalVariant ? 'PARENT_FIRST' : 'STAFF_FIRST',
      })
    } catch {
      // Error ditampilkan dari parent.
    }
  }

  const handleRegisterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLocalError(null)
    setSuccessMessage(null)

    const normalizedEmail = registerEmail.trim().toLowerCase()
    if (isParentPortalVariant) {
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
        setAuthMode('login')
        setLoginEmail(normalizedEmail)
        setLoginPassword('')
        setRegisterEmail('')
        setRegisterPassword('')
        setRegistrationCode('')
        setShowRegisterPassword(false)
        setSuccessMessage('Pendaftaran Berhasil, Silahkan Masuk')
      } catch {
        // Error ditampilkan dari parent.
      }
      return
    }

    const normalizedFullName = registerFullName.trim()
    if (!normalizedFullName) {
      setLocalError('Nama lengkap wajib diisi.')
      return
    }
    if (!normalizedEmail) {
      setLocalError('Email wajib diisi.')
      return
    }
    if (!registerPassword.trim()) {
      setLocalError('Password wajib diisi.')
      return
    }
    if (!onRegisterStaff) {
      setLocalError('Pendaftaran akun petugas belum tersedia di halaman ini.')
      return
    }

    try {
      await onRegisterStaff({
        fullName: normalizedFullName,
        email: normalizedEmail,
        password: registerPassword,
      })
      setAuthMode('login')
      setLoginEmail(normalizedEmail)
      setLoginPassword('')
      setRegisterFullName('')
      setRegisterEmail('')
      setRegisterPassword('')
      setShowRegisterPassword(false)
      setSuccessMessage(
        'Pendaftaran berhasil. Akun Anda menunggu persetujuan admin.',
      )
    } catch {
      // Error ditampilkan dari parent.
    }
  }

  const title = isParentPortalVariant
    ? 'Selamat Datang Di TPA Rumah Ceria'
    : 'Selamat Datang di TPA Rumah Ceria'
  const description = isParentPortalVariant
    ? 'Platfom ini digunakan untuk memantau perkembangan putra putri anda yang ada di TPA'
    : 'Kelola aktivitas harian, pantau perkembangan anak, dan kelola operasional TPA dengan mudah dan terstruktur.'
  const cardEyebrow = isParentPortalVariant ? 'SELAMAT DATANG' : 'Selamat Datang'
  const cardTitle =
    authMode === 'register' && isParentPortalVariant
      ? 'Daftar Akun Orang Tua'
      : authMode === 'register' && !isParentPortalVariant
        ? 'Daftar Akun Petugas'
      : 'Masuk ke Dashboard'
  const cardSubtitle =
    authMode === 'register' && isParentPortalVariant
      ? 'Silahkan daftarkan akun untuk dapat mengakses dashboard monitoring putra putri anda.'
      : authMode === 'register' && !isParentPortalVariant
        ? 'Daftarkan akun petugas Anda. Akses dashboard aktif setelah disetujui admin.'
      : isParentPortalVariant
        ? 'Silahkan login untuk membuka dashboard monitoring putra putri anda'
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
              <strong>{isParentPortalVariant ? 'Monitoring Digital' : 'Akses Aman'}</strong>
              <span>
                {isParentPortalVariant
                  ? 'Pantau perkembangan dan kebutuhan putra putri anda secara praktis.'
                  : 'Autentikasi akun orang tua tetap terlindungi dengan sesi yang aman.'}
              </span>
            </div>
          </div>
          <div className="auth-visual__feature-list">
            <article className="auth-visual__feature">
              <Users size={18} />
              <div>
                <strong>{isParentPortalVariant ? 'Laporan Digital' : 'Portal Mandiri'}</strong>
                <span>
                  {isParentPortalVariant
                    ? 'Lihat hasil laporan perkembangan putra putri anda secara digital.'
                    : 'Alur login parent berdiri sendiri sehingga tidak lagi terasa seperti overlay landing page.'}
                </span>
              </div>
            </article>
            <article className="auth-visual__feature">
              <Clock3 size={18} />
              <div>
                <strong>{isParentPortalVariant ? 'Komunikasi' : 'Mobile Lebih Natural'}</strong>
                <span>
                  {isParentPortalVariant
                    ? 'Komunikasikan perkembangan dan kebutuhan putra putri anda langsung dengan masing-masing kakak pendamping.'
                    : 'Scroll dan pull-to-refresh tetap mengikuti perilaku halaman biasa di perangkat mobile.'}
                </span>
              </div>
            </article>
            <article className="auth-visual__feature">
              <Sparkles size={18} />
              <div>
                <strong>{isParentPortalVariant ? 'Galeri Moment' : 'Monitoring Langsung'}</strong>
                <span>
                  {isParentPortalVariant
                    ? 'Dapatkan moment-moment putra putri anda selama di TPA secara daring.'
                    : 'Setelah login, orang tua langsung masuk ke portal monitoring anak full screen.'}
                </span>
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
          <p>{isParentPortalVariant ? 'DASHBOARD MONITORING' : 'DAYCARE TPA'}</p>
        </div>

        <div className="auth-card__header">
          <ShieldCheck size={24} className="auth-card__top-icon" />
          <span className="auth-card__eyebrow">{cardEyebrow}</span>
          <h2>{cardTitle}</h2>
          <p className="auth-card__subtitle">{cardSubtitle}</p>
        </div>

        {authMode === 'register' &&
        ((isParentPortalVariant && onRegisterParent) ||
          (!isParentPortalVariant && onRegisterStaff)) ? (
          <form className="auth-form auth-form--stacked" onSubmit={handleRegisterSubmit}>
            {!isParentPortalVariant ? (
              <div className="field-group">
                <label className="label" htmlFor="registerFullName">
                  Nama Lengkap
                </label>
                <div className="input-with-icon">
                  <Users size={16} />
                  <input
                    id="registerFullName"
                    className="input"
                    type="text"
                    autoComplete="name"
                    placeholder="Masukkan Nama Lengkap Anda"
                    value={registerFullName}
                    onChange={(event) => setRegisterFullName(event.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>
            ) : null}

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

            {isParentPortalVariant ? (
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
            ) : null}

            {localError ? <p className="field-error">{localError}</p> : null}
            {errorMessage ? <p className="field-error">{errorMessage}</p> : null}

            <div className="form-actions">
              <button type="submit" className="button button--auth-primary" disabled={isLoading}>
                {isLoading ? 'Memproses...' : 'Daftar Sekarang'}
              </button>
            </div>
            <p className="auth-form__switch-text">
              Sudah punya akun?{' '}
              <button
                type="button"
                className="auth-form__switch-link"
                onClick={() => {
                  setAuthMode('login')
                  setLocalError(null)
                }}
                disabled={isLoading}
              >
                Masuk disini
              </button>
            </p>
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

            {successMessage ? <p className="field-success">{successMessage}</p> : null}
            {localError ? <p className="field-error">{localError}</p> : null}
            {errorMessage ? <p className="field-error">{errorMessage}</p> : null}

            <div className="form-actions">
              <button type="submit" className="button button--auth-primary" disabled={isLoading}>
                {isLoading ? 'Memproses...' : 'Masuk Sekarang'}
              </button>
            </div>
            {isParentPortalVariant && onRegisterParent ? (
              <p className="auth-form__switch-text">
                Belum punya akun?{' '}
                <button
                  type="button"
                  className="auth-form__switch-link"
                  onClick={() => {
                    setAuthMode('register')
                    setLocalError(null)
                    setSuccessMessage(null)
                  }}
                  disabled={isLoading}
                >
                  Daftar disini
                </button>
              </p>
            ) : !isParentPortalVariant && onRegisterStaff ? (
              <p className="auth-form__switch-text">
                Belum punya akun petugas?{' '}
                <button
                  type="button"
                  className="auth-form__switch-link"
                  onClick={() => {
                    setAuthMode('register')
                    setLocalError(null)
                    setSuccessMessage(null)
                  }}
                  disabled={isLoading}
                >
                  Daftar disini
                </button>
              </p>
            ) : null}
          </form>
        )}
      </div>

      {isStaffPendingApproval ? (
        <div className="app-confirm-overlay">
          <div className="app-confirm-dialog" role="alertdialog" aria-modal="true">
            <h3>Pendaftaran Menunggu Persetujuan</h3>
            <p>
              Akun petugas Anda sudah terdaftar tetapi belum disetujui admin. Akses
              dashboard akan aktif setelah proses approve selesai.
            </p>
            <div className="app-greeting-dialog__footer">
              <span className="app-greeting-dialog__countdown">
                Silakan tunggu konfirmasi dari admin, lalu coba login kembali.
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default LoginPage
