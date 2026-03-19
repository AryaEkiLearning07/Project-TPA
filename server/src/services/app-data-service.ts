import type { PoolConnection, RowDataPacket } from 'mysql2/promise'
import { dbPool } from '../config/database.js'
import {
  ensureParentRelationshipSchema,
  resolveParentProfileId,
} from './parent-relations-service.js'
import { ensureChildrenTable } from './child-service.js'
import { saveBase64ToDisk } from '../utils/base64-storage.js'
import type {
  AppData,
  CarriedItem,
  AttendanceRecord,
  ChildProfile,
  CommunicationBookEntry,
  IncidentCarriedItem,
  IncidentCategoryKey,
  IncidentReport,
  MealEquipment,
  ObservationCategory,
  ObservationItem,
  ObservationRecord,
  SupplyInventoryItem,
} from '../types/app-data.js'

const APP_DATA_VERSION = 1
const SUPPLY_INVENTORY_META_KEY = 'supply_inventory_json'
const OBSERVATION_RECORDS_META_KEY = 'observation_records_json'

type DbGender = 'MALE' | 'FEMALE'
type DbReligion =
  | 'ISLAM'
  | 'CHRISTIAN'
  | 'CATHOLIC'
  | 'HINDU'
  | 'BUDDHIST'
  | 'CONFUCIAN'
  | 'OTHER'
type DbServicePackage = 'DAILY' | 'BIWEEKLY' | 'MONTHLY'
type DbPhysicalCondition = 'HEALTHY' | 'SICK'
type DbEmotionalCondition = 'HAPPY' | 'SAD'

export class ServiceError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ServiceError'
    this.status = status
  }
}

const genderToDb: Record<string, DbGender> = {
  L: 'MALE',
  P: 'FEMALE',
}

const dbToGender: Record<DbGender, string> = {
  MALE: 'L',
  FEMALE: 'P',
}

const religionToDb: Record<string, DbReligion> = {
  islam: 'ISLAM',
  kristen: 'CHRISTIAN',
  katolik: 'CATHOLIC',
  hindu: 'HINDU',
  buddha: 'BUDDHIST',
  konghucu: 'CONFUCIAN',
  lainnya: 'OTHER',
}

const dbToReligion: Record<DbReligion, string> = {
  ISLAM: 'islam',
  CHRISTIAN: 'kristen',
  CATHOLIC: 'katolik',
  HINDU: 'hindu',
  BUDDHIST: 'buddha',
  CONFUCIAN: 'konghucu',
  OTHER: 'lainnya',
}

const serviceToDb: Record<string, DbServicePackage> = {
  harian: 'DAILY',
  '2-mingguan': 'BIWEEKLY',
  bulanan: 'MONTHLY',
}

const dbToService: Record<DbServicePackage, string> = {
  DAILY: 'harian',
  BIWEEKLY: '2-mingguan',
  MONTHLY: 'bulanan',
}

const physicalToDb: Record<string, DbPhysicalCondition> = {
  sehat: 'HEALTHY',
  sakit: 'SICK',
}

const dbToPhysical: Record<DbPhysicalCondition, string> = {
  HEALTHY: 'sehat',
  SICK: 'sakit',
}

const emotionalToDb: Record<string, DbEmotionalCondition> = {
  senang: 'HAPPY',
  sedih: 'SAD',
}

const dbToEmotional: Record<DbEmotionalCondition, string> = {
  HAPPY: 'senang',
  SAD: 'sedih',
}

const INCIDENT_CATEGORY_KEYS: IncidentCategoryKey[] = [
  'DRINKING_BOTTLE',
  'MILK_CONTAINER',
  'MEAL_CONTAINER',
  'SNACK_CONTAINER',
  'BATH_SUPPLIES',
  'MEDICINE_VITAMIN',
  'BAG',
  'HELMET',
  'SHOES',
  'JACKET',
  'OTHER',
]

const INCIDENT_CATEGORY_KEY_SET = new Set<IncidentCategoryKey>(INCIDENT_CATEGORY_KEYS)

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const toDate = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'string') {
    return value.slice(0, 10)
  }
  return ''
}

const toTime = (value: unknown): string => {
  if (typeof value !== 'string') {
    return ''
  }
  return value.slice(0, 5)
}

const toIsoDateTime = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value !== 'string') {
    return new Date().toISOString()
  }

  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const withTimezone = /Z|[+-]\d{2}:\d{2}$/.test(normalized)
    ? normalized
    : `${normalized}Z`

  const parsed = new Date(withTimezone)
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString()
  }
  return parsed.toISOString()
}

const toText = (value: unknown): string => (typeof value === 'string' ? value : '')

const toNullable = (value: unknown): string | null => {
  const normalized = toText(value).trim()
  return normalized.length > 0 ? normalized : null
}

const toDbTime = (value: unknown): string | null => {
  const normalized = toText(value).trim()
  if (!normalized) {
    return null
  }
  if (/^\d{2}:\d{2}$/.test(normalized)) {
    return `${normalized}:00`
  }
  if (/^\d{2}:\d{2}:\d{2}$/.test(normalized)) {
    return normalized
  }
  return null
}

const toDbDate = (value: unknown): string => {
  const normalized = toText(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized
  }

  const parsed = new Date(normalized)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }

  return new Date().toISOString().slice(0, 10)
}

