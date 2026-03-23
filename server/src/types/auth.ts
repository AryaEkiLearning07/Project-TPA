export type UserRole = 'ADMIN' | 'PETUGAS' | 'ORANG_TUA'

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  displayName: string
}

export interface AuthSessionPayload {
  token: string
  expiresAt: string
  user: AuthUser
}

export interface LoginInput {
  email: string
  password: string
}

export interface RequestMeta {
  ipAddress: string | null
  userAgent: string | null
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

export interface ActivityLogListResult {
  entries: ActivityLogEntry[]
  hasMore: boolean
  nextCursor: string | null
}

export interface StaffUser {
  id: string
  fullName: string
  email: string
  role: 'PETUGAS'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface StaffUserInput {
  fullName: string
  email: string
  password: string
  isActive: boolean
}
