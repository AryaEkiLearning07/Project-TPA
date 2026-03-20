interface ParentAccountMonitoringRow {
  id: string
  parentName: string
  childName: string
  registeredAt: string
  packageLabel: string
}

interface ManajemenAkunOrangTuaPageProps {
  rows: ParentAccountMonitoringRow[]
  totalAccounts: number
  isLoading: boolean
  formatDateOnly: (value: string) => string
}

const ManajemenAkunOrangTuaPage = ({
  rows,
  totalAccounts,
  isLoading,
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
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="table__empty">
                    Memuat data akun orang tua...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="table__empty">
                    Belum ada akun orang tua terdaftar.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.parentName}</td>
                    <td>{row.childName}</td>
                    <td>{formatDateOnly(row.registeredAt)}</td>
                    <td>{row.packageLabel}</td>
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

export default ManajemenAkunOrangTuaPage
