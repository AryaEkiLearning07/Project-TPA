import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { AppDatePickerField } from '../../../components/common/DatePickerFields'
import SearchableSelect from '../../../components/common/SearchableSelect'
import type {
  AttendanceRecord,
  ChildProfile,
  ObservationCategory,
  ObservationItem,
  ObservationRecord,
  ObservationRecordInput,
} from '../../../types'
import {
  type FieldErrors,
  validateObservationRecordInput,
} from '../../../utils/validators'
import { getLocalDateIso } from '../../../utils/date'

type ObservationCategoryValue = Exclude<ObservationCategory, ''>
type ObservationGroupKey = 'bulan' | 'pelangi' | 'bintang' | 'matahari'
type ObservationRecapGroupFilter = ObservationGroupKey | 'all'

interface ObservationCategorySummary {
  perluArahan: number
  perluLatihan: number
  sudahBaik: number
}

interface ObservationRecapRow {
  childId: string
  childName: string
  groupLabel: string
  latestDate: string
  observationCount: number
  totalPoints: number
  summary: ObservationCategorySummary
}

interface ObservasiPageProps {
  childrenData: ChildProfile[]
  records: ObservationRecord[]
  attendanceRecords: AttendanceRecord[]
  observerDisplayName: string
  showRecapSection?: boolean
  isTableLoading?: boolean
  onSave: (input: ObservationRecordInput, editingId?: string) => Promise<boolean>
  onNavigateToDataAnak: () => void
}

interface ObservationTemplateItemConfig {
  id: string
  activity: string
  indicator: string
  isDynamicIndicator: boolean
  defaultCategory: ObservationCategoryValue
}

interface ObservationGroupConfig {
  key: ObservationGroupKey
  label: string
  ageMinMonths: number
  ageMaxMonths?: number
  items: ObservationTemplateItemConfig[]
}

const DEFAULT_GROUP_KEY: ObservationGroupKey = 'pelangi'
const RECAP_ALL_GROUP_FILTER: ObservationRecapGroupFilter = 'all'

const observationCategories: Array<{ value: ObservationCategoryValue; label: string }> = [
  { value: 'perlu-arahan', label: 'Perlu Arahan' },
  { value: 'perlu-latihan', label: 'Perlu Latihan' },
  { value: 'sudah-baik', label: 'Sudah Baik' },
]

const createTemplateItems = (
  groupKey: ObservationGroupKey,
  items: Array<{
    activity: string
    indicator: string
    isDynamicIndicator?: boolean
    defaultCategory?: ObservationCategoryValue
  }>,
): ObservationTemplateItemConfig[] =>
  items.map((item, index) => ({
    id: `${groupKey}-${String(index + 1).padStart(2, '0')}`,
    activity: item.activity,
    indicator: item.indicator,
    isDynamicIndicator: Boolean(item.isDynamicIndicator),
    defaultCategory: item.defaultCategory ?? 'perlu-arahan',
  }))

