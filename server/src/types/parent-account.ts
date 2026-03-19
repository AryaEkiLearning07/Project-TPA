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

export interface ParentAccount {
  id: string
  createdAt: string
  updatedAt: string
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
