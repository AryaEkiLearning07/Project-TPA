import { dbPool } from '../config/database.js'

const TABLES_TO_DROP = [
    'child_staff_assignments',
    'parents',
    'child_parents',
    'children_habits',
    'children_health',
    'staff_profiles',
]

const dropTables = async () => {
    console.log('Starting cleanup of unused tables...')
    const connection = await dbPool.getConnection()

    try {
        await connection.beginTransaction()

        // Disable FK checks to allow dropping tables with dependencies
        await connection.query('SET FOREIGN_KEY_CHECKS = 0')

        for (const table of TABLES_TO_DROP) {
            console.log(`Dropping table: ${table}...`)
            await connection.query(`DROP TABLE IF EXISTS \`${table}\``)
        }

        // Re-enable FK checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 1')

        await connection.commit()
        console.log('SUCCESS: Unused tables have been removed.')
    } catch (error) {
        await connection.rollback()
        console.error('ERROR: Failed to drop tables.', error)
        process.exit(1)
    } finally {
        connection.release()
        process.exit(0)
    }
}

dropTables()
