export type MenuKey =
  | 'berita-acara'
  | 'kehadiran'
  | 'observasi'
  | 'rekap-bulanan'
  | 'data-anak'
  | 'inventori'

export type PhysicalCondition = 'sehat' | 'sakit'
export type EmotionalCondition = 'senang' | 'sedih'
export type IncidentCategoryKey =
  | 'DRINKING_BOTTLE'
  | 'MILK_CONTAINER'
  | 'MEAL_CONTAINER'
  | 'SNACK_CONTAINER'
  | 'BATH_SUPPLIES'
  | 'MEDICINE_VITAMIN'
  | 'BAG'
  | 'HELMET'
  | 'SHOES'
  | 'JACKET'
  | 'OTHER'
export type ServicePackage = 'harian' | '2-mingguan' | 'bulanan'
export type Religion =
  | 'islam'
  | 'kristen'
  | 'katolik'
  | 'hindu'
  | 'buddha'
  | 'konghucu'
  | 'lainnya'

interface MetadataFields {
  id: string
  createdAt: string
  updatedAt: string
}

export interface EquipmentItem {
  brand: string
  imageDataUrl: string
  imageName: string
  description: string
}

export interface MealEquipment {
  drinkingBottle: EquipmentItem
  milkBottle: EquipmentItem
  mealContainer: EquipmentItem
  snackContainer: EquipmentItem
}

export interface IncidentCarriedItem {
  id: string
  categoryKey: IncidentCategoryKey
  description: string
}

export interface CarriedItem {
  id: string
  category: string
  imageDataUrl: string
  imageName: string
  description: string
}

export interface ChildProfile extends MetadataFields {
  fullName: string
  nickName: string
  isActive?: boolean
  gender: string
  photoDataUrl: string
  birthPlace: string
  birthDate: string
  childOrder: string
  religion: Religion
  outsideActivities: string
  fatherName: string
  motherName: string
  homeAddress: string
  homePhone: string
  officeAddress: string
  otherPhone: string
  email: string
  whatsappNumber: string
  allergy: string
  servicePackage: ServicePackage
  serviceStartDate: string
  arrivalTime: string
  departureTime: string
  pickupPersons: string[]
  depositPurpose: string
  prenatalPeriod: string
  partusPeriod: string
  postNatalPeriod: string
  motorSkill: string
  languageSkill: string
  healthHistory: string
  toiletTrainingBab: string
  toiletTrainingBak: string
  toiletTrainingBath: string
  brushingTeeth: string
  eating: string
  drinkingMilk: string
  whenCrying: string
  whenPlaying: string
  sleeping: string
  otherHabits: string
}

export interface IncidentReport extends MetadataFields {
  childId: string
  date: string
  arrivalPhysicalCondition: PhysicalCondition
  arrivalEmotionalCondition: EmotionalCondition
  departurePhysicalCondition: PhysicalCondition
  departureEmotionalCondition: EmotionalCondition
  carriedItemsPhotoDataUrl: string
  carriedItems: IncidentCarriedItem[]
  mealEquipment: MealEquipment
  bathEquipment: string
  medicines: string
  bag: string
  parentMessage: string
  messageForParent: string
  notes: string
  arrivalSignatureDataUrl: string
  departureSignatureDataUrl: string
}

export interface AttendanceRecord extends MetadataFields {
  childId: string
  date: string
  escortName: string
  pickupName: string
  parentMessage: string
  messageForParent: string
  departureNotes: string
  arrivalTime: string
  departureTime: string
  arrivalPhysicalCondition: PhysicalCondition
  arrivalEmotionalCondition: EmotionalCondition
  departurePhysicalCondition: PhysicalCondition
  departureEmotionalCondition: EmotionalCondition
  carriedItems: CarriedItem[]
  escortSignatureDataUrl: string
  pickupSignatureDataUrl: string
}

export interface CommunicationBookEntry extends MetadataFields {
  childId: string
  date: string
  inventoryItems: string[]
  notes: string
}

import type {
  ObservationCategory,
  ObservationItem,
  ObservationRecord,
} from './features/petugas/observasi/types/observation'
export type { ObservationCategory, ObservationItem, ObservationRecord }

export interface SupplyInventoryItem extends MetadataFields {
  childId: string
  productName: string
  category: string
  quantity: number
  description: string
  imageDataUrl: string
  imageName: string
}

export interface ParentProfile {
  fatherName: string
  motherName: string
  email: string
  whatsappNumber: string
  homePhone: string
  otherPhone: string
  homeAddress: string
  officeAddress: string
}

export interface ParentAccountChild {
  id: string
  fullName: string
}

export interface ParentAccount extends MetadataFields {
  username: string
  isActive: boolean
  parentProfile: ParentProfile
  children: ParentAccountChild[]
}

export interface ParentAccountInput {
  username: string
  password: string
  isActive: boolean
  childIds: string[]
  parentProfile: ParentProfile
}

export type ChildRegistrationCodeStatus = 'ACTIVE' | 'CLAIMED' | 'REVOKED' | 'EXPIRED'

