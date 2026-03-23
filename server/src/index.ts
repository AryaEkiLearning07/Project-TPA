import type { Server } from 'node:http'
import app from './app.js'
import { checkDatabaseConnection } from './config/database.js'
import { env } from './config/env.js'
import { ensureAuthSchemaReady } from './services/auth-service.js'
import { dbPool } from './config/database.js'
import { ensureServiceRateSchema } from './services/service-rate-service.js'
import { ensureStaffAttendanceSchema } from './services/staff-attendance-service.js'
import { ensureServiceBillingSchema } from './services/service-billing-service.js'
import { ensureChildRegistrationCodeSchema } from './services/child-registration-code-service.js'

let server: Server | null = null
let isShuttingDown = false

const gracefulShutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) {
    return
  }
  isShuttingDown = true
  console.log(`\n[${signal}] Shutting down gracefully...`)

  if (server) {
    await new Promise<void>((resolve) => {
      server!.close(() => {
        console.log('HTTP server closed.')
        resolve()
      })

      setTimeout(() => {
        console.warn('Force-closing HTTP server after timeout.')
        resolve()
      }, 10_000)
    })
  }

  try {
    await dbPool.end()
    console.log('Database pool closed.')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Error closing database pool: ${message}`)
  }

  process.exit(0)
}

process.on('SIGTERM', () => { gracefulShutdown('SIGTERM') })
process.on('SIGINT', () => { gracefulShutdown('SIGINT') })

const start = async (): Promise<void> => {
  await checkDatabaseConnection()
  await ensureAuthSchemaReady()
  await ensureServiceRateSchema(dbPool)
  await ensureStaffAttendanceSchema(dbPool)
  await ensureServiceBillingSchema(dbPool)
  await ensureChildRegistrationCodeSchema(dbPool)
  server = app.listen(env.port, () => {
    console.log(`Server running on http://localhost:${env.port}`)
  })

  // Cleanup expired sessions and stale login attempts every 6 hours
  const SESSION_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000
  setInterval(async () => {
    if (isShuttingDown) {
      return
    }
    try {
      const [sessionResult] = await dbPool.execute(
        `DELETE FROM auth_sessions WHERE expires_at < UTC_TIMESTAMP()`,
      ) as [{ affectedRows?: number }, unknown]
      const [loginResult] = await dbPool.execute(
        `DELETE FROM auth_login_attempts
         WHERE (locked_until IS NULL OR locked_until < UTC_TIMESTAMP())
           AND updated_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR)`,
      ) as [{ affectedRows?: number }, unknown]
      const sessionsDeleted = sessionResult?.affectedRows ?? 0
      const attemptsDeleted = loginResult?.affectedRows ?? 0
      if (sessionsDeleted > 0 || attemptsDeleted > 0) {
        console.log(`[Cleanup] Removed ${sessionsDeleted} expired sessions, ${attemptsDeleted} stale login attempts.`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[Cleanup] Error: ${message}`)
    }
  }, SESSION_CLEANUP_INTERVAL_MS)
}

start().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Failed to start server: ${message}`)
  process.exit(1)
})
