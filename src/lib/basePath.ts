/**
 * Get the base path for the application
 * In production, the app runs under /seeder subpath
 */
export const basePath = process.env.NODE_ENV === 'production' ? '/seeder' : ''

/**
 * Prepend base path to a given path
 */
export function withBasePath(path: string): string {
  if (path.startsWith('/')) {
    return `${basePath}${path}`
  }
  return path
}
