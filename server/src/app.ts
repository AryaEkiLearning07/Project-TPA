import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import express from 'express'
import { checkDatabaseConnection } from './config/database.js'
import { env } from './config/env.js'
import { requireAuth, requireRoles } from './middlewares/auth-middleware.js'
import { createRateLimitMiddleware } from './middlewares/rate-limit-middleware.js'
import { createRequestSizeGuard } from './middlewares/request-size-middleware.js'
import appDataRoutes from './routes/app-data-routes.js'
import adminRoutes from './routes/admin-routes.js'
import authRoutes from './routes/auth-routes.js'
import parentAccountRoutes from './routes/parent-account-routes.js'
import parentRoutes from './routes/parent-routes.js'
import staffAttendanceRoutes from './routes/staff-attendance-routes.js'
import { sanitizeServerErrorMessage } from './utils/error-sanitizer.js'

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', env.security.trustProxy)
const moduleDir = path.dirname(fileURLToPath(import.meta.url))
const adminFrontendDistDir = path.resolve(moduleDir, '../../dist')
const adminFrontendIndexFile = path.join(adminFrontendDistDir, 'index.html')
const landingFrontendDistDir = path.resolve(moduleDir, '../../dist-landing')
const landingFrontendIndexFile = path.join(landingFrontendDistDir, 'index.html')
const canServeAdminFrontend = fs.existsSync(adminFrontendIndexFile)
const canServeLandingFrontend = fs.existsSync(landingFrontendIndexFile)
const publicLandingHosts = new Set(['tparumahceria.my.id', 'www.tparumahceria.my.id'])
const publicAdminHosts = new Set(['apps.tparumahceria.my.id'])
const apexLandingHost = 'tparumahceria.my.id'
const redirectOnlyHosts = new Set(['www.tparumahceria.my.id'])

function setHtmlNoStore(res: express.Response): void {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
}

const adminStaticMiddleware = canServeAdminFrontend
  ? express.static(adminFrontendDistDir, {
    index: false,
    setHeaders: (res, filePath) => {
      if (/\.(js|css|html)$/i.test(filePath)) {
        setHtmlNoStore(res)
      }
    },
  })
  : null
const landingStaticMiddleware = canServeLandingFrontend
  ? express.static(landingFrontendDistDir, {
    index: false,
    setHeaders: (res, filePath) => {
      if (/\.(js|css|html)$/i.test(filePath)) {
        setHtmlNoStore(res)
      }
    },
  })
  : null
const adminEntryScriptFile = path.join(adminFrontendDistDir, 'assets', 'app.js')
const adminEntryStyleFile = path.join(adminFrontendDistDir, 'assets', 'app.css')
const landingEntryScriptFile = path.join(landingFrontendDistDir, 'assets', 'landing.js')
const landingEntryStyleFile = path.join(landingFrontendDistDir, 'assets', 'landing.css')

const normalizeHost = (rawHost: string | undefined): string => {
  if (!rawHost) {
    return ''
  }

  return rawHost
    .split(':')[0]
    .trim()
    .toLowerCase()
}

const resolveFrontendTarget = (
  host: string,
): 'landing' | 'admin' | null => {
  if (publicLandingHosts.has(host) && canServeLandingFrontend) {
    return 'landing'
  }

  if (publicAdminHosts.has(host) && canServeAdminFrontend) {
    return 'admin'
  }

  if (canServeAdminFrontend) {
    return 'admin'
  }

  if (canServeLandingFrontend) {
    return 'landing'
  }

  return null
}

const resolveLegacyEntryAsset = (
  requestPath: string,
  frontendTarget: 'landing' | 'admin' | null,
): string | null => {
  if (!/^\/assets\/index-[^/]+\.(js|css)$/.test(requestPath)) {
    return null
  }

  if (frontendTarget === 'landing') {
    return requestPath.endsWith('.css')
      ? '/assets/landing.css'
      : '/assets/landing.js'
  }

  if (frontendTarget === 'admin') {
    return requestPath.endsWith('.css')
      ? '/assets/app.css'
      : '/assets/app.js'
  }

  return null
}

const readVersionToken = (filePath: string): string => {
  try {
    return String(fs.statSync(filePath).mtimeMs)
  } catch {
    return String(Date.now())
  }
}

