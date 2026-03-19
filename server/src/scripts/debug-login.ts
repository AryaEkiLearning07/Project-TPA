import { dbPool } from '../config/database.js'
import { login } from '../services/auth-service.js'

const run = async () => {
    console.log('--- Starting Login Debug ---')
    console.log('Attempting login with: admin@gmail.com / 12345678')

    try {
        const session = await login({
            email: 'admin@gmail.com',
            password: '12345678',
        })
        console.log('Login SUCCESS!')
        console.log('Session:', session)
    } catch (error) {
        console.error('Login FAILED!')
        if (error instanceof Error) {
            console.error('Error Name:', error.name)
            console.error('Error Message:', error.message)
            console.error('Stack Trace:', error.stack)
            if ('status' in error) {
                // @ts-ignore
                console.error('Status Code:', error.status)
            }
        } else {
            console.error('Unknown Error:', error)
        }
    } finally {
        await dbPool.end()
        console.log('--- Debug Complete ---')
    }
}

run().catch((err) => {
    console.error('Fatal Script Error:', err)
    process.exit(1)
})
