import { dbPool } from '../config/database.js'

const listTables = async () => {
    try {
        const [rows] = (await dbPool.query('SHOW TABLES')) as [any[], any]
        console.log('Tables found:', rows.length)
        rows.forEach((row) => {
            console.log(Object.values(row)[0])
        })
        process.exit(0)
    } catch (error) {
        console.error('Error listing tables:', error)
        process.exit(1)
    }
}

listTables()