export interface ChildRegistrationCode {
  id: string
  childId: string
  code: string
  status: ChildRegistrationCodeStatus
  expiresAt: string | null
  claimedAt: string | null
  claimedByParentAccountId: string | null
  createdAt: string
  updatedAt: string
}

export type UserRole = 'ADMIN' | 'PETUGAS' | 'ORANG_TUA'

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  displayName: string
  photoDataUrl?: string
}

export interface AuthSession {
  token?: string
  expiresAt: string
  user: AuthUser
}

export interface LoginInput {
  email: string
  password: string
  loginPreference?: 'STAFF_FIRST' | 'PARENT_FIRST'
}

export interface StaffUser {
  id: string
  fullName: string
  email: string
  role: 'PETUGAS'
  isActive: boolean
  tanggalMasuk: string
  photoDataUrl: string
  photoName: string
  positionTitle: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface StaffUserInput {
  fullName: string
  email: string
  password: string
  isActive: boolean
  tanggalMasuk: string
  photoDataUrl: string
  photoName: string
  positionTitle: string
  description: string
}

export type StaffRegistrationRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface StaffRegistrationRequest {
  id: string
  fullName: string
  email: string
  status: StaffRegistrationRequestStatus
  registeredAt: string
  approvedAt: string | null
  rejectedAt: string | null
}

export interface StaffRegistrationInput {
  fullName: string
  email: string
  password: string
}

export type LandingAnnouncementCategory =
  | 'event'
  | 'dokumentasi'
  | 'galeri'
  | 'fasilitas'
  | 'tim'
  | 'promosi'
  | 'ucapan'
export type LandingAnnouncementStatus = 'draft' | 'published' | 'archived'
export type LandingAnnouncementDisplayMode = 'section' | 'hero' | 'popup'

export interface LandingAnnouncement {
  id: string
  slug: string
  title: string
  category: LandingAnnouncementCategory
  displayMode: LandingAnnouncementDisplayMode
  excerpt: string
  content: string
  coverImageDataUrl: string
  coverImageName: string
  ctaLabel: string
  ctaUrl: string
  publishStartDate: string
  publishEndDate: string
  status: LandingAnnouncementStatus
  isPinned: boolean
  publishedAt: string
  authorName: string
  authorEmail: string
  createdAt: string
  updatedAt: string
}

export interface LandingAnnouncementInput {
  title: string
  slug?: string
  category: LandingAnnouncementCategory
  displayMode?: LandingAnnouncementDisplayMode
  excerpt?: string
  content?: string
  coverImageDataUrl?: string
  coverImageName?: string
  ctaLabel?: string
  ctaUrl?: string
  publishStartDate?: string
  publishEndDate?: string
  status?: LandingAnnouncementStatus
  isPinned?: boolean
  authorName?: string
  authorEmail?: string
}

export interface ActivityLogEntry {
  id: string
  eventAt: string
  gmail: string
  role: string
  action: string
  target: string
  detail: string
  status: string
}

export interface ActivityLogListResponse {
  entries: ActivityLogEntry[]
  hasMore: boolean
  nextCursor: string | null
}

export interface StaffAttendanceStatus {
  attendanceDate: string
  checkInAt: string
  checkOutAt: string
  hasCheckedIn: boolean
  hasCheckedOut: boolean
  productiveActivityCount: number
  lastProductiveActivityAt: string
  productivityStatus: 'aktif' | 'perlu-konfirmasi'
}

export interface StaffAttendanceActionResult {
  status: StaffAttendanceStatus
  alreadyCheckedIn?: boolean
  alreadyCheckedOut?: boolean
}

export interface StaffAttendanceRecapRow {
  key: string
  staffUserId: string
  fullName: string
  account: string
  attendanceDate: string
  checkInAt: string
  checkOutAt: string
  monthlyAttendanceCount: number
}

export interface ServicePackageRates {
  harian: number
  '2-mingguan': number
  bulanan: number
  updatedAt: string
}

export interface ServicePackageRatesInput {
  harian: number
  '2-mingguan': number
  bulanan: number
}

export type ServiceBillingStatus =
  | 'belum-periode'
  | 'aktif-lancar'
  | 'aktif-menunggak'
  | 'upgrade-pending'
  | 'periode-berakhir-menunggak'

export type ServiceBillingBucket = 'period' | 'arrears'
export type ServiceBillingTransactionType = 'period-start' | 'payment' | 'refund'
export type ServiceBillingPeriodStatus =
  | 'active'
  | 'upgrade_pending'
  | 'upgrade_confirmed'
  | 'completed'

export interface ServiceBillingPeriod {
  id: string
  childId: string
  packageKey: ServicePackage
  startDate: string
  endDate: string
  status: ServiceBillingPeriodStatus
  notes: string
  attendanceCount: number
  dailyChargeDays: number
  dailyChargeAmount: number
  dueAmount: number
  paidAmount: number
  outstandingAmount: number
  overpaymentAmount: number
  isAutoMigratedToMonthly: boolean
  migrationTopUpAmount: number
  needsUpgradeConfirmation: boolean
  createdAt: string
  updatedAt: string
}

export interface ServiceBillingTransaction {
  id: string
  childId: string
  periodId: string
  transactionType: ServiceBillingTransactionType
  bucket: ServiceBillingBucket
  amount: number
  notes: string
  paymentProofDataUrl: string
  paymentProofName: string
  transactedAt: string
  createdAt: string
  updatedAt: string
}

export type ServiceBillingPaymentStatus = 'lunas' | 'belum-bayar'

export interface ServiceBillingMigrationInfo {
  fromPackage: ServicePackage
  toPackage: ServicePackage
  triggerAttendance: number
  additionalAmount: number
  notes: string
}

export interface ServiceBillingSummaryRow {
  childId: string
  childName: string
  currentServicePackage: ServicePackage
  displayServicePackage: ServicePackage
  goLiveDate: string
  status: ServiceBillingStatus
  statusLabel: string
  activePeriod: ServiceBillingPeriod | null
  attendanceInActivePeriod: number
  dailyChargeDays: number
  dailyChargeAmount: number
  duePeriod: number
  paidPeriod: number
  outstandingPeriod: number
  arrearsAttendanceDays: number
  dueArrears: number
  paidArrears: number
  outstandingArrears: number
  totalOutstanding: number
  totalOverpayment: number
  overpaymentPeriod: number
  overpaymentArrears: number
  paymentStatus: ServiceBillingPaymentStatus
  hasPaymentAlert: boolean
  paymentAlertMessage: string
  migrationInfo: ServiceBillingMigrationInfo | null
  needsUpgradeConfirmation: boolean
  lastPaymentAt: string
  lastPaymentProofDataUrl: string
  lastPaymentProofName: string
  lastTransactionAt: string
}

export interface ServiceBillingSummaryResponse {
  goLiveDate: string
  generatedAt: string
  rates: ServicePackageRates
  rows: ServiceBillingSummaryRow[]
}

export interface ServiceBillingHistoryResponse {
  goLiveDate: string
  generatedAt: string
  rates: ServicePackageRates
  summary: ServiceBillingSummaryRow | null
  periods: ServiceBillingPeriod[]
  transactions: ServiceBillingTransaction[]
}

export interface ServiceBillingPeriodInput {
  childId: string
  packageKey: ServicePackage
  startDate?: string
  amount?: number
  notes?: string
}

export interface ServiceBillingPaymentInput {
  childId: string
  amount: number
  bucket: ServiceBillingBucket
  periodId?: string
  notes?: string
  paymentProofDataUrl?: string
  paymentProofName?: string
}

export interface ServiceBillingRefundInput {
  childId: string
  amount: number
  bucket: ServiceBillingBucket
  periodId?: string
  notes?: string
}

export interface ServiceBillingConfirmUpgradeInput {
  childId: string
  periodId: string
  notes?: string
}

export interface ParentDashboardData {
  children: ChildProfile[]
  attendanceRecords: AttendanceRecord[]
  incidentReports: IncidentReport[]
  observationRecords: ObservationRecord[]
  communicationEntries: CommunicationBookEntry[]
}

export interface GalleryItem {
  id: string
  childId: string
  title: string
  imageUrl: string
  createdAt: string
}

export interface ServiceBillingMonthCard {
  month: string
  status: ServiceBillingPaymentStatus
  totalDue: number
  totalPaid: number
  paidAmount: number
  outstandingTotal: number
}

export interface InvoiceItem {
  id: string
  date: string
  amount: number
  status: ServiceBillingPaymentStatus
}

export interface BillingSummaryItem {
  period: ServiceBillingPeriod
  transactions: ServiceBillingTransaction[]
}

export type BillingSummary = {
  currentMonth: ServiceBillingMonthCard | null
  history: BillingSummaryItem[]
  totalOutstanding: number
  bankInfo: {
    bankName: string
    accountNumber: string
    accountName: string
    bankBranch: string
    notes: string
  }
}

export interface AppData {
  version: number
  children: ChildProfile[]
  incidentReports: IncidentReport[]
  attendanceRecords: AttendanceRecord[]
  observationRecords: ObservationRecord[]
  communicationBooks: CommunicationBookEntry[]
  supplyInventory: SupplyInventoryItem[]
}

import type React from 'react'

export interface ConfirmDialogOptions {
  message: string | React.ReactNode
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
}

export type ChildProfileInput = Omit<ChildProfile, keyof MetadataFields>
export type IncidentReportInput = Omit<IncidentReport, keyof MetadataFields>
export type AttendanceRecordInput = Omit<AttendanceRecord, keyof MetadataFields>
export type CommunicationBookEntryInput = Omit<
  CommunicationBookEntry,
  keyof MetadataFields
>
export type ObservationRecordInput = Omit<ObservationRecord, keyof MetadataFields>
export type SupplyInventoryItemInput = Omit<
  SupplyInventoryItem,
  keyof MetadataFields
>
