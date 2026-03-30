import type {
  AttendanceRecordInput,
  ChildProfileInput,
  CommunicationBookEntryInput,
  IncidentReportInput,
  ObservationRecordInput,
} from '../types'
import { INCIDENT_CATEGORY_OPTIONS } from '../constants/incident-categories'

export type FieldErrors = Record<string, string>

const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

const timeToMinutes = (value: string): number | null => {
  if (!value) {
    return null
  }

  const [hours, minutes] = value.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null
  }

  return hours * 60 + minutes
}

export const validateChildProfileInput = (
  input: ChildProfileInput,
): FieldErrors => {
  const errors: FieldErrors = {}

  if (!input.fullName.trim()) errors.fullName = 'Nama lengkap wajib diisi'
  if (input.email.trim() && !isValidEmail(input.email)) {
    errors.email = 'Format email tidak valid'
  }
  if (!input.servicePackage) {
    errors.servicePackage = 'Paket layanan wajib dipilih'
  }

  if (input.arrivalTime && input.departureTime) {
    const arrivalMinutes = timeToMinutes(input.arrivalTime)
    const departureMinutes = timeToMinutes(input.departureTime)
    if (
      arrivalMinutes !== null &&
      departureMinutes !== null &&
      departureMinutes < arrivalMinutes
    ) {
      errors.departureTime = 'Jam pulang tidak boleh lebih awal dari jam datang'
    }
  }

  return errors
}

export const validateIncidentReportInput = (
  input: IncidentReportInput,
): FieldErrors => {
  const errors: FieldErrors = {}
  const validCategorySet = new Set(
    INCIDENT_CATEGORY_OPTIONS.map((option) => option.key),
  )

  if (!input.childId) errors.childId = 'Nama anak wajib dipilih'

  if (!input.carriedItemsPhotoDataUrl) {
    errors.carriedItemsPhotoDataUrl = 'Foto gabungan barang wajib diunggah'
  }

  if (!Array.isArray(input.carriedItems) || input.carriedItems.length === 0) {
    errors.carriedItems = 'Minimal satu item barang bawaan wajib diisi'
  } else {
    let validItemCount = 0

    input.carriedItems.forEach((item, index) => {
      if (!item.categoryKey || !validCategorySet.has(item.categoryKey)) {
        errors[`carriedItems_${index}_categoryKey`] = 'Kategori wajib dipilih'
      }
      if (!item.description.trim()) {
        errors[`carriedItems_${index}_description`] = 'Keterangan wajib diisi'
      }
      if (item.categoryKey && item.description.trim()) {
        validItemCount += 1
      }
    })

    if (validItemCount === 0) {
      errors.carriedItems = 'Minimal satu item barang bawaan wajib diisi'
    }
  }

  return errors
}

export const validateAttendanceRecordInput = (
  input: AttendanceRecordInput,
  mode: 'arrival' | 'departure' = 'arrival',
): FieldErrors => {
  const errors: FieldErrors = {}

  if (!input.childId) errors.childId = 'Nama anak wajib dipilih'

  if (mode === 'arrival') {
    if (!input.escortName.trim()) {
      errors.escortName = 'Nama pengantar wajib diisi'
    }

    if (!input.escortSignatureDataUrl) {
      errors.escortSignatureDataUrl = 'Tanda tangan pengantar wajib diisi'
    }
  }

  if (mode === 'departure') {
    if (!input.pickupName.trim()) {
      errors.pickupName = 'Nama penjemput wajib diisi'
    }
    if (!input.messageForParent.trim()) {
      errors.messageForParent = 'Pesan untuk orang tua wajib diisi'
    }
    if (!input.pickupSignatureDataUrl) {
      errors.pickupSignatureDataUrl = 'Tanda tangan penjemput wajib diisi'
    }
  }

  return errors
}

export const validateCommunicationBookEntryInput = (
  input: CommunicationBookEntryInput,
): FieldErrors => {
  const errors: FieldErrors = {}

  if (!input.childId) errors.childId = 'Nama anak wajib dipilih'
  if (!input.date) errors.date = 'Tanggal wajib diisi'

  const hasInventory = input.inventoryItems.some((item) => item.trim().length > 0)
  if (!hasInventory) {
    errors.inventoryItems = 'Minimal satu item inventory wajib diisi'
  }

  return errors
}

export const validateObservationRecordInput = (
  input: ObservationRecordInput,
): FieldErrors => {
  const errors: FieldErrors = {}

  if (!input.childId) errors.childId = 'Nama anak wajib dipilih'
  if (!input.date) errors.date = 'Tanggal observasi wajib diisi'
  if (!input.groupName.trim()) errors.groupName = 'Kelompok wajib diisi'
  if (!input.observerName.trim()) {
    errors.observerName = 'Nama observer wajib diisi'
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    errors.items = 'Minimal satu baris observasi wajib diisi'
    return errors
  }

  input.items.forEach((item, index) => {
    if (!item.activity.trim()) {
      errors[`itemActivity_${index}`] = 'Kegiatan wajib diisi'
    }
    if (!item.indicator.trim()) {
      errors[`itemIndicator_${index}`] = 'Indikator wajib diisi'
    }
    if (!item.category) {
      errors[`itemCategory_${index}`] = 'Kategori penilaian wajib dipilih'
    }
  })

  return errors
}
