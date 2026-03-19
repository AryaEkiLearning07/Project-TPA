import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise'
import { dbPool } from '../config/database.js'

const SERVICE_PACKAGE_KEYS = ['harian', '2-mingguan', 'bulanan'] as const

type SqlExecutor = Pick<Pool, 'execute'> | Pick<PoolConnection, 'execute'>

type ServicePackageKey = (typeof SERVICE_PACKAGE_KEYS)[number]

export interface ServicePackageRates {
  harian: number
  '2-mingguan': number
  bulanan: number
  updatedAt: string
}

export interface ServicePackageRatesInput {
  harian: number
  '2-mingguan': number
  bulanan: number
}

interface ServiceRateRow extends RowDataPacket {
  package_key: ServicePackageKey
  amount: number
  updated_at: Date | string
}

const toIsoDateTime = (value: Date | string): string => {
  if (value instanceof Date) {
    return value.toISOString()
  }

  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const withTimezone = /Z|[+-]\d{2}:\d{2}$/.test(normalized)
    ? normalized
    : `${normalized}Z`
  const parsed = new Date(withTimezone)
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString()
  }
  return parsed.toISOString()
}

const toSafeAmount = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }
  if (value < 0) {
    return 0
  }
  return Math.round(value)
}

export const ensureServiceRateSchema = async (
  executor: SqlExecutor,
): Promise<void> => {
  await executor.execute(
    `CREATE TABLE IF NOT EXISTS service_package_rates (
      package_key ENUM('harian', '2-mingguan', 'bulanan') NOT NULL PRIMARY KEY,
      amount BIGINT NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
  )

  await executor.execute(
    `INSERT INTO service_package_rates (
      package_key,
      amount
    ) VALUES
      ('harian', 0),
      ('2-mingguan', 0),
      ('bulanan', 0)
    ON DUPLICATE KEY UPDATE
      package_key = VALUES(package_key)`,
  )
}

export const getServicePackageRates = async (): Promise<ServicePackageRates> => {
  await ensureServiceRateSchema(dbPool)

  const [rows] = await dbPool.execute<ServiceRateRow[]>(
    `SELECT
      package_key,
      amount,
      updated_at
    FROM service_package_rates`,
  )

  let latestUpdatedAt = ''
  const rates: ServicePackageRates = {
    harian: 0,
    '2-mingguan': 0,
    bulanan: 0,
    updatedAt: '',
  }

  for (const row of rows) {
    const packageKey = row.package_key
    if (!SERVICE_PACKAGE_KEYS.includes(packageKey)) {
      continue
    }

    rates[packageKey] = toSafeAmount(row.amount)

    const updatedAt = toIsoDateTime(row.updated_at)
    if (!latestUpdatedAt || updatedAt > latestUpdatedAt) {
      latestUpdatedAt = updatedAt
    }
  }

  rates.updatedAt = latestUpdatedAt || new Date().toISOString()
  return rates
}

export const updateServicePackageRates = async (
  input: ServicePackageRatesInput,
): Promise<ServicePackageRates> => {
  const connection = await dbPool.getConnection()

  try {
    await connection.beginTransaction()
    await ensureServiceRateSchema(connection)

    for (const packageKey of SERVICE_PACKAGE_KEYS) {
      await connection.execute(
        `UPDATE service_package_rates
        SET
          amount = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE package_key = ?`,
        [toSafeAmount(input[packageKey]), packageKey],
      )
    }

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  return getServicePackageRates()
}
