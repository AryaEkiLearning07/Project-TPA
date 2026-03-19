import app from '../app.js'
import { dbPool } from '../config/database.js'
import { ensureAuthSchema } from '../services/auth-service.js'

const run = async () => {
    console.log('--- Starting Server Integration Debug ---')
    const port = 4001

    try {
        // Ensure DB connection and schema
        await ensureAuthSchema(dbPool)
        console.log('Database connected and schema verified.')

        // Start server
        const server = app.listen(port, () => {
            console.log(`Test server running on port ${port}`)
        })

        // Give it a moment
        await new Promise(r => setTimeout(r, 1000))

        console.log('Sending Login Request...')
        const response = await fetch(`http://localhost:${port}/api/v1/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'admin@gmail.com',
                password: '12345678'
            })
        })

        console.log(`Response Status: ${response.status} ${response.statusText}`)
        const text = await response.text()
        console.log('Response Body:', text)

        // Cleanup
        server.close()

    } catch (error) {
        console.error('Integration Test Failed:', error)
    } finally {
        await dbPool.end()
        console.log('--- Debug Complete ---')
    }
}

run().catch((err) => {
    console.error('Fatal Script Error:', err)
    process.exit(1)
})
