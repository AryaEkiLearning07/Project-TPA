import { AppMonthPickerField } from '../../../components/common/DatePickerFields'
import type { AttendanceRecord } from '../../../types'
import type { DownloadNoticeType } from '../adminHelpers'

interface KehadiranAnakPageProps {
  notice: { type: DownloadNoticeType; text: string } | null
  monthValue: string
  monthMax: string
  onChangeMonth: (value: string) => void
  onDownloadPdf: () => Promise<void> | void
  isDownloadingPdf: boolean
  isLoading: boolean
  pagedRecords: AttendanceRecord[]
  totalRecords: number
  page: number
  totalPages: number
  childNameById: Record<string, string>
  onPrevPage: () => void
  onNextPage: () => void
  formatDateWithWeekday: (value: string) => string
}

const KehadiranAnakPage = ({
  notice,
  monthValue,
  monthMax,
  onChangeMonth,
  onDownloadPdf,
  isDownloadingPdf,
  isLoading,
  pagedRecords,
  totalRecords,
  page,
  totalPages,
  childNameById,
  onPrevPage,
  onNextPage,
  formatDateWithWeekday,
}: KehadiranAnakPageProps) => {
  return (
    <section className="page page--admin-staff-attendance">
      <div className="card">
        <div className="card__header">
          <h2>Riwayat Kehadiran Anak Bulanan</h2>
        </div>
        {notice ? (
          <p className={`download-note download-note--${notice.type}`}>{notice.text}</p>
        ) : null}
        <div className="inline-row" style={{ marginBottom: '1.5rem' }}>
          <div className="field-group" style={{ maxWidth: '200px' }}>
            <label className="label">Bulan</label>
            <AppMonthPickerField
              value={monthValue}
              max={monthMax}
              onChange={onChangeMonth}
            />
          </div>
          <button
            type="button"
            className="button"
            onClick={() => void onDownloadPdf()}
            disabled={isDownloadingPdf || totalRecords === 0}
          >
            {isDownloadingPdf ? 'Membuat PDF...' : 'Download PDF'}
          </button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nama Anak</th>
                <th>Tanggal</th>
                <th>Kondisi Datang</th>
                <th>Kondisi Pulang</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="table__empty">Memuat...</td></tr>
              ) : totalRecords === 0 ? (
                <tr><td colSpan={5} className="table__empty">Tidak ada data untuk bulan ini.</td></tr>
              ) : (
                pagedRecords.map((record) => (
                  <tr key={record.id}>
                    <td>{childNameById[record.childId] || 'Data Terhapus'}</td>
                    <td>{formatDateWithWeekday(record.date)}</td>
                    <td>{`${record.arrivalPhysicalCondition} | ${record.arrivalEmotionalCondition}`}</td>
                    <td>{`${record.departurePhysicalCondition} | ${record.departureEmotionalCondition}`}</td>
                    <td>{record.departureTime ? 'Sudah Pulang' : 'Masih di TPA'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalRecords > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--color-text-muted, #718096)' }}>Halaman {page} dari {totalPages} ({totalRecords} data)</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="button button--tiny button--ghost" disabled={page <= 1} onClick={onPrevPage}>Previous</button>
              <button type="button" className="button button--tiny button--ghost" disabled={page >= totalPages} onClick={onNextPage}>Next</button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}

export default KehadiranAnakPage
