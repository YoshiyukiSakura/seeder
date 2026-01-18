/**
 * Next.js Server Mock
 */

export class NextRequest {
  url: string
  method: string
  headers: Headers
  private _cookies: Map<string, { value: string }>
  private _body: any
  private _formData: FormData | null

  constructor(url: string, init?: { method?: string; headers?: HeadersInit; body?: any }) {
    this.url = url
    this.method = init?.method || 'GET'
    this.headers = new Headers(init?.headers)
    this._cookies = new Map()
    this._body = init?.body
    this._formData = init?.body instanceof FormData ? init.body : null
  }

  async formData(): Promise<FormData> {
    if (this._formData) {
      return this._formData
    }
    throw new Error('No FormData available')
  }

  async json(): Promise<any> {
    if (typeof this._body === 'string') {
      return JSON.parse(this._body)
    }
    return this._body
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

  async json(): Promise<T> {
    return this.body as T
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
