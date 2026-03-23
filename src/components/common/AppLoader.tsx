const PLATFORM_LOGO_SRC = `${import.meta.env.BASE_URL}logo_TPA.jpg`

interface AppLoaderProps {
  title?: string
  message?: string
  caption?: string
}

const AppLoader = ({
  title = 'Sedang memuat platform',
  message = 'Mohon tunggu sebentar, sistem sedang menyiapkan dashboard Anda.',
  caption = 'TPA Rumah Ceria UBAYA',
}: AppLoaderProps) => {
  return (
    <section className="boot-loader" role="status" aria-live="polite">
      <div className="boot-loader__card">
        <div className="boot-loader__brand">
          <span className="boot-loader__logo-shell">
            <img
              src={PLATFORM_LOGO_SRC}
              alt="Logo TPA Rumah Ceria UBAYA"
              className="boot-loader__logo"
            />
          </span>
          <span className="boot-loader__caption">{caption}</span>
        </div>
        <div className="boot-loader__spinner" aria-hidden="true" />
        <div className="boot-loader__copy">
          <h1>{title}</h1>
          <p>{message}</p>
        </div>
      </div>
    </section>
  )
}

export default AppLoader
