import type { ChangeEvent } from 'react'
import SearchableSelect from '../../../components/common/SearchableSelect'
import { AppMonthPickerField } from '../../../components/common/DatePickerFields'
import { servicePackageOptions } from '../../../constants/options'
import type { ServiceBillingPaymentInput, ServicePackage } from '../../../types'
import type { ServiceBillingArrearsRow } from '../adminHelpers'

interface SelectOption {
  value: string
  label: string
  badge?: string
}

interface BillingPaidRow {
  childId: string
  childName: string
  packageLabel: string
  paidAmount: number
  attendanceCount: number
  isMigrated: boolean
}

interface BillingPageProps {
  isSettlementOpen: boolean
  onToggleSettlementOpen: (open: boolean) => void
  selectedBillingChildId: string
  onSelectBillingChild: (value: string) => void
  arrearsChildOptions: SelectOption[]
  paymentAmountText: string
  onPaymentAmountInput: (value: string) => void
  onPaymentAmountBlur: () => void
  selectedArrearsRow: ServiceBillingArrearsRow | null
  isMutating: boolean
  paymentForm: ServiceBillingPaymentInput
  onPaymentProofChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void> | void
  onClearPaymentProof: () => void
  onChangePaymentMethod: (method: string) => void
  onQuickPayment: () => Promise<void> | void
  formatCurrency: (value: number) => string
  isLoadingPaidRows: boolean
  paidMonthValue: string
  paidMonthMax: string
  onChangePaidMonth: (value: string) => void
  paidPackageValue: ServicePackage | ''
  onChangePaidPackage: (value: ServicePackage | '') => void
  paidLimitValue: number
  onChangePaidLimit: (value: number) => void
  paidRows: BillingPaidRow[]
  arrearsRows: ServiceBillingArrearsRow[]
}

