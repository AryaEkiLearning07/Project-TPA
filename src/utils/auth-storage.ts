import type { AuthSession } from '../types'

const AUTH_STORAGE_KEY = 'tpa_auth_session'

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isValidAuthSession = (value: unknown): value is AuthSession => {
  if (!isObject(value) || !isObject(value.user)) {
    return false
  }

  const user = value.user
  return (
    typeof value.expiresAt === 'string' &&
    typeof user.id === 'string' &&
    typeof user.email === 'string' &&
    typeof user.role === 'string' &&
    typeof user.displayName === 'string'
  )
}

export const loadAuthSession = (): AuthSession | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.sessionStorage.getItem(AUTH_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isValidAuthSession(parsed)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export const saveAuthSession = (session: AuthSession): void => {
  if (typeof window === 'undefined') {
    return
  }

  const safeSnapshot: AuthSession = {
    expiresAt: session.expiresAt,
    user: session.user,
  }

  window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(safeSnapshot))
}

export const clearAuthSession = (): void => {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.removeItem(AUTH_STORAGE_KEY)
}
