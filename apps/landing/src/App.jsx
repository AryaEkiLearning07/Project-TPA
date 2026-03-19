const appUrl = 'https://aps.tparumahceria.com'
const parentUrl = 'https://parent.tparumahceria.com'

const features = [
  {
    title: 'Monitoring Harian',
    description:
      'Kehadiran, observasi, berita acara, dan aktivitas anak tercatat rapi setiap hari.',
  },
  {
    title: 'Laporan Transparan',
    description:
      'Orang tua dapat memantau progres dan catatan pengasuh secara langsung dari akun parent.',
  },
  {
    title: 'Manajemen TPA',
    description:
      'Admin mengelola petugas, data anak, absensi, dan rekap operasional dari satu platform.',
  },
]

export default function App() {
  return (
    <main className="landing-root">
      <header className="hero">
        <div className="hero__badge">TPA Rumah Ceria</div>
        <h1>Tempat Penitipan Anak yang Terpantau, Aman, dan Terukur</h1>
        <p>
          Landing page publik untuk informasi layanan TPA. Platform operasional
          dan akun orang tua dijalankan terpisah agar lebih aman dan fokus.
        </p>
        <div className="hero__actions">
          <a className="btn btn--primary" href={parentUrl} target="_blank" rel="noreferrer">
            Login Orang Tua
          </a>
          <a className="btn btn--secondary" href={appUrl} target="_blank" rel="noreferrer">
            Login Admin/Petugas
          </a>
        </div>
      </header>

      <section className="section">
        <h2>Kenapa Rumah Ceria</h2>
        <div className="feature-grid">
          {features.map((feature) => (
            <article className="card" key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section section--split">
        <article className="panel">
          <h3>Untuk Orang Tua</h3>
          <p>
            Akses progres anak, catatan aktivitas, dan komunikasi dari pendamping
            melalui subdomain khusus parent.
          </p>
          <a href={parentUrl} target="_blank" rel="noreferrer">
            Buka Parent Portal
          </a>
        </article>
        <article className="panel">
          <h3>Untuk Pengelola TPA</h3>
          <p>
            Kelola operasional harian, kehadiran, dan rekap monitoring melalui
            platform admin terpisah.
          </p>
          <a href={appUrl} target="_blank" rel="noreferrer">
            Buka Platform Manajemen
          </a>
        </article>
      </section>
    </main>
  )
}
