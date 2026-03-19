export type ObservationCategory =
    | ''
    | 'perlu-arahan'
    | 'perlu-latihan'
    | 'sudah-baik'

export interface ObservationItem {
    id: string
    activity: string
    indicator: string
    category: ObservationCategory
    notes: string
}

export interface ObservationRecord {
    id: string
    createdAt: string
    updatedAt: string
    childId: string
    date: string
    groupName: string
    observerName: string
    items: ObservationItem[]
}

export type ObservationRecordInput = Omit<ObservationRecord, 'id' | 'createdAt' | 'updatedAt'>

export interface ObservationTemplateItemConfig {
    activity: string
    indicator: string
    defaultCategory: ObservationCategory
}

export interface ObservationTemplateConfig {
    isLocked: boolean
    groupName: string
    observerName: string
    items: ObservationTemplateItemConfig[]
}

export interface ObservationItemUiState {
    isCommitted: boolean
    baseline: ObservationItem
}

export type ObservationItemUiMap = Record<string, ObservationItemUiState>
