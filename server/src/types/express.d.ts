import type { AuthContext } from '../services/auth-service.js'

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext
    }
  }
}

export {}
