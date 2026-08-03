import { describe, expect, it } from 'vitest'
import { openDb } from './db.js'
import { verifyPassword } from './auth.js'
import { findStaffByEmail } from './staffRepo.js'
import { seedStaff } from './seed.js'

describe('seedStaff', () => {
  it('creates a staff account with a hashed password', async () => {
    const db = openDb(':memory:')
    const result = await seedStaff(db, 'staff@kwhab.ca', 'change-me-now')
    expect(result).toEqual({ created: true, email: 'staff@kwhab.ca' })
    const row = findStaffByEmail(db, 'staff@kwhab.ca')
    expect(row.password_hash).not.toBe('change-me-now')
    expect(await verifyPassword('change-me-now', row.password_hash)).toBe(true)
  })

  it('is idempotent when the account already exists', async () => {
    const db = openDb(':memory:')
    await seedStaff(db, 'staff@kwhab.ca', 'change-me-now')
    const result = await seedStaff(db, 'staff@kwhab.ca', 'a-different-password')
    expect(result).toEqual({ created: false, email: 'staff@kwhab.ca' })
    const row = findStaffByEmail(db, 'staff@kwhab.ca')
    expect(await verifyPassword('change-me-now', row.password_hash)).toBe(true)
  })
})
