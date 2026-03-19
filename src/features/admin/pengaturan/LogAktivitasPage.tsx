import { AppDatePickerField } from '../../../components/common/DatePickerFields'
import type { ActivityLogEntry } from '../../../types'

interface LogDateTimeParts {
  date: string
  time: string
}

interface LogAktivitasPageProps {
  searchLogs: string
  onChangeSearchLogs: (value: string) => void
  activityLogDateFilter: string
  todayIso: string
  onChangeActivityLogDateFilter: (value: string) => void
  activityLogLimit: number
  limitOptions: number[]
  onChangeActivityLogLimit: (value: string) => void
  onApplyFilter: () => Promise<void> | void
  isLoadingLogs: boolean
  logs: ActivityLogEntry[]
  formatLogDateTimeParts: (value: string) => LogDateTimeParts
  formatActivityActionSummary: (entry: ActivityLogEntry) => string
  activityLogPage: number
  activityLogHasMore: boolean
  activityLogNextCursor: string | null
  onLoadNext: () => void
}

const LogAktivitasPage = ({
  searchLogs,
  onChangeSearchLogs,
  activityLogDateFilter,
  todayIso,
  onChangeActivityLogDateFilter,
  activityLogLimit,
  limitOptions,
  onChangeActivityLogLimit,
  onApplyFilter,
  isLoadingLogs,
  logs,
  formatLogDateTimeParts,
  formatActivityActionSummary,
  activityLogPage,
  activityLogHasMore,
  activityLogNextCursor,
  onLoadNext,
}: LogAktivitasPageProps) => {
  return (
    <section className="page">
      <div className="card">
        <h2>Log Aktivitas Sistem</h2>
        <div className="form-grid form-grid--3">
          <div className="field-group">
            <label className="label" htmlFor="logSearch">
              Cari Gmail
            </label>
            <input
              id="logSearch"
              className="input"
              placeholder="contoh: admin@tpa.com"
              value={searchLogs}
              onChange={(event) => onChangeSearchLogs(event.target.value)}
            />
          </div>
          <div className="field-group field-group--small">
            <label className="label" htmlFor="logSearchDate">
              Tanggal
            </label>
            <AppDatePickerField
              id="logSearchDate"
              value={activityLogDateFilter}
              max={todayIso}
              onChange={onChangeActivityLogDateFilter}
            />
          </div>
          <div className="field-group field-group--small">
            <label className="label" htmlFor="logLimit">
              Jumlah Data
            </label>
            <select
              id="logLimit"
              className="input"
              value={activityLogLimit}
              onChange={(event) => onChangeActivityLogLimit(event.target.value)}
            >
              {limitOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="form-actions admin-log-filter-actions">
            <button
              type="button"
              className="button"
              onClick={() => void onApplyFilter()}
              disabled={isLoadingLogs}
            >
              Terapkan Filter
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Gmail</th>
                <th>Role</th>
                <th>Aksi</th>
                <th>Keterangan</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingLogs ? (
                <tr>
                  <td colSpan={6} className="table__empty">
                    Memuat log aktivitas...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table__empty">
                    Tidak ada log sesuai filter.
                  </td>
                </tr>
              ) : (
                logs.map((entry) => {
                  const formatted = formatLogDateTimeParts(entry.eventAt)
                  return (
                    <tr key={entry.id}>
                      <td className="admin-log-time-cell">
                        <span className="admin-log-time-cell__date">{formatted.date}</span>
                        <span className="admin-log-time-cell__time">{formatted.time} WIB</span>
                      </td>
                      <td>{entry.gmail || '-'}</td>
                      <td>{entry.role || '-'}</td>
                      <td>{formatActivityActionSummary(entry)}</td>
                      <td>{entry.detail || '-'}</td>
                      <td>{entry.status || '-'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="admin-log-pagination">
          <p className="field-hint admin-log-pagination__meta">
            Halaman {activityLogPage} | Menampilkan {logs.length} data | Limit{' '}
            {activityLogLimit}
          </p>
          <button
            type="button"
            className="button button--ghost"
            onClick={onLoadNext}
            disabled={isLoadingLogs || !activityLogHasMore || !activityLogNextCursor}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  )
}

export default LogAktivitasPage
