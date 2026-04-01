export interface EquipmentItem {
  brand: string
  imageDataUrl: string
  imageName: string
  description: string
}

export interface CarriedItem {
  id: string
  category: string
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

export interface IncidentCarriedItem {
  id: string
  categoryKey: IncidentCategoryKey
  description: string
}

export interface ChildProfile {
  id: string
  createdAt: string
  updatedAt: string
  fullName: string
  nickName: string
  isActive?: boolean
  gender: string
  photoDataUrl: string
  birthPlace: string
  birthDate: string
  childOrder: string
  religion: string
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
  servicePackage: string
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

export interface IncidentReport {
  id: string
  createdAt: string
  updatedAt: string
  childId: string
  date: string
  arrivalPhysicalCondition: string
  arrivalEmotionalCondition: string
  departurePhysicalCondition: string
  departureEmotionalCondition: string
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

export interface AttendanceRecord {
  id: string
  createdAt: string
  updatedAt: string
  childId: string
  date: string
  escortName: string
  pickupName: string
  parentMessage: string
  messageForParent: string
  departureNotes: string
  arrivalTime: string
  departureTime: string
  arrivalPhysicalCondition: string
  arrivalEmotionalCondition: string
  departurePhysicalCondition: string
  departureEmotionalCondition: string
  carriedItems: CarriedItem[]
  escortSignatureDataUrl: string
  pickupSignatureDataUrl: string
}

export interface CommunicationBookEntry {
  id: string
  createdAt: string
  updatedAt: string
  childId: string
  date: string
  inventoryItems: string[]
  notes: string
}

export type ObservationCategory = 'perlu-arahan' | 'perlu-latihan' | 'sudah-baik'

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

export interface SupplyInventoryItem {
  id: string
  createdAt: string
  updatedAt: string
  childId: string
  productName: string
  category: string
  quantity: number
  description: string
  imageDataUrl: string
  imageName: string
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

export type ChildProfileInput = Omit<ChildProfile, 'id' | 'createdAt' | 'updatedAt'>
export type IncidentReportInput = Omit<
  IncidentReport,
  'id' | 'createdAt' | 'updatedAt'
>
export type AttendanceRecordInput = Omit<
  AttendanceRecord,
  'id' | 'createdAt' | 'updatedAt'
>
export type CommunicationBookEntryInput = Omit<
  CommunicationBookEntry,
  'id' | 'createdAt' | 'updatedAt'
>
export type ObservationRecordInput = Omit<
  ObservationRecord,
  'id' | 'createdAt' | 'updatedAt'
>
export type SupplyInventoryItemInput = Omit<
  SupplyInventoryItem,
  'id' | 'createdAt' | 'updatedAt'
>
export interface DbAttendanceNotes {
  arrivalPhysicalCondition: string
  arrivalEmotionalCondition: string
  departurePhysicalCondition: string
  departureEmotionalCondition: string
  parentMessage: string
  messageForParent: string
  departureNotes: string
  carriedItems: {
    id: string
    category: string
    imageDataUrl: string
    imageName: string
    description: string
  }[]
}

export type DbGender = 'MALE' | 'FEMALE'
export type DbReligion =
  | 'ISLAM'
  | 'CHRISTIAN'
  | 'CATHOLIC'
  | 'HINDU'
  | 'BUDDHIST'
  | 'CONFUCIAN'
  | 'OTHER'
export type DbServicePackage = 'DAILY' | 'BIWEEKLY' | 'MONTHLY'
export type DbPhysicalCondition = 'HEALTHY' | 'SICK'
export type DbEmotionalCondition = 'HAPPY' | 'SAD'
