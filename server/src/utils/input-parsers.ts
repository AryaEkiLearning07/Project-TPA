/**
 * Server-side input parsers for route payloads.
 *
 * These ensure that incoming request bodies conform to expected shapes
 * before reaching service logic, preventing malformed data from
 * triggering unexpected errors or being persisted.
 */

import type {
  AttendanceRecordInput,
  CarriedItem,
  CommunicationBookEntryInput,
  IncidentCarriedItem,
  IncidentCategoryKey,
  IncidentReportInput,
  MealEquipment,
  EquipmentItem,
  ObservationRecordInput,
  ObservationItem,
  ObservationCategory,
  SupplyInventoryItemInput,
  ChildProfileInput,
} from '../types/app-data.js'

class InputParseError extends Error {
  status: number
  constructor(message: string) {
    super(message)
    this.name = 'InputParseError'
    this.status = 400
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const toText = (value: unknown): string =>
  typeof value === 'string' ? value : ''

const toNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }
  return value.map((item) => (typeof item === 'string' ? item : '')).filter(Boolean)
}

const VALID_INCIDENT_CATEGORIES: ReadonlySet<string> = new Set<IncidentCategoryKey>([
  'DRINKING_BOTTLE', 'MILK_CONTAINER', 'MEAL_CONTAINER', 'SNACK_CONTAINER',
  'BATH_SUPPLIES', 'MEDICINE_VITAMIN', 'BAG', 'HELMET', 'SHOES', 'JACKET', 'OTHER',
])

const VALID_OBSERVATION_CATEGORIES: ReadonlySet<string> = new Set<ObservationCategory>([
  'perlu-arahan', 'perlu-latihan', 'sudah-baik',
])

const parseEquipmentItem = (value: unknown): EquipmentItem => {
  const obj = isObject(value) ? value : {}
  return {
    brand: toText(obj.brand),
    imageDataUrl: toText(obj.imageDataUrl),
    imageName: toText(obj.imageName),
    description: toText(obj.description),
  }
}

const parseMealEquipment = (value: unknown): MealEquipment => {
  const obj = isObject(value) ? value : {}
  return {
    drinkingBottle: parseEquipmentItem(obj.drinkingBottle),
    milkBottle: parseEquipmentItem(obj.milkBottle),
    mealContainer: parseEquipmentItem(obj.mealContainer),
    snackContainer: parseEquipmentItem(obj.snackContainer),
  }
}

const parseCarriedItem = (value: unknown): CarriedItem => {
  const obj = isObject(value) ? value : {}
  return {
    id: toText(obj.id),
    category: toText(obj.category),
    imageDataUrl: toText(obj.imageDataUrl),
    imageName: toText(obj.imageName),
    description: toText(obj.description),
  }
}

const parseIncidentCarriedItem = (value: unknown): IncidentCarriedItem => {
  const obj = isObject(value) ? value : {}
  const categoryKey = toText(obj.categoryKey)
  return {
    id: toText(obj.id),
    categoryKey: VALID_INCIDENT_CATEGORIES.has(categoryKey)
      ? (categoryKey as IncidentCategoryKey)
      : 'OTHER',
    description: toText(obj.description),
  }
}

const parseObservationItem = (value: unknown): ObservationItem => {
  const obj = isObject(value) ? value : {}
  const category = toText(obj.category)
  return {
    id: toText(obj.id),
    activity: toText(obj.activity),
    indicator: toText(obj.indicator),
    category: VALID_OBSERVATION_CATEGORIES.has(category)
      ? (category as ObservationCategory)
      : 'perlu-arahan',
    notes: toText(obj.notes),
  }
}

export const parseAttendanceRecordInput = (value: unknown): AttendanceRecordInput => {
  if (!isObject(value)) {
    throw new InputParseError('Payload kehadiran tidak valid.')
  }

  return {
    childId: toText(value.childId),
    date: toText(value.date),
    escortName: toText(value.escortName),
    pickupName: toText(value.pickupName),
    parentMessage: toText(value.parentMessage),
    messageForParent: toText(value.messageForParent),
    departureNotes: toText(value.departureNotes),
    arrivalTime: toText(value.arrivalTime),
    departureTime: toText(value.departureTime),
    arrivalPhysicalCondition: toText(value.arrivalPhysicalCondition),
    arrivalEmotionalCondition: toText(value.arrivalEmotionalCondition),
    departurePhysicalCondition: toText(value.departurePhysicalCondition),
    departureEmotionalCondition: toText(value.departureEmotionalCondition),
    carriedItems: Array.isArray(value.carriedItems)
      ? value.carriedItems.map(parseCarriedItem)
      : [],
    escortSignatureDataUrl: toText(value.escortSignatureDataUrl),
    pickupSignatureDataUrl: toText(value.pickupSignatureDataUrl),
  }
}

