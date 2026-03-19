import { LogIn, LogOut } from 'lucide-react'
import {
  AppDatePickerField,
  AppMonthPickerField,
} from '../../../components/common/DatePickerFields'
import type { DownloadNoticeType } from '../adminHelpers'

interface StaffRowItem {
  staff: {
    id: string
    fullName: string
  }
  checkInAt: string
  checkOutAt: string
  dutyMinutes: number | null
  pay: {
    honor: number
    transport: number
    total: number
  } | null
}

interface KehadiranPetugasPageProps {
  selectedDateLabel: string
  notice: { type: DownloadNoticeType; text: string } | null
  monthValue: string
  monthMax: string
  onChangeMonth: (value: string) => void
  dateValue: string
  dateMin: string
  dateMax: string
  onChangeDate: (value: string) => void
  onOpenDownloadDialog: () => void
  isDownloadingPdf: boolean
  actionState: { staffUserId: string; action: 'check-in' | 'check-out' } | null
  belumAbsenMasukRows: StaffRowItem[]
  bertugasRows: StaffRowItem[]
  sudahAbsenMasukRows: StaffRowItem[]
  onCheckInStaff: (staffUserId: string) => Promise<void> | void
  onCheckOutStaff: (staffUserId: string) => Promise<void> | void
  isLoadingRecap: boolean
  formatTimeOnly: (value: string) => string
  formatDutyDuration: (minutes: number | null) => string
  formatRupiah: (value: number) => string
}

