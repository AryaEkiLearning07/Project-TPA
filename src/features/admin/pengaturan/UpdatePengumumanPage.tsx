import type {
  ChangeEvent,
  Dispatch,
  FormEvent,
  SetStateAction,
} from 'react'
import { useEffect, useRef } from 'react'
import type {
  LandingAnnouncement,
  LandingAnnouncementCategory,
  LandingAnnouncementDisplayMode,
  LandingAnnouncementStatus,
} from '../../../types'
import { AppDatePickerField } from '../../../components/common/DatePickerFields'

export interface LandingAnnouncementEditorForm {
  title: string
  slug: string
  category: LandingAnnouncementCategory
  displayMode: LandingAnnouncementDisplayMode
  excerpt: string
  content: string
  coverImageDataUrl: string
  coverImageName: string
  ctaLabel: string
  ctaUrl: string
  publishStartDate: string
  publishEndDate: string
  status: LandingAnnouncementStatus
  isPinned: boolean
}

type AnnouncementFunction = 'galeri' | 'dokumentasi' | 'fasilitas' | 'poster'

interface UpdatePengumumanPageProps {
  announcements: LandingAnnouncement[]
  form: LandingAnnouncementEditorForm
  setForm: Dispatch<SetStateAction<LandingAnnouncementEditorForm>>
  editingAnnouncementId: string | null
  isLoading: boolean
  isSaving: boolean
  deletingAnnouncementId: string | null
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onResetForm: () => void
  onSelectAnnouncement: (announcement: LandingAnnouncement) => void
  onDeleteAnnouncement: (announcement: LandingAnnouncement) => Promise<void> | void
  onUploadCoverImage: (event: ChangeEvent<HTMLInputElement>) => Promise<void> | void
  onClearCoverImage: () => void
  formatDateOnly: (value: string) => string
  formatDateTime: (value: string) => string
}

const statusLabelMap: Record<LandingAnnouncementStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
}

const functionLabelMap: Record<AnnouncementFunction, string> = {
  galeri: 'Galeri',
  dokumentasi: 'Dokumentasi',
  fasilitas: 'Fasilitas',
  poster: 'Poster',
}

const mapCategoryToFunction = (category: LandingAnnouncementCategory): AnnouncementFunction => {
  if (category === 'galeri') {
    return 'galeri'
  }
  if (category === 'event' || category === 'dokumentasi') {
    return 'dokumentasi'
  }
  if (category === 'fasilitas') {
    return 'fasilitas'
  }
  return 'poster'
}

const matchesFunction = (
  announcement: LandingAnnouncement,
  currentFunction: AnnouncementFunction,
): boolean => {
  if (currentFunction === 'galeri') {
    return announcement.category === 'galeri'
  }
  if (currentFunction === 'dokumentasi') {
    return announcement.category === 'event' || announcement.category === 'dokumentasi'
  }
  if (currentFunction === 'fasilitas') {
    return announcement.category === 'fasilitas'
  }
  return announcement.category === 'promosi' || announcement.category === 'ucapan'
}

const renderImageCell = (announcement: LandingAnnouncement) => {
  if (!announcement.coverImageDataUrl) {
    return <span className="field-hint">-</span>
  }

  return (
    <img
      src={announcement.coverImageDataUrl}
      alt={announcement.title || 'Poster'}
      style={{
        width: '88px',
        height: '56px',
        objectFit: 'cover',
        borderRadius: '10px',
        border: '1px solid var(--admin-border-color, #d6dae3)',
      }}
    />
  )
}

