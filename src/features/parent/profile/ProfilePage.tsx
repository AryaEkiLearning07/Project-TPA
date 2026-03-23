import { useState } from 'react'
import type { ChildProfile, ParentMenuKey } from '../../../types'

const ProfilePage = () => {
  const [activeTab, setActiveTab] = useState<ParentMenuKey>('dashboard')
  const [isLoading, setIsLoading] = useState(false)
  const [childData, setChildData] = useState<ChildProfile | null>(null)

  // Mock data - nanti akan di-load dari API
  useEffect(() => {
    const loadChildData()
  }, [])

  const loadChildData = async () => {
    setIsLoading(true)
    try {
      // TODO: Fetch from API
      const mockChildData: ChildProfile = {
        id: 'child-1',
        fullName: 'Budi Setiawan',
        nickName: 'Budi',
        gender: 'Laki-laki',
        photoDataUrl: '/logo_TPA.jpg',
        birthDate: '2022-05-15',
        age: '3 Tahun 8 Bulan',
        fatherName: 'Budi Santoso',
        motherName: 'Siti Aminah',
        fatherPhone: '08123456789',
        motherPhone: '08123456789',
        email: 'siti.aminah@gmail.com',
        whatsappNumber: '08123456789',
        homeAddress: 'Jl. Kali Rungkut Baru Timur Dalam Kompleks Samping RW 03',
        officeAddress: 'Jl. Kali Rungkut Baru Timur Dalam Kompleks Samping RW 03',
        otherPhone: '08123456790',
        birthPlace: 'RS. Umum Daerah',
        religion: 'islam',
        servicePackage: 'bulanan',
        arrivalTime: '08.00',
        departureTime: '16.30',
        pickupPersons: ['Budi Santoso', 'Siti Aminah'],
        allergy: 'Tidak ada',
        depositPurpose: 'Agar Budi bisa belajar dengan tenang',
        prenatalPeriod: 'Tidak ada',
        toiletTrainingBab: 'Belum lancar',
        toiletTrainingBak: 'Sudah lancar',
        toiletTrainingBath: 'Sudah lancar',
        brushingTeeth: 'Sudah bisa',
        eating: 'Sudah bisa',
        drinkingMilk: 'Sudah bisa',
        whenCrying: 'Sedih saat menangis',
        whenPlaying: 'Sedang bermain',
        sleeping: 'Sudah nyenyenyak',
        otherHabits: 'Aktifitas sebar-bar harian',
      }
      setChildData(mockChildData)
    } catch (error) {
      console.error('Failed to load child data:', error)
      // TODO: Show error message
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangePassword = () => {
    // TODO: Implement change password
  }

  const formatAge = (birthDate: string): string => {
    const birth = new Date(birthDate)
    const now = new Date()
    const ageInMs = now.getTime() - birth.getTime()
    const years = Math.floor(ageInMs / (1000 * 60 * 60 * 24 * 365)
    const months = Math.floor((years * 12) / 12)

    if (years < 1) {
      return `${months} tahun`
    }

    const ageInYears = (years >= 1) ? `${years} tahun` : ''

    return ageInYears || `${years} thun`
  }

  return (
    <div className="parent-profile is-active">
      {/* Loading State */}
      {isLoading && !childData ? (
        <div className="parent-loading">
          <RefreshCw className="parent-loading__spinner" />
          <p>Memuat data profil...</p>
        </div>
      ) : childData && (
        <>
          {/* Header */}
          <div className="profile-header">
            <div className="profile-header__section-header">
              <div className="profile-header__header-icon">
                <User size={20} />
              </div>
              <h2 className="profile-header__section-title">Profil Anak</h2>
              </div>
          </div>

          {/* Data Diri */}
          <div className="profile-section">
            <div className="profile-section__section">
              <div className="profile-section__header">
                <div className="profile-section__header-icon">
                  <User size={20} />
                </div>
                <h3 className="profile-section__section-title">Data Diri</h3>
              </div>
            </div>
            <div className="profile-section__body">
              <div className="profile-section__info-row">
                <span className="profile-section__label">Nama Lengkap:</span>
                <span className="profile-section__value">{childData.fullName}</span>
              </div>
              <div className="profile-section__info-row">
                <span className="profile-section__label">Tanggal Lahir:</span>
                <span className="profile-section__value">{childData.birthDate}</span>
              </div>
              <div className="profile-section__info-row">
                <span className="profile-section__label">Usia:</span>
                <span className="profile-section__value">{childData.age}</span>
              </div>
              <div className="profile-section__info-row">
                <span className="profile-section__label">Jenis Kelamin:</span>
                <span className="profile-section__value">{childData.gender}</span>
              </div>
              <div className="profile-section__info-row">
                <span className="profile-section__label">Agama:</span>
                <span className="profile-section__value">{childData.religion}</span>
              </div>
            </div>
          </div>

          {/* Orang Tua */}
          <div className="profile-section">
            <div className="profile-section__section">
              <div className="profile-section__header">
                <div className="profile-section__header-icon">
                  <div className="profile-section__header-icon-wrapper">
                    <Settings size={20} />
                    <Lock size={18} />
                  </div>
                <h3 className="profile-section__section-title">Orang Tua</h3>
              </div>
            </div>
            <div className="profile-section__body">
              <div className="profile-section__info-row">
                <span className="profile-section__label">Nama Ayah:</span>
                <span className="profile-section__value">{childData.fatherName}</span>
              </div>
              <div className="profile-section__info-row">
                <span className="profile-section__label">Nama Ibu:</span>
                <span className="profile-section__value">{childData.motherName}</span>
              </div>
              <div className="profile-section__info-row">
                <span className="profile-section__label">WhatsApp:</span>
                <span className="profile-section__value">{childData.whatsappNumber}</span>
              </div>
              <div className="profile-section__info-row">
                <span className="profile-section__label">Kontak:</span>
                <span className="profile-section__value">{childData.homePhone}</span>
              </div>
              <div className="profile-section__info-row">
                <span className="profile-section__label">Email:</span>
                <span className="profile-section__value">{childData.email}</span>
              </div>
              <div className="profile-section__info-row">
                <span className="profile-section__label">Kantor:</span>
                <span className="profile-section__value">{childData.officeAddress}</span>
              </div>
              <div className="profile-section__info-row">
                <span className="profile-section__label">Kantor:</span>
                <span className="profile-section__value">{childData.otherPhone}</span>
              </div>
            </div>
          </div>

          {/* Penjemput/Pengantar */}
          <div className="profile-section">
            <div className="profile-section__section">
              <div className="profile-section__header">
                <div className="profile-section__header-icon">
                  <div className="profile-section__header-icon-wrapper">
                    <LayoutDashboard size={20} />
                  </div>
                <h3 className="profile-section__section-title">Penjemput/Pengantar</h3>
              </div>
            </div>
            <div className="profile-section__body">
              <div className="profile-section__pickup-list">
                {childData.pickupPersons?.map((person, index) => (
                  <div key={`pickup-${index}`} className="profile-pickup-item">
                    <div className="profile-pickup-header">
                      <span className="profile-pickup-icon">👤</span>
                      <div className="profile-pickup-header-meta">
                        <span className="profile-pickup-name">{person.name}</span>
                        <span className="profile-pickup-relation">{person.relation}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          {/* Data Tambahan */}
          <div className="profile-section">
            <div className="profile-section__section">
              <div className="profile-section__header">
                <div className="profile-section__header-icon">
                  <div className="profile-section__header-icon-wrapper">
                    <Settings size={20} />
                  </div>
                <h3 className="profile-section__section-title">Data Tambahan</h3>
              </div>
            </div>
            <div className="profile-section__body">
              <div className="profile-section__info-row">
                <span className="profile-section__label">Alergi:</span>
                <span className="profile-section__value">{childData.allergy}</span>
              </div>
              <div className="profile-section__info-row">
                <span className="profile-section__label">Mood:</span>
                <span className="profile-section__value">{childData.mood || '-'}</span>
              </div>
            </div>
          </div>

          {/* Keamanan */}
          <div className="profile-section">
            <div className="profile-section__section profile-section--keamanan">
              <div className="profile-section__header">
                <div className="profile-section__header-icon">
                  <div className="profile-section__header-icon-wrapper">
                    <Lock size={18} />
                  </div>
                <h3 className="profile-section__section-title">Keamanan</h3>
                <button onClick={handleChangePassword} className="profile-keaman__btn">
                  <Lock size={16} />
                  <span>Ganti Password</span>
                </button>
              </div>
            </div>
            <div className="profile-section__body">
              <div className="profile-keaman__info">
                <p className="profile-keaman__desc">Ganti password untuk keamanan akun.</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ProfilePage