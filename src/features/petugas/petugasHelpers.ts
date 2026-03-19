import {
    ClipboardCheck,
    ClipboardList,
    Boxes,
    UsersRound,
} from 'lucide-react'
import type { SidebarMenuItem } from '../../components/layout/Sidebar'
import type {
    AppData,
    AttendanceRecord,
    ConfirmDialogOptions,
    IncidentReport,
    ObservationRecord,
} from '../../types'

// ─── ID generation ──────────────────────────────────────────────────────────

export const createId = (): string => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID()
    }
    return `${Date.now()} -${Math.random().toString(16).slice(2)} `
}

// ─── Data normalization helpers ─────────────────────────────────────────────

export const normalizeAttendanceRecord = (
    record: AttendanceRecord,
): AttendanceRecord => ({
    ...record,
    parentMessage: record.parentMessage || '',
    messageForParent: record.messageForParent || '',
    departureNotes: record.departureNotes || '',
    arrivalPhysicalCondition: record.arrivalPhysicalCondition || 'sehat',
    arrivalEmotionalCondition: record.arrivalEmotionalCondition || 'senang',
    departurePhysicalCondition: record.departurePhysicalCondition || 'sehat',
    departureEmotionalCondition: record.departureEmotionalCondition || 'senang',
    carriedItems: Array.isArray(record.carriedItems) ? record.carriedItems : [],
})

export const normalizeIncidentReport = (record: IncidentReport): IncidentReport => {
    const fallbackMealEquipment = {
        drinkingBottle: { brand: '', imageDataUrl: '', imageName: '', description: '' },
        milkBottle: { brand: '', imageDataUrl: '', imageName: '', description: '' },
        mealContainer: { brand: '', imageDataUrl: '', imageName: '', description: '' },
        snackContainer: { brand: '', imageDataUrl: '', imageName: '', description: '' },
    }

    const mealEquipment = record.mealEquipment ?? fallbackMealEquipment
    const bathEquipment = record.bathEquipment ?? ''
    const medicines = record.medicines ?? ''
    const bag = record.bag ?? ''

    const carriedItems =
        Array.isArray(record.carriedItems) && record.carriedItems.length > 0
            ? record.carriedItems
            : [
                { categoryKey: 'DRINKING_BOTTLE' as const, description: mealEquipment.drinkingBottle.brand || mealEquipment.drinkingBottle.description || '' },
                { categoryKey: 'MILK_CONTAINER' as const, description: mealEquipment.milkBottle.brand || mealEquipment.milkBottle.description || '' },
                { categoryKey: 'MEAL_CONTAINER' as const, description: mealEquipment.mealContainer.brand || mealEquipment.mealContainer.description || '' },
                { categoryKey: 'SNACK_CONTAINER' as const, description: mealEquipment.snackContainer.brand || mealEquipment.snackContainer.description || '' },
                { categoryKey: 'BATH_SUPPLIES' as const, description: bathEquipment },
                { categoryKey: 'MEDICINE_VITAMIN' as const, description: medicines },
                { categoryKey: 'BAG' as const, description: bag },
            ]
                .map((item, index) => ({
                    id: `incident - item - ${index} `,
                    categoryKey: item.categoryKey,
                    description: item.description.trim(),
                }))
                .filter((item) => item.description.length > 0)

    return {
        ...record,
        mealEquipment,
        bathEquipment,
        medicines,
        bag,
        carriedItemsPhotoDataUrl: record.carriedItemsPhotoDataUrl || '',
        carriedItems,
    }
}

export const normalizeObservationRecord = (
    record: ObservationRecord,
): ObservationRecord => ({
    ...record,
    groupName: record.groupName || '',
    observerName: record.observerName || '',
    items: Array.isArray(record.items)
        ? record.items.map((item) => ({
            id: item.id || createId(),
            activity: item.activity || '',
            indicator: item.indicator || '',
            category:
                item.category === 'perlu-arahan' ||
                    item.category === 'perlu-latihan' ||
                    item.category === 'sudah-baik'
                    ? item.category
                    : 'perlu-arahan',
            notes: item.notes || '',
        }))
        : [],
})

