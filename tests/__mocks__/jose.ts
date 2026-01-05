/**
 * Jose Mock for JWT operations
 */

const AUTH_SECRET = 'test-secret-key-for-jwt-signing'

// Simple JWT implementation for testing
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) str += '='
  return Buffer.from(str, 'base64').toString()
}

export class SignJWT {
  private payload: Record<string, any>
  private header: Record<string, any> = { alg: 'HS256', typ: 'JWT' }

  constructor(payload: Record<string, any>) {
    this.payload = { ...payload }
  }

  setProtectedHeader(header: Record<string, any>): this {
    this.header = { ...this.header, ...header }
    return this
  }

  setExpirationTime(exp: string | number): this {
    if (typeof exp === 'string') {
      const now = Math.floor(Date.now() / 1000)
      if (exp === '7d') {
        this.payload.exp = now + 7 * 24 * 60 * 60
      } else if (exp === '-1h') {
        this.payload.exp = now - 3600
      } else {
        this.payload.exp = now + 3600 // Default 1 hour
      }
    } else {
      this.payload.exp = exp
    }
    return this
  }

  setIssuedAt(iat?: number): this {
    this.payload.iat = iat ?? Math.floor(Date.now() / 1000)
    return this
  }

  async sign(secret: Uint8Array): Promise<string> {
    const headerB64 = base64UrlEncode(JSON.stringify(this.header))
    const payloadB64 = base64UrlEncode(JSON.stringify(this.payload))
    // Simple mock signature (not real HMAC)
    const signature = base64UrlEncode(`mock_sig_${headerB64}_${payloadB64}`)
    return `${headerB64}.${payloadB64}.${signature}`
  }
}

export async function jwtVerify(
  token: string,
  secret: Uint8Array
): Promise<{ payload: Record<string, any>; protectedHeader: Record<string, any> }> {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format')
  }

  try {
    const header = JSON.parse(base64UrlDecode(parts[0]))
    const payload = JSON.parse(base64UrlDecode(parts[1]))

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('JWT expired')
    }

    // Verify signature (mock check)
    const expectedSig = base64UrlEncode(`mock_sig_${parts[0]}_${parts[1]}`)
    if (parts[2] !== expectedSig) {
      throw new Error('Invalid signature')
    }

    return { payload, protectedHeader: header }
  } catch (error) {
    throw new Error(`JWT verification failed: ${error}`)
  }
}

export interface JWTPayload {
  iss?: string
  sub?: string
  aud?: string | string[]
  jti?: string
  nbf?: number
  exp?: number
  iat?: number
  [propName: string]: unknown
}
