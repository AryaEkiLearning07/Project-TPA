import { dbPool } from '../config/database.js'
import type { RowDataPacket } from 'mysql2/promise'

async function run() {
  const [rows] = await dbPool.execute<RowDataPacket[]>('DESCRIBE children')
  console.log('--- COLUMNS IN CHILDREN ---')
  rows.forEach(row => console.log(row.Field))
  await dbPool.end()
}
run()
