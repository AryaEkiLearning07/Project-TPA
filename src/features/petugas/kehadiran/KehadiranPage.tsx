import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { AppMonthPickerField } from '../../../components/common/DatePickerFields'
import SignaturePad from '../../../components/common/SignaturePad'
import SearchableSelect from '../../../components/common/SearchableSelect'
import {
  inventoryMessageCategories,
  type InventoryMessageCategoryValue,
} from '../../../constants/inventory'
import type {
  AttendanceRecord,
  AttendanceRecordInput,
  ChildProfile,
  SupplyInventoryItem,
} from '../../../types'
import {
  type FieldErrors,
  validateAttendanceRecordInput,
} from '../../../utils/validators'
import { getLocalDateIso, getLocalTimeHHmm } from '../../../utils/date'

interface KehadiranPageProps {
  childrenData: ChildProfile[]
  records: AttendanceRecord[]
  supplyItems?: SupplyInventoryItem[]
  isTableLoading?: boolean
  onSave: (input: AttendanceRecordInput, editingId?: string) => Promise<boolean>
  onNavigateToDataAnak: () => void
}

type AttendanceMode = 'arrival' | 'departure'

const createInitialForm = (): AttendanceRecordInput => ({
  childId: '',
  date: getLocalDateIso(),
  escortName: '',
  pickupName: '',
  parentMessage: '',
  messageForParent: '',
  departureNotes: '',
  arrivalTime: '',
  departureTime: '',
  arrivalPhysicalCondition: 'sehat',
  arrivalEmotionalCondition: 'senang',
  departurePhysicalCondition: 'sehat',
  departureEmotionalCondition: 'senang',
  carriedItems: [],
  escortSignatureDataUrl: '',
  pickupSignatureDataUrl: '',
})

const removeErrorKey = (errors: FieldErrors, key: string): FieldErrors => {
  if (!errors[key]) {
    return errors
  }
  const next = { ...errors }
  delete next[key]
  return next
}


const INVENTORY_AUTO_MESSAGE_TITLE = 'Informasi stok kebutuhan:'

