import type {
  ActivityLogListResponse,
  AppData,
  AuthSession,
  BillingSummary,
  ChildRegistrationCode,
  ParentAccount,
  ParentAccountInput,
  ParentDashboardData,
  ServiceBillingConfirmUpgradeInput,
  ServiceBillingHistoryResponse,
  ServiceBillingPaymentInput,
  ServiceBillingPeriodInput,
  ServiceBillingRefundInput,
  ServiceBillingSummaryResponse,
  ServicePackageRates,
  ServicePackageRatesInput,
  StaffAttendanceActionResult,
  StaffAttendanceRecapRow,
  StaffAttendanceStatus,
  StaffRegistrationInput,
  StaffRegistrationRequest,
  StaffUser,
  StaffUserInput,
  LandingAnnouncement,
  LandingAnnouncementInput,
  AttendanceRecord,
  AttendanceRecordInput,
  IncidentReport,
  IncidentReportInput,
  ObservationRecord,
  ObservationRecordInput,
  CommunicationBookEntry,
  CommunicationBookEntryInput,
  SupplyInventoryItem,
  SupplyInventoryItemInput,
  ChildProfile,
  ChildProfileInput,
  GalleryItem,
  ParentProfile,
} from '../types'

interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
}

interface ApiRequestOptions extends RequestInit {
  timeoutMs?: number
}

export type ApiErrorType =
  | 'NETWORK'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'RATE_LIMIT'
  | 'SERVER'
  | 'RESPONSE'
  | 'UNKNOWN'

interface ApiErrorParams {
  type: ApiErrorType
  message: string
  path: string
  method: string
  status?: number | null
  reference?: string
}

export class ApiError extends Error {
  readonly type: ApiErrorType
  readonly status: number | null
  readonly path: string
  readonly method: string
  readonly reference: string

  constructor({ type, message, path, method, status = null, reference }: ApiErrorParams) {
    super(message)
    this.name = 'ApiError'
    this.type = type
    this.status = status
    this.path = path
    this.method = method
    this.reference = reference ?? createErrorReference()
  }
}

const createErrorReference = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `ERR-${timestamp}-${random}`
}

export interface ServerDateContext {
  timestamp: string
  todayDate: string
  todayMonth: string
  todayYear: string
}

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  '/api/v1'

const DEFAULT_API_TIMEOUT_MS = (() => {
  const raw = Number(import.meta.env.VITE_API_TIMEOUT_MS)
  if (Number.isFinite(raw) && raw > 0) {
    return raw
  }
  return 60000
})()

const resolveApiErrorTypeFromStatus = (status: number): ApiErrorType => {
  if (status === 401) return 'UNAUTHORIZED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'NOT_FOUND'
  if (status === 408) return 'TIMEOUT'
  if (status === 429) return 'RATE_LIMIT'
  if (status >= 400 && status < 500) return 'VALIDATION'
  if (status >= 500) return 'SERVER'
  return 'UNKNOWN'
}

const normalizeMessage = (message: string): string => {
  const trimmed = message.trim()
  return trimmed.length > 0 ? trimmed : 'Terjadi kesalahan saat memproses permintaan.'
}

const formatApiErrorMessage = (params: {
  message: string
}): string => {
  return normalizeMessage(params.message)
}

const createApiError = ({
  type,
  status = null,
  message,
  path,
  method,
}: {
  type: ApiErrorType
  status?: number | null
  message: string
  path: string
  method: string
}): ApiError => {
  const reference = createErrorReference()
  return new ApiError({
    type,
    status,
    path,
    method,
    reference,
    message: formatApiErrorMessage({
      message,
    }),
  })
}

const getDefaultApiErrorMessage = (response: Response): string => {
  if (response.status >= 500) {
    return 'Maaf, terjadi kesalahan pada sistem. Silakan muat ulang halaman atau coba lagi nanti.'
  }

  return 'Permintaan tidak dapat diproses. Silakan periksa data lalu coba lagi.'
}

