import fs from 'node:fs'
import path from 'node:path'
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
import staffAttendanceRoutes from './routes/staff-attendance-routes.js'
import { sanitizeServerErrorMessage } from './utils/error-sanitizer.js'

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', env.security.trustProxy)
const frontendDistDir = path.resolve(process.cwd(), '../dist')
const frontendIndexFile = path.join(frontendDistDir, 'index.html')
const shouldServeFrontendFromBackend =
  env.nodeEnv === 'production' || process.env.SERVE_FRONTEND_FROM_BACKEND === 'true'
const canServeFrontend =
  shouldServeFrontendFromBackend &&
  fs.existsSync(frontendIndexFile)

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

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
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

if (!canServeFrontend) {
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
  requireRoles('ADMIN', 'PETUGAS'),
  express.static(UPLOADS_DIR, {
    fallthrough: false,
    index: false,
  }),
)

if (canServeFrontend) {
  app.use(express.static(frontendDistDir, { index: false }))
  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/health') ||
      req.path.startsWith('/uploads')
    ) {
      next()
      return
    }
    res.sendFile(frontendIndexFile)
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