const observationGroups: ObservationGroupConfig[] = [
  {
    key: 'bulan',
    label: 'Kelompok Bulan (2-3 tahun)',
    ageMinMonths: 24,
    ageMaxMonths: 36,
    items: createTemplateItems('bulan', [
      { activity: 'Bermain bebas', indicator: '', isDynamicIndicator: true },
      {
        activity: 'Toilet training',
        indicator: 'Membedakan apa itu buang air besar dan buang air kecil dengan benar',
      },
      {
        activity: 'Toilet training',
        indicator: 'Belajar menurunkan dan menaikkan celana dalam dan celana luar',
      },
      { activity: 'Aktivitas motorik kasar', indicator: '', isDynamicIndicator: true },
      {
        activity: 'Minum susu & makan buah',
        indicator: 'Menarik kran air minum, meskipun masih tercecer atau agak tumpah.',
      },
      { activity: 'Materi terprogram', indicator: '', isDynamicIndicator: true },
      {
        activity: 'Makan siang',
        indicator: 'Memegang sendok masih di ujung dan masih menggenggam (kepalan).',
      },
      {
        activity: 'Makan siang',
        indicator:
          'Memegang sendok, mengambil makan dan menyuapkan ke mulutnya meskipun masih tercecer dan perlu bantuan.',
      },
      {
        activity: 'Gosok gigi dan cuci tangan',
        indicator: 'Memegang gosok gigi sendiri.',
      },
      {
        activity: 'Ganti baju (berpakaian)',
        indicator: 'Melepaskan celana karet secara mandiri.',
      },
      {
        activity: 'Ganti baju (berpakaian)',
        indicator: 'Menaikkan celana karet dengan sedikit bantuan.',
      },
      {
        activity: 'Ganti baju (berpakaian)',
        indicator:
          'Mencoba membuka dan menutup celana yang memakai resleting, walaupun masih dengan sedikit bantuan.',
      },
      {
        activity: 'Ganti baju (berpakaian)',
        indicator: 'Memakai sepatu tanpa tali.',
      },
    ]),
  },
  {
    key: 'pelangi',
    label: 'Kelompok Pelangi (3-4 tahun)',
    ageMinMonths: 36,
    ageMaxMonths: 48,
    items: createTemplateItems('pelangi', [
      { activity: 'Bermain bebas', indicator: '', isDynamicIndicator: true },
      {
        activity: 'Toilet training',
        indicator: 'Menahan sampai masuk ke kamar mandi.',
      },
      {
        activity: 'Toilet training',
        indicator: 'Menggunakan kursi toilet.',
      },
      {
        activity: 'Toilet training',
        indicator:
          'Menggunakan tangan dan kakinya untuk menaiki dan menuruni toilet besar dengan menggunakan bangku kecil.',
      },
      {
        activity: 'Toilet training',
        indicator: 'Menurunkan dan menaikkan celana dalam dan celana luar dengan mandiri.',
      },
      { activity: 'Aktivitas motorik kasar', indicator: '', isDynamicIndicator: true },
      {
        activity: 'Minum susu & makan buah',
        indicator: 'Menarik kran air minum, meskipun masih tercecer atau agak tumpah.',
      },
      { activity: 'Materi terprogram', indicator: '', isDynamicIndicator: true },
      {
        activity: 'Makan siang',
        indicator:
          'Memegang sendok dengan benar (sendok dipegang di tengah dan menggunakan 2 jari, jari telunjuk dan ibu jari).',
      },
      {
        activity: 'Makan siang',
        indicator: 'Makan dengan garpu, tetapi bukan dengan cara seperti orang dewasa.',
      },
      {
        activity: 'Makan siang',
        indicator: 'Makan sendiri, meskipun masih banyak tercecer.',
      },
      {
        activity: 'Makan siang',
        indicator: 'Menarik kran air minum tanpa tercecer.',
      },
      {
        activity: 'Makan siang',
        indicator: 'Menekan pasta gigi dengan benar.',
      },
      {
        activity: 'Gosok gigi dan cuci tangan',
        indicator: 'Memegang gosok gigi dengan benar.',
      },
      {
        activity: 'Ganti baju (berpakaian)',
        indicator:
          'Memakai baju (kaos) dengan bantuan sedikit pada saat merapikan. Membuka dan menutup kancing dengan bantuan.',
      },
      {
        activity: 'Ganti baju (berpakaian)',
        indicator: 'Memakai kaos kaki dengan bantuan.',
      },
    ]),
  },
  {
    key: 'bintang',
    label: 'Kelompok Bintang (4-5 tahun)',
    ageMinMonths: 48,
    ageMaxMonths: 60,
    items: createTemplateItems('bintang', [
      { activity: 'Bermain bebas', indicator: '', isDynamicIndicator: true },
      {
        activity: 'Toilet training',
        indicator: 'Duduk di toilet (atau berdiri di depannya).',
      },
      {
        activity: 'Toilet training',
        indicator: 'Menyiram toilet.',
      },
      {
        activity: 'Toilet training',
        indicator: 'Membersihkan alat kelamin setelah selesai menyiram.',
      },
      {
        activity: 'Toilet training',
        indicator: 'Turun dari toilet.',
      },
      { activity: 'Aktivitas motorik kasar', indicator: '', isDynamicIndicator: true },
      {
        activity: 'Minum susu & makan buah',
        indicator: 'Menggunakan sendok dan garpu dengan benar.',
      },
      { activity: 'Materi terprogram', indicator: '', isDynamicIndicator: true },
      {
        activity: 'Makan siang',
        indicator: 'Makan sendiri tanpa tercecer.',
      },
      {
        activity: 'Makan siang',
        indicator: 'Mengambil makanan untuk dirinya saat di meja makan.',
      },
      {
        activity: 'Makan siang',
        indicator: 'Menggunakan sendok dan garpu dengan benar.',
      },
      {
        activity: 'Makan siang',
        indicator: 'Mengerti tentang waktu makan (makan pagi, makan siang, makan malam).',
      },
      {
        activity: 'Gosok gigi dan cuci tangan',
        indicator: 'Memegang gosok gigi dengan benar.',
      },
      {
        activity: 'Ganti baju (berpakaian)',
        indicator: 'Merapikan kerah baju.',
      },
      {
        activity: 'Ganti baju (berpakaian)',
        indicator: 'Memakai dan melepaskan pakaian (baju, celana, dan kaos kaki).',
      },
      {
        activity: 'Ganti baju (berpakaian)',
        indicator: 'Melipat pakaian.',
      },
      {
        activity: 'Mandi bersama',
        indicator: 'Menyisir rambut, namun kurang rapi dan masih membutuhkan bantuan.',
      },
    ]),
  },
  {
    key: 'matahari',
    label: 'Kelompok Matahari (5-6 tahun)',
    ageMinMonths: 60,
    items: createTemplateItems('matahari', [
      { activity: 'Bermain bebas', indicator: '', isDynamicIndicator: true },
      {
        activity: 'Toilet training',
        indicator:
          'Langsung ke toilet sendiri tanpa selalu diingatkan dan melakukan urutan dengan tepat.',
      },
      { activity: 'Aktivitas motorik kasar', indicator: '', isDynamicIndicator: true },
      {
        activity: 'Minum susu & makan buah',
        indicator: 'Menghabiskan susu dan buah.',
      },
      {
        activity: 'Minum susu & makan buah',
        indicator: 'Mengunyah dengan mulut tertutup.',
      },
      { activity: 'Materi terprogram', indicator: '', isDynamicIndicator: true },
      {
        activity: 'Makan siang',
        indicator: 'Menghabiskan makanannya.',
      },
      {
        activity: 'Makan siang',
        indicator: 'Mengunyah dengan mulut tertutup.',
      },
      {
        activity: 'Makan siang',
        indicator: 'Meletakkan piring dan gelas kotor ke tempat bak cuci.',
      },
      {
        activity: 'Gosok gigi dan cuci tangan',
        indicator: 'Menggosok gigi dengan benar.',
      },
      {
        activity: 'Ganti baju (berpakaian)',
        indicator: 'Memakai baju lengkap sendiri.',
      },
      {
        activity: 'Ganti baju (berpakaian)',
        indicator: 'Memasang tali.',
      },
      {
        activity: 'Ganti baju (berpakaian)',
        indicator: 'Melipat dan memasukkan baju kotor ke dalam kresek serta menaruhnya di dalam tas.',
      },
      {
        activity: 'Mandi bersama',
        indicator:
          'Mandi sendiri, namun masih dibantu untuk bagian-bagian yang sulit dijangkau (punggung belakang, tumit, jari-jari kaki).',
      },
      {
        activity: 'Mandi bersama',
        indicator: 'Merias wajah (memberikan bedak untuk perempuan dan menyisir dengan rapi).',
      },
    ]),
  },
]

const observationGroupOptions = observationGroups.map((group) => ({
  value: group.key,
  label: group.label,
}))

const observationRecapGroupOptions: Array<{ value: ObservationRecapGroupFilter; label: string }> = [
  { value: RECAP_ALL_GROUP_FILTER, label: 'Semua Kelompok' },
  ...observationGroupOptions,
]

const observationGroupByKey = observationGroups.reduce<Record<ObservationGroupKey, ObservationGroupConfig>>(
  (accumulator, group) => {
    accumulator[group.key] = group
    return accumulator
  },
  {
    bulan: observationGroups[0],
    pelangi: observationGroups[1],
    bintang: observationGroups[2],
    matahari: observationGroups[3],
  },
)

const removeErrorKey = (errors: FieldErrors, key: string): FieldErrors => {
  if (!errors[key]) return errors
  const next = { ...errors }
  delete next[key]
  return next
}

const removeObservationPointErrors = (errors: FieldErrors): FieldErrors => {
  const next: FieldErrors = {}
  for (const [key, value] of Object.entries(errors)) {
    if (!key.startsWith('item')) next[key] = value
  }
  return next
}

const normalizePointCategory = (value: unknown): ObservationCategory => {
  if (value === 'perlu-arahan') return 'perlu-arahan'
  if (value === 'perlu-latihan') return 'perlu-latihan'
  if (value === 'sudah-baik') return 'sudah-baik'
  return ''
}

const createEmptyObservationCategorySummary = (): ObservationCategorySummary => ({
  perluArahan: 0,
  perluLatihan: 0,
  sudahBaik: 0,
})

const summarizeObservationItems = (items: ObservationItem[]): ObservationCategorySummary => {
  const summary = createEmptyObservationCategorySummary()

  for (const item of items) {
    if (item.category === 'perlu-arahan') summary.perluArahan += 1
    if (item.category === 'perlu-latihan') summary.perluLatihan += 1
    if (item.category === 'sudah-baik') summary.sudahBaik += 1
  }

  return summary
}