const renderFrontendIndexHtml = (
  target: 'landing' | 'admin',
): string => {
  const html = fs.readFileSync(
    target === 'landing' ? landingFrontendIndexFile : adminFrontendIndexFile,
    'utf8',
  )

  if (target === 'landing') {
    const landingScriptVersion = readVersionToken(landingEntryScriptFile)
    const landingStyleVersion = readVersionToken(landingEntryStyleFile)

    return html
      .replaceAll('/assets/landing.js', `/assets/landing.js?v=${landingScriptVersion}`)
      .replaceAll('/assets/landing.css', `/assets/landing.css?v=${landingStyleVersion}`)
  }

  const adminScriptVersion = readVersionToken(adminEntryScriptFile)
  const adminStyleVersion = readVersionToken(adminEntryStyleFile)

  return html
    .replaceAll('/assets/app.js', `/assets/app.js?v=${adminScriptVersion}`)
    .replaceAll('/assets/app.css', `/assets/app.css?v=${adminStyleVersion}`)
}

const localOriginPattern = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/
const globalApiRateLimiter = createRateLimitMiddleware({
  keyPrefix: 'global-api',
  windowMs: env.security.globalRateLimitWindowMs,
  maxRequests: env.security.globalRateLimitMax,
  message: 'Terlalu banyak request ke API. Coba lagi sebentar.',
})
const loginRateLimiter = createRateLimitMiddleware({
  keyPrefix: 'auth-login',
  windowMs: env.security.loginRateLimitWindowMs,
  maxRequests: env.security.loginRateLimitMax,
  blockDurationMs: env.security.loginRateLimitBlockMs,
  message: 'Terlalu banyak percobaan login dari jaringan ini. Coba lagi nanti.',
})
const requestSizeGuard = createRequestSizeGuard({
  defaultMaxBytes: env.security.defaultBodyLimitBytes,
  rules: [
    { pathPattern: /^\/api\/v1\/auth\/login$/, maxBytes: 32 * 1024 },
    { pathPattern: /^\/api\/v1\/admin\/backup$/, maxBytes: 16 * 1024 },
    { pathPattern: /^\/api\/v1\/(attendance|incidents|children)(\/|$)/, maxBytes: env.security.uploadBodyLimitBytes },
    { pathPattern: /^\/api\/v1\/admin\/service-billing\/payments$/, maxBytes: env.security.uploadBodyLimitBytes },
    { pathPattern: /^\/api\/v1\/app-data(\/|$)/, maxBytes: env.security.uploadBodyLimitBytes },
  ],
})

const alwaysAllowedOrigins = new Set([
  'http://tparumahceria.my.id',
  'https://tparumahceria.my.id',
  'http://apps.tparumahceria.my.id',
  'https://apps.tparumahceria.my.id',
])

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true)
        return
      }

      if (alwaysAllowedOrigins.has(origin)) {
        callback(null, true)
        return
      }

      if (env.corsOrigins.includes(origin)) {
        callback(null, true)
        return
      }

      if (env.nodeEnv !== 'production' && localOriginPattern.test(origin)) {
        callback(null, true)
        return
      }

      callback(new Error(`CORS origin tidak diizinkan: ${origin}`))
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  }),
)
app.use(requestSizeGuard)
app.use(express.json({ limit: env.security.uploadBodyLimitBytes }))
app.use('/api', globalApiRateLimiter)
app.use('/api/v1/auth/login', loginRateLimiter)
app.use((req, res, next) => {
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  if (env.security.cspEnabled) {
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: blob:",
        "font-src 'self' data: https://fonts.gstatic.com",
        "connect-src 'self' https:",
      ].join('; '),
    )
  }

  next()
})

app.use((req, res, next) => {
  if (
    req.path.startsWith('/api') ||
    req.path.startsWith('/health') ||
    req.path.startsWith('/uploads')
  ) {
    next()
    return
  }

  const requestHost = normalizeHost(req.headers.host)
  if (!redirectOnlyHosts.has(requestHost)) {
    next()
    return
  }

  setHtmlNoStore(res)
  res.redirect(308, `https://${apexLandingHost}${req.originalUrl}`)
})

