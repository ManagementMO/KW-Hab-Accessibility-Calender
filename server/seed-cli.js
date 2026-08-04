import { fileURLToPath } from 'node:url'
import { openDb } from './db.js'
import { seedStaff } from './seed.js'

const email = process.env.STAFF_EMAIL
const password = process.env.STAFF_PASSWORD
if (!email || !password) {
  console.error('STAFF_EMAIL and STAFF_PASSWORD must be set. Copy .env.example to .env and set values.')
  process.exit(1)
}

const dbPath = process.env.DB_PATH || fileURLToPath(new URL('./data.db', import.meta.url))
const db = openDb(dbPath)
const result = await seedStaff(db, email, password)
console.log(result.created ? `Created staff account for ${result.email}.` : `Staff account ${result.email} already exists, skipping.`)
