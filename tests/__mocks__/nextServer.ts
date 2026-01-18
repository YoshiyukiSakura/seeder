/**
 * Next.js Server Mock
 */

export class NextRequest {
  url: string
  method: string
  headers: Headers
  private _cookies: Map<string, { value: string }>

  constructor(url: string, init?: { method?: string; headers?: HeadersInit; body?: any }) {
    this.url = url
    this.method = init?.method || 'GET'
    this.headers = new Headers(init?.headers)
    this._cookies = new Map()
  }

  get cookies() {
    const self = this
    return {
      get(name: string) {
        return self._cookies.get(name)
      },
      getAll() {
        return Array.from(self._cookies.entries()).map(([name, { value }]) => ({ name, value }))
      },
      has(name: string) {
        return self._cookies.has(name)
      },
      set(name: string, value: string) {
        self._cookies.set(name, { value })
      },
      delete(name: string) {
        self._cookies.delete(name)
      },
    }
  }

  setCookie(name: string, value: string) {
    this._cookies.set(name, { value })
  }
}

export class NextResponse<T = unknown> {
  body: T | null
  status: number
  headers: Headers
  private _cookies: Map<string, { value: string; options?: any }>

  constructor(body?: T | null, init?: { status?: number; headers?: HeadersInit }) {
    this.body = body ?? null
    this.status = init?.status || 200
    this.headers = new Headers(init?.headers)
    this._cookies = new Map()
  }

  // Instance method to get JSON data
  async json(): Promise<T> {
    return this.body as T
  }

  // Instance method to get text
  async text(): Promise<string> {
    return typeof this.body === 'string' ? this.body : JSON.stringify(this.body)
  }

  get cookies() {
    const self = this
    return {
      set(name: string, value: string, options?: any) {
        self._cookies.set(name, { value, options })
      },
      get(name: string) {
        return self._cookies.get(name)
      },
      delete(name: string) {
        self._cookies.delete(name)
      },
    }
  }

  static json<T>(data: T, init?: { status?: number; headers?: HeadersInit }): NextResponse<T> {
    const response = new NextResponse<T>(data, init)
    response.headers.set('Content-Type', 'application/json')
    return response
  }

  static redirect(url: string | URL, status?: number): NextResponse {
    const response = new NextResponse(null, { status: status || 302 })
    response.headers.set('Location', url.toString())
    return response
  }
}
