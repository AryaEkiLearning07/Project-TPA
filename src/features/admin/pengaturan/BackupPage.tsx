interface BackupPageProps {
  isProcessingBackup: boolean
  onBackup: () => Promise<void> | void
}

const BackupPage = ({ isProcessingBackup, onBackup }: BackupPageProps) => {
  return (
    <section className="page">
      <div className="card">
        <h2>Backup Data</h2>
        <p className="card__description">
          Backup akan mengunduh snapshot JSON seluruh data utama aplikasi, termasuk
          akun admin/petugas, tarif layanan, dan log aktivitas.
        </p>
        <div className="form-actions">
          <button
            type="button"
            className="button button--success"
            onClick={() => void onBackup()}
            disabled={isProcessingBackup}
          >
            {isProcessingBackup ? 'Menyiapkan backup...' : 'Unduh Backup Sekarang'}
          </button>
        </div>
      </div>
    </section>
  )
}

export default BackupPage
