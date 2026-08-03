import bcrypt from 'bcryptjs'
import { createHmac, timingSafeEqual } from 'node:crypto'

export function hashPassword(password) {
  return bcrypt.hash(password, 10)
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash)
}

export function signSession(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${signature}`
}

export function verifySession(token, secret) {
  if (!token || typeof token !== 'string') return null
  const [body, signature] = token.split('.')
  if (!body || !signature) return null
  const expected = createHmac('sha256', secret).update(body).digest('base64url')
  const expectedBuf = Buffer.from(expected)
  const actualBuf = Buffer.from(signature)
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) return null
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}