const toHeaders = (
  headers: HeadersInit | undefined,
  hasBody: boolean,
): Headers => {
  const normalized = new Headers(headers)
  if (hasBody && !normalized.has('Content-Type')) {
    normalized.set('Content-Type', 'application/json')
  }

  return normalized
}

const parseApiErrorMessage = async (response: Response): Promise<string> => {
  const text = await response.text()
  if (!text) {
    return getDefaultApiErrorMessage(response)
  }

  try {
    const parsed = JSON.parse(text) as ApiResponse<unknown>
    return parsed.message ?? getDefaultApiErrorMessage(response)
  } catch {
    return text
  }
}

const executeFetch = async (
  path: string,
  options: ApiRequestOptions = {},
): Promise<Response> => {
  const { timeoutMs = DEFAULT_API_TIMEOUT_MS, ...fetchOptions } = options
  const method = (fetchOptions.method ?? 'GET').toUpperCase()
  const controller = new AbortController()
  const externalSignal = fetchOptions.signal
  const onExternalAbort = () => {
    controller.abort()
  }

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort()
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true })
    }
  }

  const timeoutHandle = window.setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  try {
    const hasBody = fetchOptions.body !== undefined && fetchOptions.body !== null

    return await fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      headers: toHeaders(fetchOptions.headers, hasBody),
      credentials: 'include',
      signal: controller.signal,
    })
  } catch (error) {
    const errorName = error instanceof Error ? error.name : ''

    if (errorName === 'AbortError') {
      if (externalSignal?.aborted) {
        throw createApiError({
          type: 'CANCELLED',
          path,
          method,
          message: 'Permintaan dibatalkan sebelum selesai.',
        })
      }

      throw createApiError({
        type: 'TIMEOUT',
        path,
        method,
        message:
          'Koneksi ke server melewati batas waktu. Silakan periksa jaringan lalu coba lagi.',
      })
    }

    const message = error instanceof Error ? error.message : 'Kesalahan jaringan tidak diketahui.'
    throw createApiError({
      type: 'NETWORK',
      path,
      method,
      message: `Tidak dapat terhubung ke server. ${message}`,
    })
  } finally {
    window.clearTimeout(timeoutHandle)
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort)
    }
  }
}

const request = async <T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> => {
  const method = (options.method ?? 'GET').toUpperCase()
  const response = await executeFetch(path, options)

  const text = await response.text()
  let payload: ApiResponse<T> | null = null

  if (text) {
    try {
      payload = JSON.parse(text) as ApiResponse<T>
    } catch {
      payload = null
    }
  }

  if (!response.ok || !payload?.success || payload.data === undefined) {
    const rawResponseMessage = payload === null && text ? text : null
    const message = normalizeMessage(
      payload?.message ?? rawResponseMessage ?? getDefaultApiErrorMessage(response),
    )
    const type = !response.ok
      ? resolveApiErrorTypeFromStatus(response.status)
      : 'RESPONSE'

    throw createApiError({
      type,
      status: response.status,
      message,
      path,
      method,
    })
  }

  return payload.data
}

const extractFilename = (contentDisposition: string | null): string | null => {
  if (!contentDisposition) {
    return null
  }

  const match = /filename="([^"]+)"/i.exec(contentDisposition)
  if (!match || !match[1]) {
    return null
  }

  return match[1]
}

const requestDownload = async (
  path: string,
  options: ApiRequestOptions = {},
): Promise<{ blob: Blob; fileName: string | null }> => {
  const method = (options.method ?? 'GET').toUpperCase()
  const response = await executeFetch(path, options)

  if (!response.ok) {
    const message = await parseApiErrorMessage(response)
    throw createApiError({
      type: resolveApiErrorTypeFromStatus(response.status),
      status: response.status,
      message,
      path,
      method,
    })
  }

  const blob = await response.blob()
  const fileName = extractFilename(response.headers.get('content-disposition'))
  return { blob, fileName }
}

