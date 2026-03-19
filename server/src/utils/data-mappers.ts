import type {
    AttendanceRecord,
    CarriedItem,
    IncidentCarriedItem,
    IncidentCategoryKey,
    MealEquipment,
    ObservationCategory,
    ObservationItem,
    ObservationRecord,
    SupplyInventoryItem,
    DbAttendanceNotes,
    DbGender,
    DbReligion,
    DbServicePackage,
    DbPhysicalCondition,
    DbEmotionalCondition
} from '../types/index.js'
import { toText } from './string-utils.js'

export const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

export const toDate = (value: unknown): string => {
    if (value instanceof Date) {
        return value.toISOString().slice(0, 10)
    }
    if (typeof value === 'string') {
        return value.slice(0, 10)
    }
    return ''
}

export const toTime = (value: unknown): string => {
    if (typeof value !== 'string') {
        return ''
    }
    return value.slice(0, 5)
}

export const toIsoDateTime = (value: unknown): string => {
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

export const toNullable = (value: unknown): string | null => {
    const normalized = toText(value).trim()
    return normalized.length > 0 ? normalized : null
}

export const toDbTime = (value: unknown): string | null => {
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

export const toDbDate = (value: unknown): string => {
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

export const toDbDateTime = (value: unknown): string => {
    const parsed = new Date(toText(value))
    if (Number.isNaN(parsed.getTime())) {
        return toDbDateTime(new Date().toISOString())
    }

    const yyyy = String(parsed.getUTCFullYear())
    const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(parsed.getUTCDate()).padStart(2, '0')
    const hh = String(parsed.getUTCHours()).padStart(2, '0')
    const mi = String(parsed.getUTCMinutes()).padStart(2, '0')
    const ss = String(parsed.getUTCSeconds()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}

export const toNumericDbId = (value: unknown): number | null => {
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

export const parseStringArrayJson = (value: unknown): string[] => {
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

export const parseMealEquipmentJson = (value: unknown): MealEquipment => {
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

const createIncidentItemId = (index: number): string => `incident-item-${index}`

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

export const toIncidentCategoryKey = (value: unknown): IncidentCategoryKey => {
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

interface ParsedIncidentItemsJson {
    groupPhotoDataUrl: string
    items: IncidentCarriedItem[]
}

export const parseIncidentItemsJson = (value: unknown): ParsedIncidentItemsJson => {
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

export const parseAttendanceNotesJson = (
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

export const toAttendanceNotesJson = (notes: DbAttendanceNotes): string => JSON.stringify(notes)

export const toDbAttendanceNotesJson = (record: AttendanceRecord): string =>
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

export const parseSupplyInventoryJson = (value: unknown): SupplyInventoryItem[] => {
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

export const toDbSupplyInventoryJson = (items: SupplyInventoryItem[]): string =>
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

export const sanitizeObservationItem = (value: unknown, index: number): ObservationItem => {
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

export const parseObservationRecordsJson = (value: unknown): ObservationRecord[] => {
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
                    ? item.items.map((observationItem: any, itemIndex: number) =>
                        sanitizeObservationItem(observationItem, itemIndex),
                    )
                    : [],
            }))
            .filter((item) => item.id.length > 0 && item.childId.length > 0)
    } catch {
        return []
    }
}

export const toDbObservationRecordsJson = (records: ObservationRecord[]): string =>
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

const genderToDb: Record<string, DbGender> = {
    L: 'MALE',
    P: 'FEMALE',
}

export const toDbGender = (value: unknown): DbGender => {
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

const religionToDb: Record<string, DbReligion> = {
    islam: 'ISLAM',
    kristen: 'CHRISTIAN',
    katolik: 'CATHOLIC',
    hindu: 'HINDU',
    buddha: 'BUDDHIST',
    konghucu: 'CONFUCIAN',
    lainnya: 'OTHER',
}

export const toDbReligion = (value: unknown): DbReligion => {
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

const serviceToDb: Record<string, DbServicePackage> = {
    harian: 'DAILY',
    '2-mingguan': 'BIWEEKLY',
    bulanan: 'MONTHLY',
}

export const toDbServicePackage = (value: unknown): DbServicePackage => {
    const direct = serviceToDb[toText(value)]
    if (direct) {
        return direct
    }

    const normalized = toText(value).trim().toUpperCase()
    if (normalized === 'DAILY' || normalized === 'HARIAN') return 'DAILY'
    if (normalized === 'BIWEEKLY' || normalized === '2-MINGGUAN') return 'BIWEEKLY'
    if (normalized === 'MONTHLY' || normalized === 'BULANAN') return 'MONTHLY'

    return 'DAILY'
}

export const toDbPhysicalCondition = (value: unknown): DbPhysicalCondition => {
    const text = toText(value).toLowerCase()
    return text === 'sakit' || text === 'sick' ? 'SICK' : 'HEALTHY'
}

export const toDbEmotionalCondition = (value: unknown): DbEmotionalCondition => {
    const text = toText(value).toLowerCase()
    return text === 'sedih' || text === 'sad' ? 'SAD' : 'HAPPY'
}
