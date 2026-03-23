import SearchableSelect from '../../../components/common/SearchableSelect'
import { AppDatePickerField } from '../../../components/common/DatePickerFields'
import type { DownloadNoticeType, ObservationRecapRow } from '../adminHelpers'

interface SelectOption {
  value: string
  label: string
  badge?: string
}

interface ObservasiAnakPageProps {
  notice: { type: DownloadNoticeType; text: string } | null
  filterDate: string
  filterDateMax: string
  onChangeFilterDate: (value: string) => void
  filterGroup: string
  onChangeFilterGroup: (value: string) => void
  groupOptions: SelectOption[]
  filterChild: string
  onChangeFilterChild: (value: string) => void
  childOptions: SelectOption[]
  onDownloadAll: () => Promise<void> | void
  isDownloadingAll: boolean
  canDownloadAll: boolean
  isLoading: boolean
  rows: ObservationRecapRow[]
  downloadingChildId: string | null
  downloadableChildIds: Set<string>
  onDownloadChild: (childId: string) => Promise<void> | void
  formatDateOnly: (value: string) => string
}

const ObservasiAnakPage = ({
  notice,
  filterDate,
  filterDateMax,
  onChangeFilterDate,
  filterGroup,
  onChangeFilterGroup,
  groupOptions,
  filterChild,
  onChangeFilterChild,
  childOptions,
  onDownloadAll,
  isDownloadingAll,
  canDownloadAll,
  isLoading,
  rows,
  downloadingChildId,
  downloadableChildIds,
  onDownloadChild,
  formatDateOnly,
}: ObservasiAnakPageProps) => {
  return (
    <section className="page">
      <div className="card">
        <div className="card__header">
          <h2>Observasi Anak</h2>
          <p className="card__description">
            Untuk download observasi dalam 1 bulan maka pilih nama kelompok dan nama anak untuk memunculkan fitur unduh semua.
          </p>
        </div>

        {notice ? (
          <div className={`notice notice--${notice.type}`} style={{ marginBottom: '1rem' }}>
            {notice.text}
          </div>
        ) : null}

        <div className="form-grid form-grid--3" style={{ marginBottom: '1rem' }}>
          <div className="field-group">
            <label className="label">Filter Tanggal</label>
            <AppDatePickerField
              value={filterDate}
              max={filterDateMax}
              onChange={onChangeFilterDate}
            />
          </div>
          <div className="field-group">
            <label className="label">Filter Kelompok</label>
            <SearchableSelect
              value={filterGroup}
              onChange={onChangeFilterGroup}
              options={[
                { value: '', label: 'Semua kelompok' },
                ...groupOptions,
              ]}
              placeholder="Semua kelompok"
              emptyMessage="Data kelompok tidak tersedia"
              searchable={false}
              clearable={false}
              usePortal
            />
          </div>
          <div className="field-group">
            <label className="label">Nama Anak</label>
            <SearchableSelect
              value={filterChild}
              onChange={onChangeFilterChild}
              options={childOptions}
              placeholder="Semua anak"
              emptyMessage="Data anak tidak tersedia"
              usePortal
            />
          </div>
        </div>

        {filterGroup && filterChild ? (
          <div className="inline-row" style={{ marginBottom: '1rem' }}>
            <button
              type="button"
              className="button"
              onClick={() => void onDownloadAll()}
              disabled={isDownloadingAll || !canDownloadAll}
            >
              {isDownloadingAll ? 'Mengunduh...' : 'Unduh Semua'}
            </button>
            {!canDownloadAll ? (
              <p className="field-hint" style={{ margin: 0 }}>
                Tidak ada data anak yang dapat diunduh.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Tanggal Observasi</th>
                <th>Nama Anak</th>
                <th>Sudah Baik</th>
                <th>Perlu Latihan</th>
                <th>Perlu Arahan</th>
                <th>Kelompok</th>
                <th>Unduh</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="table__empty">Memuat...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="table__empty">Tidak ada data observasi.</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.childId}>
                    <td>{formatDateOnly(row.latestDate)}</td>
                    <td>{row.childName}</td>
                    <td>{row.categorySummary.sudahBaik}</td>
                    <td>{row.categorySummary.perluLatihan}</td>
                    <td>{row.categorySummary.perluArahan}</td>
                    <td>{row.latestGroup}</td>
                    <td>
                      <button
                        type="button"
                        className="button button--ghost button--tiny"
                        onClick={() => void onDownloadChild(row.childId)}
                        disabled={
                          downloadingChildId === row.childId ||
                          !downloadableChildIds.has(row.childId)
                        }
                      >
                        {downloadingChildId === row.childId ? '...' : 'Unduh'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export default ObservasiAnakPage