const toDbDateTime = (value: unknown): string => {
  const parsed = new Date(toText(value))
  if (Number.isNaN(parsed.getTime())) {
    return nowDbDateTime()
  }

  const yyyy = String(parsed.getUTCFullYear())
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(parsed.getUTCDate()).padStart(2, '0')
  const hh = String(parsed.getUTCHours()).padStart(2, '0')
  const mi = String(parsed.getUTCMinutes()).padStart(2, '0')
  const ss = String(parsed.getUTCSeconds()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}

const nowDbDateTime = (): string => toDbDateTime(new Date().toISOString())

const toNumericDbId = (value: unknown): number | null => {
  const normalized = toText(value).trim()
  if (!/^\d+$/.test(normalized)) {
    return null
  }

  const parsed = Number.parseInt(normalized, 10)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

const parseStringArrayJson = (value: unknown): string[] => {
  if (typeof value !== 'string' || value.length === 0) {
    return []
  }
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    return []
  }
}

const defaultMealEquipment = (): MealEquipment => ({
  drinkingBottle: { brand: '', imageDataUrl: '', imageName: '', description: '' },
  milkBottle: { brand: '', imageDataUrl: '', imageName: '', description: '' },
  mealContainer: { brand: '', imageDataUrl: '', imageName: '', description: '' },
  snackContainer: { brand: '', imageDataUrl: '', imageName: '', description: '' },
})

const parseMealEquipmentJson = (value: unknown): MealEquipment => {
  if (typeof value !== 'string' || value.length === 0) {
    return defaultMealEquipment()
  }
  try {
    const parsed = JSON.parse(value) as unknown
    if (!isObject(parsed)) {
      return defaultMealEquipment()
    }

    const safeItem = (item: unknown) => {
      if (!isObject(item)) {
        return { brand: '', imageDataUrl: '', imageName: '', description: '' }
      }
      return {
        brand: typeof item.brand === 'string' ? item.brand : '',
        imageDataUrl: typeof item.imageDataUrl === 'string' ? item.imageDataUrl : '',
        imageName: typeof item.imageName === 'string' ? item.imageName : '',
        description: typeof item.description === 'string' ? item.description : '',
      }
    }

    return {
      drinkingBottle: safeItem(parsed.drinkingBottle),
      milkBottle: safeItem(parsed.milkBottle),
      mealContainer: safeItem(parsed.mealContainer),
      snackContainer: safeItem(parsed.snackContainer),
    }
  } catch {
    return defaultMealEquipment()
  }
}

interface ParsedIncidentItemsJson {
  groupPhotoDataUrl: string
  items: IncidentCarriedItem[]
}

const createIncidentItemId = (index: number): string => `incident-item-${index}`

const toIncidentCategoryKey = (value: unknown): IncidentCategoryKey => {
  const normalized = toText(value).trim().toUpperCase() as IncidentCategoryKey
  if (INCIDENT_CATEGORY_KEY_SET.has(normalized)) {
    return normalized
  }
  return 'OTHER'
}

const sanitizeIncidentCarriedItem = (
  value: unknown,
  index: number,
): IncidentCarriedItem => {
  if (!isObject(value)) {
    return {
      id: createIncidentItemId(index),
      categoryKey: 'OTHER',
      description: '',
    }
  }

  return {
    id: toText(value.id) || createIncidentItemId(index),
    categoryKey: toIncidentCategoryKey(value.categoryKey),
    description: toText(value.description),
  }
}

const parseIncidentItemsJson = (value: unknown): ParsedIncidentItemsJson => {
  if (typeof value !== 'string' || value.length === 0) {
    return {
      groupPhotoDataUrl: '',
      items: [],
    }
  }

  try {
    const parsed = JSON.parse(value) as unknown
    if (!isObject(parsed)) {
      return {
        groupPhotoDataUrl: '',
        items: [],
      }
    }

    const rawPhoto =
      typeof parsed.groupPhotoDataUrl === 'string'
        ? parsed.groupPhotoDataUrl
        : typeof parsed.carriedItemsPhotoDataUrl === 'string'
          ? parsed.carriedItemsPhotoDataUrl
          : ''

    const items = Array.isArray(parsed.items)
      ? parsed.items.map((item, index) => sanitizeIncidentCarriedItem(item, index))
      : []

    return {
      groupPhotoDataUrl: rawPhoto,
      items,
    }
  } catch {
    return {
      groupPhotoDataUrl: '',
      items: [],
    }
  }
}

const splitLegacyText = (value: string): string[] =>
  value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)

const buildLegacyMealDescription = (item: {
  brand: string
  description: string
}): string => {
  const brand = toText(item.brand).trim()
  const description = toText(item.description).trim()
  if (!brand) {
    return description
  }
  if (!description || brand.toLowerCase() === description.toLowerCase()) {
    return brand
  }
  return `${brand} (${description})`
}

const buildIncidentItemsFromLegacy = (
  mealEquipment: MealEquipment,
  bathEquipment: string,
  medicines: string,
  bagItems: string,
): IncidentCarriedItem[] => {
  const nextItems: IncidentCarriedItem[] = []

  const pushItems = (
    categoryKey: IncidentCategoryKey,
    rawValues: string[],
  ) => {
    for (const rawValue of rawValues) {
      const description = rawValue.trim()
      if (!description) {
        continue
      }
      nextItems.push({
        id: createIncidentItemId(nextItems.length),
        categoryKey,
        description,
      })
    }
  }

  pushItems('DRINKING_BOTTLE', [
    buildLegacyMealDescription(mealEquipment.drinkingBottle),
  ])
  pushItems('MILK_CONTAINER', [buildLegacyMealDescription(mealEquipment.milkBottle)])
  pushItems('MEAL_CONTAINER', [buildLegacyMealDescription(mealEquipment.mealContainer)])
  pushItems('SNACK_CONTAINER', [buildLegacyMealDescription(mealEquipment.snackContainer)])
  pushItems('BATH_SUPPLIES', splitLegacyText(toText(bathEquipment)))
  pushItems('MEDICINE_VITAMIN', splitLegacyText(toText(medicines)))
  pushItems('BAG', splitLegacyText(toText(bagItems)))

  return nextItems
}

const sanitizeIncidentCarriedItems = (
  items: IncidentCarriedItem[],
): IncidentCarriedItem[] =>
  (Array.isArray(items) ? items : [])
    .map((item, index) => sanitizeIncidentCarriedItem(item, index))
    .map((item, index) => ({
      ...item,
      id: item.id || createIncidentItemId(index),
      description: item.description.trim(),
    }))
    .filter((item) => item.description.length > 0)

const getIncidentDescriptionsByCategory = (
  items: IncidentCarriedItem[],
  categoryKey: IncidentCategoryKey,
): string[] =>
  items
    .filter((item) => item.categoryKey === categoryKey)
    .map((item) => item.description.trim())
    .filter(Boolean)

const getJoinedIncidentDescriptions = (
  items: IncidentCarriedItem[],
  categoryKey: IncidentCategoryKey,
): string => getIncidentDescriptionsByCategory(items, categoryKey).join('\n')

const buildLegacyFieldsFromIncidentItems = (
  items: IncidentCarriedItem[],
): {
  mealEquipment: MealEquipment
  bathEquipment: string
  medicines: string
  bagItems: string
} => {
  const mealEquipment = defaultMealEquipment()

  const setMealField = (
    key: keyof MealEquipment,
    categoryKey: IncidentCategoryKey,
  ) => {
    const description = getJoinedIncidentDescriptions(items, categoryKey)
    mealEquipment[key] = {
      ...mealEquipment[key],
      brand: description,
      description,
    }
  }

  setMealField('drinkingBottle', 'DRINKING_BOTTLE')
  setMealField('milkBottle', 'MILK_CONTAINER')
  setMealField('mealContainer', 'MEAL_CONTAINER')
  setMealField('snackContainer', 'SNACK_CONTAINER')

  return {
    mealEquipment,
    bathEquipment: getJoinedIncidentDescriptions(items, 'BATH_SUPPLIES'),
    medicines: getJoinedIncidentDescriptions(items, 'MEDICINE_VITAMIN'),
    bagItems: getJoinedIncidentDescriptions(items, 'BAG'),
  }
}

const sanitizeCarriedItem = (value: unknown): CarriedItem => {
  if (!isObject(value)) {
    return {
      id: '',
      category: '',
      imageDataUrl: '',
      imageName: '',
      description: '',
    }
  }

  return {
    id: toText(value.id),
    category: toText(value.category),
    imageDataUrl: toText(value.imageDataUrl),
    imageName: toText(value.imageName),
    description: toText(value.description),
  }
}