export const parseIncidentReportInput = (value: unknown): IncidentReportInput => {
  if (!isObject(value)) {
    throw new InputParseError('Payload berita acara tidak valid.')
  }

  return {
    childId: toText(value.childId),
    date: toText(value.date),
    arrivalPhysicalCondition: toText(value.arrivalPhysicalCondition),
    arrivalEmotionalCondition: toText(value.arrivalEmotionalCondition),
    departurePhysicalCondition: toText(value.departurePhysicalCondition),
    departureEmotionalCondition: toText(value.departureEmotionalCondition),
    carriedItemsPhotoDataUrl: toText(value.carriedItemsPhotoDataUrl),
    carriedItems: Array.isArray(value.carriedItems)
      ? value.carriedItems.map(parseIncidentCarriedItem)
      : [],
    mealEquipment: parseMealEquipment(value.mealEquipment),
    bathEquipment: toText(value.bathEquipment),
    medicines: toText(value.medicines),
    bag: toText(value.bag),
    parentMessage: toText(value.parentMessage),
    messageForParent: toText(value.messageForParent),
    notes: toText(value.notes),
    arrivalSignatureDataUrl: toText(value.arrivalSignatureDataUrl),
    departureSignatureDataUrl: toText(value.departureSignatureDataUrl),
  }
}

export const parseObservationRecordInput = (value: unknown): ObservationRecordInput => {
  if (!isObject(value)) {
    throw new InputParseError('Payload observasi tidak valid.')
  }

  return {
    childId: toText(value.childId),
    date: toText(value.date),
    groupName: toText(value.groupName),
    observerName: toText(value.observerName),
    items: Array.isArray(value.items)
      ? value.items.map(parseObservationItem)
      : [],
  }
}

export const parseCommunicationBookEntryInput = (value: unknown): CommunicationBookEntryInput => {
  if (!isObject(value)) {
    throw new InputParseError('Payload buku komunikasi tidak valid.')
  }

  return {
    childId: toText(value.childId),
    date: toText(value.date),
    inventoryItems: toStringArray(value.inventoryItems),
    notes: toText(value.notes),
  }
}

export const parseSupplyInventoryItemInput = (value: unknown): SupplyInventoryItemInput => {
  if (!isObject(value)) {
    throw new InputParseError('Payload inventori tidak valid.')
  }

  return {
    childId: toText(value.childId),
    productName: toText(value.productName),
    category: toText(value.category),
    quantity: toNumber(value.quantity, 0),
    description: toText(value.description),
    imageDataUrl: toText(value.imageDataUrl),
    imageName: toText(value.imageName),
  }
}

export const parseChildProfileInput = (value: unknown): ChildProfileInput => {
  if (!isObject(value)) {
    throw new InputParseError('Payload data anak tidak valid.')
  }

  return {
    fullName: toText(value.fullName),
    nickName: toText(value.nickName),
    gender: toText(value.gender),
    photoDataUrl: toText(value.photoDataUrl),
    birthPlace: toText(value.birthPlace),
    birthDate: toText(value.birthDate),
    childOrder: toText(value.childOrder),
    religion: toText(value.religion),
    outsideActivities: toText(value.outsideActivities),
    fatherName: toText(value.fatherName),
    motherName: toText(value.motherName),
    homeAddress: toText(value.homeAddress),
    homePhone: toText(value.homePhone),
    officeAddress: toText(value.officeAddress),
    otherPhone: toText(value.otherPhone),
    email: toText(value.email),
    whatsappNumber: toText(value.whatsappNumber),
    allergy: toText(value.allergy),
    servicePackage: toText(value.servicePackage),
    arrivalTime: toText(value.arrivalTime),
    departureTime: toText(value.departureTime),
    pickupPersons: toStringArray(value.pickupPersons),
    depositPurpose: toText(value.depositPurpose),
    prenatalPeriod: toText(value.prenatalPeriod),
    partusPeriod: toText(value.partusPeriod),
    postNatalPeriod: toText(value.postNatalPeriod),
    motorSkill: toText(value.motorSkill),
    languageSkill: toText(value.languageSkill),
    healthHistory: toText(value.healthHistory),
    toiletTrainingBab: toText(value.toiletTrainingBab),
    toiletTrainingBak: toText(value.toiletTrainingBak),
    toiletTrainingBath: toText(value.toiletTrainingBath),
    brushingTeeth: toText(value.brushingTeeth),
    eating: toText(value.eating),
    drinkingMilk: toText(value.drinkingMilk),
    whenCrying: toText(value.whenCrying),
    whenPlaying: toText(value.whenPlaying),
    sleeping: toText(value.sleeping),
    otherHabits: toText(value.otherHabits),
  }
}

export { InputParseError }
