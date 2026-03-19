import type { IncidentCategoryKey } from '../types'

export type PrintableIncidentCategoryKey = Extract<
  IncidentCategoryKey,
  | 'DRINKING_BOTTLE'
  | 'MILK_CONTAINER'
  | 'MEAL_CONTAINER'
  | 'SNACK_CONTAINER'
  | 'BATH_SUPPLIES'
  | 'MEDICINE_VITAMIN'
  | 'BAG'
>

export interface IncidentCategoryOption {
  key: IncidentCategoryKey
  label: string
  printable: boolean
  printRowLabel?: string
}

export const INCIDENT_CATEGORY_OPTIONS: IncidentCategoryOption[] = [
  {
    key: 'DRINKING_BOTTLE',
    label: 'Tempat minum',
    printable: true,
    printRowLabel: '2.a tempat minum',
  },
  {
    key: 'MILK_CONTAINER',
    label: 'Tempat susu',
    printable: true,
    printRowLabel: '2.b tempat susu',
  },
  {
    key: 'MEAL_CONTAINER',
    label: 'Tempat makan/sayur',
    printable: true,
    printRowLabel: '2.c tempat makan/sayur',
  },
  {
    key: 'SNACK_CONTAINER',
    label: 'Tempat kue',
    printable: true,
    printRowLabel: '2.d tempat kue',
  },
  {
    key: 'BATH_SUPPLIES',
    label: 'Perlengkapan mandi',
    printable: true,
    printRowLabel: '3 perlengkapan mandi',
  },
  {
    key: 'MEDICINE_VITAMIN',
    label: 'Obat / vitamin',
    printable: true,
    printRowLabel: '4.a obat/vitamin',
  },
  {
    key: 'BAG',
    label: 'Tas',
    printable: true,
    printRowLabel: '4.b tas',
  },
  { key: 'HELMET', label: 'Helm', printable: false },
  { key: 'SHOES', label: 'Sepatu', printable: false },
  { key: 'JACKET', label: 'Jaket', printable: false },
  { key: 'OTHER', label: 'Lainnya', printable: false },
]

export const INCIDENT_CATEGORY_BY_KEY: Record<
  IncidentCategoryKey,
  IncidentCategoryOption
> = INCIDENT_CATEGORY_OPTIONS.reduce(
  (accumulator, item) => ({
    ...accumulator,
    [item.key]: item,
  }),
  {} as Record<IncidentCategoryKey, IncidentCategoryOption>,
)

export const INCIDENT_PRINTABLE_CATEGORY_KEYS: PrintableIncidentCategoryKey[] =
  INCIDENT_CATEGORY_OPTIONS.filter(
    (item): item is IncidentCategoryOption & { key: PrintableIncidentCategoryKey } =>
      item.printable,
  ).map((item) => item.key)

export const INCIDENT_PRINTABLE_ROW_LABEL_BY_KEY: Record<
  PrintableIncidentCategoryKey,
  string
> = INCIDENT_PRINTABLE_CATEGORY_KEYS.reduce(
  (accumulator, key) => ({
    ...accumulator,
    [key]: INCIDENT_CATEGORY_BY_KEY[key].printRowLabel ?? '',
  }),
  {} as Record<PrintableIncidentCategoryKey, string>,
)
