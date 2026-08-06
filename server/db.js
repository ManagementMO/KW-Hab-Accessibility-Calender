import Database from 'better-sqlite3'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  day TEXT NOT NULL,
  time TEXT NOT NULL,
  place TEXT NOT NULL,
  cost TEXT NOT NULL,
  bus TEXT NOT NULL,
  group_label TEXT NOT NULL,
  noise TEXT NOT NULL,
  access_status TEXT NOT NULL,
  access_owner TEXT NOT NULL,
  access_last_confirmed TEXT NOT NULL,
  access_note TEXT NOT NULL DEFAULT '',
  support TEXT NOT NULL,
  registration TEXT NOT NULL,
  image TEXT NOT NULL,
  reason TEXT NOT NULL,
  short TEXT NOT NULL,
  plain TEXT NOT NULL,
  arrival TEXT NOT NULL,
  journey TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`

function migrate(db) {
  const columns = db.prepare("PRAGMA table_info(events)").all().map((column) => column.name)
  if (!columns.includes('registration_url')) db.exec('ALTER TABLE events ADD COLUMN registration_url TEXT NOT NULL DEFAULT \'\'')
  if (!columns.includes('created_by')) db.exec('ALTER TABLE events ADD COLUMN created_by TEXT NOT NULL DEFAULT \'\'')
  if (!columns.includes('date')) db.exec('ALTER TABLE events ADD COLUMN date TEXT NOT NULL DEFAULT \'\'')
  if (!columns.includes('host')) db.exec('ALTER TABLE events ADD COLUMN host TEXT NOT NULL DEFAULT \'\'')
}

export function openDb(path) {
  const db = new Database(path)
  if (path !== ':memory:') db.pragma('journal_mode = WAL')
  db.exec(SCHEMA)
  migrate(db)
  return db
}
