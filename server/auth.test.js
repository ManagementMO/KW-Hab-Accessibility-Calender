import { describe, expect, it } from 'vitest'
import { hashPassword, signSession, verifyPassword, verifySession } from './auth.js'

describe('password hashing', () => {
  it('hashes a password and verifies it correctly', async () => {
    const hash = await hashPassword('correct-horse-battery-staple')
    expect(hash).not.toBe('correct-horse-battery-staple')
    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true)
    expect(await verifyPassword('wrong-password', hash)).toBe(false)
  })
})

describe('session signing', () => {
  it('round-trips a payload through sign and verify', () => {
    const token = signSession({ staffId: 'abc', email: 'a@b.com' }, 'test-secret')
    expect(verifySession(token, 'test-secret')).toEqual({ staffId: 'abc', email: 'a@b.com' })
  })

  it('rejects a token signed with a different secret', () => {
    const token = signSession({ staffId: 'abc' }, 'test-secret')
    expect(verifySession(token, 'other-secret')).toBeNull()
  })

  it('rejects a tampered token body', () => {
    const token = signSession({ staffId: 'abc' }, 'test-secret')
    const [, signature] = token.split('.')
    const tampered = `${Buffer.from(JSON.stringify({ staffId: 'admin' })).toString('base64url')}.${signature}`
    expect(verifySession(tampered, 'test-secret')).toBeNull()
  })

  it('rejects garbage input', () => {
    expect(verifySession('not-a-real-token', 'test-secret')).toBeNull()
    expect(verifySession(undefined, 'test-secret')).toBeNull()
  })
})