const formatIsoDateLabel = (isoDate: string): string => {
  if (!isoDate) return '-'
  const date = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(date.getTime())) return isoDate

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

const toNormalizedText = (value: string): string => value.trim().toLowerCase()

const getAgeInMonths = (birthDate: string, todayIso: string): number | null => {
  if (!birthDate) return null

  const birth = new Date(`${birthDate}T00:00:00`)
  const today = new Date(`${todayIso}T00:00:00`)

  if (Number.isNaN(birth.getTime()) || Number.isNaN(today.getTime())) {
    return null
  }

  let months = (today.getFullYear() - birth.getFullYear()) * 12
  months += today.getMonth() - birth.getMonth()

  if (today.getDate() < birth.getDate()) {
    months -= 1
  }

  return months < 0 ? 0 : months
}

const resolveGroupKeyByAgeMonths = (ageMonths: number | null): ObservationGroupKey => {
  if (ageMonths === null) return DEFAULT_GROUP_KEY
  if (ageMonths < 36) return 'bulan'
  if (ageMonths < 48) return 'pelangi'
  if (ageMonths < 60) return 'bintang'
  return 'matahari'
}

const isChildSubscribed = (child: ChildProfile): boolean =>
  Boolean(child.servicePackage && child.servicePackage.trim())

const resolveChildGroupKey = (
  child: ChildProfile,
  todayIso: string,
): ObservationGroupKey => resolveGroupKeyByAgeMonths(getAgeInMonths(child.birthDate, todayIso))

const resolveGroupKeyFromGroupName = (groupName: string): ObservationGroupKey | null => {
  const normalized = groupName.trim().toLowerCase()
  if (!normalized) return null
  if (normalized.includes('bulan')) return 'bulan'
  if (normalized.includes('pelangi')) return 'pelangi'
  if (normalized.includes('bintang')) return 'bintang'
  if (normalized.includes('matahari')) return 'matahari'
  return null
}

const createObservationItemsFromTemplate = (
  templateItems: ObservationTemplateItemConfig[],
  sourceItems: ObservationItem[] = [],
): ObservationItem[] => {
  const usedSourceIndexes = new Set<number>()

  const takeSource = (
    predicate: (item: ObservationItem, index: number) => boolean,
  ): ObservationItem | null => {
    for (let index = 0; index < sourceItems.length; index += 1) {
      if (usedSourceIndexes.has(index)) continue
      const source = sourceItems[index]
      if (!predicate(source, index)) continue
      usedSourceIndexes.add(index)
      return source
    }

    return null
  }

  return templateItems.map((templateItem) => {
    const exactMatch =
      takeSource((item) => item.id === templateItem.id) ??
      takeSource(
        (item) =>
          toNormalizedText(item.activity) === toNormalizedText(templateItem.activity) &&
          (templateItem.isDynamicIndicator ||
            toNormalizedText(item.indicator) === toNormalizedText(templateItem.indicator)),
      )

    return {
      id: templateItem.id,
      activity: templateItem.activity,
      indicator: templateItem.isDynamicIndicator
        ? (exactMatch?.indicator.trim() ?? '')
        : templateItem.indicator,
      category: normalizePointCategory(exactMatch?.category),
      notes: exactMatch?.notes?.trim() ?? '',
    }
  })
}

const createFormForGroup = (
  groupKey: ObservationGroupKey,
  todayDate: string,
  options?: {
    observerName?: string
    childId?: string
    sourceItems?: ObservationItem[]
  },
): ObservationRecordInput => {
  const group = observationGroupByKey[groupKey]

  return {
    childId: options?.childId ?? '',
    date: todayDate,
    groupName: group.label,
    observerName: options?.observerName ?? '',
    items: createObservationItemsFromTemplate(group.items, options?.sourceItems ?? []),
  }
}

const groupObservationPoints = (
  points: ObservationItem[],
): Array<{ activity: string; points: ObservationItem[] }> =>
  points.reduce<Array<{ activity: string; points: ObservationItem[] }>>((accumulator, point) => {
    const activity = point.activity.trim()
    const existing = accumulator.find((group) => group.activity === activity)

    if (existing) {
      existing.points.push(point)
      return accumulator
    }

    accumulator.push({
      activity,
      points: [point],
    })

    return accumulator
  }, [])