const parseAttendanceNotesJson = (
  value: unknown,
): Pick<
  AttendanceRecord,
  | 'arrivalPhysicalCondition'
  | 'arrivalEmotionalCondition'
  | 'departurePhysicalCondition'
  | 'departureEmotionalCondition'
  | 'parentMessage'
  | 'messageForParent'
  | 'departureNotes'
  | 'carriedItems'
> => {
  const defaults = {
    arrivalPhysicalCondition: 'sehat',
    arrivalEmotionalCondition: 'senang',
    departurePhysicalCondition: 'sehat',
    departureEmotionalCondition: 'senang',
    parentMessage: '',
    messageForParent: '',
    departureNotes: '',
    carriedItems: [] as CarriedItem[],
  }

  if (typeof value !== 'string' || value.length === 0) {
    return defaults
  }

  try {
    const parsed = JSON.parse(value) as unknown
    if (!isObject(parsed)) {
      return defaults
    }

    const carriedItems = Array.isArray(parsed.carriedItems)
      ? parsed.carriedItems.map(sanitizeCarriedItem)
      : []

    return {
      arrivalPhysicalCondition: toText(parsed.arrivalPhysicalCondition) || 'sehat',
      arrivalEmotionalCondition: toText(parsed.arrivalEmotionalCondition) || 'senang',
      departurePhysicalCondition: toText(parsed.departurePhysicalCondition) || 'sehat',
      departureEmotionalCondition:
        toText(parsed.departureEmotionalCondition) || 'senang',
      parentMessage: toText(parsed.parentMessage),
      messageForParent: toText(parsed.messageForParent),
      departureNotes: toText(parsed.departureNotes),
      carriedItems,
    }
  } catch {
    return defaults
  }
}

const toDbAttendanceNotesJson = (record: AttendanceRecord): string =>
  JSON.stringify({
    arrivalPhysicalCondition: toText(record.arrivalPhysicalCondition) || 'sehat',
    arrivalEmotionalCondition: toText(record.arrivalEmotionalCondition) || 'senang',
    departurePhysicalCondition: toText(record.departurePhysicalCondition) || 'sehat',
    departureEmotionalCondition:
      toText(record.departureEmotionalCondition) || 'senang',
    parentMessage: toText(record.parentMessage),
    messageForParent: toText(record.messageForParent),
    departureNotes: toText(record.departureNotes),
    carriedItems: (Array.isArray(record.carriedItems) ? record.carriedItems : []).map(
      (item) => ({
        id: toText(item.id),
        category: toText(item.category),
        imageDataUrl: toText(item.imageDataUrl),
        imageName: toText(item.imageName),
        description: toText(item.description),
      }),
    ),
  })

const parseSupplyInventoryJson = (value: unknown): SupplyInventoryItem[] => {
  if (typeof value !== 'string' || value.length === 0) {
    return []
  }

  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter((item): item is Record<string, unknown> => isObject(item))
      .map((item) => ({
        id: toText(item.id),
        createdAt: toText(item.createdAt) || new Date().toISOString(),
        updatedAt: toText(item.updatedAt) || new Date().toISOString(),
        childId: toText(item.childId),
        productName: toText(item.productName),
        category: toText(item.category),
        quantity: Number(item.quantity) || 0,
        description: toText(item.description),
        imageDataUrl: toText(item.imageDataUrl),
        imageName: toText(item.imageName),
      }))
      .filter((item) => item.id.length > 0 && item.productName.trim().length > 0)
  } catch {
    return []
  }
}

const toDbSupplyInventoryJson = (items: SupplyInventoryItem[]): string =>
  JSON.stringify(
    (Array.isArray(items) ? items : []).map((item) => ({
      id: toText(item.id),
      createdAt: toText(item.createdAt) || new Date().toISOString(),
      updatedAt: toText(item.updatedAt) || new Date().toISOString(),
      childId: toText(item.childId).trim(),
      productName: toText(item.productName).trim(),
      category: toText(item.category).trim(),
      quantity: Number(item.quantity) || 0,
      description: toText(item.description).trim(),
      imageDataUrl: toText(item.imageDataUrl),
      imageName: toText(item.imageName),
    })),
  )

const toObservationCategory = (value: unknown): ObservationCategory => {
  const normalized = toText(value).trim().toLowerCase()
  if (normalized === 'perlu-latihan') {
    return 'perlu-latihan'
  }
  if (normalized === 'sudah-baik') {
    return 'sudah-baik'
  }
  return 'perlu-arahan'
}

const sanitizeObservationItem = (value: unknown, index: number): ObservationItem => {
  if (!isObject(value)) {
    return {
      id: `observation-item-${index}`,
      activity: '',
      indicator: '',
      category: 'perlu-arahan',
      notes: '',
    }
  }

  return {
    id: toText(value.id) || `observation-item-${index}`,
    activity: toText(value.activity),
    indicator: toText(value.indicator),
    category: toObservationCategory(value.category),
    notes: toText(value.notes),
  }
}

const parseObservationRecordsJson = (value: unknown): ObservationRecord[] => {
  if (typeof value !== 'string' || value.length === 0) {
    return []
  }

  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter((item): item is Record<string, unknown> => isObject(item))
      .map((item, index) => ({
        id: toText(item.id) || `observation-${index}`,
        createdAt: toText(item.createdAt) || new Date().toISOString(),
        updatedAt: toText(item.updatedAt) || new Date().toISOString(),
        childId: toText(item.childId),
        date: toDate(item.date),
        groupName: toText(item.groupName),
        observerName: toText(item.observerName),
        items: Array.isArray(item.items)
          ? item.items.map((observationItem, itemIndex) =>
            sanitizeObservationItem(observationItem, itemIndex),
          )
          : [],
      }))
      .filter((item) => item.id.length > 0 && item.childId.length > 0)
  } catch {
    return []
  }
}

const toDbObservationRecordsJson = (records: ObservationRecord[]): string =>
  JSON.stringify(
    (Array.isArray(records) ? records : [])
      .map((record) => ({
        id: toText(record.id),
        createdAt: toText(record.createdAt) || new Date().toISOString(),
        updatedAt: toText(record.updatedAt) || new Date().toISOString(),
        childId: toText(record.childId),
        date: toDbDate(record.date),
        groupName: toText(record.groupName),
        observerName: toText(record.observerName),
        items: (Array.isArray(record.items) ? record.items : []).map((item, index) => ({
          id: toText(item.id) || `observation-item-${index}`,
          activity: toText(item.activity),
          indicator: toText(item.indicator),
          category: toObservationCategory(item.category),
          notes: toText(item.notes),
        })),
      }))
      .filter((record) => record.id.length > 0 && record.childId.length > 0),
  )

type SqlExecutor = {
  execute: (sql: string, values?: unknown) => Promise<unknown>
}

