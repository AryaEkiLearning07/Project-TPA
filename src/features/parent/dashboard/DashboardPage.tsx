import { useState, useEffect } from 'react'
import type {
  ParentDashboardData,
  ChildProfile,
  ParentAuthUser,
} from '../../../types'
import { parentApi } from '../../../services/api'

const DashboardPage = () => {
  const [dashboardData, setDashboardData] = useState<ParentDashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Load dashboard data on mount
  useEffect(() => {
    const loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setIsLoading(true)
    try {
      const data = await parentApi.getDashboardData()
      setDashboardData(data)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
      // TODO: Show error message to user
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(async () => {
      try {
        const data = await parentApi.getDashboardData()
        setDashboardData(data)
      } catch (error) {
        console.error('Failed to refresh dashboard data:', error)
      }
      setIsRefreshing(false)
    }, 1000)
  }

  const child = dashboardData?.children?.[0]

  // Format time
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    return `${hours}:${minutes}`
  }

  return (
    <div className="parent-dashboard is-active">
      {/* Loading State */}
      {isLoading && (
        <div className="parent-loading">
          <RefreshCw className="parent-loading__spinner" />
          <p>Memuat data dashboard...</p>
        </div>
      )}

      {/* Header Card */}
      <div className="dashboard-header">
        <div className="dashboard-header__child-profile">
          <div className="dashboard-header__avatar">
            {child?.photoDataUrl ? (
              <img src={child.photoDataUrl} alt={child.fullName} className="dashboard-header__avatar-img" />
            ) : (
              <div className="dashboard-header__avatar-placeholder">
                {child?.fullName?.substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="dashboard-header__child-info">
            <h2 className="dashboard-header__child-name">
              {child?.fullName}
            </h2>
            <p className="dashboard-header__greeting">Halo Mama,</p>
            <span className="dashboard-header__child-status">
              {child?.nickName ? 'Sedang' : 'Bermain'}
            </span>
          </p>
        </div>
      </div>

      {/* Status Cards */}
      <div className="dashboard-status-card">
        <div className="dashboard-status-card__item">
          <div className="dashboard-status-card__icon-wrap">
            <LayoutDashboard size={18} />
          </div>
          <div className="dashboard-status-card__content">
            <h3>Status Hari Ini</h3>
            <div className="dashboard-status-card__time">08:00</div>
            <p className="dashboard-status-card__desc">
              {child?.currentStatus || 'Sedang Istirahat Siang'}
            </p>
          </div>
        </div>
        <div className="dashboard-status-card__item">
          <div className="dashboard-status-card__icon-wrap">
            <User size={18} />
          </div>
          <div className="dashboard-status-card__content">
            <h3>Petugas Jaga</h3>
            <div className="dashboard-status-card__desc">
              {child?.currentPetugas || 'Ibu Siti'}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="dashboard-activities">
        <h2 className="dashboard-activities__title">Aktivitas Terkini</h2>

        {(!isLoading && dashboardData && (
          <div className="dashboard-activities__list">
            {dashboardData?.attendanceRecords?.slice(0, 3).map((record) => (
              <div className="activity-card" key={`activity-${record.id}`}>
                <div className="activity-card__icon-wrap">
                  <Home size={18} />
                </div>
                <div className="activity-card__content">
                  <div className="activity-card__time">{formatTime(record.arrivalTime)}</div>
                  <h4 className="activity-card__title">Check-in</h4>
                  <p className="activity-card__desc">Budi tiba di TPA</p>
                </div>
              </div>
            </div>
            ))}

            {dashboardData?.mealRecords?.slice(0, 2).map((record) => (
              <div className="activity-card" key={`activity-${record.id}`}>
                <div className="activity-card__icon-wrap">
                  <Activity size={18} />
                </div>
                <div className="activity-card__content">
                  <div className="activity-card__time">{formatTime(record.recordedAt)}</div>
                  <h4 className="activity-card__title">Sarapan</h4>
                  <p className="activity-card__desc">{record.menuType} - {record.foodType}</p>
                  <div className="activity-card__badge">
                    {record.portionStatus === 'HABIS' ? (
                      <span className="activity-card__badge activity-card__badge--habis">Habis</span>
                    ) : record.portionStatus === 'CUKUP' ? (
                      <span className="activity-card__badge activity-card__badge--cukup">Cukup</span>
                    ) : (
                      <span className="activity-card__badge activity-card__badge--kurang">Kurang</span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {dashboardData?.sleepRecords?.slice(0, 1).map((record) => (
              <div className="activity-card" key={`activity-${record.id}`}>
                <div className="activity-card__icon-wrap">
                  <LayoutDashboard size={18} />
                </div>
                <div className="activity-card__content">
                  <div className="activity-card__time">
                    {formatTime(record.sleepTime)}
                    {' - '}
                    {formatTime(record.wakeUpTime)}
                  </div>
                  <h4 className="activity-card__title">Tidur Siang</h4>
                  <p className="activity-card__desc">
                    {record.sleepReason || 'Waktu istirahat siang'}
                  </p>
                </div>
              </div>
            ))}

            {/* Refresh Button */}
            <div className="dashboard-refresh">
              <button
                onClick={handleRefresh}
                className={`dashboard-refresh ${isRefreshing ? 'is-refreshing' : ''}`}
                disabled={isLoading}
              >
                <RefreshCw className="dashboard-refresh__icon" />
                <span>Perbarui Data</span>
              </button>
            </div>
          </>
        )}

        <div className="dashboard-empty">
          <p>Belum ada data dashboard. Silakan coba lagi.</p>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage