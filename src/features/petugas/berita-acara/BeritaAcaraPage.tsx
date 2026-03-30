import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { AppDatePickerField } from '../../../components/common/DatePickerFields'
import SearchableSelect from '../../../components/common/SearchableSelect'
import {
  INCIDENT_CATEGORY_OPTIONS,
  type PrintableIncidentCategoryKey,
} from '../../../constants/incident-categories'
import type {
  ChildProfile,
  AttendanceRecord,
  IncidentCarriedItem,
  IncidentCategoryKey,
  IncidentReport,
  IncidentReportInput,
} from '../../../types'
import { getLocalDateIso } from '../../../utils/date'
import { compressImageToDataUrl } from '../../../utils/image'
import {
  type FieldErrors,
  validateIncidentReportInput,
} from '../../../utils/validators'

interface BeritaAcaraPageProps {
  childrenData: ChildProfile[]
  reports: IncidentReport[]
  attendanceRecords: AttendanceRecord[]
  staffDisplayName: string
  isTableLoading?: boolean
  onSave: (input: IncidentReportInput, editingId?: string) => Promise<boolean>
  onNavigateToDataAnak: () => void
}

const createIncidentItemId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const createEmptyMealEquipment = () => ({
  drinkingBottle: { brand: '', imageDataUrl: '', imageName: '', description: '' },
  milkBottle: { brand: '', imageDataUrl: '', imageName: '', description: '' },
  mealContainer: { brand: '', imageDataUrl: '', imageName: '', description: '' },
  snackContainer: { brand: '', imageDataUrl: '', imageName: '', description: '' },
})

const createInitialForm = (date: string): IncidentReportInput => ({
  childId: '',
  date,
  arrivalPhysicalCondition: 'sehat',
  arrivalEmotionalCondition: 'senang',
  departurePhysicalCondition: 'sehat',
  departureEmotionalCondition: 'senang',
  carriedItemsPhotoDataUrl: '',
  carriedItems: [],
  mealEquipment: createEmptyMealEquipment(),
  bathEquipment: '',
  medicines: '',
  bag: '',
  parentMessage: '',
  messageForParent: '',
  notes: '',
  arrivalSignatureDataUrl: '',
  departureSignatureDataUrl: '',
})

const physicalConditionOptions: Array<{
  value: IncidentReportInput['arrivalPhysicalCondition']
  label: string
}> = [
    { value: 'sehat', label: 'Sehat' },
    { value: 'sakit', label: 'Sakit' },
  ]

const emotionalConditionOptions: Array<{
  value: IncidentReportInput['arrivalEmotionalCondition']
  label: string
}> = [
    { value: 'senang', label: 'Senang' },
    { value: 'sedih', label: 'Sedih' },
  ]

const incidentCategoryOptions = INCIDENT_CATEGORY_OPTIONS.map((option) => ({
  value: option.key,
  label: option.label,
}))

const removeErrorKey = (errors: FieldErrors, key: string): FieldErrors => {
  if (!errors[key]) {
    return errors
  }
  const next = { ...errors }
  delete next[key]
  return next
}

const clearCarriedItemsErrors = (errors: FieldErrors): FieldErrors => {
  const next = { ...errors }
  if (next.carriedItems) {
    delete next.carriedItems
  }
  Object.keys(next).forEach((key) => {
    if (key.startsWith('carriedItems_')) {
      delete next[key]
    }
  })
  return next
}

const formatReadableDate = (isoDate: string): string => {
  const parsed = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return isoDate
  }
  return parsed.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

const buildLegacyIncidentFieldsFromCarriedItems = (
  carriedItems: IncidentCarriedItem[],
) => {
  const findValues = (categoryKey: PrintableIncidentCategoryKey): string =>
    carriedItems
      .filter((item) => item.categoryKey === categoryKey)
      .map((item) => item.description.trim())
      .filter(Boolean)
      .join('\n')

  const mealEquipment = createEmptyMealEquipment()
  const drinkingBottle = findValues('DRINKING_BOTTLE')
  const milkContainer = findValues('MILK_CONTAINER')
  const mealContainer = findValues('MEAL_CONTAINER')
  const snackContainer = findValues('SNACK_CONTAINER')

  mealEquipment.drinkingBottle.brand = drinkingBottle
  mealEquipment.drinkingBottle.description = drinkingBottle
  mealEquipment.milkBottle.brand = milkContainer
  mealEquipment.milkBottle.description = milkContainer
  mealEquipment.mealContainer.brand = mealContainer
  mealEquipment.mealContainer.description = mealContainer
  mealEquipment.snackContainer.brand = snackContainer
  mealEquipment.snackContainer.description = snackContainer

  return {
    mealEquipment,
    bathEquipment: findValues('BATH_SUPPLIES'),
    medicines: findValues('MEDICINE_VITAMIN'),
    bag: findValues('BAG'),
  }
}

const buildCarriedItemsFromLegacy = (record: IncidentReport): IncidentCarriedItem[] => {
  const next: IncidentCarriedItem[] = []

  const push = (
    categoryKey: PrintableIncidentCategoryKey,
    rawValue: string,
  ) => {
    const value = rawValue.trim()
    if (!value) {
      return
    }
    next.push({
      id: createIncidentItemId(),
      categoryKey,
      description: value,
    })
  }

  push(
    'DRINKING_BOTTLE',
    record.mealEquipment.drinkingBottle.description ||
    record.mealEquipment.drinkingBottle.brand ||
    '',
  )
  push(
    'MILK_CONTAINER',
    record.mealEquipment.milkBottle.description ||
    record.mealEquipment.milkBottle.brand ||
    '',
  )
  push(
    'MEAL_CONTAINER',
    record.mealEquipment.mealContainer.description ||
    record.mealEquipment.mealContainer.brand ||
    '',
  )
  push(
    'SNACK_CONTAINER',
    record.mealEquipment.snackContainer.description ||
    record.mealEquipment.snackContainer.brand ||
    '',
  )
  push('BATH_SUPPLIES', record.bathEquipment || '')
  push('MEDICINE_VITAMIN', record.medicines || '')
  push('BAG', record.bag || '')
  return next
}

