import { env } from '../config/env.js'

const isProduction = env.nodeEnv === 'production'

export const sanitizeServerErrorMessage = (
  error: unknown,
  fallbackMessage: string,
): string => {
  if (isProduction) {
    return fallbackMessage
  }

  if (error instanceof Error) {
    const message = error.message.trim()
    if (message.length > 0) {
      return message
    }
  }

  return fallbackMessage
}

export const sanitizeDatabaseErrorMessage = (
  sqlMessage: string | undefined,
  fallbackMessage: string,
): string => {
  if (isProduction) {
    return fallbackMessage
  }

  const message = typeof sqlMessage === 'string' ? sqlMessage.trim() : ''
  return message.length > 0 ? message : fallbackMessage
}
