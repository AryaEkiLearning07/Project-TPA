import { Component, type ErrorInfo, type ReactNode } from 'react'
import { clearAuthSession } from '../../utils/auth-storage'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  hasError: boolean
}

class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled frontend error:', error, info)
  }

  handleReload = (): void => {
    window.location.reload()
  }

  handleResetSession = (): void => {
    clearAuthSession()
    window.location.reload()
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
            Halaman admin/petugas mengalami gangguan saat dimuat. Coba muat ulang halaman.
          </p>
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
