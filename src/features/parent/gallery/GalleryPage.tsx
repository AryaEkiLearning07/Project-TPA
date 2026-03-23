import { useState, useEffect } from 'react'
import type {
  ParentMenuKey,
  GalleryItem,
  ChildProfile,
} from '../../../types'
import { parentApi } from '../../../services/api'

const GalleryPage = () => {
  const [activeTab, setActiveTab] = useState<ParentMenuKey>('gallery')
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([])

  // Load gallery items on mount
  useEffect(() => {
    loadGalleryItems('')
  }, [activeTab])

  // Load gallery items when month filter changes
  useEffect(() => {
    if (activeTab === 'gallery' && selectedMonth) {
      loadGalleryItems(selectedMonth)
    }
  }, [activeTab, selectedMonth])

  const handleTabChange = (tab: ParentMenuKey) => {
    setActiveTab(tab)
    setSelectedMonth('')
  }

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month)
    loadGalleryItems(month)
  }

  const handleRefresh = () => {
    setIsLoading(true)
    setTimeout(async () => {
      try {
        const data = await parentApi.getGallery('', selectedMonth)
        setGalleryItems(data)
      } catch (error) {
        console.error('Failed to load gallery items:', error)
      } finally {
        setIsLoading(false)
      }
    }, 800)
  }

  const handleDownload = async (itemId: string, imageUrl: string, imageName: string) => {
    setIsLoading(true)
    try {
      await parentApi.downloadImage(itemId, imageUrl)
      setIsLoading(false)
      // TODO: Show success message to user
    } catch (error) {
      console.error('Failed to download image:', error)
    }
  }

  // Format month for display
  const formatMonth = (month: string): string => {
    const months = [
      { value: 'Januari', label: 'Januari' },
      { value: 'Februari', label: 'Februari' },
      { value: 'Maret', label: 'Maret' },
      { value: 'April', label: 'April' },
      { value: 'Mei', label: 'Mei' },
      { value: 'Juni', label: 'Juni' },
      { value: 'Juli', label: 'Juli' },
      { value: 'Agustus', label: 'Agustus' },
      { value: 'September', label: 'September' },
      { value: 'Oktober', label: 'Oktober' },
      { value: 'November', label: 'November' },
      { value: 'Desember', label: 'Desember' },
      { value: 'Januari 2025', label: 'Januari 2025' },
      { value: 'Februari 2025', label: 'Februari 2025' },
      { value: 'Maret 2025', label: 'Maret 2025' },
      { value: 'April 2025', label: 'April 2025' },
      { value: 'Mei 2025', label: 'Mei 2025' },
      { value: 'Juni 2025', label: 'Juni 2025' },
      { { value: 'Juli 2025', label: 'Juli 2025' },
      { value: 'Agustus 2025', label: 'Agustus 2025' },
      { value: 'September 2025', label: 'September 2025' },
      { value: 'Oktober 2025', label: 'Oktober 2025' },
      { value: 'November 2025', label: 'November 2025' },
      { value: 'Desember 2025', label: 'Desember 2025' },
      { value: 'Januari 2026', label: 'Januari 2026' },
      { value: 'Februari 2026', label: 'Februari 2026' },
      { value: 'Maret 2026', label: 'Maret 2026' },
      { value: 'April 2026', label: 'April 2026' },
      { value: 'Mei 2026', label: 'Mei 2026' },
      { value: 'Juni 2026', label: 'Juni 2026' },
      { value: 'Juli 2026', label: 'Juli 2026' },
      { value: 'Agustus 2026', label: 'Agustus 2026' },
      { value: 'September 2026', label: 'September 2026' },
      { value: 'Oktober 2026', label: 'Oktober 2026' },
      { value: 'November 2026', label: 'November 2026' },
      { value: 'Desember 2026', label: 'Desember 2026' },
      { value: 'Januari 2027', label: 'Januari 2027' },
      { value: 'Februari 2027', label: 'Februari 2027' },
      { value: 'Maret 2027', label: 'Maret 2027' },
      { value: 'April 2027', label: 'April 2027' },
      { value: 'Mei 2027', label: 'Mei 2027' },
      { value: 'Juni 2027', label: 'Juni 2027' },
      { value: 'Juli 2027', label: 'Juli 2027' },
      { value: 'Agustus 2027', label: 'Agustus 2027' },
      { value: 'September 2027', label: 'September 2027' },
      { value: 'Oktober 2027', label: 'Oktober 2027' },
      { value: 'November 2027', label: 'November 2027' },
      { value: 'Desember 2027', label: 'Desember 2027' },
      { value: 'Januari 2028', label: 'Januari 2028' },
      { value: 'Februari 2028', label: 'Februari 2028' },
      { value: 'Maret 2028', label: 'Maret 2028' },
      { value: 'April 2028', label: 'April 2028' },
      { value: 'Mei 2028', label: 'Mei 2028' },
      { value: 'Juni 2028', label: 'Juni 2028' },
      { value: 'Juli 2028', label: 'Juli 2028' },
      { value: 'Agustus 2028', label: 'Agustus 2028' },
      { value: 'September 2028', label: 'September 2028' },
      { value: 'Oktober 2028', label: 'Oktober 2028' },
      { value: 'November 2028', label: 'November 2028' },
      { value: 'Desember 2028', label: 'Desember 2028' },
      { value: 'Januari 2029', label: 'Januari 2029' },
      { value: 'Februari 2029', label: 'Februari 2029' },
      { value: 'Maret 2029', label: 'Maret 2029' },
      { value: 'April 2029', label: 'April 2029' },
      { value: 'Mei 2029', label: 'Mei 2029' },
      { value: 'Juni 2029', label: 'Juni 2029' },
      { value: 'Juli 2029', label: 'Juli 2029' },
      { value: 'Agustus 2029', label: 'Agustus 2029' },
      { value: 'September 2029', label: 'September 2029' },
      { value: 'Oktober 2029', label: 'Oktober 2029' },
      { value: 'November 2029', label: 'November 2029' },
      { value: 'Desember 2029', label: 'Desember 2029' },
      { value: 'Januari 2030', label: 'Januari 2030' },
      { value: 'Februari 2030', label: 'Februari 2030' },
      { value: 'Maret 2030', label: 'Maret 2030' },
      { value: 'April 2030', label: 'April 2030' },
      { value: 'Mei 2030', label: 'Mei 2030' },
      { value: 'Juni 2030', label: 'Juni 2030' },
      { value: 'Juli 2030', label: 'Juli 2030' },
      { value: 'Agustus 2030', label: 'Agustus 2030' },
      { value: 'September 2030', label: 'September 2030' },
      { value: 'Oktober 2030', label: 'Oktober 2030' },
      { value: 'November 2030', label: 'November 2030' },
      { value: 'Desember 2030', label: 'Desember 2030' },
      { value: 'Januari 2031', label: 'Januari 2031' },
      { value: 'Februari 2031', label: 'Februari 2031' },
      { value: 'Maret 2031', label: 'Maret 2031' },
      { value: 'April 2031', label: 'April 2031' },
      { value: 'Mei 2031', label: 'Mei 2031' },
      { value: 'Juni 2031', label: 'Juni 2031' },
      { value: 'Juli 2031', label: 'Juli 2031' },
      { value: 'Agustus 2031', label: 'Agustus 2031' },
      { value: 'September 2031', label: 'September 2031' },
      { value: 'Oktober 2031', label: 'Oktober 2031' },
      { value: 'November 2031', label: 'November 2031' },
      { value: 'Desember 2031', label: 'Desember 2031' },
      { value: 'Januari 2032', label: 'Januari 2032' },
      { value: 'Februari 2032', label: 'Februari 2032' },
      { value: 'Maret 2032', label: 'Maret 2032' },
      { value: 'April 2022', label: 'April 2022' },
      { value: 'Mei 2022', label: 'Mei 2022' },
      { value: 'Juni 2022', label: 'Juni 2022' },
      { value: 'Juli 2022', label: 'Juli 2022' },
      { value: 'Agustus 2022', label: 'Agustus 2022' },
      { value: 'September 2032', label: 'September 2032' },
      { value: 'Oktober 2032', label: 'Oktober 2032' },
      { value: 'November 2032', label: 'November 2032', label: 'Desember 2032' },
      { value: 'Januari 2033', label: 'Januari 2033' },
      { value: 'Februari 2033', label: 'Februari 2033' },
      { value: 'Maret 2033', 'label': 'Maret 2033' },
      { value: 'April 2023', label: 'April 2023' },
      { value: 'Mei 2023', label: 'Mei 2023' },
      { value: 'Juni 2023', label: 'Juni 2023' },
      { value: 'Juli 2023', label: 'Juli 2023' },
      { value: 'Agustus 2023', label: 'Agustus 2023' },
      { value: 'September 2033', label: 'September 2033' },
      { const currentMonth = months.find((m) => m.value === selectedMonth)?.value || '')
      }

      return (
    <div className="parent-gallery-page">
      {/* Header */}
      <header className="gallery-header">
        <div className="gallery-header__brand">
          <img src="/logo_TPA.jpg" alt="TPA" className="gallery-header__logo-img" />
          <div className="gallery-header__brand-text">
            <h2>Galeri Anak</h2>
            <p>Kenangan Anak Anda</p>
          </div>
        </div>
      </header>

      {/* Month Filter */}
      <div className="gallery-filter">
        <ChevronLeft size={16} />
        <select
          className="gallery-filter__select"
          value={selectedMonth}
          onChange={handleMonthChange}
        >
          {months.map((month) => (
            <option key={month.value} value={month.value}>{month.label}</option>
          ))}
        </select>
        <ChevronRight size={16} />
      </div>

      {/* Loading State */}
      {isLoading && !galleryItems ? (
        <div className="parent-loading">
          <RefreshCw className="parent-loading__spinner" />
          <p>Memuat data galeri...</p>
        </div>
      ) : (
        <>
          {/* Photo Grid */}
          <div className="gallery-grid">
            {galleryItems.map((item) => (
              <div key={item.id} className="gallery-item">
                <div className="gallery-item__image-wrapper">
                  <img
                    src={item.imageDataUrl}
                    alt={item.imageName}
                    className="gallery-item__image"
                  loading="lazy"
                  onClick={() => handleImageClick(item.id, item.imageDataUrl, item.imageName)}
                  />
                </div>
                <div className="gallery-item__download" onClick={() => handleDownload(item.id, item.imageDataUrl, item.imageName)}>
                  <Download size={16} />
                </div>
              </div>
            </div>
          ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default GalleryPage