const ensureAppMetaTable = async (
  executor: SqlExecutor,
): Promise<void> => {
  await executor.execute(
    `CREATE TABLE IF NOT EXISTS app_meta (
      meta_key VARCHAR(128) PRIMARY KEY,
      meta_value LONGTEXT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
  )
}

const hasTableColumn = async (
  executor: SqlExecutor,
  tableName: string,
  columnName: string,
): Promise<boolean> => {
  const [rows] = (await executor.execute(
    `SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    LIMIT 1`,
    [tableName, columnName],
  )) as [RowDataPacket[], unknown]

  return Array.isArray(rows) && rows.length > 0
}

const ensureIncidentReportsSchema = async (
  executor: SqlExecutor,
): Promise<void> => {
  const hasItemsJson = await hasTableColumn(
    executor,
    'incident_reports',
    'items_json',
  )
  if (!hasItemsJson) {
    await executor.execute(
      'ALTER TABLE incident_reports ADD COLUMN items_json LONGTEXT NULL AFTER meal_equipment_json',
    )
  }
}

const toDbGender = (value: unknown): DbGender => {
  const direct = genderToDb[toText(value)]
  if (direct) {
    return direct
  }

  const normalized = toText(value).trim().toUpperCase()
  if (normalized === 'MALE' || normalized === 'L') {
    return 'MALE'
  }
  if (normalized === 'FEMALE' || normalized === 'P') {
    return 'FEMALE'
  }

  return 'MALE'
}

const toDbReligion = (value: unknown): DbReligion => {
  const direct = religionToDb[toText(value)]
  if (direct) {
    return direct
  }

  const normalized = toText(value).trim().toLowerCase()
  const fallbackMap: Record<string, DbReligion> = {
    islam: 'ISLAM',
    kristen: 'CHRISTIAN',
    christian: 'CHRISTIAN',
    katolik: 'CATHOLIC',
    catholic: 'CATHOLIC',
    hindu: 'HINDU',
    buddha: 'BUDDHIST',
    buddhist: 'BUDDHIST',
    konghucu: 'CONFUCIAN',
    confucian: 'CONFUCIAN',
    lainnya: 'OTHER',
    other: 'OTHER',
  }

  return fallbackMap[normalized] ?? 'OTHER'
}

const toDbServicePackage = (value: unknown): DbServicePackage => {
  const direct = serviceToDb[toText(value)]
  if (direct) {
    return direct
  }

  const normalized = toText(value).trim().toLowerCase()
  if (
    normalized === 'harian' ||
    normalized === 'daily'
  ) {
    return 'DAILY'
  }
  if (
    normalized === '2-mingguan' ||
    normalized === '2 mingguan' ||
    normalized === 'biweekly'
  ) {
    return 'BIWEEKLY'
  }
  if (
    normalized === 'bulanan' ||
    normalized === 'monthly'
  ) {
    return 'MONTHLY'
  }

  return 'DAILY'
}

const REDACTED_TEXT = '[DISENSOR]'

export const maskSensitiveData = (data: AppData): AppData => {
  return {
    ...data,
    children: data.children.map((child) => ({
      ...child,
      fatherName: REDACTED_TEXT,
      motherName: REDACTED_TEXT,
      homeAddress: REDACTED_TEXT,
      officeAddress: REDACTED_TEXT,
      homePhone: '',
      whatsappNumber: '',
      email: '',
      otherPhone: '',
      // pickupPersons: child.pickupPersons.map(() => REDACTED_TEXT), // Don't mask pickup persons as per request
    })),
  }
}

const toDbPhysicalCondition = (value: unknown): DbPhysicalCondition => {
  const mapped = physicalToDb[toText(value)]
  if (mapped) {
    return mapped
  }
  return toText(value).trim().toUpperCase() === 'SICK' ? 'SICK' : 'HEALTHY'
}

const toDbEmotionalCondition = (value: unknown): DbEmotionalCondition => {
  const mapped = emotionalToDb[toText(value)]
  if (mapped) {
    return mapped
  }
  return toText(value).trim().toUpperCase() === 'SAD' ? 'SAD' : 'HAPPY'
}

const mapChildRow = (row: RowDataPacket): ChildProfile => ({
  id: String(row.id),
  createdAt: toIsoDateTime(row.created_at),
  updatedAt: toIsoDateTime(row.updated_at),
  fullName: typeof row.full_name === 'string' ? row.full_name : '',
  nickName: typeof row.nick_name === 'string' ? row.nick_name : '',
  gender: dbToGender[row.gender as DbGender] ?? 'L',
  photoDataUrl: typeof row.photo_path === 'string' ? row.photo_path : '',
  birthPlace: typeof row.birth_place === 'string' ? row.birth_place : '',
  birthDate: toDate(row.birth_date),
  childOrder: typeof row.child_order === 'string' ? row.child_order : '',
  religion: dbToReligion[row.religion as DbReligion] ?? 'islam',
  outsideActivities:
    typeof row.outside_activities === 'string' ? row.outside_activities : '',
  fatherName: typeof row.profile_father_name === 'string' ? row.profile_father_name : '',
  motherName: typeof row.profile_mother_name === 'string' ? row.profile_mother_name : '',
  homeAddress: typeof row.profile_home_address === 'string' ? row.profile_home_address : '',
  homePhone: typeof row.profile_home_phone === 'string' ? row.profile_home_phone : '',
  officeAddress: typeof row.profile_office_address === 'string' ? row.profile_office_address : '',
  otherPhone: typeof row.profile_other_phone === 'string' ? row.profile_other_phone : '',
  email: typeof row.profile_email === 'string' ? row.profile_email : '',
  whatsappNumber: typeof row.profile_whatsapp_number === 'string' ? row.profile_whatsapp_number : '',
  allergy: typeof row.allergy === 'string' ? row.allergy : '',
  servicePackage: dbToService[row.service_package as DbServicePackage] ?? 'harian',
  arrivalTime: toTime(row.planned_arrival_time),
  departureTime: toTime(row.planned_departure_time),
  pickupPersons: parseStringArrayJson(row.pickup_persons_json),
  depositPurpose: typeof row.deposit_purpose === 'string' ? row.deposit_purpose : '',
  prenatalPeriod: typeof row.prenatal_period === 'string' ? row.prenatal_period : '',
  partusPeriod: typeof row.partus_period === 'string' ? row.partus_period : '',
  postNatalPeriod:
    typeof row.post_natal_period === 'string' ? row.post_natal_period : '',
  motorSkill: typeof row.motor_skill === 'string' ? row.motor_skill : '',
  languageSkill: typeof row.language_skill === 'string' ? row.language_skill : '',
  healthHistory: typeof row.health_history === 'string' ? row.health_history : '',
  toiletTrainingBab:
    typeof row.toilet_training_bab === 'string' ? row.toilet_training_bab : '',
  toiletTrainingBak:
    typeof row.toilet_training_bak === 'string' ? row.toilet_training_bak : '',
  toiletTrainingBath:
    typeof row.toilet_training_bath === 'string' ? row.toilet_training_bath : '',
  brushingTeeth: typeof row.brushing_teeth === 'string' ? row.brushing_teeth : '',
  eating: typeof row.eating_habit === 'string' ? row.eating_habit : '',
  drinkingMilk:
    typeof row.drinking_milk_habit === 'string' ? row.drinking_milk_habit : '',
  whenCrying: typeof row.when_crying === 'string' ? row.when_crying : '',
  whenPlaying: typeof row.when_playing === 'string' ? row.when_playing : '',
  sleeping: typeof row.sleeping_habit === 'string' ? row.sleeping_habit : '',
  otherHabits: typeof row.other_habits === 'string' ? row.other_habits : '',
})

const mapAttendanceRow = (row: RowDataPacket): AttendanceRecord => {
  const noteData = parseAttendanceNotesJson(row.notes)

  return {
    id: String(row.id),
    createdAt: toIsoDateTime(row.created_at),
    updatedAt: toIsoDateTime(row.updated_at),
    childId: String(row.child_id),
    date: toDate(row.attendance_date),
    escortName: typeof row.escort_name === 'string' ? row.escort_name : '',
    pickupName: typeof row.pickup_name === 'string' ? row.pickup_name : '',
    parentMessage: noteData.parentMessage || '',
    messageForParent: noteData.messageForParent || '',
    departureNotes: noteData.departureNotes || '',
    arrivalTime: toTime(row.arrival_time),
    departureTime: toTime(row.departure_time),
    arrivalPhysicalCondition:
      noteData.arrivalPhysicalCondition || 'sehat',
    arrivalEmotionalCondition:
      noteData.arrivalEmotionalCondition || 'senang',
    departurePhysicalCondition:
      noteData.departurePhysicalCondition || 'sehat',
    departureEmotionalCondition:
      noteData.departureEmotionalCondition || 'senang',
    carriedItems: noteData.carriedItems,
    escortSignatureDataUrl:
      typeof row.escort_signature_data === 'string' ? row.escort_signature_data : '',
    pickupSignatureDataUrl:
      typeof row.pickup_signature_data === 'string' ? row.pickup_signature_data : '',
  }
}

const mapIncidentRow = (row: RowDataPacket): IncidentReport => {
  const mealEquipment = parseMealEquipmentJson(row.meal_equipment_json)
  const bathEquipment = typeof row.bath_equipment === 'string' ? row.bath_equipment : ''
  const medicines = typeof row.medicines === 'string' ? row.medicines : ''
  const bag = typeof row.bag_items === 'string' ? row.bag_items : ''
  const parsedItemsJson = parseIncidentItemsJson(row.items_json)

  const carriedItems =
    parsedItemsJson.items.length > 0
      ? parsedItemsJson.items
      : buildIncidentItemsFromLegacy(mealEquipment, bathEquipment, medicines, bag)

  return {
    id: String(row.id),
    createdAt: toIsoDateTime(row.created_at),
    updatedAt: toIsoDateTime(row.updated_at),
    childId: String(row.child_id),
    date: toDate(row.report_date),
    arrivalPhysicalCondition:
      dbToPhysical[row.arrival_physical_condition as DbPhysicalCondition] ?? 'sehat',
    arrivalEmotionalCondition:
      dbToEmotional[row.arrival_emotional_condition as DbEmotionalCondition] ??
      'senang',
    departurePhysicalCondition:
      dbToPhysical[row.departure_physical_condition as DbPhysicalCondition] ??
      'sehat',
    departureEmotionalCondition:
      dbToEmotional[row.departure_emotional_condition as DbEmotionalCondition] ??
      'senang',
    carriedItemsPhotoDataUrl: parsedItemsJson.groupPhotoDataUrl,
    carriedItems,
    mealEquipment,
    bathEquipment,
    medicines,
    bag,
    parentMessage:
      typeof row.parent_message === 'string' ? row.parent_message : '',
    messageForParent:
      typeof row.message_for_parent === 'string' ? row.message_for_parent : '',
    notes: typeof row.notes === 'string' ? row.notes : '',
    arrivalSignatureDataUrl:
      typeof row.arrival_signature_data === 'string' ? row.arrival_signature_data : '',
    departureSignatureDataUrl:
      typeof row.departure_signature_data === 'string'
        ? row.departure_signature_data
        : '',
  }
}

const mapCommunicationRow = (row: RowDataPacket): CommunicationBookEntry => ({
  id: String(row.id),
  createdAt: toIsoDateTime(row.created_at),
  updatedAt: toIsoDateTime(row.updated_at),
  childId: String(row.child_id),
  date: toDate(row.entry_date),
  inventoryItems: parseStringArrayJson(row.inventory_items_json),
  notes: typeof row.notes === 'string' ? row.notes : '',
})

export const getAppData = async (): Promise<AppData> => {
  await ensureChildrenTable(dbPool)
  await ensureIncidentReportsSchema(dbPool)
  await ensureParentRelationshipSchema(dbPool)

  const [childrenRows, incidentRows, attendanceRows, observationRows, supplyRows] =
    await Promise.all([
      dbPool.query<RowDataPacket[]>(
        `SELECT
          c.*,
          p.father_name AS profile_father_name,
          p.mother_name AS profile_mother_name,
          p.email AS profile_email,
          p.whatsapp_number AS profile_whatsapp_number,
          p.home_phone AS profile_home_phone,
          p.other_phone AS profile_other_phone,
          p.home_address AS profile_home_address,
          p.office_address AS profile_office_address
        FROM children c
        LEFT JOIN parent_profiles p ON p.id = c.parent_profile_id
        WHERE c.is_active = 1
        ORDER BY c.created_at DESC`,
      ),
      dbPool.query<RowDataPacket[]>(
        'SELECT * FROM incident_reports ORDER BY report_date DESC, created_at DESC',
      ),
      dbPool.query<RowDataPacket[]>(
        'SELECT * FROM attendance_records ORDER BY attendance_date DESC, created_at DESC',
      ),
      dbPool.query<RowDataPacket[]>(
        'SELECT * FROM observation_records ORDER BY observation_date DESC, created_at DESC',
      ),
      dbPool.query<RowDataPacket[]>(
        'SELECT * FROM supply_inventory ORDER BY created_at DESC',
      ),
    ])

  // Map observation records with items
  const obsRecords = observationRows[0] ?? []
  const obsIds = obsRecords.map((r: any) => r.id)
  let obsItemsMap = new Map<number, ObservationItem[]>()
  if (obsIds.length > 0) {
    const [itemRows] = await dbPool.query<RowDataPacket[]>(
      `SELECT * FROM observation_items WHERE observation_record_id IN (${obsIds.map(() => '?').join(',')}) ORDER BY sort_order ASC`,
      obsIds
    )
    for (const item of itemRows) {
      const list = obsItemsMap.get(item.observation_record_id) || []
      list.push({
        id: String(item.id),
        activity: toText(item.activity),
        indicator: toText(item.indicator),
        category: toObservationCategory(item.category),
        notes: toText(item.notes),
      })
      obsItemsMap.set(item.observation_record_id, list)
    }
  }

  const observationRecords: ObservationRecord[] = obsRecords.map((row: any) => ({
    id: String(row.id),
    createdAt: toIsoDateTime(row.created_at),
    updatedAt: toIsoDateTime(row.updated_at),
    childId: String(row.child_id),
    date: toDate(row.observation_date),
    groupName: toText(row.group_name),
    observerName: toText(row.observer_name),
    items: obsItemsMap.get(row.id) || [],
  }))

  const supplyInventory: SupplyInventoryItem[] = (supplyRows[0] ?? []).map((row: any) => ({
    id: String(row.id),
    createdAt: toIsoDateTime(row.created_at),
    updatedAt: toIsoDateTime(row.updated_at),
    childId: String(row.child_id),
    productName: toText(row.product_name),
    category: toText(row.category),
    quantity: Number(row.quantity) || 0,
    description: toText(row.description),
    imageDataUrl: toText(row.image_path),
    imageName: toText(row.image_name),
  }))

  return {
    version: APP_DATA_VERSION,
    children: childrenRows[0].map(mapChildRow),
    incidentReports: incidentRows[0].map(mapIncidentRow),
    attendanceRecords: attendanceRows[0].map(mapAttendanceRow),
    observationRecords,
    communicationBooks: [],
    supplyInventory,
  }
}

const stripMealEquipmentMedia = (equipment: MealEquipment): MealEquipment => ({
  drinkingBottle: {
    ...equipment.drinkingBottle,
    imageDataUrl: '',
    imageName: '',
  },
  milkBottle: {
    ...equipment.milkBottle,
    imageDataUrl: '',
    imageName: '',
  },
  mealContainer: {
    ...equipment.mealContainer,
    imageDataUrl: '',
    imageName: '',
  },
  snackContainer: {
    ...equipment.snackContainer,
    imageDataUrl: '',
    imageName: '',
  },
})

export const stripAppDataMediaPayload = (data: AppData): AppData => ({
  ...data,
  children: data.children.map((child) => ({
    ...child,
    photoDataUrl: '',
  })),
  incidentReports: data.incidentReports.map((report) => ({
    ...report,
    carriedItemsPhotoDataUrl: '',
    arrivalSignatureDataUrl: '',
    departureSignatureDataUrl: '',
    mealEquipment: stripMealEquipmentMedia(report.mealEquipment),
  })),
  attendanceRecords: data.attendanceRecords.map((record) => ({
    ...record,
    escortSignatureDataUrl: '',
    pickupSignatureDataUrl: '',
    carriedItems: record.carriedItems.map((item) => ({
      ...item,
      imageDataUrl: '',
      imageName: '',
    })),
  })),
  supplyInventory: data.supplyInventory.map((item) => ({
    ...item,
    imageDataUrl: '',
    imageName: '',
  })),
})

const serializeChild = (child: ChildProfile) => ({
  fullName: toText(child.fullName).trim(),
  nickName: toText(child.nickName).trim(),
  gender: toDbGender(child.gender),
  photoPath: toNullable(child.photoDataUrl),
  birthPlace: toText(child.birthPlace).trim(),
  birthDate: toDbDate(child.birthDate),
  childOrder: toNullable(child.childOrder),
  religion: toDbReligion(child.religion),
  outsideActivities: toNullable(child.outsideActivities),
  allergy: toNullable(child.allergy),
  servicePackage: toDbServicePackage(child.servicePackage),
  arrivalTime: toDbTime(child.arrivalTime),
  departureTime: toDbTime(child.departureTime),
  depositPurpose: toNullable(child.depositPurpose),
  prenatalPeriod: toNullable(child.prenatalPeriod),
  partusPeriod: toNullable(child.partusPeriod),
  postNatalPeriod: toNullable(child.postNatalPeriod),
  motorSkill: toNullable(child.motorSkill),
  languageSkill: toNullable(child.languageSkill),
  healthHistory: toNullable(child.healthHistory),
  toiletTrainingBab: toNullable(child.toiletTrainingBab),
  toiletTrainingBak: toNullable(child.toiletTrainingBak),
  toiletTrainingBath: toNullable(child.toiletTrainingBath),
  brushingTeeth: toNullable(child.brushingTeeth),
  eating: toNullable(child.eating),
  drinkingMilk: toNullable(child.drinkingMilk),
  whenCrying: toNullable(child.whenCrying),
  whenPlaying: toNullable(child.whenPlaying),
  sleeping: toNullable(child.sleeping),
  otherHabits: toNullable(child.otherHabits),
  pickupPersons: Array.isArray(child.pickupPersons) ? child.pickupPersons : [],
  createdAt: toDbDateTime(child.createdAt),
  updatedAt: toDbDateTime(child.updatedAt),
})

const serializeAttendance = (record: AttendanceRecord, childId: number) => ({
  childId,
  date: toDbDate(record.date),
  escortName: toText(record.escortName).trim(),
  pickupName: toText(record.pickupName).trim(),
  arrivalTime: toDbTime(record.arrivalTime),
  departureTime: toDbTime(record.departureTime),
  notes: toDbAttendanceNotesJson(record),
  escortSignatureData: toText(record.escortSignatureDataUrl).trim(),
  pickupSignatureData: toText(record.pickupSignatureDataUrl).trim(),
  createdAt: toDbDateTime(record.createdAt),
  updatedAt: toDbDateTime(record.updatedAt),
})

const serializeIncident = (report: IncidentReport, childId: number) => {
  const normalizedItems = sanitizeIncidentCarriedItems(
    (Array.isArray(report.carriedItems) ? report.carriedItems : []) as IncidentCarriedItem[],
  )
  const carriedItems =
    normalizedItems.length > 0
      ? normalizedItems
      : buildIncidentItemsFromLegacy(
        report.mealEquipment || defaultMealEquipment(),
        toText(report.bathEquipment),
        toText(report.medicines),
        toText(report.bag),
      )

  const legacyFromItems = buildLegacyFieldsFromIncidentItems(carriedItems)
  const fallbackMealEquipment =
    report.mealEquipment && isObject(report.mealEquipment)
      ? report.mealEquipment
      : defaultMealEquipment()

  const mealEquipment =
    carriedItems.length > 0 ? legacyFromItems.mealEquipment : fallbackMealEquipment
  const bathEquipment =
    carriedItems.length > 0 ? legacyFromItems.bathEquipment : toText(report.bathEquipment)
  const medicines =
    carriedItems.length > 0 ? legacyFromItems.medicines : toText(report.medicines)
  const bagItems =
    carriedItems.length > 0 ? legacyFromItems.bagItems : toText(report.bag)

  return {
    childId,
    date: toDbDate(report.date),
    arrivalPhysicalCondition: toDbPhysicalCondition(report.arrivalPhysicalCondition),
    arrivalEmotionalCondition: toDbEmotionalCondition(report.arrivalEmotionalCondition),
    departurePhysicalCondition: toDbPhysicalCondition(
      report.departurePhysicalCondition,
    ),
    departureEmotionalCondition: toDbEmotionalCondition(
      report.departureEmotionalCondition,
    ),
    mealEquipmentJson: JSON.stringify(mealEquipment),
    itemsJson: JSON.stringify({
      version: 1,
      groupPhotoDataUrl: toText(report.carriedItemsPhotoDataUrl),
      items: carriedItems.map((item) => ({
        categoryKey: toIncidentCategoryKey(item.categoryKey),
        description: toText(item.description).trim(),
      })),
    }),
    bathEquipment: toNullable(bathEquipment),
    medicines: toNullable(medicines),
    bagItems: toNullable(bagItems),
    parentMessage: toNullable(report.parentMessage),
    messageForParent: toNullable(report.messageForParent),
    notes: toNullable(report.notes),
    arrivalSignatureData: toNullable(report.arrivalSignatureDataUrl),
    departureSignatureData: toNullable(report.departureSignatureDataUrl),
    createdAt: toDbDateTime(report.createdAt),
    updatedAt: toDbDateTime(report.updatedAt),
  }
}

const serializeCommunication = (entry: CommunicationBookEntry, childId: number) => ({
  childId,
  date: toDbDate(entry.date),
  inventoryItemsJson: JSON.stringify(
    (Array.isArray(entry.inventoryItems) ? entry.inventoryItems : [])
      .map((item) => toText(item).trim())
      .filter(Boolean),
  ),
  notes: toNullable(entry.notes),
  createdAt: toDbDateTime(entry.createdAt),
  updatedAt: toDbDateTime(entry.updatedAt),
})

const insertChild = async (
  connection: PoolConnection,
  child: ChildProfile,
): Promise<number> => {
  const payload = serializeChild(child)
  const preservedChildId = toNumericDbId(child.id)
  const parentProfileId = await resolveParentProfileId(connection, {
    fatherName: child.fatherName,
    motherName: child.motherName,
    email: child.email,
    whatsappNumber: child.whatsappNumber,
    homePhone: child.homePhone,
    otherPhone: child.otherPhone,
    homeAddress: child.homeAddress,
    officeAddress: child.officeAddress,
  })

  if (preservedChildId !== null) {
    await connection.execute(
      `INSERT INTO children (
        id,
        full_name,
        nick_name,
        gender,
        photo_path,
        birth_place,
        birth_date,
        child_order,
        religion,
        outside_activities,
        allergy,
        service_package,
        planned_arrival_time,
        planned_departure_time,
        deposit_purpose,
        prenatal_period,
        partus_period,
        post_natal_period,
        motor_skill,
        language_skill,
        health_history,
        toilet_training_bab,
        toilet_training_bak,
        toilet_training_bath,
        brushing_teeth,
        eating_habit,
        drinking_milk_habit,
        when_crying,
        when_playing,
        sleeping_habit,
        other_habits,
        pickup_persons_json,
        parent_profile_id,
        is_active,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        preservedChildId,
        payload.fullName,
        payload.nickName,
        payload.gender,
        payload.photoPath,
        payload.birthPlace,
        payload.birthDate,
        payload.childOrder,
        payload.religion,
        payload.outsideActivities,
        payload.allergy,
        payload.servicePackage,
        payload.arrivalTime,
        payload.departureTime,
        payload.depositPurpose,
        payload.prenatalPeriod,
        payload.partusPeriod,
        payload.postNatalPeriod,
        payload.motorSkill,
        payload.languageSkill,
        payload.healthHistory,
        payload.toiletTrainingBab,
        payload.toiletTrainingBak,
        payload.toiletTrainingBath,
        payload.brushingTeeth,
        payload.eating,
        payload.drinkingMilk,
        payload.whenCrying,
        payload.whenPlaying,
        payload.sleeping,
        payload.otherHabits,
        JSON.stringify(payload.pickupPersons || []),
        parentProfileId,
        payload.createdAt,
        payload.updatedAt,
      ],
    )

    return preservedChildId
  }

  const [result] = await connection.execute(
    `INSERT INTO children (
      full_name,
      nick_name,
      gender,
      photo_path,
      birth_place,
      birth_date,
      child_order,
      religion,
      outside_activities,
      allergy,
      service_package,
      planned_arrival_time,
      planned_departure_time,
      deposit_purpose,
      prenatal_period,
      partus_period,
      post_natal_period,
      motor_skill,
      language_skill,
      health_history,
      toilet_training_bab,
      toilet_training_bak,
      toilet_training_bath,
      brushing_teeth,
      eating_habit,
      drinking_milk_habit,
      when_crying,
      when_playing,
      sleeping_habit,
      other_habits,
      pickup_persons_json,
      parent_profile_id,
      is_active,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      payload.fullName,
      payload.nickName,
      payload.gender,
      payload.photoPath,
      payload.birthPlace,
      payload.birthDate,
      payload.childOrder,
      payload.religion,
      payload.outsideActivities,
      payload.allergy,
      payload.servicePackage,
      payload.arrivalTime,
      payload.departureTime,
      payload.depositPurpose,
      payload.prenatalPeriod,
      payload.partusPeriod,
      payload.postNatalPeriod,
      payload.motorSkill,
      payload.languageSkill,
      payload.healthHistory,
      payload.toiletTrainingBab,
      payload.toiletTrainingBak,
      payload.toiletTrainingBath,
      payload.brushingTeeth,
      payload.eating,
      payload.drinkingMilk,
      payload.whenCrying,
      payload.whenPlaying,
      payload.sleeping,
      payload.otherHabits,
      JSON.stringify(payload.pickupPersons || []),
      parentProfileId,
      payload.createdAt,
      payload.updatedAt,
    ],
  )

  if (!isObject(result) || typeof result.insertId !== 'number') {
    throw new ServiceError(500, 'Gagal menyimpan data anak.')
  }
  return result.insertId
}

const insertAttendance = async (
  connection: PoolConnection,
  record: AttendanceRecord,
  childId: number,
): Promise<void> => {
  const payload = serializeAttendance(record, childId)
  await connection.execute(
    `INSERT INTO attendance_records (
      child_id,
      attendance_date,
      escort_name,
      pickup_name,
      arrival_time,
      departure_time,
      escort_signature_data,
      pickup_signature_data,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      escort_name = VALUES(escort_name),
      pickup_name = VALUES(pickup_name),
      arrival_time = VALUES(arrival_time),
      departure_time = VALUES(departure_time),
      escort_signature_data = VALUES(escort_signature_data),
      pickup_signature_data = VALUES(pickup_signature_data),
      notes = VALUES(notes),
      updated_at = VALUES(updated_at)`,
    [
      payload.childId,
      payload.date,
      payload.escortName,
      payload.pickupName,
      payload.arrivalTime,
      payload.departureTime,
      payload.escortSignatureData,
      payload.pickupSignatureData,
      payload.notes,
      payload.createdAt,
      payload.updatedAt,
    ],
  )
}

const insertIncident = async (
  connection: PoolConnection,
  report: IncidentReport,
  childId: number,
): Promise<void> => {
  const payload = serializeIncident(report, childId)
  await connection.execute(
    `INSERT INTO incident_reports (
      child_id,
      report_date,
      arrival_physical_condition,
      arrival_emotional_condition,
      departure_physical_condition,
      departure_emotional_condition,
      meal_equipment_json,
      items_json,
      bath_equipment,
      medicines,
      bag_items,
      parent_message,
      message_for_parent,
      notes,
      arrival_signature_data,
      departure_signature_data,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      arrival_physical_condition = VALUES(arrival_physical_condition),
      arrival_emotional_condition = VALUES(arrival_emotional_condition),
      departure_physical_condition = VALUES(departure_physical_condition),
      departure_emotional_condition = VALUES(departure_emotional_condition),
      meal_equipment_json = VALUES(meal_equipment_json),
      items_json = VALUES(items_json),
      bath_equipment = VALUES(bath_equipment),
      medicines = VALUES(medicines),
      bag_items = VALUES(bag_items),
      parent_message = VALUES(parent_message),
      message_for_parent = VALUES(message_for_parent),
      notes = VALUES(notes),
      arrival_signature_data = VALUES(arrival_signature_data),
      departure_signature_data = VALUES(departure_signature_data),
      updated_at = VALUES(updated_at)`,
    [
      payload.childId,
      payload.date,
      payload.arrivalPhysicalCondition,
      payload.arrivalEmotionalCondition,
      payload.departurePhysicalCondition,
      payload.departureEmotionalCondition,
      payload.mealEquipmentJson,
      payload.itemsJson,
      payload.bathEquipment,
      payload.medicines,
      payload.bagItems,
      payload.parentMessage,
      payload.messageForParent,
      payload.notes,
      payload.arrivalSignatureData,
      payload.departureSignatureData,
      payload.createdAt,
      payload.updatedAt,
    ],
  )
}


const sanitizePayload = (value: AppData): AppData => ({
  version: typeof value.version === 'number' ? value.version : APP_DATA_VERSION,
  children: Array.isArray(value.children) ? value.children : [],
  incidentReports: Array.isArray(value.incidentReports) ? value.incidentReports : [],
  attendanceRecords: Array.isArray(value.attendanceRecords)
    ? value.attendanceRecords
    : [],
  observationRecords: Array.isArray(value.observationRecords)
    ? value.observationRecords
    : [],
  communicationBooks: Array.isArray(value.communicationBooks)
    ? value.communicationBooks
    : [],
  supplyInventory: Array.isArray(value.supplyInventory)
    ? value.supplyInventory
    : [],
})

const preprocessAppDataImages = async (data: AppData): Promise<AppData> => {
  // Process Children
  const children = await Promise.all(
    data.children.map(async (child) => ({
      ...child,
      photoDataUrl: await saveBase64ToDisk(child.photoDataUrl, 'child'),
    })),
  )

  // Process Supply Inventory
  const supplyInventory = await Promise.all(
    data.supplyInventory.map(async (item) => ({
      ...item,
      imageDataUrl: await saveBase64ToDisk(item.imageDataUrl, 'inventory'),
    })),
  )

  // Process Attendance Records
  const attendanceRecords = await Promise.all(
    data.attendanceRecords.map(async (record) => ({
      ...record,
      escortSignatureDataUrl: await saveBase64ToDisk(
        record.escortSignatureDataUrl,
        'sig_escort',
      ),
      pickupSignatureDataUrl: await saveBase64ToDisk(
        record.pickupSignatureDataUrl,
        'sig_pickup',
      ),
      carriedItems: await Promise.all(
        (record.carriedItems || []).map(async (item) => ({
          ...item,
          imageDataUrl: await saveBase64ToDisk(item.imageDataUrl, 'item'),
        })),
      ),
    })),
  )

  // Process Incident Reports
  const incidentReports = await Promise.all(
    data.incidentReports.map(async (report) => {
      const me = report.mealEquipment || defaultMealEquipment()
      const processedME = {
        drinkingBottle: {
          ...me.drinkingBottle,
          imageDataUrl: await saveBase64ToDisk(
            me.drinkingBottle.imageDataUrl,
            'meal_drinking',
          ),
        },
        milkBottle: {
          ...me.milkBottle,
          imageDataUrl: await saveBase64ToDisk(
            me.milkBottle.imageDataUrl,
            'meal_milk',
          ),
        },
        mealContainer: {
          ...me.mealContainer,
          imageDataUrl: await saveBase64ToDisk(
            me.mealContainer.imageDataUrl,
            'meal_container',
          ),
        },
        snackContainer: {
          ...me.snackContainer,
          imageDataUrl: await saveBase64ToDisk(
            me.snackContainer.imageDataUrl,
            'meal_snack',
          ),
        },
      }

      return {
        ...report,
        carriedItemsPhotoDataUrl: await saveBase64ToDisk(
          report.carriedItemsPhotoDataUrl,
          'incident_group',
        ),
        arrivalSignatureDataUrl: await saveBase64ToDisk(
          report.arrivalSignatureDataUrl,
          'sig_arrival',
        ),
        departureSignatureDataUrl: await saveBase64ToDisk(
          report.departureSignatureDataUrl,
          'sig_departure',
        ),
        mealEquipment: processedME,
      }
    }),
  )

  return {
    ...data,
    children,
    supplyInventory,
    attendanceRecords,
    incidentReports,
  }
}

export const replaceAppData = async (payload: AppData): Promise<AppData> => {
  const safePayload = await preprocessAppDataImages(sanitizePayload(payload))
  const connection = await dbPool.getConnection()

  try {
    await ensureAppMetaTable(connection)
    await ensureIncidentReportsSchema(connection)
    await ensureParentRelationshipSchema(connection)
    await connection.beginTransaction()
    await connection.execute('DELETE FROM attendance_records')
    await connection.execute('DELETE FROM incident_reports')
    await connection.execute('DELETE FROM children')

    const childIdMap = new Map<string, number>()

    for (const child of safePayload.children) {
      const dbId = await insertChild(connection, child)
      childIdMap.set(child.id, dbId)
    }

    for (const record of safePayload.attendanceRecords) {
      const childId = childIdMap.get(record.childId)
      if (!childId) continue
      await insertAttendance(connection, record, childId)
    }

    for (const report of safePayload.incidentReports) {
      const childId = childIdMap.get(report.childId)
      if (!childId) continue
      await insertIncident(connection, report, childId)
    }

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  return getAppData()
}
