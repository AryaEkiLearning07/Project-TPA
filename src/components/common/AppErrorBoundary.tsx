import { Component, type ErrorInfo, type ReactNode } from 'react'
import { clearAuthSession } from '../../utils/auth-storage'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  hasError: boolean
  errorTypeLabel: string
  userMessage: string
  technicalMessage: string | null
  errorReference: string | null
}

const IS_PRODUCTION_BUILD = import.meta.env.PROD

class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  private readonly chunkReloadStorageKey = 'tpa:chunk-reload-once'

  state: AppErrorBoundaryState = {
    hasError: false,
    errorTypeLabel: 'Aplikasi',
    userMessage: 'Halaman portal mengalami gangguan saat dimuat. Coba muat ulang halaman.',
    technicalMessage: null,
    errorReference: null,
  }

  static getDerivedStateFromError(): Partial<AppErrorBoundaryState> {
    return { hasError: true }
  }

  private readSessionFlag = (): string | null => {
    try {
      return window.sessionStorage.getItem(this.chunkReloadStorageKey)
    } catch {
      return null
    }
  }

  private writeSessionFlag = (value: string): void => {
    try {
      window.sessionStorage.setItem(this.chunkReloadStorageKey, value)
    } catch {
      // Ignore storage failures on restricted browsers.
    }
  }

  private clearSessionFlag = (): void => {
    try {
      window.sessionStorage.removeItem(this.chunkReloadStorageKey)
    } catch {
      // Ignore storage failures on restricted browsers.
    }
  }

  private createErrorReference = (): string => {
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).slice(2, 7).toUpperCase()
    return `FRONT-${timestamp}-${random}`
  }

  private classifyError = (error: Error): {
    isChunkLoadError: boolean
    errorTypeLabel: string
    userMessage: string
    technicalMessage: string | null
  } => {
    const rawMessage = typeof error?.message === 'string' ? error.message : ''
    const normalized = `${error?.name || ''} ${rawMessage}`.toLowerCase()
    const isChunkLoadError = /loading chunk|failed to fetch dynamically imported module|importing a module script failed/i.test(
      rawMessage,
    )

    if (isChunkLoadError) {
      return {
        isChunkLoadError: true,
        errorTypeLabel: 'Pemuatan Modul Aplikasi',
        userMessage:
          'Modul aplikasi gagal dimuat. Biasanya ini terjadi karena versi aplikasi di browser belum sinkron setelah pembaruan.',
        technicalMessage: IS_PRODUCTION_BUILD ? null : rawMessage || null,
      }
    }

    if (/networkerror|failed to fetch|network request failed|load failed/i.test(normalized)) {
      return {
        isChunkLoadError: false,
        errorTypeLabel: 'Koneksi Jaringan',
        userMessage:
          'Koneksi ke server bermasalah saat memuat halaman. Periksa jaringan lalu coba lagi.',
        technicalMessage: IS_PRODUCTION_BUILD ? null : rawMessage || null,
      }
    }

    if (/typeerror|cannot read properties of undefined|cannot read properties of null/i.test(normalized)) {
      return {
        isChunkLoadError: false,
        errorTypeLabel: 'Runtime Aplikasi',
        userMessage:
          'Terjadi kesalahan runtime pada aplikasi. Silakan muat ulang atau reset sesi jika masalah berulang.',
        technicalMessage: IS_PRODUCTION_BUILD ? null : rawMessage || null,
      }
    }

    return {
      isChunkLoadError: false,
      errorTypeLabel: 'Error Internal Frontend',
      userMessage:
        'Terjadi gangguan internal saat merender halaman. Silakan muat ulang halaman.',
      technicalMessage: IS_PRODUCTION_BUILD ? null : rawMessage || null,
    }
  }

  private forceResetSession = async (): Promise<void> => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
    } catch {
      // Ignore network error and keep local reset flow.
    } finally {
      clearAuthSession()
      window.location.assign('/')
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const reference = this.createErrorReference()
    const classified = this.classifyError(error)
    this.setState({
      hasError: true,
      errorTypeLabel: classified.errorTypeLabel,
      userMessage: classified.userMessage,
      technicalMessage: classified.technicalMessage,
      errorReference: reference,
    })

    console.error(`[${reference}] Unhandled frontend error:`, error, info)

    if (!classified.isChunkLoadError || typeof window === 'undefined') {
      return
    }

    const alreadyReloaded = this.readSessionFlag() === '1'
    if (!alreadyReloaded) {
      this.writeSessionFlag('1')
      window.location.reload()
      return
    }

    this.clearSessionFlag()
  }

  handleReload = (): void => {
    this.clearSessionFlag()
    window.location.reload()
  }

  handleResetSession = (): void => {
    this.clearSessionFlag()
    void this.forceResetSession()
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <section className="auth-shell auth-shell--simple">
        <div className="auth-card auth-card--login">
          <div className="auth-card__header">
            <h2>Sistem Perlu Dimuat Ulang</h2>
          </div>
          <p className="card__description">
            {this.state.userMessage}
          </p>
          <p className="app-error-boundary__meta">
            Jenis error: <strong>{this.state.errorTypeLabel}</strong>
          </p>
          {this.state.errorReference ? (
            <p className="app-error-boundary__meta app-error-boundary__meta--reference">
              Kode referensi: <code>{this.state.errorReference}</code>
            </p>
          ) : null}
          {this.state.technicalMessage ? (
            <details className="app-error-boundary__details">
              <summary>Detail teknis</summary>
              <code>{this.state.technicalMessage}</code>
            </details>
          ) : null}
          <div className="form-actions">
            <button type="button" className="button" onClick={this.handleReload}>
              Muat Ulang
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={this.handleResetSession}
            >
              Reset Sesi
            </button>
          </div>
        </div>
      </section>
    )
  }
}

export default AppErrorBoundary
