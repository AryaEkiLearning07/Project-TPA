import { checkDatabaseConnection } from '../config/database.js'

const run = async (): Promise<void> => {
  await checkDatabaseConnection()
  console.log('Database connection successful')
  process.exit(0)
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Database connection failed: ${message}`)
  process.exit(1)
})
