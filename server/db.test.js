import { describe, expect, it } from 'vitest'
import { openDb } from './db.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

describe('openDb', () => {
  it('creates the events and staff tables', () => {
    const db = openDb(':memory:')
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name)
    expect(tables).toEqual(expect.arrayContaining(['events', 'staff']))
  })

  it('adds registration_url, created_by, date, and host columns to the events table', () => {
    const db = openDb(':memory:')
    const columns = db.prepare('PRAGMA table_info(events)').all().map((column) => column.name)
    expect(columns).toEqual(expect.arrayContaining(['registration_url', 'created_by', 'date', 'host']))
  })

  it('backfills the new columns on a database created before they existed', () => {
    const dbPath = path.join(os.tmpdir(), `db-migrate-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)
    let db1
    let db2
    try {
      db1 = openDb(dbPath)
      db1.exec('ALTER TABLE events DROP COLUMN registration_url')
      db1.exec('ALTER TABLE events DROP COLUMN created_by')
      db1.exec('ALTER TABLE events DROP COLUMN date')
      db1.exec('ALTER TABLE events DROP COLUMN host')
      let columns = db1.prepare('PRAGMA table_info(events)').all().map((column) => column.name)
      expect(columns).not.toEqual(expect.arrayContaining(['registration_url', 'created_by', 'date', 'host']))
      db1.close()
      db1 = null

      db2 = openDb(dbPath)
      columns = db2.prepare('PRAGMA table_info(events)').all().map((column) => column.name)
      expect(columns).toEqual(expect.arrayContaining(['registration_url', 'created_by', 'date', 'host']))
      db2.close()
      db2 = null
    } finally {
      if (db1) db1.close()
      if (db2) db2.close()
      for (const suffix of ['', '-journal', '-wal', '-shm']) {
        const file = dbPath + suffix
        if (fs.existsSync(file)) fs.rmSync(file)
      }
    }
  })

  it('does not create a day column on a fresh database', () => {
    const db = openDb(':memory:')
    const columns = db.prepare('PRAGMA table_info(events)').all().map((column) => column.name)
    expect(columns).not.toContain('day')
  })

  it('drops the day column from a database created before it was removed', () => {
    const dbPath = path.join(os.tmpdir(), `db-drop-day-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)
    let db1
    let db2
    try {
      db1 = openDb(dbPath)
      db1.exec("ALTER TABLE events ADD COLUMN day TEXT NOT NULL DEFAULT ''")
      let columns = db1.prepare('PRAGMA table_info(events)').all().map((column) => column.name)
      expect(columns).toContain('day')
      db1.close()
      db1 = null

      db2 = openDb(dbPath)
      columns = db2.prepare('PRAGMA table_info(events)').all().map((column) => column.name)
      expect(columns).not.toContain('day')
      db2.close()
      db2 = null
    } finally {
      if (db1) db1.close()
      if (db2) db2.close()
      for (const suffix of ['', '-journal', '-wal', '-shm']) {
        const file = dbPath + suffix
        if (fs.existsSync(file)) fs.rmSync(file)
      }
    }
  })

  it('is idempotent when called twice on the same file', () => {
    const dbPath = path.join(os.tmpdir(), `db-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)
    let db1
    let db2
    try {
      db1 = openDb(dbPath)
      db1.prepare('INSERT INTO staff (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)').run('1', 'a@b.com', 'hash', '2026-01-01')
      expect(db1.prepare('SELECT COUNT(*) as count FROM staff').get().count).toBe(1)
      db1.close()
      db1 = null

      db2 = openDb(dbPath)
      expect(db2.prepare('SELECT COUNT(*) as count FROM staff').get().count).toBe(1)
      db2.close()
      db2 = null
    } finally {
      if (db1) db1.close()
      if (db2) db2.close()
      for (const suffix of ['', '-journal', '-wal', '-shm']) {
        const file = dbPath + suffix
        if (fs.existsSync(file)) fs.rmSync(file)
      }
    }
  })
})