export const appDataApi = {
  getAppData: (options?: { mode?: 'full' | 'lite' }): Promise<AppData> =>
    request(`/app-data${options?.mode === 'lite' ? '?mode=lite' : ''}`),
  replaceAppData: (payload: AppData): Promise<AppData> =>
    request('/app-data', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  importAppData: (payload: AppData): Promise<AppData> =>
    request('/app-data/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
}

export const parentAccountApi = {
  getParentAccounts: (): Promise<ParentAccount[]> => request('/parent-accounts'),
  createParentAccount: (payload: ParentAccountInput): Promise<ParentAccount> =>
    request('/parent-accounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateParentAccount: (
    id: string,
    payload: ParentAccountInput,
  ): Promise<ParentAccount> =>
    request(`/parent-accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteParentAccount: (id: string): Promise<{ id: string }> =>
    request(`/parent-accounts/${id}`, {
      method: 'DELETE',
    }),
}

export const authApi = {
  login: (payload: {
    email: string
    password: string
    loginPreference?: 'STAFF_FIRST' | 'PARENT_FIRST'
  }): Promise<AuthSession> =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  logout: (): Promise<{ loggedOut: boolean }> =>
    request('/auth/logout', {
      method: 'POST',
    }),
  registerParentWithCode: (payload: {
    email: string
    password: string
    registrationCode: string
  }): Promise<{
    user: AuthSession['user']
    expiresAt: string
    dashboard: ParentDashboardData
  }> =>
    request('/auth/register-parent-with-code', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  registerStaff: (payload: StaffRegistrationInput): Promise<StaffRegistrationRequest> =>
    request('/auth/register-staff', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  me: (): Promise<{ user: AuthSession['user']; expiresAt: string }> =>
    request('/auth/me'),
}

export const staffAttendanceApi = {
  getStatus: (): Promise<StaffAttendanceStatus> =>
    request('/staff-attendance/status'),
  checkIn: (): Promise<StaffAttendanceActionResult> =>
    request('/staff-attendance/check-in', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  checkOut: (): Promise<StaffAttendanceActionResult> =>
    request('/staff-attendance/check-out', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
}

export const adminApi = {
  getServerDateContext: (): Promise<ServerDateContext> =>
    request('/admin/server-date-context'),
  getLandingAnnouncements: (): Promise<LandingAnnouncement[]> =>
    request('/admin/landing-announcements'),
  createLandingAnnouncement: (payload: LandingAnnouncementInput): Promise<LandingAnnouncement> =>
    request('/admin/landing-announcements', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateLandingAnnouncement: (
    id: string,
    payload: LandingAnnouncementInput,
  ): Promise<LandingAnnouncement> =>
    request(`/admin/landing-announcements/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteLandingAnnouncement: (id: string): Promise<{ id: string }> =>
    request(`/admin/landing-announcements/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  checkInStaffAttendance: (payload: {
    staffUserId: string
    attendanceDate: string
  }): Promise<StaffAttendanceActionResult> =>
    request('/admin/staff-attendance/check-in', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  checkOutStaffAttendance: (payload: {
    staffUserId: string
    attendanceDate: string
  }): Promise<StaffAttendanceActionResult> =>
    request('/admin/staff-attendance/check-out', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getStaffUsers: (): Promise<StaffUser[]> => request('/admin/staff-users'),
  getPendingStaffRegistrationRequests: (): Promise<StaffRegistrationRequest[]> =>
    request('/admin/staff-registration-requests'),
  approveStaffRegistrationRequest: (requestId: string): Promise<StaffUser> =>
    request(`/admin/staff-registration-requests/${encodeURIComponent(requestId)}/approve`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  rejectStaffRegistrationRequest: (requestId: string): Promise<{ id: string }> =>
    request(`/admin/staff-registration-requests/${encodeURIComponent(requestId)}/reject`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  createStaffUser: (payload: StaffUserInput): Promise<StaffUser> =>
    request('/admin/staff-users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateStaffUser: (id: string, payload: StaffUserInput): Promise<StaffUser> =>
    request(`/admin/staff-users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteStaffUser: (id: string): Promise<{ id: string }> =>
    request(`/admin/staff-users/${id}`, {
      method: 'DELETE',
    }),
  getActivityLogs: (options?: {
    search?: string
    limit?: number
    cursor?: string | null
    eventDate?: string
  }): Promise<ActivityLogListResponse> => {
    const params = new URLSearchParams()
    params.set('search', options?.search ?? '')
    params.set('limit', String(options?.limit ?? 200))
    if (options?.eventDate) {
      params.set('eventDate', options.eventDate)
    }
    if (options?.cursor) {
      params.set('cursor', options.cursor)
    }

    return request(`/admin/activity-logs?${params.toString()}`)
  },
  getStaffAttendanceRecap: (
    date: string,
    month: string,
  ): Promise<StaffAttendanceRecapRow[]> =>
    request(
      `/admin/staff-attendance/recap?date=${encodeURIComponent(date)}&month=${encodeURIComponent(month)}`,
    ),
  getServiceRates: (): Promise<ServicePackageRates> =>
    request('/admin/service-rates'),
  updateServiceRates: (
    payload: ServicePackageRatesInput,
  ): Promise<ServicePackageRates> =>
    request('/admin/service-rates', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  getServiceBillingSummary: (): Promise<ServiceBillingSummaryResponse> =>
    request('/admin/service-billing/summary'),
  getServiceBillingHistory: (
    childId: string,
  ): Promise<ServiceBillingHistoryResponse> =>
    request(`/admin/service-billing/history/${encodeURIComponent(childId)}`),
  createServiceBillingPeriod: (
    payload: ServiceBillingPeriodInput,
  ): Promise<ServiceBillingHistoryResponse> =>
    request('/admin/service-billing/periods', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createServiceBillingPayment: (
    payload: ServiceBillingPaymentInput,
  ): Promise<ServiceBillingHistoryResponse> =>
    request('/admin/service-billing/payments', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createServiceBillingRefund: (
    payload: ServiceBillingRefundInput,
  ): Promise<ServiceBillingHistoryResponse> =>
    request('/admin/service-billing/refunds', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  confirmServiceBillingUpgrade: (
    payload: ServiceBillingConfirmUpgradeInput,
  ): Promise<ServiceBillingHistoryResponse> =>
    request('/admin/service-billing/confirm-upgrade', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  downloadBackup: (): Promise<{ blob: Blob; fileName: string | null }> =>
    requestDownload('/admin/backup', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    }),
  getChildRegistrationCode: (childId: string): Promise<ChildRegistrationCode | null> =>
    request(`/admin/children/${encodeURIComponent(childId)}/registration-code`),
  generateChildRegistrationCode: (childId: string): Promise<ChildRegistrationCode> =>
    request(`/admin/children/${encodeURIComponent(childId)}/registration-code`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
}
export const attendanceApi = {
  getAttendanceRecords: (month?: string): Promise<AttendanceRecord[]> =>
    request(`/attendance${month ? `?month=${month}` : ''}`),
  createAttendanceRecord: (payload: AttendanceRecordInput): Promise<AttendanceRecord> =>
    request('/attendance', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateAttendanceRecord: (id: string, payload: AttendanceRecordInput): Promise<AttendanceRecord> =>
    request(`/attendance/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteAttendanceRecord: (id: string): Promise<void> =>
    request(`/attendance/${id}`, {
      method: 'DELETE',
    }),
}

export const incidentApi = {
  getIncidentReports: (month?: string): Promise<IncidentReport[]> =>
    request(`/incidents${month ? `?month=${month}` : ''}`),
  createIncidentReport: (payload: IncidentReportInput): Promise<IncidentReport> =>
    request('/incidents', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateIncidentReport: (id: string, payload: IncidentReportInput): Promise<IncidentReport> =>
    request(`/incidents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteIncidentReport: (id: string): Promise<void> =>
    request(`/incidents/${id}`, {
      method: 'DELETE',
    }),
}

export const observationApi = {
  getObservationRecords: (month?: string): Promise<ObservationRecord[]> =>
    request(`/observations${month ? `?month=${month}` : ''}`),
  createObservationRecord: (payload: ObservationRecordInput): Promise<ObservationRecord> =>
    request('/observations', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateObservationRecord: (id: string, payload: ObservationRecordInput): Promise<ObservationRecord> =>
    request(`/observations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteObservationRecord: (id: string): Promise<void> =>
    request(`/observations/${id}`, {
      method: 'DELETE',
    }),
}

export const communicationApi = {
  getCommunicationEntries: (month?: string): Promise<CommunicationBookEntry[]> =>
    request(`/communications${month ? `?month=${month}` : ''}`),
  createCommunicationEntry: (payload: CommunicationBookEntryInput): Promise<CommunicationBookEntry> =>
    request('/communications', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateCommunicationEntry: (id: string, payload: CommunicationBookEntryInput): Promise<CommunicationBookEntry> =>
    request(`/communications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteCommunicationEntry: (id: string): Promise<void> =>
    request(`/communications/${id}`, {
      method: 'DELETE',
    }),
}

export const supplyInventoryApi = {
  getSupplyInventory: (): Promise<SupplyInventoryItem[]> =>
    request('/supply-inventory'),
  createSupplyItem: (payload: SupplyInventoryItemInput): Promise<SupplyInventoryItem> =>
    request('/supply-inventory', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateSupplyItem: (id: string, payload: SupplyInventoryItemInput): Promise<SupplyInventoryItem> =>
    request(`/supply-inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteSupplyItem: (id: string): Promise<void> =>
    request(`/supply-inventory/${id}`, {
      method: 'DELETE',
    }),
}

export const parentApi = {
  getDashboardData: (): Promise<ParentDashboardData> =>
    request('/parent/dashboard'),
  updateProfile: (payload: {
    childId: string
    childProfile: ChildProfileInput
    parentProfile: ParentProfile
  }): Promise<ParentDashboardData> =>
    request(`/parent/profile/${encodeURIComponent(payload.childId)}`, {
      method: 'PUT',
      body: JSON.stringify({
        childProfile: payload.childProfile,
        parentProfile: payload.parentProfile,
      }),
    }),
  changePassword: (payload: {
    currentPassword: string
    newPassword: string
  }): Promise<{ updated: boolean }> =>
    request('/parent/password', {
      method: 'PUT',
      body: JSON.stringify({
        currentPassword: payload.currentPassword,
        newPassword: payload.newPassword,
      }),
    }),
  getChildDetails: (childId: string): Promise<ChildProfile> =>
    request(`/parent/child/${childId}`),
  getDailyLogs: (childId: string, date?: string): Promise<AttendanceRecord[]> =>
    request(`/parent/child/${childId}/logs${date ? `?date=${date}` : ''}`),
  getGallery: (childId: string, month?: string): Promise<GalleryItem[]> =>
    request(`/parent/child/${childId}/gallery${month ? `?month=${month}` : ''}`),
  getBilling: (childId: string): Promise<BillingSummary> =>
    request(`/parent/child/${childId}/billing`),
  linkChildByCode: (payload: { registrationCode: string }): Promise<ParentDashboardData> =>
    request('/parent/link-child', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateParentMessage: (payload: {
    attendanceId: string
    parentMessage: string
  }): Promise<{ updated: boolean; attendanceId: string; parentMessage: string }> =>
    request(`/parent/attendance/${encodeURIComponent(payload.attendanceId)}/message`, {
      method: 'PUT',
      body: JSON.stringify({ parentMessage: payload.parentMessage }),
    }),
}

export const childApi = {
  getChildren: (): Promise<ChildProfile[]> =>
    request('/children'),
  getChildById: (id: string): Promise<ChildProfile> =>
    request(`/children/${id}`),
  createChild: (payload: ChildProfileInput): Promise<ChildProfile> =>
    request('/children', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateChild: (id: string, payload: ChildProfileInput): Promise<ChildProfile> =>
    request(`/children/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteChild: (id: string): Promise<void> =>
    request(`/children/${id}`, {
      method: 'DELETE',
    }),
}