const ObservasiPage = ({
  childrenData,
  records,
  attendanceRecords,
  observerDisplayName,
  showRecapSection = true,
  isTableLoading = false,
  onSave,
  onNavigateToDataAnak,
}: ObservasiPageProps) => {
  const resolvedObserverName = observerDisplayName.trim()
  const [todayDate, setTodayDate] = useState<string>(() => getLocalDateIso())
  const [selectedGroupKey, setSelectedGroupKey] = useState<ObservationGroupKey>(DEFAULT_GROUP_KEY)
  const [form, setForm] = useState<ObservationRecordInput>(() =>
    createFormForGroup(DEFAULT_GROUP_KEY, getLocalDateIso(), {
      observerName: observerDisplayName.trim(),
    }),
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [dynamicIndicatorDrafts, setDynamicIndicatorDrafts] = useState<Record<string, string>>({})
  const [dynamicIndicatorEditingMap, setDynamicIndicatorEditingMap] = useState<Record<string, true>>({})
  const [indicatorBlockedAlert, setIndicatorBlockedAlert] = useState<string>('')
  const indicatorBlockedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [recapGroupFilter, setRecapGroupFilter] =
    useState<ObservationRecapGroupFilter>(RECAP_ALL_GROUP_FILTER)
  const [recapDateFilter, setRecapDateFilter] = useState<string>('')

  const [historyDateFilter, setHistoryDateFilter] = useState<string>(() => getLocalDateIso())
  const [historyChildFilter, setHistoryChildFilter] = useState<string>('')
  const [historyPage, setHistoryPage] = useState<number>(1)
  const HISTORY_PAGE_SIZE = 20

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

  const hasChildren = childrenData.length > 0

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(`${todayDate}T00:00:00`)),
    [todayDate],
  )

  const childById = useMemo(
    () =>
      childrenData.reduce<Record<string, ChildProfile>>((accumulator, child) => {
        accumulator[child.id] = child
        return accumulator
      }, {}),
    [childrenData],
  )

  const childNameById = (id: string): string => {
    const child = childById[id]
    return child ? child.fullName : 'Data anak dihapus'
  }

  const sortedRecords = useMemo(
    () =>
      [...records].sort((left, right) =>
        `${right.date}${right.createdAt}`.localeCompare(`${left.date}${left.createdAt}`, 'id'),
      ),
    [records],
  )

  const filteredHistoryRecords = useMemo(() => {
    let filtered = sortedRecords

    if (historyDateFilter) {
      filtered = filtered.filter((record) => record.date === historyDateFilter)
    }

    if (historyChildFilter) {
      filtered = filtered.filter((record) => record.childId === historyChildFilter)
    }

    return filtered
  }, [sortedRecords, historyDateFilter, historyChildFilter])

  const historyTotalPages = Math.max(1, Math.ceil(filteredHistoryRecords.length / HISTORY_PAGE_SIZE))
  const paginatedHistoryRecords = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE
    return filteredHistoryRecords.slice(start, start + HISTORY_PAGE_SIZE)
  }, [filteredHistoryRecords, historyPage])

  const filteredRecapRecords = useMemo(
    () =>
      sortedRecords.filter((record) => {
        if (recapGroupFilter !== RECAP_ALL_GROUP_FILTER) {
          const recordGroupKey = resolveGroupKeyFromGroupName(record.groupName)
          if (recordGroupKey !== recapGroupFilter) {
            return false
          }
        }

        if (recapDateFilter && record.date !== recapDateFilter) {
          return false
        }

        return true
      }),
    [recapDateFilter, recapGroupFilter, sortedRecords],
  )

  const recapTotals = useMemo(() => {
    const categorySummary = createEmptyObservationCategorySummary()
    const childIds = new Set<string>()
    let totalPoints = 0

    for (const record of filteredRecapRecords) {
      childIds.add(record.childId)
      totalPoints += record.items.length
      const itemSummary = summarizeObservationItems(record.items)
      categorySummary.perluArahan += itemSummary.perluArahan
      categorySummary.perluLatihan += itemSummary.perluLatihan
      categorySummary.sudahBaik += itemSummary.sudahBaik
    }

    return {
      totalRecords: filteredRecapRecords.length,
      totalChildren: childIds.size,
      totalPoints,
      categorySummary,
    }
  }, [filteredRecapRecords])

  const recapRows = useMemo<ObservationRecapRow[]>(() => {
    const map = new Map<
      string,
      {
        childId: string
        childName: string
        groupSet: Set<string>
        latestDate: string
        observationCount: number
        totalPoints: number
        summary: ObservationCategorySummary
      }
    >()

    for (const record of filteredRecapRecords) {
      const current =
        map.get(record.childId) ?? {
          childId: record.childId,
          childName: childById[record.childId]?.fullName ?? 'Data anak dihapus',
          groupSet: new Set<string>(),
          latestDate: '',
          observationCount: 0,
          totalPoints: 0,
          summary: createEmptyObservationCategorySummary(),
        }

      const cleanGroupName = record.groupName?.trim() || '-'
      current.groupSet.add(cleanGroupName)
      current.observationCount += 1
      current.totalPoints += record.items.length
      if (!current.latestDate || record.date > current.latestDate) {
        current.latestDate = record.date
      }

      const itemSummary = summarizeObservationItems(record.items)
      current.summary.perluArahan += itemSummary.perluArahan
      current.summary.perluLatihan += itemSummary.perluLatihan
      current.summary.sudahBaik += itemSummary.sudahBaik

      map.set(record.childId, current)
    }

    return Array.from(map.values())
      .map((row) => ({
        childId: row.childId,
        childName: row.childName,
        groupLabel: Array.from(row.groupSet).sort((a, b) => a.localeCompare(b, 'id')).join(', '),
        latestDate: row.latestDate,
        observationCount: row.observationCount,
        totalPoints: row.totalPoints,
        summary: row.summary,
      }))
      .sort((left, right) =>
        left.childName.localeCompare(right.childName, 'id', { sensitivity: 'base' }),
      )
  }, [childById, filteredRecapRecords])

  const recapSelectedGroupLabel =
    recapGroupFilter === RECAP_ALL_GROUP_FILTER
      ? 'Semua kelompok'
      : observationGroupByKey[recapGroupFilter].label

  const recapSelectedDateLabel = recapDateFilter
    ? formatIsoDateLabel(recapDateFilter)
    : 'Semua tanggal'

  const isRecapFilterActive =
    recapGroupFilter !== RECAP_ALL_GROUP_FILTER || Boolean(recapDateFilter)

  const arrivedChildIdsToday = useMemo(
    () =>
      new Set(
        attendanceRecords
          .filter((record) => record.date === todayDate && record.arrivalTime)
          .map((record) => record.childId),
      ),
    [attendanceRecords, todayDate],
  )

  const observedChildIdsToday = useMemo(
    () =>
      new Set(
        records
          .filter((record) => record.date === todayDate)
          .map((record) => record.childId),
      ),
    [records, todayDate],
  )

  const childGroupById = useMemo(
    () =>
      childrenData.reduce<Record<string, ObservationGroupKey>>((accumulator, child) => {
        accumulator[child.id] = resolveChildGroupKey(child, todayDate)
        return accumulator
      }, {}),
    [childrenData, todayDate],
  )

  const selectableChildren = useMemo(
    () =>
      childrenData.filter(
        (child) =>
          arrivedChildIdsToday.has(child.id) &&
          isChildSubscribed(child) &&
          childGroupById[child.id] === selectedGroupKey,
      ),
    [arrivedChildIdsToday, childGroupById, childrenData, selectedGroupKey],
  )

  const childOptions = useMemo(() => {
    const options = selectableChildren.map((child) => ({
      value: child.id,
      label: child.fullName,
      badge: observedChildIdsToday.has(child.id) ? 'Terobservasi' : undefined,
    }))

    if (form.childId && !options.some((option) => option.value === form.childId)) {
      const activeChild = childById[form.childId]
      if (activeChild) {
        options.unshift({
          value: activeChild.id,
          label: `${activeChild.fullName} (riwayat)`,
          badge: observedChildIdsToday.has(activeChild.id) ? 'Terobservasi' : 'Riwayat',
        })
      }
    }

    return options
  }, [childById, form.childId, observedChildIdsToday, selectableChildren])

  const currentGroup = observationGroupByKey[selectedGroupKey]

  const dynamicIndicatorIdSet = useMemo(
    () =>
      new Set(
        currentGroup.items
          .filter((item) => item.isDynamicIndicator)
          .map((item) => item.id),
      ),
    [currentGroup.items],
  )

  const groupedPoints = useMemo(() => groupObservationPoints(form.items), [form.items])

  const pointIndexById = useMemo(() => {
    const map: Record<string, number> = {}
    form.items.forEach((item, index) => {
      map[item.id] = index
    })
    return map
  }, [form.items])

  const isChildSelected = form.childId.trim().length > 0
  const isPointInteractionDisabled = !isChildSelected
  const areAllCategoriesFilled = useMemo(
    () => form.items.every((item) => Boolean(item.category)),
    [form.items],
  )
  const areAllIndicatorsFilled = useMemo(
    () => form.items.every((item) => Boolean(item.indicator.trim())),
    [form.items],
  )

  const canSubmitObservation =
    isChildSelected &&
    Boolean(resolvedObserverName) &&
    areAllCategoriesFilled &&
    areAllIndicatorsFilled

  const setField = <K extends keyof ObservationRecordInput>(
    key: K,
    value: ObservationRecordInput[K],
  ) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }))
    setErrors((previous) => removeErrorKey(previous, String(key)))
  }

  const updatePoint = (pointId: string, updater: (item: ObservationItem) => ObservationItem) => {
    setForm((previous) => ({
      ...previous,
      items: previous.items.map((item) => (item.id === pointId ? updater(item) : item)),
    }))
    setErrors((previous) => removeObservationPointErrors(previous))
  }

  const clearDynamicIndicatorEditing = () => {
    setDynamicIndicatorDrafts({})
    setDynamicIndicatorEditingMap({})
  }

  const startDynamicIndicatorEdit = (item: ObservationItem) => {
    setDynamicIndicatorDrafts((previous) => ({
      ...previous,
      [item.id]: item.indicator,
    }))
    setDynamicIndicatorEditingMap((previous) => ({
      ...previous,
      [item.id]: true,
    }))
  }

  const updateDynamicIndicatorDraft = (itemId: string, value: string) => {
    setDynamicIndicatorDrafts((previous) => ({
      ...previous,
      [itemId]: value,
    }))
  }

  const closeDynamicIndicatorEdit = (itemId: string) => {
    setDynamicIndicatorDrafts((previous) => {
      if (!Object.prototype.hasOwnProperty.call(previous, itemId)) return previous
      const next = { ...previous }
      delete next[itemId]
      return next
    })
    setDynamicIndicatorEditingMap((previous) => {
      if (!previous[itemId]) return previous
      const next = { ...previous }
      delete next[itemId]
      return next
    })
  }

  const saveDynamicIndicatorEdit = (item: ObservationItem) => {
    const draft = dynamicIndicatorDrafts[item.id]
    if (typeof draft !== 'string') {
      closeDynamicIndicatorEdit(item.id)
      return
    }
    if (draft !== item.indicator) {
      updatePoint(item.id, (previous) => ({
        ...previous,
        indicator: draft,
      }))
    }
    closeDynamicIndicatorEdit(item.id)
  }

  const handleGroupSelect = (groupValue: string) => {
    const nextGroup = observationGroupByKey[groupValue as ObservationGroupKey]
    if (!nextGroup) return
    clearDynamicIndicatorEditing()
    setSelectedGroupKey(nextGroup.key)
    setForm(() =>
      createFormForGroup(nextGroup.key, todayDate, {
        observerName: resolvedObserverName,
      }),
    )
    setEditingId(null)
    setErrors({})
  }

  const handleChildSelect = (childId: string) => {
    if (!childId) {
      setField('childId', childId)
      return
    }

    const child = childById[childId]
    if (!child || !isChildSubscribed(child)) {
      setField('childId', childId)
      return
    }

    const autoGroupKey = resolveChildGroupKey(child, todayDate)
    if (autoGroupKey === selectedGroupKey) {
      setField('childId', childId)
      return
    }

    const nextGroup = observationGroupByKey[autoGroupKey]
    clearDynamicIndicatorEditing()
    setSelectedGroupKey(autoGroupKey)
    setForm((previous) => ({
      ...previous,
      childId,
      groupName: nextGroup.label,
      items: createObservationItemsFromTemplate(nextGroup.items, previous.items),
    }))
    setErrors((previous) => removeObservationPointErrors(removeErrorKey(previous, 'childId')))
  }

  const resetForm = () => {
    clearDynamicIndicatorEditing()
    setForm(() =>
      createFormForGroup(selectedGroupKey, todayDate, {
        observerName: resolvedObserverName,
      }),
    )
    setEditingId(null)
    setErrors({})
  }

  const showIndicatorBlockedAlert = (itemId: string) => {
    setIndicatorBlockedAlert(itemId)
    if (indicatorBlockedTimerRef.current) {
      clearTimeout(indicatorBlockedTimerRef.current)
    }
    indicatorBlockedTimerRef.current = setTimeout(() => {
      setIndicatorBlockedAlert('')
      indicatorBlockedTimerRef.current = null
    }, 3000)
    // Focus the indicator input for this item
    const indicatorEl = document.getElementById(`observationIndicator_${itemId}`)
    if (indicatorEl) {
      indicatorEl.focus()
      indicatorEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedForm: ObservationRecordInput = {
      ...form,
      date: todayDate,
      groupName: currentGroup.label,
      observerName: resolvedObserverName,
      items: form.items.map((item) => ({
        ...item,
        activity: item.activity.trim(),
        indicator: item.indicator.trim(),
        category: normalizePointCategory(item.category),
        notes: item.notes.trim(),
      })),
    }
    const nextErrors = validateObservationRecordInput(normalizedForm)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      const firstItemErrorKey = Object.keys(nextErrors).find((k) => k.startsWith('item'))
      if (firstItemErrorKey) {
        const match = firstItemErrorKey.match(/item\w+_(\d+)/)
        if (match) {
          const itemIndex = Number(match[1])
          const item = normalizedForm.items[itemIndex]
          if (item) {
            const el = document.getElementById(`observationIndicator_${item.id}`) ??
              document.querySelector(`[data-item-id="${item.id}"]`)
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
          }
        }
      }
      return
    }
    const success = await onSave(normalizedForm, editingId ?? undefined)
    if (success) {
      resetForm()
    }
  }

  const handleEdit = (record: ObservationRecord) => {
    const { id, createdAt, updatedAt, ...input } = record
    void createdAt
    void updatedAt
    const child = childById[input.childId]
    const fallbackGroupKey = resolveGroupKeyFromGroupName(input.groupName)
      ?? (child ? resolveChildGroupKey(child, todayDate) : DEFAULT_GROUP_KEY)
    const nextGroup = observationGroupByKey[fallbackGroupKey] ?? observationGroupByKey[DEFAULT_GROUP_KEY]
    clearDynamicIndicatorEditing()
    setSelectedGroupKey(nextGroup.key)
    setForm(
      createFormForGroup(nextGroup.key, input.date || todayDate, {
        observerName: resolvedObserverName,
        childId: input.childId,
        sourceItems: input.items,
      }),
    )
    setEditingId(id)
    setErrors({})
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const renderTableLoadingRows = (columnCount: number, rowCount: number, keyPrefix: string) =>
    Array.from({ length: rowCount }, (_, rowIndex) => (
      <tr key={`${keyPrefix}-${rowIndex}`}>
        {Array.from({ length: columnCount }, (_, columnIndex) => (
          <td key={`${keyPrefix}-${rowIndex}-${columnIndex}`} className="table__skeleton-cell">
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
    minRows = 3,
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

  const resetRecapFilters = () => {
    setRecapGroupFilter(RECAP_ALL_GROUP_FILTER)
    setRecapDateFilter('')
  }

  const getSummaryLabel = (items: ObservationItem[]): string => {
    const summary = summarizeObservationItems(items)
    return `Arahan: ${summary.perluArahan}, Latihan: ${summary.perluLatihan}, Sudah baik: ${summary.sudahBaik}`
  }

  const activityCount = groupedPoints.length

  return (
    <section className="page page--observasi">
      <div className="card">
        <h2>Observasi Anak</h2>
        <p className="card__description">
          Pencatatan Observasi perkembangan setiap anak berdasarkan kegiatan dan indikator per kelompok usia.
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

        <form id="tour-observasi-form" onSubmit={handleSubmit}>
          <fieldset className="fieldset" disabled={!hasChildren}>
            <div className="form-grid form-grid--3">
              <div className="field-group">
                <label className="label" htmlFor="observationGroupKey">
                  Kelompok utama
                </label>
                <SearchableSelect
                  className="observation-group-select"
                  value={selectedGroupKey}
                  onChange={handleGroupSelect}
                  options={observationGroupOptions}
                  placeholder="Pilih kelompok"
                  emptyMessage="Kelompok tidak tersedia"
                  searchable={false}
                  clearable={false}
                />
              </div>

              <div id="tour-observasi-child-select" className="field-group">
                <label className="label" htmlFor="observationChildId">
                  Nama anak
                </label>
                <SearchableSelect
                  value={form.childId}
                  onChange={handleChildSelect}
                  options={childOptions}
                  placeholder="Pilih nama anak"
                  emptyMessage="Belum ada anak sesuai kelompok yang absen datang"
                  clearable={!editingId}
                />
                {errors.childId ? <p className="field-error">{errors.childId}</p> : null}
              </div>

              <div className="field-group">
                <label className="label">Observer</label>
                <input className="input input--locked" value={resolvedObserverName || '-'} readOnly />
              </div>
            </div>

            {selectableChildren.length === 0 ? (
              <p className="field-hint">
                Belum ada anak kelompok ini yang absen datang hari ini.
              </p>
            ) : null}

            <div className="observation-meta-readonly">
              <div>
                <span>Tanggal Observasi (otomatis)</span>
                <strong>{todayLabel}</strong>
              </div>
              <div>
                <span>Kelompok</span>
                <strong>{currentGroup.label}</strong>
              </div>
              <div>
                <span>Total Point</span>
                <strong>{form.items.length} point</strong>
              </div>
            </div>

            <div className="observation-guide">
              <p className="observation-guide__title">Keterangan Kategori Penilaian</p>
              <p>
                <strong>Perlu arahan:</strong> belum bisa dan masih perlu bantuan/masih dibantu.
              </p>
              <p>
                <strong>Perlu latihan:</strong> sudah bisa, namun terkadang perlu pengulangan/latihan.
              </p>
              <p>
                <strong>Sudah baik:</strong> dilakukan berulang kali secara mandiri tanpa bantuan dan latihan.
              </p>
            </div>

            <div className={`observation-items-shell ${isPointInteractionDisabled ? 'is-disabled' : ''}`}>
              <section className="observation-items-section">
                <div className="observation-items-section__head">
                  <h4 className="observation-items-section__title">Daftar Kegiatan</h4>
                  <span className="observation-items-section__count">{activityCount} kegiatan</span>
                </div>

                {groupedPoints.map((group, groupIndex) => (
                  <div
                    className={`observation-point-group ${groupIndex % 2 === 1 ? 'is-contrast' : ''}`}
                    key={`${group.activity}-${groupIndex}`}
                  >
                    <div className="observation-point-group__head">
                      <p className="observation-point-group__title">{group.activity}</p>
                    </div>

                    <div className="table-wrap observation-desktop-table">
                      <table className="table observation-table">
                        <thead>
                          <tr>
                            <th>Point</th>
                            <th>Indikator</th>
                            <th>Kategori Penilaian</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.points.map((item) => {
                            const itemIndex = pointIndexById[item.id] ?? 0
                            const pointNumber = itemIndex + 1
                            const isDynamicIndicator = dynamicIndicatorIdSet.has(item.id)

                            return (
                              <tr key={item.id} className="observation-row">
                                <td>
                                  <div className="observation-point-cell">
                                    <span className="observation-item-index-chip">Point {pointNumber}</span>
                                    {isDynamicIndicator ? (
                                      <span className="badge">Dinamis</span>
                                    ) : null}
                                  </div>
                                </td>
                                <td>
                                  {isDynamicIndicator ? (
                                    <div className="observation-dynamic-editor">
                                      {dynamicIndicatorEditingMap[item.id] ? (
                                        <textarea
                                          id={`observationIndicator_${item.id}`}
                                          className="textarea observation-textarea"
                                          rows={2}
                                          value={dynamicIndicatorDrafts[item.id] ?? item.indicator}
                                          onChange={(event) =>
                                            updateDynamicIndicatorDraft(item.id, event.target.value)
                                          }
                                          placeholder="Isi indikator kegiatan hari ini"
                                          disabled={isPointInteractionDisabled}
                                        />
                                      ) : (
                                        <p className="observation-static-text">{item.indicator || '-'}</p>
                                      )}

                                      <div className="observation-item-actions">
                                        {dynamicIndicatorEditingMap[item.id] ? (
                                          <>
                                            <button
                                              type="button"
                                              className="button button--tiny"
                                              onClick={() => saveDynamicIndicatorEdit(item)}
                                              disabled={
                                                isPointInteractionDisabled ||
                                                (dynamicIndicatorDrafts[item.id] ?? item.indicator) === item.indicator
                                              }
                                            >
                                              Simpan
                                            </button>
                                            <button
                                              type="button"
                                              className="button button--tiny button--ghost"
                                              onClick={() => closeDynamicIndicatorEdit(item.id)}
                                              disabled={isPointInteractionDisabled}
                                            >
                                              Batal
                                            </button>
                                          </>
                                        ) : (
                                          <button
                                            type="button"
                                            className="button button--tiny button--ghost"
                                            onClick={() => startDynamicIndicatorEdit(item)}
                                            disabled={isPointInteractionDisabled}
                                          >
                                            Edit
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="observation-static-text">{item.indicator || '-'}</p>
                                  )}
                                  {errors[`itemIndicator_${itemIndex}`] ? (
                                    <p className="field-error">{errors[`itemIndicator_${itemIndex}`]}</p>
                                  ) : null}
                                </td>
                                <td>
                                  {!item.indicator.trim() && !isPointInteractionDisabled ? (
                                    <button
                                      type="button"
                                      className="button button--ghost button--tiny"
                                      onClick={() => showIndicatorBlockedAlert(item.id)}
                                    >
                                      Pilih penilaian
                                    </button>
                                  ) : (
                                    <SearchableSelect
                                      className="observation-category-select"
                                      value={item.category}
                                      onChange={(value) =>
                                        updatePoint(item.id, (previous) => ({
                                          ...previous,
                                          category: normalizePointCategory(value),
                                        }))
                                      }
                                      options={observationCategories}
                                      placeholder="Pilih penilaian"
                                      emptyMessage="Kategori tidak tersedia"
                                      searchable={false}
                                      clearable={!isPointInteractionDisabled}
                                      disabled={isPointInteractionDisabled}
                                      usePortal
                                    />
                                  )}
                                  {indicatorBlockedAlert === item.id ? (
                                    <p className="field-error">Masukkan Indikator terlebih dahulu</p>
                                  ) : null}
                                  {errors[`itemCategory_${itemIndex}`] ? (
                                    <p className="field-error">{errors[`itemCategory_${itemIndex}`]}</p>
                                  ) : null}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="observation-mobile-list">
                      {group.points.map((item) => {
                        const itemIndex = pointIndexById[item.id] ?? 0
                        const pointNumber = itemIndex + 1
                        const isDynamicIndicator = dynamicIndicatorIdSet.has(item.id)

                        return (
                          <article
                            className="observation-mobile-card"
                            key={`mobile-${item.id}`}
                          >
                            <div className="observation-mobile-card__header">
                              <span className="observation-mobile-card__index">Point {pointNumber}</span>
                              {isDynamicIndicator ? (
                                <span className="badge">Dinamis</span>
                                ) : null}
                            </div>

                            <div className="field-group">
                              <label className="label">Indikator</label>
                              {isDynamicIndicator ? (
                                <div className="observation-dynamic-editor">
                                  {dynamicIndicatorEditingMap[item.id] ? (
                                    <textarea
                                      id={`observationIndicator_${item.id}`}
                                      className="textarea observation-textarea"
                                      rows={2}
                                      value={dynamicIndicatorDrafts[item.id] ?? item.indicator}
                                      onChange={(event) =>
                                        updateDynamicIndicatorDraft(item.id, event.target.value)
                                      }
                                      placeholder="Isi indikator kegiatan hari ini"
                                      disabled={isPointInteractionDisabled}
                                    />
                                  ) : (
                                    <p className="observation-static-text">{item.indicator || '-'}</p>
                                  )}

                                  <div className="observation-item-actions">
                                    {dynamicIndicatorEditingMap[item.id] ? (
                                      <>
                                        <button
                                          type="button"
                                          className="button button--tiny"
                                          onClick={() => saveDynamicIndicatorEdit(item)}
                                          disabled={
                                            isPointInteractionDisabled ||
                                            (dynamicIndicatorDrafts[item.id] ?? item.indicator) === item.indicator
                                          }
                                        >
                                          Simpan
                                        </button>
                                        <button
                                          type="button"
                                          className="button button--tiny button--ghost"
                                          onClick={() => closeDynamicIndicatorEdit(item.id)}
                                          disabled={isPointInteractionDisabled}
                                        >
                                          Batal
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        className="button button--tiny button--ghost"
                                        onClick={() => startDynamicIndicatorEdit(item)}
                                        disabled={isPointInteractionDisabled}
                                      >
                                        Edit
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <p className="observation-static-text">{item.indicator || '-'}</p>
                              )}
                              {errors[`itemIndicator_${itemIndex}`] ? (
                                <p className="field-error">{errors[`itemIndicator_${itemIndex}`]}</p>
                              ) : null}
                            </div>

                            <div className="field-group">
                              <label className="label">Kategori Penilaian</label>
                              {!item.indicator.trim() && !isPointInteractionDisabled ? (
                                <button
                                  type="button"
                                  className="button button--ghost button--tiny"
                                  onClick={() => showIndicatorBlockedAlert(item.id)}
                                >
                                  Pilih penilaian
                                </button>
                              ) : (
                                <SearchableSelect
                                  className="observation-category-select"
                                  value={item.category}
                                  onChange={(value) =>
                                    updatePoint(item.id, (previous) => ({
                                      ...previous,
                                      category: normalizePointCategory(value),
                                    }))
                                  }
                                  options={observationCategories}
                                  placeholder="Pilih penilaian"
                                  emptyMessage="Kategori tidak tersedia"
                                  searchable={false}
                                  clearable={!isPointInteractionDisabled}
                                  disabled={isPointInteractionDisabled}
                                />
                              )}
                              {indicatorBlockedAlert === item.id ? (
                                <p className="field-error">Masukkan Indikator terlebih dahulu</p>
                              ) : null}
                              {errors[`itemCategory_${itemIndex}`] ? (
                                <p className="field-error">{errors[`itemCategory_${itemIndex}`]}</p>
                              ) : null}
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </section>
            </div>

            {errors.items ? <p className="field-error">{errors.items}</p> : null}

            {!isChildSelected ? (
              <p className="field-hint">
                Pilih nama anak terlebih dahulu agar pengisian observasi aktif.
              </p>
            ) : null}

            {!canSubmitObservation ? (
              <p className="field-hint">
                Pastikan semua kategori penilaian terisi dan indikator dinamis sudah diisi.
              </p>
            ) : null}

            <div className="form-actions">
              <button type="submit" className="button" disabled={!canSubmitObservation}>
                {editingId ? 'Update Observasi' : 'Simpan Observasi'}
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

      {showRecapSection ? (
        <div id="tour-observasi-recap" className="card">
          <h3>Rekap Observasi</h3>
          <p className="card__description">
            Rekap otomatis berdasarkan filter kelompok dan tanggal observasi.
          </p>

          <div className="observation-recap-filter">
            <div className="field-group">
              <label className="label" htmlFor="observationRecapGroupFilter">
                Kelompok
              </label>
              <SearchableSelect
                className="observation-group-select"
                value={recapGroupFilter}
                onChange={(value) => setRecapGroupFilter(value as ObservationRecapGroupFilter)}
                options={observationRecapGroupOptions}
                placeholder="Pilih kelompok"
                emptyMessage="Kelompok tidak tersedia"
                searchable={false}
                clearable={false}
              />
            </div>

            <div className="field-group">
              <label className="label" htmlFor="observationRecapDateFilter">
                Tanggal observasi
              </label>
              <AppDatePickerField
                id="observationRecapDateFilter"
                value={recapDateFilter}
                max={todayDate}
                onChange={(value) => {
                  setRecapDateFilter(value > todayDate ? todayDate : value)
                }}
              />
            </div>

            <div className="observation-recap-filter__actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={resetRecapFilters}
                disabled={!isRecapFilterActive}
              >
                Reset Filter Rekap
              </button>
            </div>
          </div>

          <p className="field-hint observation-recap-filter-note">
            Filter aktif: {recapSelectedGroupLabel} | {recapSelectedDateLabel}
          </p>

          <div className="observation-recap-stats">
            <article className="observation-recap-stat">
              <span>Total observasi</span>
              <strong>{recapTotals.totalRecords}</strong>
            </article>
            <article className="observation-recap-stat">
              <span>Anak terobservasi</span>
              <strong>{recapTotals.totalChildren}</strong>
            </article>
            <article className="observation-recap-stat">
              <span>Total point</span>
              <strong>{recapTotals.totalPoints}</strong>
            </article>
            <article className="observation-recap-stat">
              <span>Perlu arahan</span>
              <strong>{recapTotals.categorySummary.perluArahan}</strong>
            </article>
            <article className="observation-recap-stat">
              <span>Perlu latihan</span>
              <strong>{recapTotals.categorySummary.perluLatihan}</strong>
            </article>
            <article className="observation-recap-stat">
              <span>Sudah baik</span>
              <strong>{recapTotals.categorySummary.sudahBaik}</strong>
            </article>
          </div>

          <div className="table-wrap observation-recap-table">
            <table className="table">
              <thead>
                <tr>
                  <th>Nama anak</th>
                  <th>Kelompok</th>
                  <th>Tanggal terakhir</th>
                  <th>Jumlah observasi</th>
                  <th>Total point</th>
                  <th>Arahan</th>
                  <th>Latihan</th>
                  <th>Sudah baik</th>
                </tr>
              </thead>
              <tbody>
                {recapRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="table__empty">
                      Tidak ada data observasi untuk filter yang dipilih.
                    </td>
                  </tr>
                ) : (
                  recapRows.map((row) => (
                    <tr key={`recap-${row.childId}`}>
                      <td>{row.childName}</td>
                      <td>{row.groupLabel}</td>
                      <td>{formatIsoDateLabel(row.latestDate)}</td>
                      <td>{row.observationCount}</td>
                      <td>{row.totalPoints}</td>
                      <td>{row.summary.perluArahan}</td>
                      <td>{row.summary.perluLatihan}</td>
                      <td>{row.summary.sudahBaik}</td>
                    </tr>
                  ))
                )}
                {renderMinimumRows(recapRows.length, 8, 'observation-recap')}
              </tbody>
            </table>
          </div>

          <div className="observation-recap-mobile">
            {recapRows.length === 0 ? (
              <p className="observation-recap-mobile__empty">
                Tidak ada data observasi untuk filter yang dipilih.
              </p>
            ) : (
              recapRows.map((row) => (
                <article key={`mobile-recap-${row.childId}`} className="observation-recap-card">
                  <div className="observation-recap-card__row">
                    <span className="observation-recap-card__label">Nama anak</span>
                    <strong>{row.childName}</strong>
                  </div>
                  <div className="observation-recap-card__row">
                    <span className="observation-recap-card__label">Kelompok</span>
                    <strong>{row.groupLabel}</strong>
                  </div>
                  <div className="observation-recap-card__row">
                    <span className="observation-recap-card__label">Tanggal terakhir</span>
                    <strong>{formatIsoDateLabel(row.latestDate)}</strong>
                  </div>
                  <div className="observation-recap-card__metrics">
                    <span>Obs: {row.observationCount}</span>
                    <span>Point: {row.totalPoints}</span>
                    <span>Arahan: {row.summary.perluArahan}</span>
                    <span>Latihan: {row.summary.perluLatihan}</span>
                    <span>Baik: {row.summary.sudahBaik}</span>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      ) : null}

      <div className="card">
        <h3>Riwayat Observasi</h3>
        <p className="card__description">Filter berdasarkan tanggal dan anak.</p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div className="field-group" style={{ flex: '1 1 200px' }}>
            <label className="label">Tanggal</label>
            <AppDatePickerField
              value={historyDateFilter}
              max={todayDate}
              onChange={(value) => {
                setHistoryDateFilter(value)
                setHistoryPage(1)
              }}
            />
          </div>
          <div className="field-group" style={{ flex: '1 1 200px' }}>
            <label className="label">Anak</label>
            <SearchableSelect
              value={historyChildFilter}
              onChange={(val) => { setHistoryChildFilter(val as string); setHistoryPage(1) }}
              options={[
                { value: '', label: 'Semua anak' },
                ...childrenData.map((child) => ({
                  value: child.id,
                  label: child.fullName,
                })).sort((a, b) => a.label.localeCompare(b.label, 'id')),
              ]}
              placeholder="Pilih anak..."
              usePortal={true}
            />
          </div>
        </div>

        <div className="table-wrap observation-history-table">
          <table className="table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Nama anak</th>
                <th>Kelompok</th>
                <th>Observer</th>
                <th>Ringkasan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isTableLoading ? (
                renderTableLoadingRows(6, 4, 'observation-history')
              ) : filteredHistoryRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table__empty">
                    Belum ada data observasi untuk filter yang dipilih.
                  </td>
                </tr>
              ) : (
                paginatedHistoryRecords.map((record) => (
                  <tr key={record.id}>
                    <td>{record.date}</td>
                    <td>{childNameById(record.childId)}</td>
                    <td>{record.groupName || '-'}</td>
                    <td>{record.observerName || '-'}</td>
                    <td>{getSummaryLabel(record.items)}</td>
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
                ))
              )}
              {renderMinimumRows(paginatedHistoryRecords.length, 6, 'observation-history')}
            </tbody>
          </table>
        </div>
        {filteredHistoryRecords.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--color-text-muted, #718096)' }}>
              Halaman {historyPage} dari {historyTotalPages} ({filteredHistoryRecords.length} data)
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="button button--tiny button--ghost" disabled={historyPage <= 1} onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}>← Previous</button>
              <button type="button" className="button button--tiny button--ghost" disabled={historyPage >= historyTotalPages} onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}>Next →</button>
            </div>
          </div>
        ) : null}

        <div className="observation-history-mobile">
          {isTableLoading ? (
            <p className="observation-history-mobile__empty">
              Memuat riwayat observasi...
            </p>
          ) : filteredHistoryRecords.length === 0 ? (
            <p className="observation-history-mobile__empty">Belum ada data observasi untuk filter yang dipilih.</p>
          ) : (
            paginatedHistoryRecords.map((record) => (
              <article key={`mobile-history-${record.id}`} className="observation-history-card">
                <div className="observation-history-card__row">
                  <span className="observation-history-card__label">Tanggal</span>
                  <strong>{record.date}</strong>
                </div>
                <div className="observation-history-card__row">
                  <span className="observation-history-card__label">Nama anak</span>
                  <strong>{childNameById(record.childId)}</strong>
                </div>
                <div className="observation-history-card__row">
                  <span className="observation-history-card__label">Kelompok</span>
                  <strong>{record.groupName || '-'}</strong>
                </div>
                <div className="observation-history-card__row">
                  <span className="observation-history-card__label">Observer</span>
                  <strong>{record.observerName || '-'}</strong>
                </div>
                <div className="observation-history-card__row">
                  <span className="observation-history-card__label">Ringkasan</span>
                  <strong>{getSummaryLabel(record.items)}</strong>
                </div>
                <div className="observation-history-card__actions">
                  <button
                    type="button"
                    className="button button--tiny button--ghost"
                    onClick={() => handleEdit(record)}
                  >
                    Edit
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  )
}

export default ObservasiPage
