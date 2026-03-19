import type {
  EmotionalCondition,
  PhysicalCondition,
  Religion,
  ServicePackage,
} from '../types'

export const physicalConditionOptions: Array<{
  value: PhysicalCondition
  label: string
}> = [
    { value: 'sehat', label: 'Sehat' },
    { value: 'sakit', label: 'Sakit' },
  ]

export const emotionalConditionOptions: Array<{
  value: EmotionalCondition
  label: string
}> = [
    { value: 'senang', label: 'Senang' },
    { value: 'sedih', label: 'Sedih' },
  ]

export const religionOptions: Array<{ value: Religion; label: string }> = [
  { value: 'islam', label: 'Islam' },
  { value: 'kristen', label: 'Kristen' },
  { value: 'katolik', label: 'Katolik' },
  { value: 'hindu', label: 'Hindu' },
  { value: 'buddha', label: 'Buddha' },
  { value: 'konghucu', label: 'Konghucu' },
  { value: 'lainnya', label: 'Lainnya' },
]

export const servicePackageOptions: Array<{
  value: ServicePackage
  label: string
}> = [
    { value: 'harian', label: 'Harian' },
    { value: '2-mingguan', label: '2 Mingguan' },
    { value: 'bulanan', label: 'Bulanan' },
  ]
