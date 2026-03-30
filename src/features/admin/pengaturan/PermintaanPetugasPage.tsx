import type { StaffRegistrationRequest } from '../../../types'

interface PermintaanPetugasPageProps {
  requests: StaffRegistrationRequest[]
  isLoading: boolean
  processingRequestId: string | null
  onApprove: (request: StaffRegistrationRequest) => Promise<void> | void
  onReject: (request: StaffRegistrationRequest) => Promise<void> | void
  formatDateTime: (value: string) => string
}

const PermintaanPetugasPage = ({
  requests,
  isLoading,
  processingRequestId,
  onApprove,
  onReject,
  formatDateTime,
}: PermintaanPetugasPageProps) => {
  return (
    <section className="page">
      <div className="card">
        <h2>Permintaan Petugas</h2>
        <p className="card__description">
          {requests.length} permintaan pendaftaran petugas menunggu persetujuan.
        </p>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nama Lengkap</th>
                <th>Email</th>
                <th>Tanggal Daftar</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="table__empty">
                    Memuat permintaan petugas...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={4} className="table__empty">
                    Belum ada permintaan petugas yang menunggu approve.
                  </td>
                </tr>
              ) : (
                requests.map((request) => {
                  const isProcessing = processingRequestId === request.id
                  return (
                    <tr key={request.id}>
                      <td>{request.fullName}</td>
                      <td>{request.email}</td>
                      <td>{formatDateTime(request.registeredAt)}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="button button--tiny"
                            onClick={() => void onApprove(request)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? 'Memproses...' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            className="button button--tiny button--danger"
                            onClick={() => void onReject(request)}
                            disabled={isProcessing}
                          >
                            Tolak
                          </button>
                        </div>
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

export default PermintaanPetugasPage