const BeritaAcaraPage = ({
  childrenData,
  reports,
  attendanceRecords,
  staffDisplayName,
  isTableLoading = false,
  onSave,
  onNavigateToDataAnak,
}: BeritaAcaraPageProps) => {
  const [todayDate, setTodayDate] = useState<string>(() => getLocalDateIso())
  const [historyDateFilter, setHistoryDateFilter] = useState<string>(() =>
    getLocalDateIso(),
  )
  const [historyChildFilter, setHistoryChildFilter] = useState<string>('')
  const [historyPage, setHistoryPage] = useState<number>(1)
  const HISTORY_PAGE_SIZE = 20
  const [form, setForm] = useState<IncidentReportInput>(() =>
    createInitialForm(getLocalDateIso()),
  )
  const [errors, setErrors] = useState<FieldErrors>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isPhotoUploading, setPhotoUploading] = useState(false)
  const [photoUploadError, setPhotoUploadError] = useState<string>('')
  const [previewReport, setPreviewReport] = useState<IncidentReport | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [currentHour, setCurrentHour] = useState<number>(() => new Date().getHours())

  const hasChildren = childrenData.length > 0
  const incidentTargetDate = editingId ? form.date : todayDate
  const companionLabel = currentHour >= 12 ? 'Pendamping sore' : 'Pendamping pagi'
  const resolvedStaffDisplayName = staffDisplayName.trim() || '-'
  const arrivedChildIds = useMemo(
    () =>
      new Set(
        attendanceRecords
          .filter((record) => record.date === incidentTargetDate && Boolean(record.arrivalTime))
          .map((record) => record.childId),
      ),
    [attendanceRecords, incidentTargetDate],
  )

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setTodayDate((previous) => {
        const nextDate = getLocalDateIso()
        return previous === nextDate ? previous : nextDate
      })
      const nextHour = new Date().getHours()
      setCurrentHour((previous) => (previous === nextHour ? previous : nextHour))
    }, 30_000)

    return () => {
      window.clearInterval(timerId)
    }
  }, [])

  useEffect(() => {
    if (editingId) {
      return
    }
    setForm((previous) =>
      previous.date === todayDate ? previous : { ...previous, date: todayDate },
    )
  }, [todayDate, editingId])

  const childNameById = (id: string): string => {
    const child = childrenData.find((item) => item.id === id)
    return child ? child.fullName : 'Data anak dihapus'
  }

  const filteredReports = useMemo(
    () =>
      [...reports]
        .filter((record) => {
          if (historyDateFilter) {
            return record.date === historyDateFilter
          }
          // Jika tanggal tidak dipilih, default ke bulan berjalan (current month)
          const currentMonthKey = todayDate.slice(0, 7)
          return record.date.startsWith(currentMonthKey)
        })
        .filter((record) =>
          historyChildFilter ? record.childId === historyChildFilter : true,
        )
        .sort((left, right) =>
          `${right.date}${right.createdAt}`.localeCompare(
            `${left.date}${left.createdAt}`,
            'id',
          ),
        ),
    [reports, historyDateFilter, historyChildFilter, todayDate],
  )

  const historyTotalPages = Math.max(1, Math.ceil(filteredReports.length / HISTORY_PAGE_SIZE))
  const paginatedReports = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE
    return filteredReports.slice(start, start + HISTORY_PAGE_SIZE)
  }, [filteredReports, historyPage])

  const selectableChildOptions = useMemo(
    () =>
      childrenData
        .slice()
        .sort((left, right) => left.fullName.localeCompare(right.fullName, 'id'))
        .map((child) => ({
          value: child.id,
          label: child.fullName,
          badge: arrivedChildIds.has(child.id) ? 'Hadir' : undefined,
        })),
    [arrivedChildIds, childrenData],
  )

  const historyChildOptions = useMemo(
    () =>
      childrenData.map((child) => ({
        value: child.id,
        label: child.fullName,
      })),
    [childrenData],
  )

  const parentMessageFromAttendance = useMemo(() => {
    if (!form.childId) {
      return ''
    }
    const attendance = attendanceRecords.find(
      (record) =>
        record.childId === form.childId &&
        record.date === incidentTargetDate &&
        Boolean(record.arrivalTime),
    )
    return attendance?.parentMessage?.trim() ?? ''
  }, [attendanceRecords, form.childId, incidentTargetDate])

  useEffect(() => {
    if (editingId) {
      return
    }
    setForm((previous) =>
      previous.parentMessage === parentMessageFromAttendance
        ? previous
        : { ...previous, parentMessage: parentMessageFromAttendance },
    )
  }, [editingId, parentMessageFromAttendance])

  const setField = <K extends keyof IncidentReportInput>(
    key: K,
    value: IncidentReportInput[K],
  ) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }))
    setErrors((previous) => removeErrorKey(previous, String(key)))
  }

  const addCarriedItem = () => {
    setForm((previous) => ({
      ...previous,
      carriedItems: [
        ...previous.carriedItems,
        {
          id: createIncidentItemId(),
          categoryKey: 'DRINKING_BOTTLE',
          description: '',
        },
      ],
    }))
    setErrors((previous) => clearCarriedItemsErrors(previous))
  }

  const updateCarriedItem = (
    itemId: string,
    patch: Partial<IncidentCarriedItem>,
  ) => {
    setForm((previous) => ({
      ...previous,
      carriedItems: previous.carriedItems.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item,
      ),
    }))
    setErrors((previous) => clearCarriedItemsErrors(previous))
  }

  const removeCarriedItem = (itemId: string) => {
    setForm((previous) => ({
      ...previous,
      carriedItems: previous.carriedItems.filter((item) => item.id !== itemId),
    }))
    setErrors((previous) => clearCarriedItemsErrors(previous))
  }

  const resetForm = () => {
    setForm(createInitialForm(todayDate))
    setErrors({})
    setPhotoUploadError('')
    setEditingId(null)
  }

  const triggerPhotoInput = () => {
    if (isPhotoUploading) {
      return
    }
    photoInputRef.current?.click()
  }

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setPhotoUploading(true)
    setPhotoUploadError('')

    try {
      const compressed = await compressImageToDataUrl(file, {
        maxDimension: 1600,
        quality: 0.78,
      })
      setField('carriedItemsPhotoDataUrl', compressed.dataUrl)
      setErrors((previous) => removeErrorKey(previous, 'carriedItemsPhotoDataUrl'))
    } catch (error) {
      setPhotoUploadError(
        error instanceof Error ? error.message : 'Gagal mengunggah foto barang',
      )
    } finally {
      setPhotoUploading(false)
      if (photoInputRef.current) {
        photoInputRef.current.value = ''
      }
    }
  }

  const clearPhoto = () => {
    setField('carriedItemsPhotoDataUrl', '')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedCarriedItems = form.carriedItems.map((item) => ({
      ...item,
      description: item.description.trim(),
    }))
    const validationInput: IncidentReportInput = {
      ...form,
      date: incidentTargetDate,
      carriedItems: normalizedCarriedItems,
    }

    const nextErrors = validateIncidentReportInput(validationInput)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    const legacyFields = buildLegacyIncidentFieldsFromCarriedItems(
      normalizedCarriedItems,
    )

    const submissionForm: IncidentReportInput = {
      ...validationInput,
      ...legacyFields,
      date: incidentTargetDate,
    }

    const success = await onSave(submissionForm, editingId ?? undefined)
    if (success) {
      setForm(createInitialForm(todayDate))
      setErrors({})
      setEditingId(null)
      setPhotoUploadError('')
    }
  }

  const handleEdit = (record: IncidentReport) => {
    const { id, createdAt, updatedAt, ...input } = record
    void createdAt
    void updatedAt

    const carriedItems =
      Array.isArray(record.carriedItems) && record.carriedItems.length > 0
        ? record.carriedItems.map((item) => ({
          ...item,
          id: item.id || createIncidentItemId(),
          description: item.description || '',
        }))
        : buildCarriedItemsFromLegacy(record)

    setForm({
      ...input,
      carriedItems,
      carriedItemsPhotoDataUrl: input.carriedItemsPhotoDataUrl || '',
      mealEquipment: input.mealEquipment || createEmptyMealEquipment(),
      bathEquipment: input.bathEquipment || '',
      medicines: input.medicines || '',
      bag: input.bag || '',
    })
    setErrors({})
    setPhotoUploadError('')
    setEditingId(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const isSaveDisabled = !hasChildren || !form.childId

  const renderTableLoadingRows = (
    columnCount: number,
    rowCount: number,
    keyPrefix: string,
  ) =>
    Array.from({ length: rowCount }, (_, rowIndex) => (
      <tr key={`${keyPrefix}-${rowIndex}`}>
        {Array.from({ length: columnCount }, (_, columnIndex) => (
          <td
            key={`${keyPrefix}-${rowIndex}-${columnIndex}`}
            className="table__skeleton-cell"
          >
            <span
              className={`table__skeleton-line ${columnIndex % 3 === 0
                ? 'table__skeleton-line--short'
                : columnIndex % 3 === 1
                  ? 'table__skeleton-line--medium'
                  : 'table__skeleton-line--long'
                }`}
            />
          </td>
        ))}
      </tr>
    ))

  const renderMinimumRows = (
    currentCount: number,
    columnCount: number,
    keyPrefix: string,
    minRows = 3
  ) => {
    if (currentCount >= minRows) return null
    return Array.from({ length: minRows - currentCount }, (_, index) => (
      <tr key={`${keyPrefix}-empty-${index}`} className="table__empty-row">
        {Array.from({ length: columnCount }, (_, colIndex) => (
          <td key={`${keyPrefix}-empty-${index}-${colIndex}`} className="table__empty-cell">
            &nbsp;
          </td>
        ))}
      </tr>
    ))
  }

  return (
    <section className="page">
      <div className="card">
        <h2>Berita Acara</h2>
        <p className="card__description">
          Pencatatan kondisi anak, barang bawaan, dan pesan orangtua serta pesan untuk orang tua.
        </p>

        {!hasChildren ? (
          <div className="empty-state">
            <p>Data anak masih kosong. Tambahkan data anak terlebih dahulu.</p>
            <button
              type="button"
              className="button"
              onClick={onNavigateToDataAnak}
            >
              Buka Menu Data Anak
            </button>
          </div>
        ) : null}

        <form id="tour-berita-acara-form" onSubmit={handleSubmit}>
          <fieldset className="fieldset" disabled={!hasChildren}>
            <div className="field-group" style={{ marginBottom: '0.9rem' }}>
              <label className="label" htmlFor="incidentDateReadonly">
                Hari/Tanggal
              </label>
              <input
                id="incidentDateReadonly"
                className="input input--locked"
                value={formatReadableDate(incidentTargetDate)}
                readOnly
              />
              <p className="field-hint">
                {editingId
                  ? 'Mode edit memakai tanggal data yang dipilih.'
                  : 'Tanggal ini diisi otomatis oleh sistem.'}
              </p>
            </div>

            <div className="form-grid form-grid--2">
              <div className="field-group">
                <label className="label">Nama anak</label>
                <SearchableSelect
                  value={form.childId}
                  onChange={(value) => setField('childId', value)}
                  options={selectableChildOptions}
                  placeholder="Pilih nama anak"
                  emptyMessage="Tidak ada anak yang tersedia"
                  clearable={false}
                />
                {errors.childId ? <p className="field-error">{errors.childId}</p> : null}
              </div>
              <div className="field-group">
                <label className="label">{companionLabel}</label>
                <input className="input input--locked" value={resolvedStaffDisplayName} readOnly />
              </div>
            </div>

            <div className="section-title">Kondisi Anak</div>
            <div className="form-grid form-grid--2">
              <div className="field-group">
                <label className="label">Datang - Kondisi Fisik</label>
                <SearchableSelect
                  value={form.arrivalPhysicalCondition}
                  onChange={(value) =>
                    setField(
                      'arrivalPhysicalCondition',
                      value as IncidentReportInput['arrivalPhysicalCondition'],
                    )
                  }
                  options={physicalConditionOptions}
                  placeholder="Pilih kondisi fisik"
                  searchable={false}
                  clearable={false}
                />
              </div>
              <div className="field-group">
                <label className="label">Datang - Kondisi Emosi</label>
                <SearchableSelect
                  value={form.arrivalEmotionalCondition}
                  onChange={(value) =>
                    setField(
                      'arrivalEmotionalCondition',
                      value as IncidentReportInput['arrivalEmotionalCondition'],
                    )
                  }
                  options={emotionalConditionOptions}
                  placeholder="Pilih kondisi emosi"
                  searchable={false}
                  clearable={false}
                />
              </div>
              <div className="field-group">
                <label className="label">Pulang - Kondisi Fisik</label>
                <SearchableSelect
                  value={form.departurePhysicalCondition}
                  onChange={(value) =>
                    setField(
                      'departurePhysicalCondition',
                      value as IncidentReportInput['departurePhysicalCondition'],
                    )
                  }
                  options={physicalConditionOptions}
                  placeholder="Pilih kondisi fisik"
                  searchable={false}
                  clearable={false}
                />
              </div>
              <div className="field-group">
                <label className="label">Pulang - Kondisi Emosi</label>
                <SearchableSelect
                  value={form.departureEmotionalCondition}
                  onChange={(value) =>
                    setField(
                      'departureEmotionalCondition',
                      value as IncidentReportInput['departureEmotionalCondition'],
                    )
                  }
                  options={emotionalConditionOptions}
                  placeholder="Pilih kondisi emosi"
                  searchable={false}
                  clearable={false}
                />
              </div>
            </div>
            <div className="section-title">Foto Gabungan Barang Bawaan</div>
            <div className="incident-photo-card">
              <div className="incident-photo-preview">
                {form.carriedItemsPhotoDataUrl ? (
                  <img src={form.carriedItemsPhotoDataUrl} alt="Foto gabungan barang" />
                ) : (
                  <p>Belum ada foto barang</p>
                )}
              </div>
              <div className="incident-photo-actions">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  hidden
                />
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={triggerPhotoInput}
                  disabled={isPhotoUploading}
                >
                  {isPhotoUploading
                    ? 'Mengunggah...'
                    : form.carriedItemsPhotoDataUrl
                      ? 'Ganti Foto'
                      : 'Upload Foto'}
                </button>
                {form.carriedItemsPhotoDataUrl ? (
                  <button
                    type="button"
                    className="button button--danger"
                    onClick={clearPhoto}
                    disabled={isPhotoUploading}
                  >
                    Hapus Foto
                  </button>
                ) : null}
              </div>
              {errors.carriedItemsPhotoDataUrl ? (
                <p className="field-error">{errors.carriedItemsPhotoDataUrl}</p>
              ) : null}
              {photoUploadError ? <p className="field-error">{photoUploadError}</p> : null}
              <p className="field-hint">
                Foto ini disimpan sebagai dokumentasi, tetapi tidak dicetak di PDF berita acara.
              </p>
            </div>

            <div className="section-title">Daftar Barang Bawaan</div>
            <div className="incident-items-list">
              {form.carriedItems.length === 0 ? (
                <p className="field-hint">Belum ada item. Tambahkan item barang bawaan.</p>
              ) : null}

              {form.carriedItems.map((item, index) => (
                <div key={item.id} className="incident-item-row">
                  <div className="form-grid form-grid--2">
                    <div className="field-group">
                      <label className="label">Kategori</label>
                      <SearchableSelect
                        value={item.categoryKey}
                        onChange={(value) =>
                          updateCarriedItem(item.id, {
                            categoryKey: value as IncidentCategoryKey,
                          })
                        }
                        options={incidentCategoryOptions}
                        placeholder="Pilih kategori"
                        searchable={false}
                        clearable={false}
                      />
                      {errors[`carriedItems_${index}_categoryKey`] ? (
                        <p className="field-error">
                          {errors[`carriedItems_${index}_categoryKey`]}
                        </p>
                      ) : null}
                    </div>

                    <div className="field-group">
                      <label className="label" htmlFor={`incidentDescription_${item.id}`}>
                        Keterangan
                      </label>
                      <textarea
                        id={`incidentDescription_${item.id}`}
                        className="textarea"
                        rows={2}
                        value={item.description}
                        onChange={(event) =>
                          updateCarriedItem(item.id, {
                            description: event.target.value,
                          })
                        }
                        placeholder="Contoh: Tupperware ungu"
                      />
                      {errors[`carriedItems_${index}_description`] ? (
                        <p className="field-error">
                          {errors[`carriedItems_${index}_description`]}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="incident-item-row__actions">
                    <button
                      type="button"
                      className="button button--tiny button--danger"
                      onClick={() => removeCarriedItem(item.id)}
                    >
                      Hapus Item
                    </button>
                  </div>
                </div>
              ))}

              <div className="form-actions">
                <button type="button" className="button button--ghost" onClick={addCarriedItem}>
                  Tambah Item
                </button>
              </div>
              {errors.carriedItems ? <p className="field-error">{errors.carriedItems}</p> : null}
            </div>

            <div className="form-grid form-grid--2">
              <div className="field-group">
                <label className="label" htmlFor="parentMessage">
                  Pesan dari orangtua
                </label>
                <textarea
                  id="parentMessage"
                  className="textarea input--locked"
                  rows={2}
                  value={form.parentMessage}
                  placeholder="Pesan dari orang tua tampil otomatis"
                  disabled
                  readOnly
                />
                <p className="field-hint">
                  Ditulis dari Portal Orang Tua, petugas hanya melihat.
                </p>
              </div>
              <div className="field-group">
                <label className="label" htmlFor="messageForParent">
                  Pesan untuk orangtua
                </label>
                <textarea
                  id="messageForParent"
                  className="textarea"
                  rows={2}
                  value={form.messageForParent}
                  onChange={(event) =>
                    setField('messageForParent', event.target.value)
                  }
                />
              </div>
            </div>

            <div className="field-group">
              <label className="label" htmlFor="incidentNotes">
                Catatan / keterangan
              </label>
              <textarea
                id="incidentNotes"
                className="textarea"
                rows={2}
                value={form.notes}
                onChange={(event) => setField('notes', event.target.value)}
              />
            </div>

            <div className="section-title">Tandatangan Orangtua</div>
            <p className="field-hint">
              Tanda tangan orang tua dilakukan manual di lembar cetak berita acara.
            </p>

            <div className="form-actions">
              <button className="button" type="submit" disabled={isSaveDisabled}>
                {editingId ? 'Update Berita Acara' : 'Simpan Berita Acara'}
              </button>
              {editingId ? (
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={resetForm}
                >
                  Batal Edit
                </button>
              ) : null}
            </div>
          </fieldset>
        </form>
      </div>

      <div id="tour-berita-acara-history" className="card">
        <h3>Riwayat Berita Acara</h3>
        <p className="card__description">
          Filter data berdasarkan tanggal dan nama anak. Klik foto untuk preview.
        </p>

        <div className="incident-history-filter">
          <div className="field-group">
            <label className="label" htmlFor="incidentHistoryDate">
              Filter Tanggal
            </label>
            <AppDatePickerField
              id="incidentHistoryDate"
              value={historyDateFilter}
              max={todayDate}
              onChange={(value) => {
                setHistoryDateFilter(value > todayDate ? todayDate : value)
                setHistoryPage(1)
              }}
            />
          </div>

          <div className="field-group">
            <label className="label">
              Filter Nama Anak (Opsional)
            </label>
            <SearchableSelect
              value={historyChildFilter}
              onChange={(value) => { setHistoryChildFilter(value); setHistoryPage(1) }}
              options={historyChildOptions}
              placeholder="Semua anak"
              emptyMessage="Data anak tidak tersedia"
              usePortal={true}
            />
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Nama anak</th>
                <th>Foto</th>
                <th>Pesan orangtua</th>
                <th>Pesan untuk orangtua</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isTableLoading ? (
                renderTableLoadingRows(6, 4, 'incident-history')
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table__empty">
                    Belum ada data berita acara pada filter ini.
                  </td>
                </tr>
              ) : (
                <>
                  {paginatedReports.map((record) => (
                    <tr key={record.id}>
                      <td>{formatReadableDate(record.date)}</td>
                      <td>{childNameById(record.childId)}</td>
                      <td>
                        {record.carriedItemsPhotoDataUrl ? (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setPreviewReport(record)}
                            style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: '6px',
                              overflow: 'hidden',
                              cursor: 'pointer',
                              border: '1px solid var(--color-border, #cbd5e0)',
                            }}
                          >
                            <img
                              src={record.carriedItemsPhotoDataUrl}
                              alt="Foto barang"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted, #a0aec0)', fontSize: '0.85rem' }}>—</span>
                        )}
                      </td>
                      <td>{record.parentMessage || '-'}</td>
                      <td>{record.messageForParent || '-'}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="button button--tiny button--ghost"
                            onClick={() => handleEdit(record)}
                          >
                            {editingId === record.id ? 'Sedang Diedit' : 'Edit'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {renderMinimumRows(paginatedReports.length, 6, 'incident-history')}
                </>
              )}
            </tbody>
          </table>
        </div>
        {filteredReports.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--color-text-muted, #718096)' }}>
              Halaman {historyPage} dari {historyTotalPages} ({filteredReports.length} data)
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="button button--tiny button--ghost"
                disabled={historyPage <= 1}
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
              >
                ← Previous
              </button>
              <button
                type="button"
                className="button button--tiny button--ghost"
                disabled={historyPage >= historyTotalPages}
                onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
              >
                Next →
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Popup Preview Berita Acara */}
      {previewReport ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setPreviewReport(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setPreviewReport(null) }}
          role="dialog"
          tabIndex={-1}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.5rem',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewReport(null)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                lineHeight: 1,
                color: 'var(--color-text-muted, #718096)',
              }}
            >
              ✕
            </button>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>
              Preview Berita Acara — {childNameById(previewReport.childId)}
            </h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--color-text-muted, #718096)' }}>
              Tanggal: {previewReport.date}
            </p>
            {previewReport.carriedItemsPhotoDataUrl ? (
              <img
                src={previewReport.carriedItemsPhotoDataUrl}
                alt="Foto barang bawaan"
                style={{ width: '100%', borderRadius: '8px', marginBottom: '1rem' }}
              />
            ) : null}
            <div style={{ fontSize: '0.9rem' }}>
              <strong>Barang Bawaan ({Array.isArray(previewReport.carriedItems) ? previewReport.carriedItems.length : 0} item):</strong>
              {Array.isArray(previewReport.carriedItems) && previewReport.carriedItems.length > 0 ? (
                <ul style={{ margin: '0.5rem 0', paddingLeft: '1.2rem' }}>
                  {previewReport.carriedItems.map((item, idx) => (
                    <li key={item.id ?? idx}>
                      {INCIDENT_CATEGORY_OPTIONS.find(o => o.key === item.categoryKey)?.label ?? item.categoryKey}: {item.description || '-'}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: '0.25rem 0', color: 'var(--color-text-muted, #a0aec0)' }}>Tidak ada item.</p>
              )}
              {previewReport.parentMessage ? (
                <p><strong>Pesan orangtua:</strong> {previewReport.parentMessage}</p>
              ) : null}
              {previewReport.messageForParent ? (
                <p><strong>Pesan untuk orangtua:</strong> {previewReport.messageForParent}</p>
              ) : null}
              {previewReport.notes ? (
                <p><strong>Catatan:</strong> {previewReport.notes}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default BeritaAcaraPage