export const normalizeAppData = (value: AppData): AppData => ({
    version: typeof value.version === 'number' ? value.version : 1,
    children: Array.isArray(value.children) ? value.children : [],
    incidentReports: Array.isArray(value.incidentReports)
        ? value.incidentReports.map(normalizeIncidentReport)
        : [],
    attendanceRecords: Array.isArray(value.attendanceRecords)
        ? value.attendanceRecords.map(normalizeAttendanceRecord)
        : [],
    observationRecords: Array.isArray(value.observationRecords)
        ? value.observationRecords.map(normalizeObservationRecord)
        : [],
    communicationBooks: Array.isArray(value.communicationBooks)
        ? value.communicationBooks
        : [],
    supplyInventory: Array.isArray(value.supplyInventory) ? value.supplyInventory : [],
})

// ─── Utility helpers ────────────────────────────────────────────────────────

export const getErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : 'Unknown error'

export const isNumericId = (value: string): boolean => /^\d+$/.test(value.trim())

export const formatDateTime = (value: string): string => {
    if (!value) {
        return '-'
    }

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
        return value
    }

    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(parsed)
}

export const formatDateOnly = (value: string): string => {
    if (!value) {
        return '-'
    }

    const parsed = new Date(`${value} T00:00:00`)
    if (Number.isNaN(parsed.getTime())) {
        return value
    }

    return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    }).format(parsed)
}

export const formatTimeOnly = (value: string): string => {
    if (!value) {
        return '-'
    }

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
        return value
    }

    return new Intl.DateTimeFormat('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
    }).format(parsed)
}

// ─── Navigation types ───────────────────────────────────────────────────────

export type PetugasMenuKey = 'berita-acara' | 'kehadiran' | 'observasi' | 'data-anak' | 'inventori'
export type PetugasDataSegment =
    | 'children'
    | 'attendanceRecords'
    | 'incidentReports'
    | 'observationRecords'
    | 'supplyInventory'

export const menuTitles: Record<PetugasMenuKey, { title: string; subtitle: string }> = {
    'berita-acara': {
        title: 'Berita Acara',
        subtitle: 'Perlengkapan harian, pesan orangtua, dan tandatangan',
    },
    kehadiran: {
        title: 'Kehadiran',
        subtitle: 'Pencatatan jam datang dan pulang anak',
    },
    observasi: {
        title: 'Observasi',
        subtitle: 'Form observasi anak berdasarkan kegiatan dan indikator',
    },
    'data-anak': {
        title: 'Data Anak',
        subtitle: 'Profil anak, orangtua, kebiasaan, dan perkembangan',
    },
    inventori: {
        title: 'Inventori',
        subtitle: 'Persediaan stok kebutuhan setiap anak',
    },
}

export const menuDataSegments: Record<PetugasMenuKey, PetugasDataSegment[]> = {
    'data-anak': ['children'],
    kehadiran: ['children', 'attendanceRecords', 'supplyInventory'],
    'berita-acara': ['children', 'incidentReports'],
    observasi: ['children', 'attendanceRecords', 'observationRecords'],
    inventori: ['children', 'supplyInventory'],
}

export const petugasMenus: SidebarMenuItem[] = [
    {
        key: 'kehadiran',
        label: 'Kehadiran',
        icon: UsersRound,
    },
    {
        key: 'berita-acara',
        label: 'Berita Acara',
        icon: ClipboardList,
    },
    {
        key: 'observasi',
        label: 'Observasi',
        icon: ClipboardCheck,
    },
    {
        key: 'inventori',
        label: 'Inventori',
        icon: Boxes,
    },
]

export interface PetugasNavigationState {
    scope: 'petugas'
    menu: PetugasMenuKey
}

export const isPetugasMenuKey = (value: unknown): value is PetugasMenuKey =>
    value === 'berita-acara' ||
    value === 'kehadiran' ||
    value === 'observasi' ||
    value === 'data-anak' ||
    value === 'inventori'

export const isPetugasNavigationState = (value: unknown): value is PetugasNavigationState => {
    if (typeof value !== 'object' || value === null) {
        return false
    }

    const state = value as Partial<PetugasNavigationState>
    return state.scope === 'petugas' && isPetugasMenuKey(state.menu)
}

export const buildPetugasNavigationState = (menu: PetugasMenuKey): PetugasNavigationState => ({
    scope: 'petugas',
    menu,
})

export type ConfirmDialogState = Required<
    Pick<ConfirmDialogOptions, 'title' | 'message' | 'confirmLabel' | 'cancelLabel' | 'tone'>
>
