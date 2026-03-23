import { type FormEvent, useMemo, useState } from 'react'
import { religionOptions, servicePackageOptions } from '../../../constants/options'
import { AppDatePickerField } from '../../../components/common/DatePickerFields'
import type {
  ChildRegistrationCode,
  ChildProfile,
  ChildProfileInput,
  ConfirmDialogOptions,
  UserRole,
} from '../../../types'
import { getLocalDateIso } from '../../../utils/date'
import {
  type FieldErrors,
  validateChildProfileInput,
} from '../../../utils/validators'

interface DataAnakPageProps {
  childrenData: ChildProfile[]
  viewerRole: UserRole
  canManageData?: boolean
  registrationCodesByChildId?: Record<string, ChildRegistrationCode | null | undefined>
  onSave?: (input: ChildProfileInput, editingId?: string) => Promise<boolean>
  onDelete?: (id: string) => Promise<boolean>
  onLoadRegistrationCode?: (childId: string) => Promise<void>
  onGenerateRegistrationCode?: (childId: string) => Promise<boolean>
  onRequestConfirm: (options: ConfirmDialogOptions) => Promise<boolean>
}

const createInitialForm = (): ChildProfileInput => ({
  fullName: '',
  nickName: '',
  gender: 'L',
  photoDataUrl: '',
  birthPlace: '',
  birthDate: '',
  childOrder: '',
  religion: 'islam',
  outsideActivities: '',
  fatherName: '',
  motherName: '',
  homeAddress: '',
  homePhone: '',
  officeAddress: '',
  otherPhone: '',
  email: '',
  whatsappNumber: '',
  allergy: '',
  servicePackage: 'harian',
  arrivalTime: '',
  departureTime: '',
  pickupPersons: [],
  depositPurpose: '',
  prenatalPeriod: '',
  partusPeriod: '',
  postNatalPeriod: '',
  motorSkill: '',
  languageSkill: '',
  healthHistory: '',
  toiletTrainingBab: '',
  toiletTrainingBak: '',
  toiletTrainingBath: '',
  brushingTeeth: '',
  eating: '',
  drinkingMilk: '',
  whenCrying: '',
  whenPlaying: '',
  sleeping: '',
  otherHabits: '',
})

const removeErrorKey = (errors: FieldErrors, key: string): FieldErrors => {
  if (!errors[key]) return errors
  const next = { ...errors }
  delete next[key]
  return next
}

const validateAdminMandatoryFields = (input: ChildProfileInput): FieldErrors => {
  const errors: FieldErrors = {}
  const optionalKeys = new Set<keyof ChildProfileInput>([
    'allergy',
    'toiletTrainingBab',
    'toiletTrainingBak',
    'toiletTrainingBath',
    'brushingTeeth',
    'eating',
    'drinkingMilk',
    'whenCrying',
    'whenPlaying',
    'sleeping',
    'otherHabits',
  ])

  ;(Object.keys(input) as (keyof ChildProfileInput)[]).forEach((key) => {
    if (optionalKeys.has(key)) {
      return
    }

    const value = input[key]
    if (Array.isArray(value)) {
      if (value.length === 0) {
        errors[String(key)] = 'Wajib diisi'
      }
      return
    }

    if (typeof value === 'string' && !value.trim()) {
      errors[String(key)] = 'Wajib diisi'
    }
  })

  return errors
}

const formatWhatsAppLink = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '')
  const number = cleaned.startsWith('0') ? `62${cleaned.slice(1)}` : cleaned
  return `https://wa.me/${number}`
}

const REDACTED_TEXT = '[DISENSOR]'

const displayText = (value: string, fallback = '-'): string => {
  const normalized = value.trim()
  if (!normalized || normalized.toUpperCase() === REDACTED_TEXT) {
    return fallback
  }
  return normalized
}

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

const calculateAge = (birthDateString: string): string => {
  if (!birthDateString) return ''
  const today = new Date()
  const birthDate = new Date(birthDateString)
  let years = today.getFullYear() - birthDate.getFullYear()
  let months = today.getMonth() - birthDate.getMonth()
  if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
    years--
    months += 12
  }
  return `${years} tahun ${months} bulan`
}

