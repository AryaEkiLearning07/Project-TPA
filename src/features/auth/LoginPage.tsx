import { Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react'
import { type FormEvent, useState } from 'react'

const PLATFORM_LOGO_SRC = `${import.meta.env.BASE_URL}logo_TPA.jpg`

interface LoginPageProps {
  isLoading: boolean
  errorMessage: string | null
  onSubmit: (payload: { email: string; password: string }) => Promise<void>
}

const LoginPage = ({ isLoading, errorMessage, onSubmit }: LoginPageProps) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLocalError(null)

    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      setLocalError('Email wajib diisi.')
      return
    }
    if (!password.trim()) {
      setLocalError('Password wajib diisi.')
      return
    }

    try {
      await onSubmit({
        email: normalizedEmail,
        password,
      })
    } catch {
      // Error sudah ditangani parent component agar pesan bisa ditampilkan.
    }
  }

  return (
    <section className="auth-shell auth-shell--simple">
      <div className="auth-card auth-card--login">
        <div className="auth-card__badge-block" aria-hidden="true">
          <div className="auth-card__badge">
            <img src={PLATFORM_LOGO_SRC} alt="" className="auth-card__logo" />
          </div>
          <p>DAYCARE UBAYA</p>
        </div>
        <div className="auth-card__header">
          <ShieldCheck size={24} className="auth-card__top-icon" />
          <h2>LOGIN SISTEM</h2>
        </div>

        <form onSubmit={handleSubmit}>
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
                value={email}
                onChange={(event) => setEmail(event.target.value)}
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
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isLoading}
                />
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowPassword((previous) => !previous)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {localError ? <p className="field-error">{localError}</p> : null}
          {errorMessage ? <p className="field-error">{errorMessage}</p> : null}

          <div className="form-actions">
            <button type="submit" className="button" disabled={isLoading}>
              {isLoading ? 'Memproses...' : 'Masuk'}
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}

export default LoginPage
