import type { AppData } from '../types'

export const STORAGE_KEY = 'tpa_dashboard_v1'
const DATA_VERSION = 1

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const createEmptyAppData = (): AppData => ({
  version: DATA_VERSION,
  children: [],
  incidentReports: [],
  attendanceRecords: [],
  observationRecords: [],
  communicationBooks: [],
  supplyInventory: [],
})

const sanitizeLoadedData = (value: unknown): AppData => {
  if (!isObject(value)) {
    return createEmptyAppData()
  }

  return {
    version: typeof value.version === 'number' ? value.version : DATA_VERSION,
    children: Array.isArray(value.children)
      ? (value.children as AppData['children'])
      : [],
    incidentReports: Array.isArray(value.incidentReports)
      ? (value.incidentReports as AppData['incidentReports'])
      : [],
    attendanceRecords: Array.isArray(value.attendanceRecords)
      ? (value.attendanceRecords as AppData['attendanceRecords'])
      : [],
    observationRecords: Array.isArray(value.observationRecords)
      ? (value.observationRecords as AppData['observationRecords'])
      : [],
    communicationBooks: Array.isArray(value.communicationBooks)
      ? (value.communicationBooks as AppData['communicationBooks'])
      : [],
    supplyInventory: Array.isArray(value.supplyInventory)
      ? (value.supplyInventory as AppData['supplyInventory'])
      : [],
  }
}

export const loadAppData = (): AppData => {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return createEmptyAppData()
  }

  const raw = window.sessionStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return createEmptyAppData()
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    return sanitizeLoadedData(parsed)
  } catch {
    return createEmptyAppData()
  }
}

export const saveAppData = (next: AppData): void => {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return
  }

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // sessionStorage may fail when quota is exceeded. Ignore to avoid breaking UI.
  }
}

export const clearAppDataStorage = (): void => {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return
  }

  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore sessionStorage cleanup failures to avoid breaking UI.
  }
}
