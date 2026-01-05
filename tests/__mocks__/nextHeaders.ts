/**
 * Next.js Headers Mock
 */

const cookieStore = new Map<string, string>()

export function cookies() {
  return {
    get(name: string) {
      const value = cookieStore.get(name)
      return value ? { value } : undefined
    },
    getAll() {
      return Array.from(cookieStore.entries()).map(([name, value]) => ({ name, value }))
    },
    has(name: string) {
      return cookieStore.has(name)
    },
    set(name: string, value: string) {
      cookieStore.set(name, value)
    },
    delete(name: string) {
      cookieStore.delete(name)
    },
  }
}

export function headers() {
  const headerStore = new Map<string, string>()
  return {
    get(name: string) {
      return headerStore.get(name.toLowerCase()) || null
    },
    has(name: string) {
      return headerStore.has(name.toLowerCase())
    },
    set(name: string, value: string) {
      headerStore.set(name.toLowerCase(), value)
    },
    delete(name: string) {
      headerStore.delete(name.toLowerCase())
    },
    forEach(callback: (value: string, key: string) => void) {
      headerStore.forEach(callback)
    },
  }
}

// Helper to set cookies for testing
export function __setCookie(name: string, value: string) {
  cookieStore.set(name, value)
}

export function __clearCookies() {
  cookieStore.clear()
}
