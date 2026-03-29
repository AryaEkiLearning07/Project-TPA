import { Download } from 'lucide-react'
import SearchableSelect from '../../../components/common/SearchableSelect'
import { AppDatePickerField } from '../../../components/common/DatePickerFields'
import type { DownloadNoticeType } from '../adminHelpers'
import type { IncidentReport } from '../../../types'

interface SelectOption {
  value: string
  label: string
  badge?: string
}

interface BeritaAcaraPageProps {
  notice: { type: DownloadNoticeType; text: string } | null
  recapTotals: { totalChildren: number; totalReports: number }
  filterDate: string
  dateMax: string
  onChangeFilterDate: (value: string) => void
  filterChild: string
  onChangeFilterChild: (value: string) => void
  childOptions: SelectOption[]
  onOpenDownloadDialog: () => void
  isDownloadingPdf: boolean
  isLoading: boolean
  filteredList: IncidentReport[]
  rows: IncidentReport[]
  companionByChildDate: Map<string, { escortName: string; pickupName: string; sortKey: string }>
  childNameById: Record<string, string>
  formatDateOnly: (value: string) => string
}

const BeritaAcaraPage = ({
  notice,
  recapTotals,
  filterDate,
  dateMax,
  onChangeFilterDate,
  filterChild,
  onChangeFilterChild,
  childOptions,
  onOpenDownloadDialog,
  isDownloadingPdf,
  isLoading,
  filteredList,
  rows,
  companionByChildDate,
  childNameById,
  formatDateOnly,
}: BeritaAcaraPageProps) => {
  return (
    <section className="page">
      <div className="card">
        <div className="card__header">
          <h2>Berita Acara</h2>
          <p className="card__description">
            Total <strong>{recapTotals.totalReports}</strong> berita acara dari <strong>{recapTotals.totalChildren}</strong> anak.
          </p>
        </div>

        {notice ? (
          <div className={`notice notice--${notice.type}`} style={{ marginBottom: '1rem' }}>
            {notice.text}
          </div>
        ) : null}

        <div className="inline-row inline-row--wrap" style={{ marginBottom: '1.5rem', alignItems: 'flex-end' }}>
          <div className="field-group" style={{ maxWidth: '240px' }}>
            <label className="label">Filter Tanggal</label>
            <AppDatePickerField
              value={filterDate}
              max={dateMax}
              onChange={onChangeFilterDate}
            />
          </div>
          <div className="field-group" style={{ flex: '1 1 360px', minWidth: '280px' }}>
            <label className="label">Filter Anak</label>
            <SearchableSelect
              value={filterChild}
              onChange={onChangeFilterChild}
              options={childOptions}
              placeholder="Semua anak"
              emptyMessage="Data anak tidak tersedia"
              usePortal
            />
          </div>
          <button
            type="button"
            className="button button--download-pdf"
            style={{ marginLeft: 'auto' }}
            onClick={onOpenDownloadDialog}
            disabled={isDownloadingPdf}
          >
            {isDownloadingPdf ? 'Mengunduh...' : (
              <>
                <Download size={14} />
                <span>Unduh PDF</span>
              </>
            )}
          </button>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nama Anak</th>
                <th>Tanggal Berita Acara</th>
                <th>Pesan dari Orang Tua</th>
                <th>Untuk Orang Tua</th>
                <th>Pendamping Pagi</th>
                <th>Pendamping Siang</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="table__empty">Memuat...</td></tr>
              ) : filteredList.length === 0 ? (
                <tr><td colSpan={6} className="table__empty">Tidak ada berita acara.</td></tr>
              ) : (
                rows.map((report) => {
                  const companion = companionByChildDate.get(`${report.childId}-${report.date}`)
                  return (
                    <tr key={report.id}>
                      <td>{childNameById[report.childId] || 'Data Terhapus'}</td>
                      <td>{formatDateOnly(report.date)}</td>
                      <td>{report.parentMessage || '-'}</td>
                      <td>{report.messageForParent || '-'}</td>
                      <td>{companion?.escortName || '-'}</td>
                      <td>{companion?.pickupName || '-'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {filteredList.length > 20 ? (
          <p className="field-hint" style={{ marginTop: '0.5rem' }}>
            Menampilkan 20 dari {filteredList.length} data. Gunakan filter untuk mempersempit.
          </p>
        ) : null}
      </div>
    </section>
  )
}

export default BeritaAcaraPage
