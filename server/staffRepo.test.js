import { describe, expect, it } from 'vitest'
import { openDb } from './db.js'
import { createStaff, findStaffByEmail } from './staffRepo.js'

describe('staffRepo', () => {
  it('returns null for an email with no staff account', () => {
    const db = openDb(':memory:')
    expect(findStaffByEmail(db, 'nobody@kwhab.ca')).toBeNull()
  })

  it('creates a staff account and finds it by email', () => {
    const db = openDb(':memory:')
    createStaff(db, { email: 'staff@kwhab.ca', passwordHash: 'hashed-value' })
    const found = findStaffByEmail(db, 'staff@kwhab.ca')
    expect(found.email).toBe('staff@kwhab.ca')
    expect(found.password_hash).toBe('hashed-value')
  })

  it('rejects a duplicate email', () => {
    const db = openDb(':memory:')
    createStaff(db, { email: 'staff@kwhab.ca', passwordHash: 'a' })
    expect(() => createStaff(db, { email: 'staff@kwhab.ca', passwordHash: 'b' })).toThrow()
  })
})