const BillingPage = ({
  isSettlementOpen,
  onToggleSettlementOpen,
  selectedBillingChildId,
  onSelectBillingChild,
  arrearsChildOptions,
  paymentAmountText,
  onPaymentAmountInput,
  onPaymentAmountBlur,
  selectedArrearsRow,
  isMutating,
  paymentForm,
  onPaymentProofChange,
  onClearPaymentProof,
  onChangePaymentMethod,
  onQuickPayment,
  formatCurrency,
  isLoadingPaidRows,
  paidMonthValue,
  paidMonthMax,
  onChangePaidMonth,
  paidPackageValue,
  onChangePaidPackage,
  paidLimitValue,
  onChangePaidLimit,
  paidRows,
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
          <div className="table-wrap">
            <table className="table service-billing-arrears-table">
              <thead>
                <tr>
                  <th>Nama Anak [Lama Hari]</th>
                  <th>Paket Layanan</th>
                  <th style={{ textAlign: 'center' }}>Total Pembayaran</th>
                </tr>
              </thead>
              <tbody>
                {arrearsRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="table__empty">Tidak ada anak yang menunggak.</td>
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <details
          className="service-section-collapse"
          open={isSettlementOpen}
          onToggle={(event) =>
            onToggleSettlementOpen(
              (event.currentTarget as HTMLDetailsElement).open,
            )
          }
        >
          <summary className="service-section-collapse__summary">
            Input Pembayaran (Pelunasan)
          </summary>

          <div className="service-section-collapse__body">
            <div className="form-grid form-grid--2 service-billing-settlement-grid">
              <div className="field-group">
                <label className="label">Pilih Anak yang Belum Lunas</label>
                <SearchableSelect
                  value={selectedBillingChildId}
                  onChange={onSelectBillingChild}
                  options={arrearsChildOptions}
                  placeholder="Pilih anak yang belum lunas"
                  emptyMessage="Tidak ada anak yang belum lunas"
                  clearable={false}
                  usePortal
                />
              </div>

              <div className="field-group">
                <label className="label" htmlFor="serviceBillingAmount">
                  Nominal Pembayaran
                </label>
                <input
                  id="serviceBillingAmount"
                  className="input service-billing-amount-input"
                  type="text"
                  inputMode="numeric"
                  value={paymentAmountText}
                  onChange={(event) =>
                    onPaymentAmountInput(event.target.value)
                  }
                  onBlur={onPaymentAmountBlur}
                  disabled={!selectedArrearsRow || isMutating}
                />
              </div>
            </div>

            <div className="form-grid form-grid--3 service-billing-settlement-grid">
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
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

              <div className="field-group">
                <label className="label" htmlFor="serviceBillingNotes">
                  Metode Pembayaran
                </label>
                <select
                  id="serviceBillingNotes"
                  className="input"
                  value={paymentForm.notes ?? ''}
                  onChange={(event) => onChangePaymentMethod(event.target.value)}
                  disabled={!selectedArrearsRow || isMutating}
                >
                  <option value="">-- Pilih Metode --</option>
                  <option value="Cash">Cash</option>
                  <option value="BCA">BCA</option>
                  <option value="BRI">BRI</option>
                  <option value="MANDIRI">MANDIRI</option>
                  <option value="BNI">BNI</option>
                  <option value="QRIS">QRIS</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div className="form-actions" style={{ alignSelf: 'end' }}>
                <button
                  type="button"
                  className="button button--success"
                  onClick={() => void onQuickPayment()}
                  disabled={
                    !selectedArrearsRow ||
                    isMutating ||
                    paymentForm.amount <= 0
                  }
                >
                  {isMutating
                    ? 'Menyimpan Pembayaran...'
                    : 'Simpan Pembayaran'}
                </button>
              </div>
            </div>

            <p className="field-hint">
              {selectedArrearsRow
                ? `Sisa tagihan (belum lunas) saat ini: ${formatCurrency(selectedArrearsRow.totalOutstanding)}.`
                : 'Pilih anak belum lunas untuk mulai pembayaran.'}{' '}
              Nominal pas akan membuat tagihan otomatis lunas; jika kurang, sisa tagihan otomatis berkurang.
            </p>
            <p className="field-hint">
              Aturan paket: harian berlaku 1 hari, paket 2 mingguan berlaku 10 hari ke depan,
              dan paket bulanan berlaku 30 hari ke depan (hari berjalan tetap dihitung).
            </p>
          </div>
        </details>
      </div>

      <div className="card service-billing-arrears-card">
        <h3>Daftar Pembayaran LUNAS</h3>
        <p className="card__description">
          Menampilkan daftar anak yang pembayarannya sudah berstatus <strong>LUNAS</strong> beserta total nominal yang disetorkan pada periode aktif. Seluruh kelas digabung dan diurutkan.
        </p>

        <div className="form-grid form-grid--3" style={{ marginBottom: '1.5rem' }}>
          <div className="field-group">
            <label className="label">Bulan</label>
            <AppMonthPickerField
              value={paidMonthValue}
              max={paidMonthMax}
              onChange={onChangePaidMonth}
            />
          </div>
          <div className="field-group">
            <label className="label">Kategori Paket</label>
            <select
              className="input"
              value={paidPackageValue}
              onChange={(e) => onChangePaidPackage(e.target.value as ServicePackage | '')}
            >
              <option value="">Semua Paket</option>
              {servicePackageOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label className="label">Jumlah Data</label>
            <select
              className="input"
              value={paidLimitValue}
              onChange={(e) => onChangePaidLimit(Number(e.target.value))}
            >
              <option value={20}>20 Data</option>
              <option value={50}>50 Data</option>
              <option value={100}>100 Data</option>
              <option value={9999}>Semua Data</option>
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table service-billing-arrears-table">
            <thead>
              <tr>
                <th>Nama Anak</th>
                <th>Paket</th>
                <th style={{ textAlign: 'center' }}>Jumlah Kehadiran</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Total Dibayarkan</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingPaidRows && paidRows.length === 0 ? (
                <tr><td colSpan={5} className="table__empty">Memuat daftar lunas...</td></tr>
              ) : paidRows.length === 0 ? (
                <tr><td colSpan={5} className="table__empty">Tidak ada anak yang sudah lunas.</td></tr>
              ) : (
                paidRows.map((row) => (
                  <tr key={row.childId}>
                    <td>
                      <div className="service-billing-package-name">
                        <strong>{row.childName}</strong>
                        {row.isMigrated && <span className="service-billing-migration-badge">Migrasi</span>}
                      </div>
                    </td>
                    <td>{row.packageLabel}</td>
                    <td style={{ textAlign: 'center' }}>{row.attendanceCount}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px 12px',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        color: '#fff',
                        backgroundColor: 'var(--color-success, #38a169)',
                        borderRadius: '9999px',
                      }}>LUNAS</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>{formatCurrency(row.paidAmount)}</td>
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

export default BillingPage
