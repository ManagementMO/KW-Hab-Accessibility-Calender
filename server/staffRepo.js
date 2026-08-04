import { randomUUID } from 'node:crypto'

export function findStaffByEmail(db, email) {
  return db.prepare('SELECT * FROM staff WHERE email = ?').get(email) || null
}

export function createStaff(db, { email, passwordHash }) {
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  db.prepare('INSERT INTO staff (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)').run(id, email, passwordHash, createdAt)
  return { id, email, passwordHash, createdAt }
}
