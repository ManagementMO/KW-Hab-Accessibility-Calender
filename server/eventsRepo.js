import { randomUUID } from 'node:crypto'
import { eventInputToRow, rowToEvent } from './eventMapper.js'

const COLUMNS = `
  id, title, category, date, time, place, cost, bus, group_label, noise,
  access_status, access_owner, access_last_confirmed, access_note,
  support, registration, registration_url, image, reason, short, plain, host, arrival, journey, created_at, created_by
`

export function listEvents(db) {
  const rows = db.prepare('SELECT * FROM events ORDER BY created_at ASC').all()
  return rows.map(rowToEvent)
}

export function listEventsByStaff(db, staffId) {
  const rows = db.prepare('SELECT * FROM events WHERE created_by = ? ORDER BY created_at ASC').all(staffId)
  return rows.map(rowToEvent)
}

export function getEventById(db, id) {
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(id)
  return row ? rowToEvent(row) : null
}

export function insertEvent(db, input, staffId) {
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  const row = eventInputToRow(input, id, createdAt, staffId)
  db.prepare(`INSERT INTO events (${COLUMNS}) VALUES (
    @id, @title, @category, @date, @time, @place, @cost, @bus, @group_label, @noise,
    @access_status, @access_owner, @access_last_confirmed, @access_note,
    @support, @registration, @registration_url, @image, @reason, @short, @plain, @host, @arrival, @journey, @created_at, @created_by
  )`).run(row)
  return rowToEvent(row)
}

export function deleteEvent(db, id) {
  db.prepare('DELETE FROM events WHERE id = ?').run(id)
}

export function updateEvent(db, id, input, createdBy) {
  const row = eventInputToRow(input, id, null, createdBy)
  db.prepare(`UPDATE events SET
    title=@title, category=@category, date=@date, time=@time, place=@place, cost=@cost, bus=@bus, group_label=@group_label, noise=@noise,
    access_status=@access_status, access_owner=@access_owner, access_last_confirmed=@access_last_confirmed, access_note=@access_note,
    support=@support, registration=@registration, registration_url=@registration_url, image=@image, reason=@reason, short=@short, plain=@plain,
    host=@host, arrival=@arrival, journey=@journey
  WHERE id=@id`).run(row)
  return getEventById(db, id)
}