if (!canServeAdminFrontend && !canServeLandingFrontend) {
  app.get('/', (_req, res) => {
    res.json({
      success: true,
      service: 'project-tpa-server',
      message: 'Server API sedang berjalan',
      timestamp: new Date().toISOString(),
    })
  })
}

app.get('/health', (_req, res) => {
  res.json({
    success: true,
    service: 'project-tpa-server',
    timestamp: new Date().toISOString(),
  })
})

const healthDbMiddleware = env.nodeEnv === 'production'
  ? [requireAuth, requireRoles('ADMIN')]
  : []

app.get('/health/db', ...healthDbMiddleware, async (_req, res) => {
  try {
    await checkDatabaseConnection()
    res.json({
      success: true,
      message: 'Koneksi database sehat',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Koneksi database gagal.',
      ...(env.nodeEnv !== 'production'
        ? { detail: sanitizeServerErrorMessage(error, 'Kesalahan database tidak diketahui.') }
        : {}),
      timestamp: new Date().toISOString(),
    })
  }
})

import attendanceRoutes from './routes/attendance-routes.js'
import incidentRoutes from './routes/incident-routes.js'
import observationRoutes from './routes/observation-routes.js'
import communicationRoutes from './routes/communication-routes.js'
import supplyInventoryRoutes from './routes/supply-inventory-routes.js'
import childRoutes from './routes/child-routes.js'

app.use('/api/v1', authRoutes)
app.use('/api/v1', staffAttendanceRoutes)
app.use('/api/v1', appDataRoutes)
app.use('/api/v1', parentAccountRoutes)
app.use('/api/v1', parentRoutes)
app.use('/api/v1/attendance', attendanceRoutes)
app.use('/api/v1/incidents', incidentRoutes)
app.use('/api/v1/observations', observationRoutes)
app.use('/api/v1/communications', communicationRoutes)
app.use('/api/v1/supply-inventory', supplyInventoryRoutes)
app.use('/api/v1/children', childRoutes)
app.use('/api/v1', adminRoutes)

// Serve uploads folder
import { UPLOADS_DIR } from './middlewares/upload-middleware.js'
app.use(
  '/uploads',
  requireAuth,
  requireRoles('ADMIN', 'PETUGAS', 'ORANG_TUA'),
  express.static(UPLOADS_DIR, {
    fallthrough: false,
    index: false,
  }),
)

if (adminStaticMiddleware || landingStaticMiddleware) {
  app.use((req, _res, next) => {
    const frontendTarget = resolveFrontendTarget(normalizeHost(req.headers.host))
    const legacyEntryAsset = resolveLegacyEntryAsset(req.path, frontendTarget)

    if (legacyEntryAsset) {
      req.url = legacyEntryAsset
    }

    next()
  })

  app.use((req, res, next) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/health') ||
      req.path.startsWith('/uploads')
    ) {
      next()
      return
    }

    const frontendTarget = resolveFrontendTarget(normalizeHost(req.headers.host))

    if (frontendTarget === 'landing' && landingStaticMiddleware) {
      landingStaticMiddleware(req, res, next)
      return
    }

    if (frontendTarget === 'admin' && adminStaticMiddleware) {
      adminStaticMiddleware(req, res, next)
      return
    }

    next()
  })

  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/health') ||
      req.path.startsWith('/uploads')
    ) {
      next()
      return
    }

    const frontendTarget = resolveFrontendTarget(normalizeHost(req.headers.host))
    if (frontendTarget === 'landing' && canServeLandingFrontend) {
      setHtmlNoStore(res)
      res.type('html').send(renderFrontendIndexHtml('landing'))
      return
    }

    if (frontendTarget === 'admin' && canServeAdminFrontend) {
      setHtmlNoStore(res)
      res.type('html').send(renderFrontendIndexHtml('admin'))
      return
    }

    next()
  })
}

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint tidak ditemukan',
    timestamp: new Date().toISOString(),
  })
})

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err)

  const message = sanitizeServerErrorMessage(err, 'Terjadi kesalahan pada sistem.')
  const status = (err as any).status || 500

  res.status(status).json({
    success: false,
    message,
    timestamp: new Date().toISOString(),
  })
})

export default app