const UpdatePengumumanPage = ({
  announcements,
  form,
  setForm,
  editingAnnouncementId,
  isLoading,
  isSaving,
  deletingAnnouncementId,
  onSubmit,
  onResetForm,
  onSelectAnnouncement,
  onDeleteAnnouncement,
  onUploadCoverImage,
  onClearCoverImage,
  formatDateOnly,
  formatDateTime,
}: UpdatePengumumanPageProps) => {
  const editCardRef = useRef<HTMLDivElement | null>(null)
  const activeFunction = mapCategoryToFunction(form.category)
  const filteredAnnouncements = announcements.filter((announcement) =>
    matchesFunction(announcement, activeFunction),
  )
  const shouldScrollAnnouncementList = filteredAnnouncements.length > 5
  const isGalleryMode = activeFunction === 'galeri'
  const isDocumentationMode = activeFunction === 'dokumentasi'
  const isFacilityMode = activeFunction === 'fasilitas'
  const isPosterMode = activeFunction === 'poster'

  useEffect(() => {
    if (!editingAnnouncementId) {
      return
    }
    editCardRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }, [editingAnnouncementId])

  const handleFunctionChange = (nextFunction: AnnouncementFunction) => {
    onResetForm()
    setForm((previous) => {
      if (nextFunction === 'galeri') {
        return {
          ...previous,
          category: 'galeri',
          displayMode: 'section',
          excerpt: '',
          content: '',
          ctaLabel: '',
          ctaUrl: '',
          publishStartDate: '',
          publishEndDate: '',
        }
      }

      if (nextFunction === 'dokumentasi') {
        return {
          ...previous,
          category: 'dokumentasi',
          displayMode: 'section',
          publishEndDate: '',
          ctaLabel: '',
          ctaUrl: '',
          content: '',
        }
      }

      if (nextFunction === 'fasilitas') {
        return {
          ...previous,
          category: 'fasilitas',
          displayMode: 'section',
          publishStartDate: '',
          publishEndDate: '',
          ctaLabel: '',
          ctaUrl: '',
          excerpt: '',
          content: '',
          status: 'published',
        }
      }

      return {
        ...previous,
        category:
          previous.category === 'promosi' || previous.category === 'ucapan'
            ? previous.category
            : 'ucapan',
        displayMode: 'popup',
        status: 'published',
        excerpt: '',
        content: '',
        ctaLabel: '',
        ctaUrl: '',
        isPinned: false,
      }
    })
  }

  return (
    <section className="page">
      <div className="card">
        <h2>Update Pengumuman</h2>
        <p className="card__description">
          Pilih fungsi dulu, lalu daftar riwayat dan form input akan menyesuaikan otomatis.
        </p>

        <div className="field-group field-group--small">
          <label className="label" htmlFor="announcementFunction">
            Pilih Fungsi
          </label>
          <select
            id="announcementFunction"
            className="input"
            value={activeFunction}
            onChange={(event) =>
              handleFunctionChange(event.target.value as AnnouncementFunction)
            }
          >
            <option value="galeri">Update Galeri</option>
            <option value="dokumentasi">Update Dokumentasi</option>
            <option value="fasilitas">Update Fasilitas TPA</option>
            <option value="poster">Update Poster</option>
          </select>
        </div>
      </div>

      <div className="card">
        <h3>Daftar {functionLabelMap[activeFunction]}</h3>
        <p className="card__description">
          Menampilkan seluruh riwayat {functionLabelMap[activeFunction].toLowerCase()} yang pernah diupload.
        </p>

        <div
          className="table-wrap"
          style={
            shouldScrollAnnouncementList
              ? { maxHeight: '460px', overflowY: 'auto' }
              : undefined
          }
        >
          <table className="table">
            <thead>
              {isGalleryMode ? (
                <tr>
                  <th>Foto</th>
                  <th>Judul</th>
                  <th>Status</th>
                  <th>Update</th>
                  <th>Aksi</th>
                </tr>
              ) : null}
              {isDocumentationMode ? (
                <tr>
                  <th>Foto</th>
                  <th>Judul</th>
                  <th>Tanggal</th>
                  <th>Keterangan</th>
                  <th>Status</th>
                  <th>Update</th>
                  <th>Aksi</th>
                </tr>
              ) : null}
              {isPosterMode ? (
                <tr>
                  <th>Foto</th>
                  <th>Tanggal Upload</th>
                  <th>Tanggal Selesai</th>
                  <th>Status</th>
                  <th>Update</th>
                  <th>Aksi</th>
                </tr>
              ) : null}
              {isFacilityMode ? (
                <tr>
                  <th>Foto</th>
                  <th>Judul</th>
                  <th>Keterangan Singkat</th>
                  <th>Fungsi</th>
                  <th>Status</th>
                  <th>Update</th>
                  <th>Aksi</th>
                </tr>
              ) : null}
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={isPosterMode ? 6 : isDocumentationMode || isFacilityMode ? 7 : 5} className="table__empty">
                    Memuat daftar update...
                  </td>
                </tr>
              ) : filteredAnnouncements.length === 0 ? (
                <tr>
                  <td colSpan={isPosterMode ? 6 : isDocumentationMode || isFacilityMode ? 7 : 5} className="table__empty">
                    Tidak ada data {functionLabelMap[activeFunction].toLowerCase()}.
                  </td>
                </tr>
              ) : (
                filteredAnnouncements.map((announcement) => {
                  if (isGalleryMode) {
                    return (
                      <tr key={announcement.id}>
                        <td>{renderImageCell(announcement)}</td>
                        <td><strong>{announcement.title}</strong></td>
                        <td>{statusLabelMap[announcement.status]}</td>
                        <td>{formatDateTime(announcement.updatedAt)}</td>
                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              className="button button--tiny button--ghost"
                              onClick={() => onSelectAnnouncement(announcement)}
                              disabled={isSaving}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="button button--tiny button--danger"
                              onClick={() => void onDeleteAnnouncement(announcement)}
                              disabled={deletingAnnouncementId === announcement.id}
                            >
                              {deletingAnnouncementId === announcement.id ? 'Menghapus...' : 'Hapus'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  if (isDocumentationMode) {
                    return (
                      <tr key={announcement.id}>
                        <td>{renderImageCell(announcement)}</td>
                        <td><strong>{announcement.title}</strong></td>
                        <td>{announcement.publishStartDate ? formatDateOnly(announcement.publishStartDate) : '-'}</td>
                        <td>{announcement.excerpt || '-'}</td>
                        <td>{statusLabelMap[announcement.status]}</td>
                        <td>{formatDateTime(announcement.updatedAt)}</td>
                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              className="button button--tiny button--ghost"
                              onClick={() => onSelectAnnouncement(announcement)}
                              disabled={isSaving}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="button button--tiny button--danger"
                              onClick={() => void onDeleteAnnouncement(announcement)}
                              disabled={deletingAnnouncementId === announcement.id}
                            >
                              {deletingAnnouncementId === announcement.id ? 'Menghapus...' : 'Hapus'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  if (isFacilityMode) {
                    return (
                      <tr key={announcement.id}>
                        <td>{renderImageCell(announcement)}</td>
                        <td><strong>{announcement.title}</strong></td>
                        <td>{announcement.excerpt || '-'}</td>
                        <td>{announcement.content || '-'}</td>
                        <td>{statusLabelMap[announcement.status]}</td>
                        <td>{formatDateTime(announcement.updatedAt)}</td>
                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              className="button button--tiny button--ghost"
                              onClick={() => onSelectAnnouncement(announcement)}
                              disabled={isSaving}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="button button--tiny button--danger"
                              onClick={() => void onDeleteAnnouncement(announcement)}
                              disabled={deletingAnnouncementId === announcement.id}
                            >
                              {deletingAnnouncementId === announcement.id ? 'Menghapus...' : 'Hapus'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={announcement.id}>
                      <td>{renderImageCell(announcement)}</td>
                      <td>{announcement.publishStartDate ? formatDateOnly(announcement.publishStartDate) : '-'}</td>
                      <td>{announcement.publishEndDate ? formatDateOnly(announcement.publishEndDate) : '-'}</td>
                      <td>{statusLabelMap[announcement.status]}</td>
                      <td>{formatDateTime(announcement.updatedAt)}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="button button--tiny button--ghost"
                            onClick={() => onSelectAnnouncement(announcement)}
                            disabled={isSaving}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="button button--tiny button--danger"
                            onClick={() => void onDeleteAnnouncement(announcement)}
                            disabled={deletingAnnouncementId === announcement.id}
                          >
                            {deletingAnnouncementId === announcement.id ? 'Menghapus...' : 'Hapus'}
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

      <div className="card" ref={editCardRef}>
        <h3>{editingAnnouncementId ? 'Edit Data' : 'Tambah Data Baru'}</h3>
        <p className="card__description">
          Form input menyesuaikan fungsi {functionLabelMap[activeFunction].toLowerCase()}.
        </p>

        <form onSubmit={onSubmit}>
          {!isPosterMode ? (
            <div className="field-group">
              <label className="label" htmlFor="announcementTitle">
                Judul
              </label>
              <input
                id="announcementTitle"
                className="input"
                value={form.title}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    title: event.target.value,
                  }))
                }
                placeholder={
                  isGalleryMode
                    ? 'Contoh: Bermain Sensorik'
                    : isFacilityMode
                      ? 'Contoh: Area Indoor (Soft Play)'
                      : 'Contoh: Dokumentasi kegiatan motorik halus'
                }
              />
            </div>
          ) : null}

          {isDocumentationMode ? (
            <>
              <div className="form-grid form-grid--2">
                <div className="field-group">
                  <label className="label" htmlFor="announcementStartDate">
                    Tanggal
                  </label>
                  <AppDatePickerField
                    id="announcementStartDate"
                    value={form.publishStartDate}
                    onChange={(value) =>
                      setForm((previous) => ({
                        ...previous,
                        publishStartDate: value,
                      }))
                    }
                  />
                </div>

                <div className="field-group">
                  <label className="label" htmlFor="announcementStatus">
                    Status
                  </label>
                  <select
                    id="announcementStatus"
                    className="input"
                    value={form.status}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        status: event.target.value as LandingAnnouncementStatus,
                      }))
                    }
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className="field-group">
                <label className="label" htmlFor="announcementExcerpt">
                  Keterangan
                </label>
                <textarea
                  id="announcementExcerpt"
                  className="textarea"
                  rows={4}
                  value={form.excerpt}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      excerpt: event.target.value,
                    }))
                  }
                  placeholder="Isi keterangan dokumentasi kegiatan."
                />
              </div>
            </>
          ) : null}

          {isGalleryMode ? (
            <div className="field-group field-group--small">
              <label className="label" htmlFor="announcementStatusGallery">
                Status
              </label>
              <select
                id="announcementStatusGallery"
                className="input"
                value={form.status}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    status: event.target.value as LandingAnnouncementStatus,
                  }))
                }
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          ) : null}

          {isFacilityMode ? (
            <>
              <div className="field-group field-group--small">
                <label className="label" htmlFor="announcementStatusFacility">
                  Status
                </label>
                <select
                  id="announcementStatusFacility"
                  className="input"
                  value={form.status}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      status: event.target.value as LandingAnnouncementStatus,
                    }))
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="field-group">
                <label className="label" htmlFor="facilityShortDescription">
                  Keterangan Singkat
                </label>
                <textarea
                  id="facilityShortDescription"
                  className="textarea"
                  rows={3}
                  value={form.excerpt}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      excerpt: event.target.value,
                    }))
                  }
                  placeholder="Isi keterangan singkat fasilitas."
                />
              </div>

              <div className="field-group">
                <label className="label" htmlFor="facilityFunctionDescription">
                  Fungsi
                </label>
                <textarea
                  id="facilityFunctionDescription"
                  className="textarea"
                  rows={4}
                  value={form.content}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      content: event.target.value,
                    }))
                  }
                  placeholder="Isi fungsi fasilitas untuk ditampilkan di landing page."
                />
              </div>
            </>
          ) : null}

          {isPosterMode ? (
            <>
              <div className="form-grid form-grid--2">
                <div className="field-group">
                  <label className="label" htmlFor="announcementStartDatePoster">
                    Tanggal Upload / Tayang
                  </label>
                  <AppDatePickerField
                    id="announcementStartDatePoster"
                    value={form.publishStartDate}
                    onChange={(value) =>
                      setForm((previous) => ({
                        ...previous,
                        publishStartDate: value,
                      }))
                    }
                  />
                </div>

                <div className="field-group">
                  <label className="label" htmlFor="announcementEndDatePoster">
                    Tanggal Selesai
                  </label>
                  <AppDatePickerField
                    id="announcementEndDatePoster"
                    value={form.publishEndDate}
                    onChange={(value) =>
                      setForm((previous) => ({
                        ...previous,
                        publishEndDate: value,
                      }))
                    }
                  />
                </div>
              </div>
              <p className="field-hint" style={{ marginTop: '-0.25rem' }}>
                Poster otomatis tampil saat tanggal mulai dan otomatis arsip saat tanggal selesai terlewati.
              </p>
            </>
          ) : null}

          <div className="field-group">
            <label className="label" htmlFor="announcementImage">
              {isFacilityMode ? 'Gambar Fasilitas' : 'Foto'}
            </label>
            <input
              id="announcementImage"
              className="input"
              type="file"
              accept="image/*"
              onChange={(event) => void onUploadCoverImage(event)}
            />
            {form.coverImageDataUrl ? (
              <div className="announcement-cover-preview">
                <img src={form.coverImageDataUrl} alt={form.coverImageName || 'Preview pengumuman'} />
                <div className="table-actions">
                  <button
                    type="button"
                    className="button button--tiny button--ghost"
                    onClick={onClearCoverImage}
                  >
                    Hapus Foto
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="form-actions">
            <button type="submit" className="button" disabled={isSaving}>
              {isSaving
                ? 'Menyimpan...'
                : editingAnnouncementId
                  ? 'Update Data'
                  : 'Simpan Data'}
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={onResetForm}
              disabled={isSaving}
            >
              Reset Form
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}

export default UpdatePengumumanPage
