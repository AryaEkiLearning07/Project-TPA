import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config({ path: 'e:/Project TPA/server/.env' })

const run = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number.parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'db_TPA',
  })

  try {
    const tableExists = async (tableName) => {
      const [rows] = await connection.query(
        `SELECT COUNT(*) AS cnt
         FROM information_schema.tables
         WHERE table_schema = DATABASE()
           AND table_name = ?`,
        [tableName],
      )
      return Number(rows[0]?.cnt || 0) > 0
    }

    const countRows = async (tableName) => {
      const [rows] = await connection.query(`SELECT COUNT(*) as cnt FROM ${tableName}`)
      return Number(rows[0]?.cnt || 0)
    }

    const countTables = [
      'children',
      'parent_profiles',
      'parent_accounts',
      'users',
      'attendance_records',
      'observation_records',
      'incident_reports',
      'supply_inventory',
      'staff_daily_attendance',
      'service_billing_periods',
      'service_billing_transactions',
    ]

    console.log('=== Table Counts ===')
    for (const tableName of countTables) {
      if (!(await tableExists(tableName))) {
        console.log(`${tableName}: (table not found)`)
        continue
      }
      console.log(`${tableName}:`, await countRows(tableName))
    }

    if (await tableExists('app_meta')) {
      const [obs] = await connection.query(
        "SELECT LENGTH(meta_value) AS len FROM app_meta WHERE meta_key='observation_records_json'",
      )
      console.log('observation_records_json length:', obs[0]?.len || 0)

      const [inv] = await connection.query(
        "SELECT LENGTH(meta_value) AS len FROM app_meta WHERE meta_key='supply_inventory_json'",
      )
      console.log('supply_inventory_json length:', inv[0]?.len || 0)
    } else {
      console.log('app_meta: not used in current schema')
    }
  } finally {
    await connection.end()
  }
}

run().catch((error) => {
  console.error('check_data failed:', error)
  process.exitCode = 1
})
