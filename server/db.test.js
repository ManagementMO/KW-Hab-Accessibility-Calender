import { describe, expect, it } from 'vitest'
import { openDb } from './db.js'

describe('openDb', () => {
  it('creates the events and staff tables', () => {
    const db = openDb(':memory:')
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name)
    expect(tables).toEqual(expect.arrayContaining(['events', 'staff']))
  })

  it('is idempotent when called twice on the same file', () => {
    const db1 = openDb(':memory:')
    db1.prepare('INSERT INTO staff (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)').run('1', 'a@b.com', 'hash', '2026-01-01')
    expect(db1.prepare('SELECT COUNT(*) as count FROM staff').get().count).toBe(1)
  })
})