const DataAnakPage = ({
  childrenData,
  viewerRole,
  canManageData = viewerRole === 'ADMIN',
  registrationCodesByChildId = {},
  onSave,
  onDelete,
  onLoadRegistrationCode,
  onGenerateRegistrationCode,
  onRequestConfirm,
}: DataAnakPageProps) => {
  const [form, setForm] = useState<ChildProfileInput>(() => createInitialForm())
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pickupInput, setPickupInput] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isModalOpen, setModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedChild, setSelectedChild] = useState<ChildProfile | null>(null)
  const [isLoadingRegistrationCode, setLoadingRegistrationCode] = useState(false)
  const [isGeneratingRegistrationCode, setGeneratingRegistrationCode] = useState(false)
  const [registrationCodeNotice, setRegistrationCodeNotice] = useState<string | null>(null)
  const isPetugasView = viewerRole === 'PETUGAS'
  const selectedChildRegistrationCode = selectedChild
    ? registrationCodesByChildId[selectedChild.id] ?? null
    : null

  const orderedChildren = useMemo(
    () =>
      [...childrenData].sort((left, right) =>
        left.fullName.localeCompare(right.fullName, 'id'),
      ),
    [childrenData],
  )

  const childStatusSummary = useMemo(
    () =>
      childrenData.reduce(
        (summary, child) => {
          if (child.isActive === false) {
            summary.nonActive += 1
            return summary
          }

          summary.active += 1
          return summary
        },
        {
          total: childrenData.length,
          active: 0,
          nonActive: 0,
        },
      ),
    [childrenData],
  )

  const headerDescription =
    viewerRole === 'ADMIN'
      ? `${childStatusSummary.total} terdaftar | ${childStatusSummary.active} aktif | ${childStatusSummary.nonActive} non-aktif`
      : `${childrenData.length} anak terdaftar`

  const filteredChildren = useMemo(() => {
    if (!searchQuery.trim()) return orderedChildren
    const q = searchQuery.toLowerCase()
    return orderedChildren.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.nickName.toLowerCase().includes(q),
    )
  }, [orderedChildren, searchQuery])

  const setField = <K extends keyof ChildProfileInput>(
    key: K,
    value: ChildProfileInput[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => removeErrorKey(prev, String(key)))
    setSaveError(null)
  }

  const resetForm = () => {
    setForm(createInitialForm())
    setErrors({})
    setSaveError(null)
    setEditingId(null)
    setPickupInput('')
  }

  const openAddModal = () => {
    if (!canManageData) return
    resetForm()
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    resetForm()
  }

  const addPickupPerson = () => {
    const candidate = pickupInput.trim()
    if (!candidate) return
    if (form.pickupPersons.some((p) => p.toLowerCase() === candidate.toLowerCase())) {
      setPickupInput('')
      return
    }
    setField('pickupPersons', [...form.pickupPersons, candidate])
    setPickupInput('')
  }

  const removePickupPerson = (name: string) => {
    setField('pickupPersons', form.pickupPersons.filter((p) => p !== name))
  }

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      setField('photoDataUrl', (e.target?.result as string) || '')
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canManageData || !onSave) return
    setSaveError(null)
    const normalized: ChildProfileInput = {
      ...form,
      pickupPersons: form.pickupPersons.map((p) => p.trim()).filter(Boolean),
      email: form.email.trim(),
    }
    const strictErrors = viewerRole === 'ADMIN' ? validateAdminMandatoryFields(normalized) : {}
    if (Object.keys(strictErrors).length > 0) {
      setErrors(strictErrors)
      setSaveError(
        'Semua field wajib diisi kecuali Alergi dan field pada bagian Kebiasaan Sehari-hari.',
      )
      return
    }

    const nextErrors = validateChildProfileInput(normalized)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    const success = await onSave(normalized, editingId ?? undefined)
    if (success) {
      closeModal()
      return
    }
    setSaveError('Gagal menyimpan data anak. Periksa koneksi database atau field yang diisi.')
  }

  const handleEdit = (record: ChildProfile, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!canManageData) return
    const { id, createdAt, updatedAt, ...input } = record
    void createdAt
    void updatedAt
    setSelectedChild(null)
    setForm(input)
    setErrors({})
    setEditingId(id)
    setPickupInput('')
    setModalOpen(true)
  }

  const handleDelete = async (record: ChildProfile, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!canManageData || !onDelete) return
    const confirmed = await onRequestConfirm({
      title: 'Hapus Data Anak',
      message: `Hapus data anak "${record.fullName}" dari daftar?`,
      confirmLabel: 'Ya, Hapus',
      cancelLabel: 'Batal',
      tone: 'danger',
    })
    if (!confirmed) return
    const success = await onDelete(record.id)
    if (!success) {
      return
    }
    if (editingId === record.id) {
      resetForm()
      setModalOpen(false)
    }
    if (selectedChild?.id === record.id) {
      setSelectedChild(null)
    }
  }

  const loadRegistrationCodeForChild = async (childId: string) => {
    if (viewerRole !== 'ADMIN' || !onLoadRegistrationCode) {
      return
    }

    setLoadingRegistrationCode(true)
    try {
      await onLoadRegistrationCode(childId)
    } finally {
      setLoadingRegistrationCode(false)
    }
  }

  const handleSelectChild = (child: ChildProfile) => {
    setSelectedChild(child)
    setRegistrationCodeNotice(null)
    void loadRegistrationCodeForChild(child.id)
  }

  const handleGenerateRegistrationCode = async () => {
    if (!selectedChild || !onGenerateRegistrationCode || selectedChildRegistrationCode) {
      return
    }

    setGeneratingRegistrationCode(true)
    setRegistrationCodeNotice(null)
    const success = await onGenerateRegistrationCode(selectedChild.id)
    setGeneratingRegistrationCode(false)
    if (success) {
      setRegistrationCodeNotice('Kode registrasi berhasil dibuat untuk anak ini.')
      return
    }
    setRegistrationCodeNotice('Gagal membuat kode registrasi.')
  }

  const handleCopyRegistrationCode = async () => {
    const code = selectedChildRegistrationCode?.code
    if (!code) {
      return
    }

    try {
      await navigator.clipboard.writeText(code)
      setRegistrationCodeNotice('Kode registrasi berhasil disalin.')
    } catch {
      setRegistrationCodeNotice('Gagal menyalin kode registrasi.')
    }
  }

  const getParentName = (child: ChildProfile): string => {
    const mother = displayText(child.motherName, '')
    if (mother) return mother
    const father = displayText(child.fatherName, '')
    return father || '-'
  }

  const getWhatsAppNumber = (child: ChildProfile): string => {
    const whatsapp = displayText(child.whatsappNumber, '')
    if (whatsapp) return whatsapp
    const homePhone = displayText(child.homePhone, '')
    if (homePhone) return homePhone
    return displayText(child.otherPhone, '')
  }

  //  Detail View 
  if (selectedChild) {
    const child = selectedChild
    const waNumber = getWhatsAppNumber(child)

    return (
      <section className="page">
        <div className="card">
          <button
            type="button"
            className="button button--ghost"
            onClick={() => setSelectedChild(null)}
            style={{ marginBottom: '1rem' }}
          >
            Kembali ke Daftar Anak
          </button>

          <div className="child-detail-header">
            <div className="child-detail-photo-wrap">
              {child.photoDataUrl ? (
                <img src={child.photoDataUrl} alt={child.fullName} className="child-detail-photo" />
              ) : (
                <div className="child-detail-avatar">
                  {(child.nickName || child.fullName).charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <h2 style={{ margin: 0 }}>{child.fullName}</h2>
              <div style={{ margin: '0.4rem 0 0', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="detail-pill detail-pill--blue">
                  {child.nickName}
                </span>
                <span className="detail-pill detail-pill--green">
                  {calculateAge(child.birthDate)}
                </span>
                <span className={`detail-pill ${child.gender === 'P' ? 'detail-pill--pink' : 'detail-pill--purple'}`}>
                  {child.gender === 'P' ? 'Perempuan' : 'Laki-laki'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="section-title">Biodata</div>
          <div className="detail-grid">
            <div className="detail-item"><span className="detail-label">Tempat Lahir</span><span className="detail-value">{displayText(child.birthPlace)}</span></div>
            <div className="detail-item"><span className="detail-label">Tanggal Lahir</span><span className="detail-value">{formatDate(child.birthDate)}</span></div>
            <div className="detail-item"><span className="detail-label">Anak Ke</span><span className="detail-value">{displayText(child.childOrder)}</span></div>
            <div className="detail-item"><span className="detail-label">Agama</span><span className="detail-value">{child.religion}</span></div>
            <div className="detail-item"><span className="detail-label">Alergi</span><span className="detail-value">{child.allergy || 'Tidak ada'}</span></div>
            <div className="detail-item"><span className="detail-label">Kegiatan Luar</span><span className="detail-value">{displayText(child.outsideActivities)}</span></div>
          </div>
        </div>

        <div className="card">
          {isPetugasView ? (
            <>
              <div className="section-title">Data Pengantar dan Penjemput</div>
              <div className="detail-grid">
                <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                  <span className="detail-label">Daftar Pengantar & Penjemput</span>
                  <div className="detail-value" style={{ marginTop: '0.4rem' }}>
                    {child.pickupPersons && child.pickupPersons.length > 0 ? (
                      <div className="chips">
                        {child.pickupPersons.map((p) => (
                          <span key={p} className="chip">{p}</span>
                        ))}
                      </div>
                    ) : (
                      '-'
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="section-title">Data Orangtua</div>
              <div className="detail-grid">
                <div className="detail-item"><span className="detail-label">Nama Ayah</span><span className="detail-value">{displayText(child.fatherName)}</span></div>
                <div className="detail-item"><span className="detail-label">Nama Ibu</span><span className="detail-value">{displayText(child.motherName)}</span></div>
                <div className="detail-item"><span className="detail-label">Email</span><span className="detail-value">{displayText(child.email)}</span></div>
                <div className="detail-item"><span className="detail-label">No. WhatsApp</span><span className="detail-value">{displayText(child.whatsappNumber || child.homePhone)}</span></div>
                <div className="detail-item"><span className="detail-label">No. Lain</span><span className="detail-value">{displayText(child.otherPhone)}</span></div>
                <div className="detail-item"><span className="detail-label">Alamat Rumah</span><span className="detail-value">{displayText(child.homeAddress)}</span></div>
                <div className="detail-item"><span className="detail-label">Alamat Kantor</span><span className="detail-value">{displayText(child.officeAddress)}</span></div>
              </div>
              {waNumber ? (
                <a href={formatWhatsAppLink(waNumber)} target="_blank" rel="noopener noreferrer"
                  className="button" style={{ marginTop: '0.8rem', background: '#25d366', borderColor: '#25d366', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.241-.579-.486-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Hubungi via WhatsApp
                </a>
              ) : null}
            </>
          )}
        </div>

        <div className="card">
          <div className="section-title">Layanan</div>
          <div className="detail-grid">
            <div className="detail-item"><span className="detail-label">Paket</span><span className="detail-value">{child.servicePackage}</span></div>
            <div className="detail-item"><span className="detail-label">Jam Datang</span><span className="detail-value">{displayText(child.arrivalTime)}</span></div>
            <div className="detail-item"><span className="detail-label">Jam Pulang</span><span className="detail-value">{displayText(child.departureTime)}</span></div>
            <div className="detail-item"><span className="detail-label">Tujuan Menitipkan</span><span className="detail-value">{displayText(child.depositPurpose)}</span></div>
            <div className="detail-item"><span className="detail-label">Pengantar & Penjemput</span><span className="detail-value">{child.pickupPersons.length > 0 ? child.pickupPersons.join(', ') : '-'}</span></div>
          </div>
        </div>

        {viewerRole === 'ADMIN' ? (
          <div className="card">
            <div className="section-title">Kode Registrasi Orang Tua</div>
            {isLoadingRegistrationCode ? (
              <p className="card__description">Memuat kode registrasi...</p>
            ) : selectedChildRegistrationCode ? (
              <>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Kode Aktif</span>
                    <span className="detail-value" style={{ fontSize: '1.15rem', fontWeight: 700, letterSpacing: '0.08em' }}>
                      {selectedChildRegistrationCode.code}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Status</span>
                    <span className="detail-value">{selectedChildRegistrationCode.status}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Diklaim Pada</span>
                    <span className="detail-value">{selectedChildRegistrationCode.claimedAt ? formatDate(selectedChildRegistrationCode.claimedAt) : '-'}</span>
                  </div>
                </div>
                <p className="card__description" style={{ marginTop: '0.8rem' }}>
                  Kode ini diberikan ke orang tua untuk membuat akun atau menambahkan anak ke akun yang sudah ada.
                </p>
              </>
            ) : (
              <p className="card__description">
                Belum ada kode registrasi untuk anak ini.
              </p>
            )}

            {registrationCodeNotice ? (
              <p className="card__description" style={{ marginTop: '0.8rem', color: '#0f766e' }}>
                {registrationCodeNotice}
              </p>
            ) : null}

            <div className="form-actions" style={{ marginTop: '1rem' }}>
              {!selectedChildRegistrationCode ? (
                <button
                  type="button"
                  className="button"
                  onClick={() => void handleGenerateRegistrationCode()}
                  disabled={isGeneratingRegistrationCode}
                >
                  {isGeneratingRegistrationCode ? 'Memproses...' : 'Generate Kode'}
                </button>
              ) : null}
              {selectedChildRegistrationCode ? (
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => void handleCopyRegistrationCode()}
                >
                  Salin Kode
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="card">
          <div className="section-title">Perkembangan Kondisi Anak</div>
          <div className="detail-grid">
            <div className="detail-item"><span className="detail-label">Masa Prenatal</span><span className="detail-value">{displayText(child.prenatalPeriod)}</span></div>
            <div className="detail-item"><span className="detail-label">Masa Partus</span><span className="detail-value">{displayText(child.partusPeriod)}</span></div>
            <div className="detail-item"><span className="detail-label">Masa Post-natal</span><span className="detail-value">{displayText(child.postNatalPeriod)}</span></div>
            <div className="detail-item"><span className="detail-label">Motorik</span><span className="detail-value">{displayText(child.motorSkill)}</span></div>
            <div className="detail-item"><span className="detail-label">Bahasa</span><span className="detail-value">{displayText(child.languageSkill)}</span></div>
            <div className="detail-item"><span className="detail-label">Riwayat Kesehatan</span><span className="detail-value">{displayText(child.healthHistory)}</span></div>
          </div>
        </div>

        <div className="card">
          <div className="section-title">Kebiasaan Sehari-hari</div>
          <div className="detail-grid">
            <div className="detail-item"><span className="detail-label">Toilet BAB</span><span className="detail-value">{displayText(child.toiletTrainingBab)}</span></div>
            <div className="detail-item"><span className="detail-label">Toilet BAK</span><span className="detail-value">{displayText(child.toiletTrainingBak)}</span></div>
            <div className="detail-item"><span className="detail-label">Mandi</span><span className="detail-value">{displayText(child.toiletTrainingBath)}</span></div>
            <div className="detail-item"><span className="detail-label">Gosok Gigi</span><span className="detail-value">{displayText(child.brushingTeeth)}</span></div>
            <div className="detail-item"><span className="detail-label">Makan</span><span className="detail-value">{displayText(child.eating)}</span></div>
            <div className="detail-item"><span className="detail-label">Minum Susu</span><span className="detail-value">{displayText(child.drinkingMilk)}</span></div>
            <div className="detail-item"><span className="detail-label">Saat Menangis</span><span className="detail-value">{displayText(child.whenCrying)}</span></div>
            <div className="detail-item"><span className="detail-label">Saat Bermain</span><span className="detail-value">{displayText(child.whenPlaying)}</span></div>
            <div className="detail-item"><span className="detail-label">Tidur</span><span className="detail-value">{displayText(child.sleeping)}</span></div>
            <div className="detail-item"><span className="detail-label">Lain-lain</span><span className="detail-value">{displayText(child.otherHabits)}</span></div>
          </div>
        </div>

        {canManageData ? (
          <div className="card">
            <div className="form-actions">
              <button type="button" className="button button--ghost" onClick={(e) => handleEdit(child, e)}>
                Edit Data
              </button>
              <button type="button" className="button button--danger" onClick={(e) => handleDelete(child, e)}>
                Hapus Data
              </button>
            </div>
          </div>
        ) : null}
      </section>
    )
  }

  //  Card List View 
  return (
    <section className="page">
      <div className="card">
        <div className="child-page-header">
          <div>
            <h2>Data Anak</h2>
            <p className="card__description">{headerDescription}</p>
          </div>
          {canManageData ? (
            <button type="button" className="button" onClick={openAddModal}>
              + Tambah Anak
            </button>
          ) : null}
        </div>
        {childrenData.length > 0 ? (
          <div className="field-group" style={{ marginTop: '0.6rem' }}>
            <input className="input" placeholder="Cari nama anak..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        ) : null}
      </div>

      {filteredChildren.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <p>{childrenData.length === 0
              ? (canManageData
                ? 'Belum ada data anak. Klik "Tambah Anak" untuk memulai.'
                : 'Belum ada data anak terdaftar.')
              : 'Tidak ada anak yang cocok dengan pencarian.'}</p>
          </div>
        </div>
      ) : (
        <div className="ktp-card-list">
          {filteredChildren.map((child) => {
            const waNumber = getWhatsAppNumber(child)
            return (
              <div key={child.id} className="ktp-card" onClick={() => handleSelectChild(child)}>
                {/* Top section: Photo + Info */}
                <div className="ktp-card__top">
                  <div className="ktp-card__photo-wrap">
                    {child.photoDataUrl ? (
                      <img src={child.photoDataUrl} alt={child.fullName} className="ktp-card__photo" />
                    ) : (
                      <div className="ktp-card__avatar">
                        {(child.nickName || child.fullName).charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="ktp-card__info">
                    <h3 className="ktp-card__name">{child.nickName || child.fullName}</h3>
                    <p className="ktp-card__meta">{formatDate(child.birthDate)}</p>
                    <p className="ktp-card__meta">
                      {isPetugasView
                        ? (child.pickupPersons.length > 0 ? child.pickupPersons.join(', ') : 'Belum ada penjemput')
                        : getParentName(child)}
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <div className="ktp-card__divider" />

                {/* Bottom section: Allergy + WhatsApp */}
                <div className="ktp-card__bottom">
                  <div className="ktp-card__bottom-left">
                    {child.allergy ? (
                      <span className="ktp-card__allergy">! {child.allergy}</span>
                    ) : (
                      <span className="ktp-card__no-allergy">Tidak ada alergi</span>
                    )}

                    {waNumber && !isPetugasView ? (
                      <a
                        href={formatWhatsAppLink(waNumber)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ktp-card__wa-link"
                        onClick={(e) => e.stopPropagation()}
                        title={`Chat WhatsApp ${waNumber}`}
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.241-.579-.486-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        Hubungi
                      </a>
                    ) : null}
                  </div>

                </div>
              </div>
            )
          })}
        </div>
      )}

      {/*  Modal Form  */}
      {canManageData && isModalOpen ? (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="modal-content modal-content--large">
            <div className="modal-header">
              <h2>{editingId ? 'Edit Data Anak' : 'Tambah Anak Baru'}</h2>
              <button type="button" className="modal-close" onClick={closeModal}>x</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              {/* Photo Upload */}
              <div className="child-photo-upload">
                <label
                  className={`child-photo-upload__frame${form.photoDataUrl ? ' child-photo-upload__frame--filled' : ''}`}
                  aria-label={form.photoDataUrl ? 'Klik untuk ganti foto anak' : 'Klik untuk upload foto anak'}
                >
                  {form.photoDataUrl ? (
                    <img src={form.photoDataUrl} alt="Preview foto anak" className="child-photo-upload__preview" />
                  ) : (
                    <div className="child-photo-upload__placeholder">Klik untuk upload foto</div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="child-photo-upload__input"
                    onChange={handlePhotoUpload}
                  />
                </label>
                <p className="child-photo-upload__hint">
                  {form.photoDataUrl ? 'Klik frame untuk ganti foto' : 'Klik frame untuk menambahkan foto'}
                </p>
                {form.photoDataUrl ? (
                  <button
                    type="button"
                    className="button button--tiny button--danger child-photo-upload__remove"
                    onClick={() => setField('photoDataUrl', '')}
                  >
                    Hapus Foto
                  </button>
                ) : null}
              </div>

              <div className="section-title">Data Anak</div>
              <div className="form-grid form-grid--3">
                <div className="field-group">
                  <label className="label" htmlFor="fullName">Nama lengkap</label>
                  <input id="fullName" className="input" value={form.fullName}
                    onChange={(e) => setField('fullName', e.target.value)} />
                  {errors.fullName ? <p className="field-error">{errors.fullName}</p> : null}
                </div>
                <div className="field-group">
                  <label className="label" htmlFor="nickName">Nama panggilan</label>
                  <input id="nickName" className="input" value={form.nickName}
                    onChange={(e) => setField('nickName', e.target.value)} />
                  {errors.nickName ? <p className="field-error">{errors.nickName}</p> : null}
                </div>
                <div className="field-group">
                  <label className="label" htmlFor="gender">Jenis Kelamin</label>
                  <select id="gender" className="input" value={form.gender}
                    onChange={(e) => setField('gender', e.target.value)}>
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>
                <div className="field-group">
                  <label className="label" htmlFor="childOrder">Anak ke</label>
                  <input id="childOrder" className="input" value={form.childOrder}
                    onChange={(e) => setField('childOrder', e.target.value)} />
                </div>
                <div className="field-group">
                  <label className="label" htmlFor="birthPlace">Tempat lahir</label>
                  <input id="birthPlace" className="input" value={form.birthPlace}
                    onChange={(e) => setField('birthPlace', e.target.value)} />
                </div>
                <div className="field-group">
                  <label className="label" htmlFor="birthDate">Tanggal lahir</label>
                  <AppDatePickerField
                    id="birthDate"
                    value={form.birthDate}
                    max={getLocalDateIso()}
                    onChange={(value) => setField('birthDate', value)}
                  />
                  {errors.birthDate ? <p className="field-error">{errors.birthDate}</p> : null}
                </div>
                <div className="field-group">
                  <label className="label" htmlFor="religion">Agama</label>
                  <select id="religion" className="input" value={form.religion}
                    onChange={(e) => setField('religion', e.target.value as ChildProfileInput['religion'])}>
                    {religionOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-grid form-grid--2">
                <div className="field-group">
                  <label className="label" htmlFor="allergy">Alergi</label>
                  <input id="allergy" className="input" value={form.allergy}
                    placeholder="Contoh: Susu sapi, Kacang, dll"
                    onChange={(e) => setField('allergy', e.target.value)} />
                </div>
                <div className="field-group">
                  <label className="label" htmlFor="outsideActivities">Kegiatan diluar lembaga</label>
                  <input id="outsideActivities" className="input" value={form.outsideActivities}
                    onChange={(e) => setField('outsideActivities', e.target.value)} />
                </div>
              </div>

              {isPetugasView ? (
                <>
                  <div className="section-title">Data Pengantar dan Penjemput</div>
                  <div className="field-group">
                    <label className="label">Nama pengantar & penjemput (bisa lebih dari satu)</label>
                    <div className="inline-row">
                      <input className="input" value={pickupInput}
                        onChange={(e) => setPickupInput(e.target.value)}
                        placeholder="Masukkan nama pengantar / penjemput"
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPickupPerson() } }} />
                      <button type="button" className="button button--ghost" onClick={addPickupPerson}>Tambah</button>
                    </div>
                    <div className="chips">
                      {form.pickupPersons.map((person) => (
                        <button type="button" key={person} className="chip"
                          onClick={() => removePickupPerson(person)} title="Klik untuk hapus">
                          {person} x
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="section-title">Data Orangtua</div>
                  <div className="form-grid form-grid--3">
                    <div className="field-group">
                      <label className="label" htmlFor="fatherName">Nama ayah</label>
                      <input id="fatherName" className="input" value={form.fatherName}
                        onChange={(e) => setField('fatherName', e.target.value)} />
                    </div>
                    <div className="field-group">
                      <label className="label" htmlFor="motherName">Nama ibu</label>
                      <input id="motherName" className="input" value={form.motherName}
                        onChange={(e) => setField('motherName', e.target.value)} />
                    </div>
                    <div className="field-group">
                      <label className="label" htmlFor="email">Email</label>
                      <input id="email" className="input" type="email" value={form.email}
                        onChange={(e) => setField('email', e.target.value)} />
                      {errors.email ? <p className="field-error">{errors.email}</p> : null}
                    </div>
                  </div>

                  <div className="form-grid form-grid--3">
                    <div className="field-group">
                      <label className="label" htmlFor="whatsappNumber">No. WhatsApp</label>
                      <input id="whatsappNumber" className="input" value={form.whatsappNumber}
                        placeholder="08xxxxxxxxxx"
                        onChange={(e) => setField('whatsappNumber', e.target.value)} />
                    </div>
                    <div className="field-group">
                      <label className="label" htmlFor="homePhone">No. telpon rumah</label>
                      <input id="homePhone" className="input" value={form.homePhone}
                        onChange={(e) => setField('homePhone', e.target.value)} />
                    </div>
                    <div className="field-group">
                      <label className="label" htmlFor="otherPhone">No. telpon lain</label>
                      <input id="otherPhone" className="input" value={form.otherPhone}
                        onChange={(e) => setField('otherPhone', e.target.value)} />
                    </div>
                  </div>

                  <div className="form-grid form-grid--2">
                    <div className="field-group">
                      <label className="label" htmlFor="homeAddress">Alamat rumah</label>
                      <textarea id="homeAddress" className="textarea" rows={2} value={form.homeAddress}
                        onChange={(e) => setField('homeAddress', e.target.value)} />
                    </div>
                    <div className="field-group">
                      <label className="label" htmlFor="officeAddress">Alamat kantor</label>
                      <textarea id="officeAddress" className="textarea" rows={2} value={form.officeAddress}
                        onChange={(e) => setField('officeAddress', e.target.value)} />
                    </div>
                  </div>
                </>
              )}

              <div className="section-title">Lain-lain</div>
              <div className="form-grid form-grid--3">
                <div className="field-group">
                  <label className="label" htmlFor="servicePackage">Paket layanan</label>
                  <select id="servicePackage" className="input" value={form.servicePackage}
                    onChange={(e) => setField('servicePackage', e.target.value as ChildProfileInput['servicePackage'])}>
                    {servicePackageOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {errors.servicePackage ? <p className="field-error">{errors.servicePackage}</p> : null}
                </div>
                <div className="field-group">
                  <label className="label" htmlFor="arrivalTime">Jam datang</label>
                  <input id="arrivalTime" className="input" type="time" value={form.arrivalTime}
                    onChange={(e) => setField('arrivalTime', e.target.value)} />
                </div>
                <div className="field-group">
                  <label className="label" htmlFor="departureTime">Jam pulang</label>
                  <input id="departureTime" className="input" type="time" value={form.departureTime}
                    onChange={(e) => setField('departureTime', e.target.value)} />
                </div>
              </div>

              {!isPetugasView ? (
                <div className="field-group">
                  <label className="label">Nama pengantar & penjemput (bisa lebih dari satu)</label>
                  <div className="inline-row">
                    <input className="input" value={pickupInput}
                      onChange={(e) => setPickupInput(e.target.value)}
                      placeholder="Masukkan nama pengantar / penjemput"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPickupPerson() } }} />
                    <button type="button" className="button button--ghost" onClick={addPickupPerson}>Tambah</button>
                  </div>
                  <div className="chips">
                    {form.pickupPersons.map((person) => (
                      <button type="button" key={person} className="chip"
                        onClick={() => removePickupPerson(person)} title="Klik untuk hapus">
                        {person} x
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="field-group">
                <label className="label" htmlFor="depositPurpose">Tujuan menitipkan anak di TPA</label>
                <textarea id="depositPurpose" className="textarea" rows={2} value={form.depositPurpose}
                  onChange={(e) => setField('depositPurpose', e.target.value)} />
              </div>

              <div className="section-title">Perkembangan Kondisi Anak</div>
              <div className="form-grid form-grid--2">
                <div className="field-group">
                  <label className="label" htmlFor="prenatalPeriod">Masa prenatal</label>
                  <textarea id="prenatalPeriod" className="textarea" rows={2} value={form.prenatalPeriod}
                    onChange={(e) => setField('prenatalPeriod', e.target.value)} />
                </div>
                <div className="field-group">
                  <label className="label" htmlFor="partusPeriod">Masa partus</label>
                  <textarea id="partusPeriod" className="textarea" rows={2} value={form.partusPeriod}
                    onChange={(e) => setField('partusPeriod', e.target.value)} />
                </div>
              </div>
              <div className="form-grid form-grid--3">
                <div className="field-group">
                  <label className="label" htmlFor="postNatalPeriod">Masa post-natal</label>
                  <textarea id="postNatalPeriod" className="textarea" rows={2} value={form.postNatalPeriod}
                    onChange={(e) => setField('postNatalPeriod', e.target.value)} />
                </div>
                <div className="field-group">
                  <label className="label" htmlFor="motorSkill">Kemampuan motorik</label>
                  <textarea id="motorSkill" className="textarea" rows={2} value={form.motorSkill}
                    onChange={(e) => setField('motorSkill', e.target.value)} />
                </div>
                <div className="field-group">
                  <label className="label" htmlFor="languageSkill">Kemampuan bahasa</label>
                  <textarea id="languageSkill" className="textarea" rows={2} value={form.languageSkill}
                    onChange={(e) => setField('languageSkill', e.target.value)} />
                </div>
              </div>
              <div className="field-group">
                <label className="label" htmlFor="healthHistory">Riwayat kesehatan</label>
                <textarea id="healthHistory" className="textarea" rows={2} value={form.healthHistory}
                  onChange={(e) => setField('healthHistory', e.target.value)} />
              </div>

              <div className="section-title">Kebiasaan Sehari-hari</div>
              <div className="form-grid form-grid--3">
                <div className="field-group">
                  <label className="label" htmlFor="toiletTrainingBab">Toilet - BAB</label>
                  <input id="toiletTrainingBab" className="input" value={form.toiletTrainingBab}
                    onChange={(e) => setField('toiletTrainingBab', e.target.value)} />
                </div>
                <div className="field-group">
                  <label className="label" htmlFor="toiletTrainingBak">Toilet - BAK</label>
                  <input id="toiletTrainingBak" className="input" value={form.toiletTrainingBak}
                    onChange={(e) => setField('toiletTrainingBak', e.target.value)} />
                </div>
                <div className="field-group">
                  <label className="label" htmlFor="toiletTrainingBath">Mandi</label>
                  <input id="toiletTrainingBath" className="input" value={form.toiletTrainingBath}
                    onChange={(e) => setField('toiletTrainingBath', e.target.value)} />
                </div>
              </div>
              <div className="form-grid form-grid--3">
                <div className="field-group">
                  <label className="label" htmlFor="brushingTeeth">Gosok gigi</label>
                  <input id="brushingTeeth" className="input" value={form.brushingTeeth}
                    onChange={(e) => setField('brushingTeeth', e.target.value)} />
                </div>
                <div className="field-group">
                  <label className="label" htmlFor="eating">Makan</label>
                  <input id="eating" className="input" value={form.eating}
                    onChange={(e) => setField('eating', e.target.value)} />
                </div>
                <div className="field-group">
                  <label className="label" htmlFor="drinkingMilk">Minum susu</label>
                  <input id="drinkingMilk" className="input" value={form.drinkingMilk}
                    onChange={(e) => setField('drinkingMilk', e.target.value)} />
                </div>
              </div>
              <div className="form-grid form-grid--3">
                <div className="field-group">
                  <label className="label" htmlFor="whenCrying">Saat menangis</label>
                  <input id="whenCrying" className="input" value={form.whenCrying}
                    onChange={(e) => setField('whenCrying', e.target.value)} />
                </div>
                <div className="field-group">
                  <label className="label" htmlFor="whenPlaying">Saat bermain</label>
                  <input id="whenPlaying" className="input" value={form.whenPlaying}
                    onChange={(e) => setField('whenPlaying', e.target.value)} />
                </div>
                <div className="field-group">
                  <label className="label" htmlFor="sleeping">Tidur</label>
                  <input id="sleeping" className="input" value={form.sleeping}
                    onChange={(e) => setField('sleeping', e.target.value)} />
                </div>
              </div>
              <div className="field-group">
                <label className="label" htmlFor="otherHabits">Lain-lain</label>
                <textarea id="otherHabits" className="textarea" rows={2} value={form.otherHabits}
                  onChange={(e) => setField('otherHabits', e.target.value)} />
              </div>

              <div className="form-actions">
                {saveError ? <p className="field-error">{saveError}</p> : null}
                <button className="button" type="submit">
                  {editingId ? 'Update Data Anak' : 'Simpan Data Anak'}
                </button>
                <button className="button button--ghost" type="button" onClick={closeModal}>Batal</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default DataAnakPage





