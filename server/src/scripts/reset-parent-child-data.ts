import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { dbPool } from '../config/database.js'

const impactedTables = [
  'parent_profiles',
  'parent_accounts',
  'children',
  'attendance_records',
  'incident_reports',
  'observation_records',
  'observation_items',
  'supply_inventory',
  'service_billing_periods',
  'service_billing_transactions',
  'child_registration_codes',
  'auth_sessions',
  'activity_logs',
  'auth_login_attempts',
] as const

const resetAutoIncrementTables = [
  'parent_profiles',
  'parent_accounts',
  'children',
  'attendance_records',
  'incident_reports',
  'observation_records',
  'observation_items',
  'supply_inventory',
  'service_billing_periods',
  'service_billing_transactions',
  'child_registration_codes',
] as const

const countTable = async (
  connection: PoolConnection,
  table: string,
): Promise<number> => {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM \`${table}\``,
  )
  return Number(rows[0]?.total ?? 0)
}

const loadTableCounts = async (
  connection: PoolConnection,
): Promise<Record<string, number>> => {
  const result: Record<string, number> = {}
  for (const table of impactedTables) {
    result[table] = await countTable(connection, table)
  }
  return result
}

const loadStaffCounts = async (
  connection: PoolConnection,
): Promise<Record<string, number>> => {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT role, COUNT(*) AS total
    FROM users
    GROUP BY role
    ORDER BY role`,
  )
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[String(row.role)] = Number(row.total ?? 0)
    return acc
  }, {})
}

const loadParentIdentifiers = async (
  connection: PoolConnection,
): Promise<string[]> => {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT DISTINCT identifier
    FROM (
      SELECT LOWER(TRIM(email)) AS identifier
      FROM parent_profiles
      WHERE email IS NOT NULL AND TRIM(email) <> ''
      UNION
      SELECT LOWER(TRIM(username)) AS identifier
      FROM parent_accounts
      WHERE username IS NOT NULL AND TRIM(username) <> ''
    ) identifiers
    WHERE identifier IS NOT NULL AND identifier <> ''`,
  )
  return rows.map((row) => String(row.identifier))
}

const deleteByParentIdentifiers = async (
  connection: PoolConnection,
  table: 'auth_login_attempts' | 'activity_logs',
  column: 'email' | 'gmail',
  identifiers: string[],
): Promise<number> => {
  if (identifiers.length === 0) {
    return 0
  }

  const placeholders = identifiers.map(() => '?').join(', ')
  const [result] = await connection.execute<ResultSetHeader>(
    `DELETE FROM \`${table}\`
    WHERE LOWER(TRIM(\`${column}\`)) IN (${placeholders})`,
    identifiers,
  )
  return result.affectedRows
}

const resetParentAndChildData = async (): Promise<void> => {
  const connection = await dbPool.getConnection()
  try {
    const beforeCounts = await loadTableCounts(connection)
    const beforeStaffCounts = await loadStaffCounts(connection)
    const parentIdentifiers = await loadParentIdentifiers(connection)

    console.log('[Reset] Row counts before cleanup:')
    console.table(beforeCounts)
    console.log('[Reset] Users by role before cleanup:')
    console.table(beforeStaffCounts)

    await connection.beginTransaction()

    const [deletedSessions] = await connection.execute<ResultSetHeader>(
      `DELETE FROM auth_sessions
      WHERE subject_role = 'ORANG_TUA'`,
    )

    const [deletedActivityByRole] = await connection.execute<ResultSetHeader>(
      `DELETE FROM activity_logs
      WHERE role = 'ORANG_TUA'`,
    )

    const deletedLoginAttemptsById = await deleteByParentIdentifiers(
      connection,
      'auth_login_attempts',
      'email',
      parentIdentifiers,
    )

    const deletedActivityById = await deleteByParentIdentifiers(
      connection,
      'activity_logs',
      'gmail',
      parentIdentifiers,
    )

    const [deletedRegistrationCodes] = await connection.execute<ResultSetHeader>(
      'DELETE FROM child_registration_codes',
    )
    const [deletedObservationItems] = await connection.execute<ResultSetHeader>(
      'DELETE FROM observation_items',
    )
    const [deletedBillingTransactions] = await connection.execute<ResultSetHeader>(
      'DELETE FROM service_billing_transactions',
    )
    const [deletedAttendance] = await connection.execute<ResultSetHeader>(
      'DELETE FROM attendance_records',
    )
    const [deletedIncidents] = await connection.execute<ResultSetHeader>(
      'DELETE FROM incident_reports',
    )
    const [deletedObservations] = await connection.execute<ResultSetHeader>(
      'DELETE FROM observation_records',
    )
    const [deletedInventory] = await connection.execute<ResultSetHeader>(
      'DELETE FROM supply_inventory',
    )
    const [deletedBillingPeriods] = await connection.execute<ResultSetHeader>(
      'DELETE FROM service_billing_periods',
    )
    const [deletedChildren] = await connection.execute<ResultSetHeader>(
      'DELETE FROM children',
    )
    const [deletedParentAccounts] = await connection.execute<ResultSetHeader>(
      'DELETE FROM parent_accounts',
    )
    const [deletedParentProfiles] = await connection.execute<ResultSetHeader>(
      'DELETE FROM parent_profiles',
    )

    for (const table of resetAutoIncrementTables) {
      await connection.execute(`ALTER TABLE \`${table}\` AUTO_INCREMENT = 1`)
    }

    await connection.commit()

    const afterCounts = await loadTableCounts(connection)
    const afterStaffCounts = await loadStaffCounts(connection)

    console.log('[Reset] Cleanup completed.')
    console.log('[Reset] Deleted rows summary:')
    console.table({
      auth_sessions_orang_tua: deletedSessions.affectedRows,
      activity_logs_orang_tua: deletedActivityByRole.affectedRows,
      auth_login_attempts_by_parent_identifier: deletedLoginAttemptsById,
      activity_logs_by_parent_identifier: deletedActivityById,
      child_registration_codes: deletedRegistrationCodes.affectedRows,
      observation_items: deletedObservationItems.affectedRows,
      service_billing_transactions: deletedBillingTransactions.affectedRows,
      attendance_records: deletedAttendance.affectedRows,
      incident_reports: deletedIncidents.affectedRows,
      observation_records: deletedObservations.affectedRows,
      supply_inventory: deletedInventory.affectedRows,
      service_billing_periods: deletedBillingPeriods.affectedRows,
      children: deletedChildren.affectedRows,
      parent_accounts: deletedParentAccounts.affectedRows,
      parent_profiles: deletedParentProfiles.affectedRows,
    })
    console.log('[Reset] Row counts after cleanup:')
    console.table(afterCounts)
    console.log('[Reset] Users by role after cleanup:')
    console.table(afterStaffCounts)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
    await dbPool.end()
  }
}

resetParentAndChildData().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[Reset] Failed: ${message}`)
  process.exit(1)
})