const KehadiranPetugasPage = ({
  selectedDateLabel,
  notice,
  monthValue,
  monthMax,
  onChangeMonth,
  dateValue,
  dateMin,
  dateMax,
  onChangeDate,
  onOpenDownloadDialog,
  isDownloadingPdf,
  actionState,
  belumAbsenMasukRows,
  bertugasRows,
  sudahAbsenMasukRows,
  onCheckInStaff,
  onCheckOutStaff,
  isLoadingRecap,
  formatTimeOnly,
  formatDutyDuration,
  formatRupiah,
}: KehadiranPetugasPageProps) => {
  return (
    <section className="page page--admin-staff-attendance">
      <div className="card">
        <div className="card__header">
          <h2>Rekap Kehadiran Petugas</h2>
          <p className="card__description">{selectedDateLabel}</p>
        </div>

        {notice ? (
          <div className={`notice notice--${notice.type}`} style={{ marginBottom: '1rem' }}>
            {notice.text}
          </div>
        ) : null}

        <div className="inline-row inline-row--wrap" style={{ marginBottom: '1rem', alignItems: 'flex-end' }}>
          <div className="field-group" style={{ maxWidth: '200px' }}>
            <label className="label">Bulan</label>
            <AppMonthPickerField
              value={monthValue}
              max={monthMax}
              onChange={onChangeMonth}
            />
          </div>
          <div className="field-group" style={{ maxWidth: '220px' }}>
            <label className="label">Tanggal (Harian)</label>
            <AppDatePickerField
              value={dateValue}
              min={dateMin}
              max={dateMax}
              onChange={onChangeDate}
            />
          </div>
          <button
            type="button"
            className="button"
            style={{ marginLeft: 'auto' }}
            onClick={onOpenDownloadDialog}
            disabled={isDownloadingPdf}
          >
            {isDownloadingPdf ? 'Mengunduh...' : 'Unduh PDF'}
          </button>
        </div>

        <div className="admin-staff-attendance-grid" style={{ marginBottom: '1rem' }}>
          <article className="admin-staff-attendance-card admin-staff-attendance-card--arrival">
            <div className="admin-staff-attendance-card__header">
              <h3>Absen Masuk</h3>
              <p>Daftar petugas aktif yang belum absen masuk.</p>
            </div>
            <div className="table-wrap admin-staff-attendance-card__table-wrap">
              <table className="table admin-staff-attendance-card__table">
                <thead>
                  <tr>
                    <th>Nama Petugas</th>
                    <th style={{ textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {belumAbsenMasukRows.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="table__empty">
                        Semua petugas aktif sudah absen masuk.
                      </td>
                    </tr>
                  ) : (
                    belumAbsenMasukRows.map((row) => {
                      const isProcessing =
                        actionState?.staffUserId === row.staff.id &&
                        actionState.action === 'check-in'

                      return (
                        <tr key={row.staff.id}>
                          <td>{row.staff.fullName}</td>
                          <td style={{ textAlign: 'center' }}>
                            <div className="admin-attendance-action-cell">
                              <button
                                type="button"
                                className="button button--attendance-checkin button--tiny"
                                onClick={() => void onCheckInStaff(row.staff.id)}
                                disabled={Boolean(actionState)}
                              >
                                <LogIn size={14} />
                                {isProcessing ? 'Memproses...' : 'Masuk'}
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
          </article>

          <article className="admin-staff-attendance-card admin-staff-attendance-card--departure">
            <div className="admin-staff-attendance-card__header">
              <h3>Bertugas / Sudah Pulang</h3>
              <p>Petugas yang sudah absen masuk. Status pulang berada di bagian bawah.</p>
            </div>
            <div className="table-wrap admin-staff-attendance-card__table-wrap">
              <table className="table admin-staff-attendance-card__table">
                <thead>
                  <tr>
                    <th>Nama Petugas</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bertugasRows.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="table__empty">
                        Belum ada petugas yang bertugas hari ini.
                      </td>
                    </tr>
                  ) : (
                    bertugasRows.map((row) => {
                      const isDone = Boolean(row.checkOutAt)
                      const isProcessing =
                        actionState?.staffUserId === row.staff.id &&
                        actionState.action === 'check-out'

                      return (
                        <tr key={row.staff.id} className={isDone ? 'is-completed' : ''}>
                          <td>{row.staff.fullName}</td>
                          <td style={{ textAlign: 'center' }}>
                            {isDone ? (
                              <span className="admin-attendance-action-status admin-attendance-action-status--done">Pulang</span>
                            ) : (
                              <div className="admin-attendance-action-cell">
                                <button
                                  type="button"
                                  className="button button--attendance-logout button--tiny"
                                  onClick={() => void onCheckOutStaff(row.staff.id)}
                                  disabled={Boolean(actionState)}
                                >
                                  <LogOut size={14} />
                                  {isProcessing ? 'Memproses...' : 'Pulang'}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </div>

        <p className="field-hint" style={{ marginBottom: '1rem' }}>
          Jam datang tercatat saat klik Masuk. Durasi, honor, dan transport muncul setelah klik Pulang.
        </p>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nama Petugas</th>
                <th>Absen Datang</th>
                <th>Absen Pulang</th>
                <th>Durasi</th>
                <th>Honor</th>
                <th>Transport</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingRecap ? (
                <tr><td colSpan={7} className="table__empty">Memuat...</td></tr>
              ) : sudahAbsenMasukRows.length === 0 ? (
                <tr><td colSpan={7} className="table__empty">Belum ada petugas yang absen masuk.</td></tr>
              ) : (
                sudahAbsenMasukRows.map((row) => (
                  <tr key={row.staff.id}>
                    <td>{row.staff.fullName}</td>
                    <td>{formatTimeOnly(row.checkInAt)}</td>
                    <td>{formatTimeOnly(row.checkOutAt)}</td>
                    <td>{row.checkOutAt ? formatDutyDuration(row.dutyMinutes) : '-'}</td>
                    <td>{row.pay ? formatRupiah(row.pay.honor) : '-'}</td>
                    <td>{row.pay ? formatRupiah(row.pay.transport) : '-'}</td>
                    <td>{row.pay ? formatRupiah(row.pay.total) : '-'}</td>
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

export default KehadiranPetugasPage
