import { Eye, EyeOff } from 'lucide-react'
import type { ChangeEvent, Dispatch, FormEvent, SetStateAction } from 'react'
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
  onUploadStaffPhoto: (event: ChangeEvent<HTMLInputElement>) => Promise<void> | void
  onStartEditStaff: (staff: StaffUser) => void
  onDeleteStaff: (staff: StaffUser) => Promise<void> | void
  onToggleStaffStatus: (staff: StaffUser) => Promise<void> | void
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
  onUploadStaffPhoto,
  onStartEditStaff,
  onDeleteStaff,
  onToggleStaffStatus,
  onApproveStaffRequest,
  onRejectStaffRequest,
}: ManajemenPetugasPageProps) => {
  return (
    <section className="page">
      {editingStaffId ? (
        <div
          className="modal-overlay admin-staff-edit-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              onResetStaffForm()
            }
          }}
        >
          <div
            className="modal-content modal-content--large admin-staff-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staffEditTitle"
          >
            <div className="modal-header">
              <div className="admin-staff-edit-modal__heading">
                <h2 id="staffEditTitle">Edit Akun Petugas</h2>
                <p className="admin-staff-edit-modal__description">
                  Upload foto petugas, isi nama, jabatan, dan keterangan, lalu simpan perubahan.
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={onResetStaffForm}
                aria-label="Tutup popup edit akun petugas"
              >
                x
              </button>
            </div>

            <form onSubmit={onSubmitStaff} className="modal-body admin-staff-edit-modal__body">
              <div className="field-group">
                <label className="label" htmlFor="staffPhotoUpload">
                  Foto Petugas
                </label>
                <div className="staff-photo-upload">
                  <input
                    id="staffPhotoUpload"
                    className="staff-photo-upload-input"
                    type="file"
                    accept="image/*"
                    onChange={(event) => void onUploadStaffPhoto(event)}
                  />
                  <label
                    htmlFor="staffPhotoUpload"
                    className={`staff-photo-upload-frame${staffForm.photoDataUrl ? ' is-filled' : ''}`}
                    aria-label={
                      staffForm.photoDataUrl
                        ? 'Klik untuk ganti foto petugas'
                        : 'Klik untuk upload foto petugas'
                    }
                  >
                    {staffForm.photoDataUrl ? (
                      <img
                        src={staffForm.photoDataUrl}
                        alt={staffForm.photoName || staffForm.fullName || 'Preview foto petugas'}
                        className="staff-photo-upload-preview"
                      />
                    ) : (
                      <span className="staff-photo-upload-placeholder">
                        Klik frame untuk upload foto
                      </span>
                    )}
                  </label>
                </div>
                <p className="staff-photo-upload-hint">Ukuran frame rasio 3:4 (vertikal).</p>
                {staffForm.photoDataUrl ? (
                  <div className="table-actions">
                    <button
                      type="button"
                      className="button button--tiny button--ghost"
                      onClick={() =>
                        setStaffForm((previous) => ({
                          ...previous,
                          photoDataUrl: '',
                          photoName: '',
                        }))
                      }
                    >
                      Hapus Foto
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="form-grid form-grid--2">
                <div className="field-group">
                  <label className="label" htmlFor="staffFullName">
                    Nama Petugas
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
                    placeholder="Contoh: Kak Aisyah Putri"
                  />
                </div>
                <div className="field-group">
                  <label className="label">Email</label>
                  <p>{staffForm.email || '-'}</p>
                </div>
              </div>

              <div className="field-group">
                <label className="label" htmlFor="staffPositionTitle">
                  Jabatan
                </label>
                <input
                  id="staffPositionTitle"
                  className="input"
                  value={staffForm.positionTitle}
                  onChange={(event) =>
                    setStaffForm((previous) => ({
                      ...previous,
                      positionTitle: event.target.value,
                    }))
                  }
                  placeholder="Contoh: Koordinator Pengasuhan"
                />
              </div>

              <div className="field-group">
                <label className="label" htmlFor="staffDescription">
                  Keterangan Petugas
                </label>
                <textarea
                  id="staffDescription"
                  className="textarea"
                  rows={4}
                  value={staffForm.description}
                  onChange={(event) =>
                    setStaffForm((previous) => ({
                      ...previous,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Contoh: Berpengalaman mendampingi anak usia dini, komunikatif, dan aktif dalam kegiatan harian."
                />
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
                    onChange={(value) =>
                      setStaffForm((previous) => ({
                        ...previous,
                        tanggalMasuk: value,
                      }))
                    }
                  />
                </div>

                <div className="field-group">
                  <label className="label" htmlFor="staffPassword">
                    Password Baru (Opsional)
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

              <div className="form-actions">
                <button type="submit" className="button">
                  Update Petugas
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={onResetStaffForm}
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

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
        <p className="card__description">{staffCountLabel} terdaftar</p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Foto</th>
                <th>Nama</th>
                <th>Keterangan</th>
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
                  <td colSpan={8} className="table__empty">
                    Memuat data petugas...
                  </td>
                </tr>
              ) : staffUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table__empty">
                    Belum ada data petugas.
                  </td>
                </tr>
              ) : (
                staffUsers.map((staff) => (
                  <tr key={staff.id}>
                    <td>
                      {staff.photoDataUrl ? (
                        <img
                          src={staff.photoDataUrl}
                          alt={staff.photoName || staff.fullName}
                          className="staff-list-photo"
                        />
                      ) : (
                        <span className="field-hint">-</span>
                      )}
                    </td>
                    <td>
                      <strong>{staff.fullName}</strong>
                      <div className="field-hint">{staff.positionTitle || '-'}</div>
                    </td>
                    <td>{staff.description || '-'}</td>
                    <td>{staff.email}</td>
                    <td>
                      <span className={`staff-status-pill ${staff.isActive ? 'staff-status-pill--active' : 'staff-status-pill--inactive'}`}>
                        {staff.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
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
                          className={`button button--tiny ${staff.isActive ? 'button--danger' : 'button--success'}`}
                          onClick={() => void onToggleStaffStatus(staff)}
                        >
                          {staff.isActive ? 'Nonaktifkan' : 'Aktifkan'}
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
