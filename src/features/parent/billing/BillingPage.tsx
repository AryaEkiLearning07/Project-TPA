import { useState } from 'react'
import type { ServiceBillingSummary, BillingSummaryRow, GalleryItem } from '../../types'
import { parentApi } from '../../../services/api'

const BillingPage = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [billingData, setBillingData] = useState<BillingSummary | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  // Load billing data on mount
  useEffect(() => {
    loadBillingData()
  }, [])

  const loadBillingData = async () => {
    setIsLoading(true)
    try {
      const data = await parentApi.getBilling()
      setBillingData(data)
    } catch (error) {
      console.error('Failed to load billing data:', error)
      // TODO: Show error message to user
    } finally {
      setIsLoading(false)
    }
  }

  const handleShowPayment = () => {
    setShowPaymentModal(true)
  }

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false)
  }

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    useGrouping: true,
    }).format(amount)
  }

  const formatDate = (date: string): string => {
    const dateObj = new Date(date)
    return new Intl.DateTimeFormat('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      timeZone: 'Asia/Jakarta',
    }).format(dateObj)
  }

  return (
    <div className="billing-page">
      {/* Loading State */}
      {isLoading && !billingData ? (
        <div className="billing-loading">
          <RefreshCw className="billing-loading__spinner" />
          <p>Memuat data billing...</p>
        </div>
      ) : billingData && (
        <div className="billing-content">
          {/* Current Month Card */}
          <div className="billing-current-month">
            <h3 className="billing-month__title">April 2026</h3>
            <span className={`billing-month__status ${billingData?.currentMonth ? 'billing-month__status--lunas' : 'billing-month__status--lunas'}`}>
              {billingData?.currentMonth?.status === 'lunas' ? 'Belum Lunas' : 'Lunas'}
            </span>
            </div>
            <div className="billing-month__amount">
              <span className="billing-month__label">Tagihan</span>
              <span className="billing-month__amount">{formatCurrency(billingData.currentMonth?.dueAmount || 0)}</span>
            </div>
          </div>

          {/* History Section */}
          <div className="billing-history">
            <h3 className="billing-history__title">Riwayat Pembayaran</h3>
            <div className="billing-history-list">
              {billingData?.history?.map((invoice) => (
                <div key={invoice.id} className="billing-history-item">
                  <div className="billing-history__date">
                    <span className="billing-history__date">{formatDate(invoice.billingPeriod.startDate)}</span>
                  </div>
                  <div className="billing-history__amount">
                    <span className="billing-history__amount">{formatCurrency(invoice.dueAmount)}</span>
                    <span className={`billing-history__status ${invoice.paid ? 'billing-history__status--lunas' : 'billing-history__status--lunas'}`}>
                      {invoice.paid ? 'Lunas' : 'Belum Lunas'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bank Info */}
          <div className="billing-bank-info">
            <h3 className="billing-bank-info__title">Informasi Rekening</h3>
            <div className="billing-bank-info__card">
              <div className="billing-bank-info__detail">
                <div className="billing-bank-info__label">Bank BCA</div>
                <div className="billing-bank__value">0283-0093-002</div>
                <div className="billing-bank__info__label">Atas Nama</div>
                <div className="billing-bank__value">PT AUBAYA</div>
              </div>
              <div className="billing-bank__info__detail">
                <div className="billing-bank-info__label">Kota Cabang</div>
                  <div className="billing-bank__info__value">Surabaya</div>
                </div>
              </div>
              <div className="billing-bank-info__detail">
                <div className="billing-bank-info__label">No. Rek</div>
                  <div className="billing-bank-info__value">003-003-002-002</div>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Charges */}
          {billingData?.outstanding > 0 && (
            <div className="billing-additional-charges">
              <h3 className="billing-additional-charges__title">Biaya Tambahan</h3>
              <div className="billing-additional-charges__card">
                <div className="billing-additional-charges__info">
                  <p className="billing-additional-charges__desc">
                    Biaya popok dan susu tambahan akan dikenakan ke tagihan orang tua jika ada.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Payment Modal */}
          {showPaymentModal && (
            <div className="billing-payment-modal">
              <div className="billing-payment-modal__overlay" onClick={handleClosePaymentModal}>
                <div className="billing-payment-modal__card">
                  <div className="billing-payment-modal__header">
                    <h3>Konfirmasi Pembayaran</h3>
                    <button
                      type="button"
                      onClick={handleClosePaymentModal}
                      className="billing-payment-modal__close"
                    >
                      ×
                    </button>
                  </div>
                  <div className="billing-payment-modal__body">
                    <p className="billing-payment-modal__desc">
                      Silakan scan QRIS berikut ini untuk melakukan pembayaran via mobile banking.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  )
}

export default BillingPage