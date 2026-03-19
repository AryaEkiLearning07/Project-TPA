import { dbPool } from '../config/database.js'

const describeChildren = async () => {
    try {
        const [rows] = (await dbPool.query('DESCRIBE children')) as [any[], any]
        console.log('Columns in children table:')
        rows.forEach((row) => {
            console.log(row.Field)
        })
        process.exit(0)
    } catch (error) {
        console.error('Error describing table:', error)
        process.exit(1)
    }
}

describeChildren()
