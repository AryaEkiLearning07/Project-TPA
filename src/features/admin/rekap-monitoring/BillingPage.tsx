import type { ChangeEvent } from 'react'
import type { ServiceBillingPaymentInput } from '../../../types'
import type { ServiceBillingArrearsRow } from '../adminHelpers'

interface BillingPaidRow {
  childId: string
  childName: string
  packageLabel: string
  paidAmount: number
  attendanceCount: number
  paymentProofDataUrl: string
  paymentProofName: string
}

interface BillingPageProps {
  isSettlementOpen: boolean
  onToggleSettlementOpen: (open: boolean) => void
  onSelectBillingChild: (value: string) => void
  selectedArrearsRow: ServiceBillingArrearsRow | null
  isMutating: boolean
  paymentForm: ServiceBillingPaymentInput
  onPaymentProofChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void> | void
  onClearPaymentProof: () => void
  onQuickPayment: () => Promise<void> | void
  formatCurrency: (value: number) => string
  isLoadingPaidRows: boolean
  paidRows: BillingPaidRow[]
  paidPage: number
  paidTotalPages: number
  onPrevPaidPage: () => void
  onNextPaidPage: () => void
  arrearsRows: ServiceBillingArrearsRow[]
}

const BillingPage = ({
  isSettlementOpen,
  onToggleSettlementOpen,
  onSelectBillingChild,
  selectedArrearsRow,
  isMutating,
  paymentForm,
  onPaymentProofChange,
  onClearPaymentProof,
  onQuickPayment,
  formatCurrency,
  isLoadingPaidRows,
  paidRows,
  paidPage,
  paidTotalPages,
  onPrevPaidPage,
  onNextPaidPage,
  arrearsRows,
}: BillingPageProps) => {
  return (
    <section className="page">
      <div className="card">
        <div className="card__header-with-actions" style={{ marginBottom: '1.5rem' }}>
          <div>
            <h2>Penagihan & Pelunasan Layanan</h2>
            <p className="card__description">Kelola tunggakan dan proses pembayaran anak</p>
          </div>
        </div>

        <div className="card service-billing-overdue-list-card">
          <h3>List Anak Menunggak</h3>
          <p className="card__description">
            Nama anak [lama hari], paket layanan, dan total pembayaran yang masih harus dilunasi.
          </p>
          <p className="field-hint" style={{ marginTop: '-0.35rem', marginBottom: '0.75rem' }}>
            Jumlah : <strong>{arrearsRows.length}</strong> Anak
          </p>
          <div className="table-wrap">
            <table className="table service-billing-arrears-table">
              <thead>
                <tr>
                  <th>Nama Anak [Lama Hari]</th>
                  <th>Paket Layanan</th>
                  <th style={{ textAlign: 'center' }}>Total Pembayaran</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {arrearsRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="table__empty">Tidak ada anak yang menunggak.</td>
                  </tr>
                ) : (
                  arrearsRows.map((row) => (
                    <tr key={row.childId}>
                      <td>
                        <strong>{row.childName}</strong>{' '}
                        <span className="field-hint">[{row.unpaidAttendanceDays} hari]</span>
                      </td>
                      <td>{row.packageLabel}</td>
                      <td style={{ textAlign: 'center' }}>{formatCurrency(row.totalOutstanding)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="button button--tiny button--success"
                          onClick={() => {
                            onSelectBillingChild(row.childId)
                            onToggleSettlementOpen(true)
                          }}
                        >
                          Bayar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isSettlementOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Input Pembayaran"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            background: 'rgba(17, 24, 39, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => {
            if (!isMutating) {
              onToggleSettlementOpen(false)
            }
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '640px',
              maxHeight: '90vh',
              overflow: 'auto',
              padding: '1rem',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Input Pembayaran</h3>

            <div
              style={{
                border: '1px solid #f0b0be',
                borderRadius: '12px',
                padding: '0.9rem',
                background: '#fff7fa',
                marginBottom: '1rem',
                display: 'grid',
                gap: '0.45rem',
              }}
            >
              <p style={{ margin: 0 }}>
                <strong>Nama Anak:</strong>{' '}
                {selectedArrearsRow?.childName || '-'}
              </p>
              <p style={{ margin: 0 }}>
                <strong>Jumlah Tunggakan:</strong>{' '}
                {selectedArrearsRow ? formatCurrency(selectedArrearsRow.totalOutstanding) : '-'}
              </p>
            </div>

            <div
              className="form-grid service-billing-settlement-grid"
              style={{ gridTemplateColumns: '1fr' }}
            >
              <div className="field-group">
                <label className="label">Bukti Transfer</label>
                <input
                  id="serviceBillingPaymentProof"
                  type="file"
                  accept="image/*"
                  onChange={(event) => void onPaymentProofChange(event)}
                  disabled={!selectedArrearsRow || isMutating}
                  style={{ display: 'none' }}
                />
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (!selectedArrearsRow || isMutating) return
                    document.getElementById('serviceBillingPaymentProof')?.click()
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      if (!selectedArrearsRow || isMutating) return
                      document.getElementById('serviceBillingPaymentProof')?.click()
                    }
                  }}
                  style={{
                    width: '100px',
                    height: '100px',
                    border: '2px dashed var(--color-border, #cbd5e0)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: (!selectedArrearsRow || isMutating) ? 'not-allowed' : 'pointer',
                    overflow: 'hidden',
                    backgroundColor: 'var(--color-bg-subtle, #f7fafc)',
                    opacity: (!selectedArrearsRow || isMutating) ? 0.5 : 1,
                  }}
                >
                  {paymentForm.paymentProofDataUrl ? (
                    <img
                      src={paymentForm.paymentProofDataUrl}
                      alt="Bukti transfer"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted, #a0aec0)' }}>Pilih Foto</span>
                  )}
                </div>
                {paymentForm.paymentProofDataUrl ? (
                  <button
                    type="button"
                    className="button button--tiny button--ghost"
                    onClick={onClearPaymentProof}
                    disabled={isMutating}
                    style={{ marginTop: '4px' }}
                  >
                    Hapus Bukti
                  </button>
                ) : null}
              </div>

              <div
                className="form-actions"
                style={{
                  alignSelf: 'stretch',
                  marginTop: '0.75rem',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.5rem',
                  alignItems: 'stretch',
                }}
              >
                <button
                  type="button"
                  className="button"
                  onClick={() => onToggleSettlementOpen(false)}
                  disabled={isMutating}
                  style={{
                    width: '100%',
                    minHeight: '46px',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: '1rem',
                    backgroundColor: '#e03131',
                    borderColor: '#e03131',
                    color: '#ffffff',
                  }}
                >
                  Tutup
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => void onQuickPayment()}
                  disabled={!selectedArrearsRow || isMutating || !paymentForm.paymentProofDataUrl}
                  style={{
                    width: '100%',
                    minHeight: '46px',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: '1rem',
                    backgroundColor: '#2f9e44',
                    borderColor: '#2f9e44',
                    color: '#ffffff',
                  }}
                >
                  {isMutating ? 'Menyimpan...' : 'Simpan Pembayaran'}
                </button>
              </div>
            </div>

            <p className="field-hint">
              {selectedArrearsRow
                ? `Tagihan anak ini akan dibayar penuh otomatis sebesar ${formatCurrency(selectedArrearsRow.totalOutstanding)} dan status berubah ke LUNAS.`
                : 'Pilih anak belum lunas untuk mulai pembayaran.'}
            </p>
          </div>
        </div>
      ) : null}

      <div className="card service-billing-arrears-card">
        <h3>Daftar Pelunasan</h3>
        <p className="card__description">
          Format: nama anak [paket], bukti pembayaran, jumlah kehadiran, total dibayarkan.
        </p>

        <div className="table-wrap">
          <table className="table service-billing-arrears-table">
            <thead>
              <tr>
                <th>Nama Anak [Paket]</th>
                <th style={{ textAlign: 'center' }}>Bukti Pembayaran</th>
                <th style={{ textAlign: 'center' }}>Jumlah Kehadiran</th>
                <th style={{ textAlign: 'center' }}>Total Dibayarkan</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingPaidRows && paidRows.length === 0 ? (
                <tr><td colSpan={4} className="table__empty">Memuat daftar lunas...</td></tr>
              ) : paidRows.length === 0 ? (
                <tr><td colSpan={4} className="table__empty">Tidak ada data pelunasan.</td></tr>
              ) : (
                paidRows.map((row) => (
                  <tr key={row.childId}>
                    <td>
                      <strong>{row.childName}</strong>{' '}
                      <span className="field-hint">[{row.packageLabel}]</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {row.paymentProofDataUrl ? (
                        <a
                          href={row.paymentProofDataUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="button button--tiny button--ghost"
                        >
                          Lihat Bukti
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>{row.attendanceCount}</td>
                    <td style={{ textAlign: 'center' }}>{formatCurrency(row.paidAmount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="inline-row" style={{ justifyContent: 'space-between', marginTop: '0.9rem' }}>
          <p className="field-hint" style={{ margin: 0 }}>
            Halaman {paidPage} dari {paidTotalPages} (20 data per halaman)
          </p>
          <div className="inline-row" style={{ gap: '0.5rem' }}>
            <button
              type="button"
              className="button button--tiny button--ghost"
              onClick={onPrevPaidPage}
              disabled={paidPage <= 1}
            >
              Sebelumnya
            </button>
            <button
              type="button"
              className="button button--tiny button--ghost"
              onClick={onNextPaidPage}
              disabled={paidPage >= paidTotalPages}
            >
              Berikutnya
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default BillingPage
