import type { NextFunction, Request, Response } from 'express'

interface RequestSizeRule {
  pathPattern: RegExp
  maxBytes: number
}

export interface RequestSizeGuardOptions {
  defaultMaxBytes: number
  rules?: RequestSizeRule[]
}

const toReadableSize = (bytes: number): string => {
  if (bytes >= 1024 * 1024) {
    return `${Math.round((bytes / (1024 * 1024)) * 10) / 10}MB`
  }
  if (bytes >= 1024) {
    return `${Math.round((bytes / 1024) * 10) / 10}KB`
  }
  return `${bytes}B`
}

const resolveMaxBytes = (
  path: string,
  defaultMaxBytes: number,
  rules: RequestSizeRule[],
): number => {
  for (const rule of rules) {
    if (rule.pathPattern.test(path)) {
      return rule.maxBytes
    }
  }

  return defaultMaxBytes
}

export const createRequestSizeGuard = (options: RequestSizeGuardOptions) => {
  const rules = options.rules ?? []
  const defaultMaxBytes = Math.max(1, options.defaultMaxBytes)

  return (req: Request, res: Response, next: NextFunction): void => {
    const method = req.method.toUpperCase()
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      next()
      return
    }

    const rawLength = req.get('content-length')
    const contentLength = rawLength
      ? Number.parseInt(rawLength, 10)
      : Number.NaN

    if (!Number.isFinite(contentLength) || contentLength <= 0) {
      next()
      return
    }

    const maxBytes = resolveMaxBytes(req.path, defaultMaxBytes, rules)
    if (contentLength <= maxBytes) {
      next()
      return
    }

    res.status(413).json({
      success: false,
      message: `Payload terlalu besar. Batas endpoint ini ${toReadableSize(maxBytes)}.`,
      timestamp: new Date().toISOString(),
    })
  }
}