const formatReadableDateShort = (isoDate: string): string => {
  const parsed = new Date(`${isoDate}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime())) {
    return isoDate
  }
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  }).format(parsed)
}

const resolveStockUnit = (productName: string, fallbackUnit: string): string => {
  const normalizedName = productName.trim().toLowerCase()
  if (normalizedName.includes('atasan')) {
    return 'atasan'
  }
  if (normalizedName.includes('bawahan')) {
    return 'bawahan'
  }
  if (normalizedName.includes('set')) {
    return 'set'
  }
  if (normalizedName.includes('kaos')) {
    return 'kaos'
  }
  return fallbackUnit
}

const classifySupplyItemForMessage = (
  item: SupplyInventoryItem,
): InventoryMessageCategoryValue | null => {
  const normalizedCategory = item.category.trim().toLowerCase()
  const normalizedText = `${item.productName} ${item.description}`.trim().toLowerCase()

  if (normalizedCategory === 'kaos-dalam') {
    return 'kaos-dalam'
  }
  if (normalizedCategory === 'baju-tidur') {
    return 'baju-tidur'
  }
  if (normalizedCategory === 'baju-sore') {
    return 'baju-sore'
  }

  if (
    normalizedCategory === 'pakaian-dalaman' ||
    normalizedText.includes('kaos dalam') ||
    (normalizedText.includes('kaos') && normalizedText.includes('dalam'))
  ) {
    return 'kaos-dalam'
  }

  if (normalizedText.includes('tidur') || normalizedText.includes('piyama')) {
    return 'baju-tidur'
  }
  if (normalizedText.includes('sore')) {
    return 'baju-sore'
  }

  if (
    normalizedCategory === 'pakaian-atasan' ||
    normalizedCategory === 'pakaian-bawahan'
  ) {
    return 'baju-sore'
  }

  return null
}

const formatInventoryCategoryMessage = (
  category: (typeof inventoryMessageCategories)[number],
  items: SupplyInventoryItem[],
): string => {
  if (items.length === 0) {
    return `${category.label} belum diinput`
  }

  if (category.value === 'kaos-dalam') {
    const totalQuantity = items.reduce((sum, item) => sum + Math.max(0, item.quantity), 0)
    if (totalQuantity <= 0) {
      return `${category.label} habis`
    }
    return `${category.label} sisa ${totalQuantity}`
  }

  const positiveItems = items.filter((item) => item.quantity > 0)
  if (positiveItems.length === 0) {
    return `${category.label} habis`
  }

  const stockParts = positiveItems.map((item) => {
    const unit = resolveStockUnit(item.productName, category.defaultUnit)
    return `${item.quantity} ${unit}`
  })
  return `${category.label} sisa ${stockParts.join(' + ')}`
}

const buildInventoryAutoMessage = (
  childId: string,
  supplyItems: SupplyInventoryItem[],
): string => {
  if (!childId) {
    return ''
  }

  const groupedItems = new Map<InventoryMessageCategoryValue, SupplyInventoryItem[]>(
    inventoryMessageCategories.map((category) => [category.value, []]),
  )

  supplyItems
    .filter((item) => item.childId === childId)
    .forEach((item) => {
      const messageCategory = classifySupplyItemForMessage(item)
      if (!messageCategory) {
        return
      }

      const previous = groupedItems.get(messageCategory) ?? []
      groupedItems.set(messageCategory, [...previous, item])
    })

  const lines = inventoryMessageCategories.map((category) =>
    formatInventoryCategoryMessage(
      category,
      groupedItems.get(category.value) ?? [],
    ),
  )

  return `${INVENTORY_AUTO_MESSAGE_TITLE}\n${lines.map((line) => `- ${line}`).join('\n')}`
}

const mergeMessageForParentWithInventory = (
  rawMessage: string,
  inventoryMessage: string,
): string => {
  const existingMessage = rawMessage.trim()
  const autoIndex = existingMessage.indexOf(INVENTORY_AUTO_MESSAGE_TITLE)
  const baseMessage =
    autoIndex >= 0
      ? existingMessage.slice(0, autoIndex).trim()
      : existingMessage

  if (!inventoryMessage) {
    return baseMessage
  }
  if (!baseMessage) {
    return inventoryMessage
  }
  return `${baseMessage}\n\n${inventoryMessage}`
}

const KehadiranPage = ({
  childrenData,
  records,
  supplyItems = [],
  isTableLoading = false,
  onSave,
  onNavigateToDataAnak,
}: KehadiranPageProps) => {
  const [form, setForm] = useState<AttendanceRecordInput>(() => createInitialForm())
  const formRef = useRef<AttendanceRecordInput>(form)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [departureRecordId, setDepartureRecordId] = useState<string | null>(null)
  const [mode, setMode] = useState<AttendanceMode>('arrival')
  const [todayDate, setTodayDate] = useState<string>(() => getLocalDateIso())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [historyMonth, setHistoryMonth] = useState<string>(() => getLocalDateIso().slice(0, 7))
  const historyLimit = 20
  const [historyPage, setHistoryPage] = useState<number>(1)
  const [childSelectionNotice, setChildSelectionNotice] = useState('')
  const childSelectRef = useRef<HTMLDivElement | null>(null)

  const hasChildren = childrenData.length > 0
  const isChildSelected = form.childId.trim().length > 0
  const selectedChild = useMemo(
    () => childrenData.find((item) => item.id === form.childId) ?? null,
    [childrenData, form.childId],
  )

  const sharedContactNames = useMemo(() => {
    if (!selectedChild) {
      return []
    }

    const candidateNames = [
      ...(Array.isArray(selectedChild.pickupPersons) ? selectedChild.pickupPersons : []),
    ]

    const seen = new Set<string>()
    return candidateNames
      .map((name) => name.trim())
      .filter((name) => {
        if (!name) {
          return false
        }

        const key = name.toLowerCase()
        if (key === '[disensor]' || key === 'disensor') {
          return false
        }
        if (seen.has(key)) {
          return false
        }

        seen.add(key)
        return true
      })
  }, [selectedChild])

  const sharedContactOptions = useMemo(() => {
    return sharedContactNames.map((name) => ({
      value: name,
      label: name,
    }))
  }, [sharedContactNames])

  const hasSharedContactOptions = sharedContactNames.length > 0

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setTodayDate((previous) => {
        const nextDate = getLocalDateIso()
        return previous === nextDate ? previous : nextDate
      })
    }, 30_000)

    return () => {
      window.clearInterval(timerId)
    }
  }, [])

  const childNameById = (id: string): string => {
    const child = childrenData.find((item) => item.id === id)
    return child ? child.fullName : 'Data anak dihapus'
  }

  const arrivalSelectableChildren = useMemo(() => {
    const arrivedTodayIds = new Set(
      records
        .filter((r) => r.date === todayDate && r.arrivalTime)
        .map((r) => r.childId)
    )
    return childrenData.filter((child) => !arrivedTodayIds.has(child.id))
  }, [childrenData, records, todayDate])

  const arrivedToday = useMemo(
    () =>
      records
        .filter(
          (record) =>
            record.date === todayDate &&
            record.arrivalTime &&
            !record.departureTime,
        )
        .sort((a, b) => a.arrivalTime.localeCompare(b.arrivalTime)),
    [records, todayDate],
  )

  const departedToday = useMemo(
    () =>
      records
        .filter((record) => record.date === todayDate && record.departureTime)
        .sort((a, b) =>
          (a.departureTime ?? '').localeCompare(b.departureTime ?? ''),
        ),
    [records, todayDate],
  )

  const filteredHistoryRecords = useMemo(
    () =>
      [...records]
        .filter((record) => {
          if (historyMonth) {
            return record.date.startsWith(historyMonth)
          }
          return record.date.startsWith(todayDate.slice(0, 7))
        })
        .sort((left, right) =>
          `${right.date}${right.createdAt}`.localeCompare(
            `${left.date}${left.createdAt}`,
            'id',
          ),
        ),
    [records, historyMonth, todayDate],
  )

  const historyTotalPages = Math.max(1, Math.ceil(filteredHistoryRecords.length / historyLimit))

  const paginatedRecords = useMemo(() => {
    const start = (historyPage - 1) * historyLimit
    return filteredHistoryRecords.slice(start, start + historyLimit)
  }, [filteredHistoryRecords, historyPage, historyLimit])

  const setFormState = (
    updater: (previous: AttendanceRecordInput) => AttendanceRecordInput,
  ) => {
    setForm((previous) => {
      const next = updater(previous)
      formRef.current = next
      return next
    })
  }

  const setField = <K extends keyof AttendanceRecordInput>(
    key: K,
    value: AttendanceRecordInput[K],
  ) => {
    setFormState((previous) => ({
      ...previous,
      [key]: value,
    }))
    setErrors((previous) => removeErrorKey(previous, String(key)))
  }

  const promptSelectChildFirst = () => {
    if (form.childId) {
      return
    }
    setChildSelectionNotice('silahkan pilih nama anak')
    childSelectRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const resetForm = () => {
    const nextForm = createInitialForm()
    formRef.current = nextForm
    setForm(nextForm)
    setErrors({})
    setDepartureRecordId(null)
    setChildSelectionNotice('')
  }

  const switchMode = (nextMode: AttendanceMode) => {
    setMode(nextMode)
    resetForm()
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) {
      return
    }

    const nextErrors = validateAttendanceRecordInput(formRef.current, mode)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    const submissionForm: AttendanceRecordInput = {
      ...formRef.current,
      date: todayDate,
    }

    if (mode === 'arrival') {
      submissionForm.arrivalTime = getLocalTimeHHmm()
    } else {
      submissionForm.departureTime = getLocalTimeHHmm()
    }

    setIsSubmitting(true)
    try {
      const persistId = mode === 'departure' ? departureRecordId ?? undefined : undefined
      const success = await onSave(submissionForm, persistId)
      if (success) {
        resetForm()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDepartureChildSelect = (childId: string) => {
    setChildSelectionNotice('')
    setErrors((previous) => {
      let next = removeErrorKey(previous, 'childId')
      next = removeErrorKey(next, 'pickupName')
      next = removeErrorKey(next, 'pickupSignatureDataUrl')
      next = removeErrorKey(next, 'parentMessage')
      next = removeErrorKey(next, 'messageForParent')
      next = removeErrorKey(next, 'departureNotes')
      return next
    })

    const existingArrival = records.find(
      (record) =>
        record.childId === childId &&
        record.date === todayDate &&
        record.arrivalTime &&
        !record.departureTime,
    )

    if (existingArrival) {
      setDepartureRecordId(existingArrival.id)
      const resolvedParentMessage = existingArrival.parentMessage.trim()
      const inventoryAutoMessage = buildInventoryAutoMessage(childId, supplyItems)
      const resolvedMessageForParent = mergeMessageForParentWithInventory(
        existingArrival.messageForParent,
        inventoryAutoMessage,
      )

      setFormState((prev) => ({
        ...prev,
        childId,
        date: existingArrival.date,
        escortName: existingArrival.escortName,
        arrivalTime: existingArrival.arrivalTime,
        parentMessage: resolvedParentMessage,
        messageForParent: resolvedMessageForParent,
        departureNotes: existingArrival.departureNotes ?? '',
        arrivalPhysicalCondition: existingArrival.arrivalPhysicalCondition || 'sehat',
        arrivalEmotionalCondition: existingArrival.arrivalEmotionalCondition || 'senang',
        departurePhysicalCondition:
          existingArrival.departurePhysicalCondition || 'sehat',
        departureEmotionalCondition:
          existingArrival.departureEmotionalCondition || 'senang',
        carriedItems:
          Array.isArray(existingArrival.carriedItems) &&
            existingArrival.carriedItems.length > 0
            ? existingArrival.carriedItems
            : [],
        escortSignatureDataUrl: existingArrival.escortSignatureDataUrl ?? '',
        pickupName: '',
        pickupSignatureDataUrl: '',
      }))
      return
    }

    setDepartureRecordId(null)
    const inventoryAutoMessage = buildInventoryAutoMessage(childId, supplyItems)
    setFormState((prev) => ({
      ...prev,
      childId,
      date: todayDate,
      parentMessage: '',
      messageForParent: inventoryAutoMessage,
      departureNotes: '',
      pickupName: '',
      pickupSignatureDataUrl: '',
    }))
  }

  const handleArrivalChildSelect = (childId: string) => {
    setChildSelectionNotice('')
    setErrors((previous) => removeErrorKey(previous, 'childId'))
    setDepartureRecordId(null)
    setFormState((prev) => ({
      ...prev,
      childId,
      escortName: '',
      escortSignatureDataUrl: '',
    }))
  }

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
        <h2>Kehadiran</h2>
        <p className="card__description">
          Catat kedatangan dan kepulangan anak dengan data inti.
        </p>
        <div className="attendance-shortcut">
          <p className="attendance-shortcut__label">List Data Anak </p>
          <button
            type="button"
            className="button button--child-data"
            onClick={onNavigateToDataAnak}
          >
            Buka Menu Data Anak
          </button>
        </div>

        {!hasChildren ? (
          <div className="empty-state">
            <p>Data anak masih kosong. Tambahkan data anak terlebih dahulu.</p>
          </div>
        ) : null}

        <div className="attendance-tab-group">
          <button
            id="tour-kehadiran-tab-arrival"
            type="button"
            className={`attendance-tab ${mode === 'arrival' ? 'is-active attendance-tab--arrival' : ''}`}
            onClick={() => switchMode('arrival')}
          >
            Absen Datang
          </button>
          <button
            id="tour-kehadiran-tab-departure"
            type="button"
            className={`attendance-tab ${mode === 'departure' ? 'is-active attendance-tab--departure' : ''}`}
            onClick={() => switchMode('departure')}
          >
            Absen Pulang
          </button>
        </div>

        <form id="tour-kehadiran-form" onSubmit={handleSubmit}>
          <fieldset className="fieldset" disabled={!hasChildren}>
            <div id="tour-kehadiran-child-select" className="field-group">
              <div ref={childSelectRef} />
              <label className="label" htmlFor="attendanceChildId">
                Nama anak
              </label>
              <SearchableSelect
                value={form.childId}
                onChange={(val) =>
                  mode === 'departure'
                    ? handleDepartureChildSelect(val)
                    : handleArrivalChildSelect(val)
                }
                options={
                  mode === 'departure'
                    ? arrivedToday.map((record) => ({
                      value: record.childId,
                      label: childNameById(record.childId),
                    }))
                    : arrivalSelectableChildren.map((child) => ({
                      value: child.id,
                      label: child.fullName,
                    }))
                }
                placeholder={mode === 'departure' ? 'Pilih anak yang akan pulang' : 'Pilih nama anak'}
                emptyMessage={
                  mode === 'departure'
                    ? 'Belum ada yang hadir'
                    : 'Semua anak sudah hadir hari ini'
                }
              />
              {errors.childId ? <p className="field-error">{errors.childId}</p> : null}
              {!errors.childId && childSelectionNotice ? (
                <p className="field-error">{childSelectionNotice}</p>
              ) : null}
            </div>

            {mode === 'arrival' ? (
              <>
                <div id="tour-kehadiran-escort-select" className="field-group" style={{ marginTop: '0.82rem' }}>
                  <label className="label">Nama pengantar</label>
                  <div
                    onPointerDownCapture={() => {
                      if (!form.childId) {
                        promptSelectChildFirst()
                      }
                    }}
                  >
                    <SearchableSelect
                      value={form.escortName}
                      onChange={(value) => setField('escortName', value)}
                      options={sharedContactOptions}
                      placeholder={
                        !form.childId
                          ? 'Silahkan pilih nama anak'
                          : hasSharedContactOptions
                            ? 'Pilih nama pengantar'
                            : 'Belum ada pengantar'
                      }
                      emptyMessage="Belum ada pengantar"
                      disabled={!form.childId || !hasSharedContactOptions}
                      clearable={false}
                    />
                  </div>
                  {errors.escortName ? (
                    <p className="field-error">{errors.escortName}</p>
                  ) : null}
                  {!errors.escortName && form.childId && !hasSharedContactOptions ? (
                    <p className="field-hint">Belum ada pengantar.</p>
                  ) : null}
                </div>

                <div id="tour-kehadiran-escort-signature" style={{ marginTop: '0.82rem' }}>
                  <SignaturePad
                    label="Tanda tangan pengantar"
                    value={form.escortSignatureDataUrl}
                    onChange={(value) => setField('escortSignatureDataUrl', value)}
                    error={errors.escortSignatureDataUrl}
                    disabled={!hasChildren || !isChildSelected}
                    onDisabledInteract={promptSelectChildFirst}
                  />
                </div>
              </>
            ) : (
              <>
                <div id="tour-kehadiran-pickup-select" className="field-group" style={{ marginTop: '0.82rem' }}>
                  <label className="label">Nama penjemput</label>
                  <div
                    onPointerDownCapture={() => {
                      if (!form.childId) {
                        promptSelectChildFirst()
                      }
                    }}
                  >
                    <SearchableSelect
                      value={form.pickupName}
                      onChange={(value) => setField('pickupName', value)}
                      options={sharedContactOptions}
                      placeholder={
                        !form.childId
                          ? 'Silahkan pilih nama anak'
                          : hasSharedContactOptions
                            ? 'Pilih nama penjemput'
                            : 'Belum ada penjemput'
                      }
                      emptyMessage="Belum ada penjemput"
                      disabled={!form.childId || !hasSharedContactOptions}
                      clearable={false}
                    />
                  </div>
                  {errors.pickupName ? (
                    <p className="field-error">{errors.pickupName}</p>
                  ) : null}
                  {!errors.pickupName && form.childId && !hasSharedContactOptions ? (
                    <p className="field-hint">Belum ada penjemput.</p>
                  ) : null}
                </div>

                <div id="tour-kehadiran-parent-message" className="field-group" style={{ marginTop: '0.82rem' }}>
                  <label className="label" htmlFor="attendanceParentMessage">
                    Pesan dari orang tua
                  </label>
                  <textarea
                    id="attendanceParentMessage"
                    className={`textarea ${!form.childId ? 'input--locked' : ''}`}
                    rows={2}
                    value={form.parentMessage}
                    onChange={(event) => setField('parentMessage', event.target.value)}
                    placeholder={
                      !form.childId
                        ? 'Silahkan pilih nama anak'
                        : 'Tuliskan pesan dari orang tua'
                    }
                    disabled={!form.childId}
                  />
                  {errors.parentMessage ? (
                    <p className="field-error">{errors.parentMessage}</p>
                  ) : null}
                </div>

                <div id="tour-kehadiran-message-for-parent" className="field-group" style={{ marginTop: '0.82rem' }}>
                  <label className="label" htmlFor="attendanceMessageForParent">
                    Pesan untuk orang tua
                  </label>
                  <textarea
                    id="attendanceMessageForParent"
                    className={`textarea ${!form.childId ? 'input--locked' : ''}`}
                    rows={2}
                    value={form.messageForParent}
                    onChange={(event) => setField('messageForParent', event.target.value)}
                    placeholder={
                      !form.childId
                        ? 'Silahkan pilih nama anak'
                        : 'Tuliskan pesan untuk orang tua'
                    }
                    disabled={!form.childId}
                  />
                  {errors.messageForParent ? (
                    <p className="field-error">{errors.messageForParent}</p>
                  ) : null}
                  {!errors.messageForParent && form.childId ? (
                    <p className="field-hint">
                      Terisi otomatis dari Berita Acara dan sisa stok buku penghubung,
                      tetap bisa Anda ubah.
                    </p>
                  ) : null}
                </div>

                <div id="tour-kehadiran-departure-notes" className="field-group" style={{ marginTop: '0.82rem' }}>
                  <label className="label" htmlFor="attendanceDepartureNotes">
                    Keterangan bawaan pulang (opsional)
                  </label>
                  <textarea
                    id="attendanceDepartureNotes"
                    className={`textarea ${!form.childId ? 'input--locked' : ''}`}
                    rows={2}
                    value={form.departureNotes}
                    onChange={(event) => setField('departureNotes', event.target.value)}
                    placeholder={
                      !form.childId
                        ? 'Silahkan pilih nama anak'
                        : 'Contoh: Baju ganti, botol minum, buku komunikasi'
                    }
                    disabled={!form.childId}
                  />
                </div>

                <div id="tour-kehadiran-pickup-signature" style={{ marginTop: '0.82rem' }}>
                  <SignaturePad
                    label="Tanda tangan penjemput"
                    value={form.pickupSignatureDataUrl}
                    onChange={(value) => setField('pickupSignatureDataUrl', value)}
                    error={errors.pickupSignatureDataUrl}
                    disabled={!hasChildren || !isChildSelected}
                    onDisabledInteract={promptSelectChildFirst}
                  />
                </div>
              </>
            )}

            <div className="form-actions">
              <button type="submit" className="button" disabled={isSubmitting}>
                {isSubmitting
                  ? 'Menyimpan...'
                  : mode === 'arrival'
                    ? 'Simpan Kedatangan'
                    : 'Simpan Kepulangan'}
              </button>
            </div>
          </fieldset>
        </form>
      </div>

      <div className="attendance-grid">
        <div id="tour-arrival-table" className="card attendance-card attendance-card--arrival">
          <h3>Kedatangan Hari Ini</h3>
          <p className="card__description">
            Anak yang sudah hadir dan belum dijemput.
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nama Anak</th>
                  <th>Pengantar</th>
                  <th>Jam Datang</th>
                </tr>
              </thead>
              <tbody>
                {isTableLoading ? (
                  renderTableLoadingRows(3, 3, 'attendance-arrival')
                ) : arrivedToday.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="table__empty">
                      Belum ada anak yang datang hari ini.
                    </td>
                  </tr>
                ) : (
                  <>
                    {arrivedToday.map((record) => (
                      <tr key={record.id}>
                        <td>{childNameById(record.childId)}</td>
                        <td>{record.escortName}</td>
                        <td>
                          <span className="badge badge--arrival">{record.arrivalTime}</span>
                        </td>
                      </tr>
                    ))}
                    {renderMinimumRows(arrivedToday.length, 3, 'attendance-arrival')}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div id="tour-departure-table" className="card attendance-card attendance-card--departure">
          <h3>Kepulangan / Sudah Pulang</h3>
          <p className="card__description">
            Anak yang sudah dijemput hari ini.
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nama Anak</th>
                  <th>Penjemput</th>
                  <th>Jam Pulang</th>
                </tr>
              </thead>
              <tbody>
                {isTableLoading ? (
                  renderTableLoadingRows(3, 3, 'attendance-departure')
                ) : departedToday.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="table__empty">
                      Belum ada anak yang pulang hari ini.
                    </td>
                  </tr>
                ) : (
                  <>
                    {departedToday.map((record) => (
                      <tr key={record.id}>
                        <td>{childNameById(record.childId)}</td>
                        <td>{record.pickupName || '-'}</td>
                        <td>
                          <span className="badge badge--departure">{record.departureTime}</span>
                        </td>
                      </tr>
                    ))}
                    {renderMinimumRows(departedToday.length, 3, 'attendance-departure')}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Riwayat Kehadiran</h3>
        <p className="card__description">Filter berdasarkan bulan dan jumlah data yang ditampilkan.</p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div className="field-group" style={{ flex: '1 1 200px' }}>
            <label className="label">Bulan</label>
            <AppMonthPickerField
              value={historyMonth}
              max={todayDate.slice(0, 7)}
              onChange={(value) => {
                setHistoryMonth(value)
                setHistoryPage(1)
              }}
            />
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Nama anak</th>
                <th>Datang (Pengantar)</th>
                <th>Pulang (Penjemput)</th>
              </tr>
            </thead>
            <tbody>
              {isTableLoading ? (
                renderTableLoadingRows(4, 4, 'attendance-history')
              ) : paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={4} className="table__empty">
                    Belum ada data kehadiran pada bulan ini.
                  </td>
                </tr>
              ) : (
                <>
                  {paginatedRecords.map((record) => (
                    <tr key={record.id}>
                      <td>{formatReadableDateShort(record.date)}</td>
                      <td>{childNameById(record.childId)}</td>
                      <td>
                        {record.arrivalTime ? (
                          <div className="inline-row">
                            <span className="badge badge--arrival">{record.arrivalTime}</span>
                            <small className="field-hint">{record.escortName}</small>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        {record.departureTime ? (
                          <div className="inline-row">
                            <span className="badge badge--departure">{record.departureTime}</span>
                            <small className="field-hint">{record.pickupName}</small>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                  {renderMinimumRows(paginatedRecords.length, 4, 'attendance-history')}
                </>
              )}
            </tbody>
          </table>
        </div>
        {filteredHistoryRecords.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--color-text-muted, #718096)' }}>
              Halaman {historyPage} dari {historyTotalPages} ({filteredHistoryRecords.length} data)
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
    </section>
  )
}

export default KehadiranPage
