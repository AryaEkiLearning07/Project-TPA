import { Eye, EyeOff } from 'lucide-react'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { AppDatePickerField } from '../../../components/common/DatePickerFields'
import type {
  StaffRegistrationRequest,
  StaffUser,
  StaffUserInput,
} from '../../../types'

interface ManajemenPetugasPageProps {
  editingStaffId: string | null
  staffCountLabel: string
  onSubmitStaff: (event: FormEvent<HTMLFormElement>) => void
  staffForm: StaffUserInput
  setStaffForm: Dispatch<SetStateAction<StaffUserInput>>
  showStaffPassword: boolean
  setShowStaffPassword: Dispatch<SetStateAction<boolean>>
  todayIso: string
  onResetStaffForm: () => void
  isLoadingStaff: boolean
  staffUsers: StaffUser[]
  pendingStaffRequests: StaffRegistrationRequest[]
  isLoadingPendingStaffRequests: boolean
  processingStaffRequestId: string | null
  formatDateOnly: (value: string) => string
  formatDateTime: (value: string) => string
  calculateServiceLength: (tanggalMasuk: string) => string
  onStartEditStaff: (staff: StaffUser) => void
  onDeleteStaff: (staff: StaffUser) => Promise<void> | void
  onApproveStaffRequest: (request: StaffRegistrationRequest) => Promise<void> | void
  onRejectStaffRequest: (request: StaffRegistrationRequest) => Promise<void> | void
}

const ManajemenPetugasPage = ({
  editingStaffId,
  staffCountLabel,
  onSubmitStaff,
  staffForm,
  setStaffForm,
  showStaffPassword,
  setShowStaffPassword,
  todayIso,
  onResetStaffForm,
  isLoadingStaff,
  staffUsers,
  pendingStaffRequests,
  isLoadingPendingStaffRequests,
  processingStaffRequestId,
  formatDateOnly,
  formatDateTime,
  calculateServiceLength,
  onStartEditStaff,
  onDeleteStaff,
  onApproveStaffRequest,
  onRejectStaffRequest,
}: ManajemenPetugasPageProps) => {
  return (
    <section className="page">
      <div className="card">
        <h2>{editingStaffId ? 'Edit Akun Petugas' : 'Tambah Akun Petugas'}</h2>
        <p className="card__description">{staffCountLabel} terdaftar</p>

        <form onSubmit={onSubmitStaff}>
          <div className="form-grid form-grid--3">
            <div className="field-group">
              <label className="label" htmlFor="staffFullName">
                Nama Lengkap
              </label>
              <input
                id="staffFullName"
                className="input"
                value={staffForm.fullName}
                onChange={(event) =>
                  setStaffForm((previous) => ({
                    ...previous,
                    fullName: event.target.value,
                  }))
                }
              />
            </div>

            <div className="field-group">
              <label className="label" htmlFor="staffEmail">
                Email
              </label>
              <input
                id="staffEmail"
                className="input"
                type="email"
                value={staffForm.email}
                onChange={(event) =>
                  setStaffForm((previous) => ({
                    ...previous,
                    email: event.target.value,
                  }))
                }
              />
            </div>

            <div className="field-group">
              <label className="label" htmlFor="staffPassword">
                {editingStaffId ? 'Password Baru (Opsional)' : 'Password'}
              </label>
              <div className="input-with-action">
                <input
                  id="staffPassword"
                  className="input"
                  type={showStaffPassword ? 'text' : 'password'}
                  value={staffForm.password}
                  onChange={(event) =>
                    setStaffForm((previous) => ({
                      ...previous,
                      password: event.target.value,
                    }))
                  }
                />
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShowStaffPassword((previous) => !previous)}
                  aria-label={showStaffPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showStaffPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div className="form-grid form-grid--2">
            <div className="field-group">
              <label className="label" htmlFor="staffTanggalMasuk">
                Tanggal Masuk
              </label>
              <AppDatePickerField
                id="staffTanggalMasuk"
                value={staffForm.tanggalMasuk}
                max={todayIso}
                disabled={Boolean(editingStaffId)}
                onChange={(value) =>
                  setStaffForm((previous) => ({
                    ...previous,
                    tanggalMasuk: value,
                  }))
                }
              />
              {editingStaffId ? (
                <p className="field-hint">Tanggal masuk tidak dapat diubah saat edit data petugas.</p>
              ) : null}
            </div>

            <div className="field-group field-group--small">
              <label className="label" htmlFor="staffStatus">
                Status Akun
              </label>
              <button
                id="staffStatus"
                type="button"
                role="switch"
                aria-checked={staffForm.isActive}
                className={`admin-status-toggle ${staffForm.isActive ? 'is-active' : 'is-inactive'}`}
                onClick={() =>
                  setStaffForm((previous) => ({
                    ...previous,
                    isActive: !previous.isActive,
                  }))
                }
              >
                <span className="admin-status-toggle__thumb" />
                <span className="admin-status-toggle__label">
                  {staffForm.isActive ? 'Aktif' : 'Non-aktif'}
                </span>
              </button>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="button">
              {editingStaffId ? 'Update Petugas' : 'Simpan Petugas'}
            </button>
            {editingStaffId ? (
              <button
                type="button"
                className="button button--ghost"
                onClick={onResetStaffForm}
              >
                Batal Edit
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="card">
        <h3>Permintaan Petugas</h3>
        <p className="card__description">
          {pendingStaffRequests.length} permintaan pendaftaran petugas menunggu persetujuan.
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
              {isLoadingPendingStaffRequests ? (
                <tr>
                  <td colSpan={4} className="table__empty">
                    Memuat permintaan petugas...
                  </td>
                </tr>
              ) : pendingStaffRequests.length === 0 ? (
                <tr>
                  <td colSpan={4} className="table__empty">
                    Belum ada permintaan petugas yang menunggu approve.
                  </td>
                </tr>
              ) : (
                pendingStaffRequests.map((request) => {
                  const isProcessing = processingStaffRequestId === request.id
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
                            onClick={() => void onApproveStaffRequest(request)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? 'Memproses...' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            className="button button--tiny button--danger"
                            onClick={() => void onRejectStaffRequest(request)}
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

      <div className="card">
        <h3>Daftar Petugas</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                <th>Status</th>
                <th>Tanggal Masuk</th>
                <th>Masa Kerja</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingStaff ? (
                <tr>
                  <td colSpan={6} className="table__empty">
                    Memuat data petugas...
                  </td>
                </tr>
              ) : staffUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table__empty">
                    Belum ada data petugas.
                  </td>
                </tr>
              ) : (
                staffUsers.map((staff) => (
                  <tr key={staff.id}>
                    <td>{staff.fullName}</td>
                    <td>{staff.email}</td>
                    <td>{staff.isActive ? 'Aktif' : 'Nonaktif'}</td>
                    <td>{formatDateOnly(staff.tanggalMasuk)}</td>
                    <td>{calculateServiceLength(staff.tanggalMasuk)}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="button button--tiny button--ghost"
                          onClick={() => onStartEditStaff(staff)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="button button--tiny button--danger"
                          onClick={() => void onDeleteStaff(staff)}
                        >
                          Hapus
                        </button>
                      </div>
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

export default ManajemenPetugasPage
