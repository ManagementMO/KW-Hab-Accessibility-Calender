import { fileURLToPath } from 'node:url'
import { createApp } from './app.js'
import { openDb } from './db.js'

const port = process.env.PORT || 3001
const secret = process.env.SESSION_SECRET
if (!secret) {
  console.error('SESSION_SECRET is not set. Copy .env.example to .env and set a value.')
  process.exit(1)
}

const dbPath = process.env.DB_PATH || fileURLToPath(new URL('./data.db', import.meta.url))
const db = openDb(dbPath)
const app = createApp(db, secret)
app.listen(port, () => console.log(`Belonging Loop API listening on http://localhost:${port}`))
