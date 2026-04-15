import mysql from 'mysql2/promise'
import { env } from './env.js'

export const dbPool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.name,
  timezone: 'Z',
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: env.db.connectionLimit,
  queueLimit: 50,
})

export const checkDatabaseConnection = async (): Promise<void> => {
  try {
    const connection = await dbPool.getConnection()
    try {
      await connection.ping()
    } finally {
      connection.release()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(
      `[Database] Connection check failed (${env.db.host}:${env.db.port} as ${env.db.user}): ${message}`,
    )
    if (message.includes('ECONNREFUSED')) {
      console.error('[Database] MySQL belum aktif. Jalankan "npm run db:start" dari root project.')
    }
    throw error
  }
}
