/**
 * Shared ServiceError class for all service modules.
 *
 * Use this for any business logic error that should result in a specific
 * HTTP status code being returned to the client.
 */
export class ServiceError extends Error {
  statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.name = 'ServiceError'
    this.statusCode = statusCode
  }
}
