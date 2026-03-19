import type { NextFunction, Request, Response } from 'express'

interface RateLimitState {
  count: number
  windowStartedAt: number
  blockedUntil: number
}

export interface RateLimitOptions {
  windowMs: number
  maxRequests: number
  blockDurationMs?: number
  keyPrefix: string
  keyResolver?: (req: Request) => string
  message?: string
}

const stateStore = new Map<string, RateLimitState>()

const cleanupStateStore = (now: number): void => {
  for (const [key, value] of stateStore.entries()) {
    const hasExpiredWindow = now - value.windowStartedAt > 10 * 60 * 1000
    const hasExpiredBlock = value.blockedUntil === 0 || value.blockedUntil <= now
    if (hasExpiredWindow && hasExpiredBlock) {
      stateStore.delete(key)
    }
  }
}

const parseClientIp = (req: Request): string => {
  const forwardedHeader = req.headers['x-forwarded-for']
  if (typeof forwardedHeader === 'string') {
    const firstForwarded = forwardedHeader.split(',')[0]?.trim()
    if (firstForwarded) {
      return firstForwarded
    }
  }

  if (Array.isArray(forwardedHeader) && forwardedHeader.length > 0) {
    const firstForwarded = forwardedHeader[0]?.split(',')[0]?.trim()
    if (firstForwarded) {
      return firstForwarded
    }
  }

  return req.ip || 'unknown'
}

export const createRateLimitMiddleware = (options: RateLimitOptions) => {
  const {
    windowMs,
    maxRequests,
    blockDurationMs = windowMs,
    keyPrefix,
    keyResolver = parseClientIp,
    message = 'Terlalu banyak request. Coba lagi beberapa saat.',
  } = options

  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method.toUpperCase() === 'OPTIONS') {
      next()
      return
    }

    const now = Date.now()
    if (stateStore.size > 50_000) {
      cleanupStateStore(now)
    }

    const key = `${keyPrefix}:${keyResolver(req)}`
    const current = stateStore.get(key)

    if (!current) {
      stateStore.set(key, {
        count: 1,
        windowStartedAt: now,
        blockedUntil: 0,
      })
      next()
      return
    }

    if (current.blockedUntil > now) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((current.blockedUntil - now) / 1000),
      )
      res.setHeader('Retry-After', String(retryAfterSeconds))
      res.status(429).json({
        success: false,
        message,
        timestamp: new Date().toISOString(),
      })
      return
    }

    if (now - current.windowStartedAt >= windowMs) {
      current.count = 0
      current.windowStartedAt = now
      current.blockedUntil = 0
    }

    current.count += 1

    if (current.count > maxRequests) {
      current.blockedUntil = now + blockDurationMs
      const retryAfterSeconds = Math.max(1, Math.ceil(blockDurationMs / 1000))
      res.setHeader('Retry-After', String(retryAfterSeconds))
      res.status(429).json({
        success: false,
        message,
        timestamp: new Date().toISOString(),
      })
      return
    }

    next()
  }
}
