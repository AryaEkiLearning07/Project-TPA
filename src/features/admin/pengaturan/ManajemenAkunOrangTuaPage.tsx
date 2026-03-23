interface ParentAccountMonitoringRow {
  id: string
  accountId: string
  parentName: string
  childName: string
  registeredAt: string
  packageLabel: string
  isActive: boolean
}

interface ManajemenAkunOrangTuaPageProps {
  rows: ParentAccountMonitoringRow[]
  totalAccounts: number
  isLoading: boolean
  togglingAccountIds: ReadonlySet<string>
  onToggleAccountStatus: (accountId: string, nextStatus: boolean) => void
  formatDateOnly: (value: string) => string
}

const ManajemenAkunOrangTuaPage = ({
  rows,
  totalAccounts,
  isLoading,
  togglingAccountIds,
  onToggleAccountStatus,
  formatDateOnly,
}: ManajemenAkunOrangTuaPageProps) => {
  return (
    <section className="page">
      <div className="card">
        <h2>Manajemen Akun Orang Tua</h2>
        <p className="card__description">
          Monitoring akun orang tua yang sudah terdaftar. Total akun: {totalAccounts}
        </p>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nama Orang Tua</th>
                <th>Nama Anak</th>
                <th>Tanggal Registrasi</th>
                <th>Paket</th>
                <th>Status Akun</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="table__empty">
                    Memuat data akun orang tua...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table__empty">
                    Belum ada akun orang tua terdaftar.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const isMutating = togglingAccountIds.has(row.accountId)
                  return (
                    <tr key={row.id}>
                      <td>{row.parentName}</td>
                      <td>{row.childName}</td>
                      <td>{formatDateOnly(row.registeredAt)}</td>
                      <td>{row.packageLabel}</td>
                      <td>{row.isActive ? 'Aktif' : 'Nonaktif'}</td>
                      <td>
                        <button
                          type="button"
                          className={`button button--tiny ${row.isActive ? 'button--danger' : 'button--success'}`}
                          onClick={() => onToggleAccountStatus(row.accountId, !row.isActive)}
                          disabled={isMutating}
                        >
                          {isMutating
                            ? 'Memproses...'
                            : row.isActive
                              ? 'Nonaktifkan'
                              : 'Aktifkan'}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export default ManajemenAkunOrangTuaPage