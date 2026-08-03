import { randomUUID } from 'node:crypto'
import { eventInputToRow, rowToEvent } from './eventMapper.js'

export function listEvents(db) {
  const rows = db.prepare('SELECT * FROM events ORDER BY created_at ASC').all()
  return rows.map(rowToEvent)
}

export function insertEvent(db, input) {
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  const row = eventInputToRow(input, id, createdAt)
  db.prepare(`INSERT INTO events (
    id, title, category, day, time, place, cost, bus, group_label, noise,
    access_status, access_owner, access_last_confirmed, access_note,
    support, registration, image, reason, short, plain, arrival, journey, created_at
  ) VALUES (
    @id, @title, @category, @day, @time, @place, @cost, @bus, @group_label, @noise,
    @access_status, @access_owner, @access_last_confirmed, @access_note,
    @support, @registration, @image, @reason, @short, @plain, @arrival, @journey, @created_at
  )`).run(row)
  return rowToEvent(row)
}
