export const inventoryCategoryOptions = [
  {
    value: 'susu',
    label: 'Susu',
  },
  {
    value: 'popok',
    label: 'Popok',
  },
  {
    value: 'pakaian-atasan',
    label: 'Pakaian - Atasan',
  },
  {
    value: 'pakaian-bawahan',
    label: 'Pakaian - Bawahan',
  },
  {
    value: 'pakaian-dalaman',
    label: 'Pakaian - Dalaman',
  },
  {
    value: 'perlengkapan-lain',
    label: 'Perlengkapan Lain',
  },
] as const

export const inventoryMessageCategories = [
  {
    value: 'baju-tidur',
    label: 'Baju tidur',
    defaultUnit: 'set',
  },
  {
    value: 'baju-sore',
    label: 'Baju sore',
    defaultUnit: 'set',
  },
  {
    value: 'kaos-dalam',
    label: 'Kaos dalam',
    defaultUnit: 'pcs',
  },
] as const

export type InventoryMessageCategoryValue =
  (typeof inventoryMessageCategories)[number]['value']

export const inventoryCategoryLabelMap = new Map<string, string>(
  [
    ...inventoryCategoryOptions,
    ...inventoryMessageCategories,
  ].map((category) => [category.value, category.label] as const),
)
