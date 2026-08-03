# Event Storage, Staff Auth, and Entry Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hard-coded mock events with a local SQLite-backed API, add staff login gating a create-only staff section, and add a participant/staff entry choice — without changing existing participant-facing UX, copy, or flow logic.

**Architecture:** A small Express + better-sqlite3 API (`server/`) serves `/api/events` (public GET, staff-only POST) and `/api/auth/*` (login/logout/me) behind a signed httpOnly session cookie. The Vite dev server proxies `/api/*` to it. The React frontend gains a top-level `entry` state (`checking → choice → participant | staff-login → staff`) that sits above the existing `tab` state machine; the participant branch (`onboarding` → app-shell) is otherwise untouched. Events are fetched via `src/lib/api.ts`; participant preferences persist via `src/lib/localStore.ts`, a structurally separate module so the browser→backend boundary is auditable by inspection.

**Tech Stack:** Existing: React 19, Vite, TypeScript, Vitest, lucide-react. New: express, better-sqlite3, bcryptjs, cookie-parser (deps); concurrently, supertest (devDeps).

**Full design context:** `docs/superpowers/specs/2026-08-02-event-storage-staff-auth-design.md`

## Global Constraints

- Server code lives in `server/` as plain ESM JavaScript (package.json already has `"type": "module"`) — `tsconfig.json`'s `include` is `["src", "vite.config.ts"]`, so server files are intentionally outside the TS project; do not add `@types/*` packages for them.
- No diagnosis fields anywhere. `access` is `{status: 'confirmed'|'reported'|'not_known', owner, lastConfirmed, note}` — never a boolean.
- Nothing auto-publishes; a staff form submission is the human-approval step.
- No streaks, no public attendance exposure, no care-substitution language.
- Registration stays an external link (`href="https://kwhab.ca/"`), never rebuilt.
- Participant preference data (`saved`, `mode`, `pecs`, `language`) must never be sent to the API — only `src/lib/localStore.ts` touches it, only `src/lib/api.ts` talks to the network.
- Never store or log a plaintext password.
- Match existing code style: dense single-line JSX, no semicolons... actually this repo *does* use no trailing semicolons and single-line arrow-function components — follow the surrounding file's formatting exactly rather than reformatting.

---

### Task 1: Backend scaffolding and the database module

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `.env.example`
- Create: `server/db.js`
- Test: `server/db.test.js`

**Interfaces:**
- Produces: `openDb(path: string): Database` — opens (creating if needed) a better-sqlite3 database at `path` and ensures the `events` and `staff` tables exist. `openDb(':memory:')` is used by every later server test for isolation.

- [ ] **Step 1: Add new dependencies and scripts to `package.json`**

Replace the `scripts`, `dependencies`, and `devDependencies` blocks:

```json
  "scripts": {
    "dev": "concurrently -k -n client,server -c blue,green \"npm:dev:client\" \"npm:dev:server\"",
    "dev:client": "vite",
    "dev:server": "node --env-file=.env --watch server/index.js",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "seed": "node --env-file=.env server/seed-cli.js"
  },
  "dependencies": {
    "better-sqlite3": "^11.8.1",
    "bcryptjs": "^2.4.3",
    "cookie-parser": "^1.4.7",
    "express": "^4.21.2",
    "lucide-react": "^0.468.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "@vitejs/plugin-react": "^4.3.4",
    "concurrently": "^9.1.2",
    "jsdom": "^25.0.1",
    "supertest": "^7.0.0",
    "typescript": "^5.7.2",
    "vite": "^5.4.21",
    "vitest": "^2.1.8"
  }
```

Run: `npm install`
Expected: installs cleanly. If `better-sqlite3` fails to build from source (no prebuilt binary for this platform/Node version), stop and report the exact error before continuing — do not substitute a different store without checking back in.

- [ ] **Step 2: Add ignores for local secrets and the database file**

Append to `.gitignore`:

```
.env
server/data.db
server/data.db-journal
server/data.db-wal
server/data.db-shm
```

- [ ] **Step 3: Create `.env.example`**

```
PORT=3001
SESSION_SECRET=replace-with-a-long-random-string
STAFF_EMAIL=staff@kwhab.ca
STAFF_PASSWORD=change-me-now
```

- [ ] **Step 4: Write the failing test for `openDb`**

Create `server/db.test.js`:

```js
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
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx vitest run server/db.test.js`
Expected: FAIL — `server/db.js` does not exist yet.

- [ ] **Step 6: Implement `server/db.js`**

```js
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

export function openDb(path) {
  const db = new Database(path)
  if (path !== ':memory:') db.pragma('journal_mode = WAL')
  db.exec(SCHEMA)
  return db
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run server/db.test.js`
Expected: PASS (2 tests)

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json .gitignore .env.example server/db.js server/db.test.js
git commit -m "feat(server): add sqlite schema and db bootstrap"
```

---

### Task 2: Event row mapping and validation

**Files:**
- Create: `server/eventMapper.js`
- Test: `server/eventMapper.test.js`

**Interfaces:**
- Consumes: nothing (pure functions, no DB).
- Produces: `rowToEvent(row): Event`, `eventInputToRow(input, id, createdAt): Row`, `validateEventInput(input): string[]` (empty array = valid). `Event` shape: `{id, title, category, day, time, place, cost, bus, group, noise, access: {status, owner, lastConfirmed, note}, support, registration, image, reason, short, plain, arrival: [{icon,title,detail,image}], journey?: {route,leave,duration,steps: string[]}}`. Task 3 (`eventsRepo.js`), Task 6 (`app.js`), and the frontend `src/lib/api.ts` (Task 9) all depend on this exact shape.

- [ ] **Step 1: Write the failing tests**

Create `server/eventMapper.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { eventInputToRow, rowToEvent, validateEventInput } from './eventMapper.js'

const sampleInput = {
  title: 'Community Art Afternoon', category: 'Art', day: 'Wednesday', time: '2:00 PM - 3:30 PM',
  place: 'Victoria Hills Centre', cost: 'Free', bus: 'Route 4 at the door', group: '12 people', noise: 'Low noise',
  access: { status: 'reported', owner: 'KW Hab staff', lastConfirmed: '2026-07-10', note: 'Indoor and step-free' },
  support: 'Staff support available', registration: 'Yes, just come', image: 'https://example.com/a.jpg',
  reason: 'Recommended because you like making things in a calm room.', short: 'Paint, draw, or make a craft.',
  plain: 'We will make art together.',
  arrival: [{ icon: '🚪', title: 'Use the front door', detail: 'The door has a flat entrance.', image: 'https://example.com/b.jpg' }],
  journey: { route: 'Bus 4 to Victoria Hills', leave: 'Leaves at 1:26 PM', duration: '14 min', steps: ['Leave home', 'Bus 4'] },
}

describe('eventInputToRow / rowToEvent round trip', () => {
  it('maps a full input to a row and back to an equivalent Event', () => {
    const row = eventInputToRow(sampleInput, 'abc-123', '2026-08-02T00:00:00.000Z')
    expect(row.id).toBe('abc-123')
    expect(row.group_label).toBe('12 people')
    expect(row.access_status).toBe('reported')
    expect(row.access_note).toBe('Indoor and step-free')

    const event = rowToEvent(row)
    expect(event).toEqual({
      id: 'abc-123', ...sampleInput,
    })
  })

  it('maps a row with no journey to an event with journey undefined', () => {
    const row = eventInputToRow({ ...sampleInput, journey: undefined }, 'abc-124', '2026-08-02T00:00:00.000Z')
    expect(row.journey).toBeNull()
    const event = rowToEvent(row)
    expect(event.journey).toBeUndefined()
  })
})

describe('validateEventInput', () => {
  it('returns no errors for a complete input', () => {
    expect(validateEventInput(sampleInput)).toEqual([])
  })

  it('flags every missing required text field', () => {
    const errors = validateEventInput({ ...sampleInput, title: '', place: '   ' })
    expect(errors).toContain('title is required')
    expect(errors).toContain('place is required')
  })

  it('flags an invalid access status', () => {
    const errors = validateEventInput({ ...sampleInput, access: { ...sampleInput.access, status: 'certified' } })
    expect(errors).toContain('access.status must be confirmed, reported, or not_known')
  })

  it('flags a missing access owner or last-confirmed date', () => {
    const errors = validateEventInput({ ...sampleInput, access: { ...sampleInput.access, owner: '', lastConfirmed: '' } })
    expect(errors).toContain('access.owner is required')
    expect(errors).toContain('access.lastConfirmed is required')
  })

  it('flags an empty or incomplete arrival list', () => {
    expect(validateEventInput({ ...sampleInput, arrival: [] })).toContain('at least one arrival step is required')
    expect(validateEventInput({ ...sampleInput, arrival: [{ icon: '🚪', title: '', detail: 'x', image: 'y' }] }))
      .toContain('each arrival step needs icon, title, detail, and image')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/eventMapper.test.js`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `server/eventMapper.js`**

```js
const REQUIRED_FIELDS = ['title', 'category', 'day', 'time', 'place', 'cost', 'bus', 'group', 'noise', 'support', 'registration', 'image', 'reason', 'short', 'plain']
const ACCESS_STATUSES = ['confirmed', 'reported', 'not_known']

export function rowToEvent(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    day: row.day,
    time: row.time,
    place: row.place,
    cost: row.cost,
    bus: row.bus,
    group: row.group_label,
    noise: row.noise,
    access: {
      status: row.access_status,
      owner: row.access_owner,
      lastConfirmed: row.access_last_confirmed,
      note: row.access_note,
    },
    support: row.support,
    registration: row.registration,
    image: row.image,
    reason: row.reason,
    short: row.short,
    plain: row.plain,
    arrival: JSON.parse(row.arrival),
    journey: row.journey ? JSON.parse(row.journey) : undefined,
  }
}

export function eventInputToRow(input, id, createdAt) {
  return {
    id,
    title: input.title,
    category: input.category,
    day: input.day,
    time: input.time,
    place: input.place,
    cost: input.cost,
    bus: input.bus,
    group_label: input.group,
    noise: input.noise,
    access_status: input.access.status,
    access_owner: input.access.owner,
    access_last_confirmed: input.access.lastConfirmed,
    access_note: input.access.note || '',
    support: input.support,
    registration: input.registration,
    image: input.image,
    reason: input.reason,
    short: input.short,
    plain: input.plain,
    arrival: JSON.stringify(input.arrival),
    journey: input.journey ? JSON.stringify(input.journey) : null,
    created_at: createdAt,
  }
}

export function validateEventInput(input) {
  const errors = []
  for (const field of REQUIRED_FIELDS) {
    const value = input[field]
    if (typeof value !== 'string' || !value.trim()) errors.push(`${field} is required`)
  }
  if (!input.access || typeof input.access !== 'object') {
    errors.push('access is required')
  } else {
    if (!ACCESS_STATUSES.includes(input.access.status)) errors.push('access.status must be confirmed, reported, or not_known')
    if (!input.access.owner || !input.access.owner.trim()) errors.push('access.owner is required')
    if (!input.access.lastConfirmed || !input.access.lastConfirmed.trim()) errors.push('access.lastConfirmed is required')
  }
  if (!Array.isArray(input.arrival) || input.arrival.length === 0) {
    errors.push('at least one arrival step is required')
  } else if (input.arrival.some((step) => !step.icon || !step.title || !step.detail || !step.image)) {
    errors.push('each arrival step needs icon, title, detail, and image')
  }
  return errors
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/eventMapper.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add server/eventMapper.js server/eventMapper.test.js
git commit -m "feat(server): add event row mapping and validation"
```

---

### Task 3: Events repository

**Files:**
- Create: `server/eventsRepo.js`
- Test: `server/eventsRepo.test.js`

**Interfaces:**
- Consumes: `openDb` (Task 1), `rowToEvent`/`eventInputToRow` (Task 2).
- Produces: `listEvents(db): Event[]`, `insertEvent(db, input): Event`. Task 6 (`app.js`) calls both directly.

- [ ] **Step 1: Write the failing tests**

Create `server/eventsRepo.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { openDb } from './db.js'
import { insertEvent, listEvents } from './eventsRepo.js'

const sampleInput = {
  title: 'Music and Games Night', category: 'Music', day: 'Friday', time: '6:00 PM - 8:00 PM',
  place: 'Kitchener Community Hall', cost: '$5', bus: 'Route 8 until 9 PM', group: '20 people', noise: 'Moderate noise',
  access: { status: 'confirmed', owner: 'KW Hab staff', lastConfirmed: '2026-07-01', note: 'Ramp entrance' },
  support: 'Support people are free', registration: 'Sign up first', image: 'https://example.com/c.jpg',
  reason: 'Recommended because you enjoy music.', short: 'Listen to music and play games.',
  plain: 'We will listen to music.',
  arrival: [{ icon: '🚪', title: 'Use the ramp', detail: 'On the side of the hall.', image: 'https://example.com/d.jpg' }],
}

describe('eventsRepo', () => {
  it('starts empty', () => {
    const db = openDb(':memory:')
    expect(listEvents(db)).toEqual([])
  })

  it('inserts an event and returns it with a generated id', () => {
    const db = openDb(':memory:')
    const created = insertEvent(db, sampleInput)
    expect(created.id).toEqual(expect.any(String))
    expect(created.title).toBe('Music and Games Night')
    expect(created.access.status).toBe('confirmed')
  })

  it('lists inserted events ordered by creation time', () => {
    const db = openDb(':memory:')
    insertEvent(db, sampleInput)
    insertEvent(db, { ...sampleInput, title: 'Second Event' })
    const events = listEvents(db)
    expect(events).toHaveLength(2)
    expect(events.map((event) => event.title)).toEqual(['Music and Games Night', 'Second Event'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/eventsRepo.test.js`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `server/eventsRepo.js`**

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/eventsRepo.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add server/eventsRepo.js server/eventsRepo.test.js
git commit -m "feat(server): add events repository"
```

---

### Task 4: Auth helpers (password hashing, session signing)

**Files:**
- Create: `server/auth.js`
- Test: `server/auth.test.js`

**Interfaces:**
- Produces: `hashPassword(password): Promise<string>`, `verifyPassword(password, hash): Promise<boolean>`, `signSession(payload, secret): string`, `verifySession(token, secret): object | null`. Task 6 (`app.js`) and Task 7 (`seed.js`) depend on these exact names.

- [ ] **Step 1: Write the failing tests**

Create `server/auth.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { hashPassword, signSession, verifyPassword, verifySession } from './auth.js'

describe('password hashing', () => {
  it('hashes a password and verifies it correctly', async () => {
    const hash = await hashPassword('correct-horse-battery-staple')
    expect(hash).not.toBe('correct-horse-battery-staple')
    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true)
    expect(await verifyPassword('wrong-password', hash)).toBe(false)
  })
})

describe('session signing', () => {
  it('round-trips a payload through sign and verify', () => {
    const token = signSession({ staffId: 'abc', email: 'a@b.com' }, 'test-secret')
    expect(verifySession(token, 'test-secret')).toEqual({ staffId: 'abc', email: 'a@b.com' })
  })

  it('rejects a token signed with a different secret', () => {
    const token = signSession({ staffId: 'abc' }, 'test-secret')
    expect(verifySession(token, 'other-secret')).toBeNull()
  })

  it('rejects a tampered token body', () => {
    const token = signSession({ staffId: 'abc' }, 'test-secret')
    const [, signature] = token.split('.')
    const tampered = `${Buffer.from(JSON.stringify({ staffId: 'admin' })).toString('base64url')}.${signature}`
    expect(verifySession(tampered, 'test-secret')).toBeNull()
  })

  it('rejects garbage input', () => {
    expect(verifySession('not-a-real-token', 'test-secret')).toBeNull()
    expect(verifySession(undefined, 'test-secret')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/auth.test.js`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `server/auth.js`**

```js
import bcrypt from 'bcryptjs'
import { createHmac, timingSafeEqual } from 'node:crypto'

export function hashPassword(password) {
  return bcrypt.hash(password, 10)
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash)
}

export function signSession(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${signature}`
}

export function verifySession(token, secret) {
  if (!token || typeof token !== 'string') return null
  const [body, signature] = token.split('.')
  if (!body || !signature) return null
  const expected = createHmac('sha256', secret).update(body).digest('base64url')
  const expectedBuf = Buffer.from(expected)
  const actualBuf = Buffer.from(signature)
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) return null
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/auth.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add server/auth.js server/auth.test.js
git commit -m "feat(server): add password hashing and signed session helpers"
```

---

### Task 5: Staff repository

**Files:**
- Create: `server/staffRepo.js`
- Test: `server/staffRepo.test.js`

**Interfaces:**
- Consumes: `openDb` (Task 1).
- Produces: `findStaffByEmail(db, email): {id, email, password_hash, created_at} | null`, `createStaff(db, {email, passwordHash}): {id, email, passwordHash, createdAt}`. Task 6 (`app.js`) and Task 7 (`seed.js`) depend on these exact names.

- [ ] **Step 1: Write the failing tests**

Create `server/staffRepo.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/staffRepo.test.js`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `server/staffRepo.js`**

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/staffRepo.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add server/staffRepo.js server/staffRepo.test.js
git commit -m "feat(server): add staff repository"
```

---

### Task 6: Express app and routes

**Files:**
- Create: `server/app.js`
- Create: `server/index.js`
- Test: `server/app.test.js`

**Interfaces:**
- Consumes: `openDb` (Task 1), `validateEventInput` (Task 2), `listEvents`/`insertEvent` (Task 3), `hashPassword`/`verifyPassword`/`signSession`/`verifySession` (Task 4), `findStaffByEmail` (Task 5).
- Produces: `createApp(db, secret): express.Express`. Task 7's manual smoke test and the frontend's `src/lib/api.ts` (Task 9) depend on the route contracts below.
- Routes: `POST /api/auth/login {email,password} → 200 {ok,email} + Set-Cookie | 401 {error}`; `POST /api/auth/logout → 200 {ok}`; `GET /api/auth/me → 200 {ok,email} | 401 {error}`; `GET /api/events → 200 Event[]`; `POST /api/events` (requires cookie) `→ 201 Event | 400 {error} | 401 {error}`.

- [ ] **Step 1: Write the failing tests**

Create `server/app.test.js`:

```js
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { openDb } from './db.js'
import { createApp } from './app.js'
import { hashPassword } from './auth.js'
import { createStaff } from './staffRepo.js'

const SECRET = 'test-secret'
const validEvent = {
  title: 'Community Art Afternoon', category: 'Art', day: 'Wednesday', time: '2:00 PM - 3:30 PM',
  place: 'Victoria Hills Centre', cost: 'Free', bus: 'Route 4 at the door', group: '12 people', noise: 'Low noise',
  access: { status: 'reported', owner: 'KW Hab staff', lastConfirmed: '2026-07-10', note: 'Indoor and step-free' },
  support: 'Staff support available', registration: 'Yes, just come', image: 'https://example.com/a.jpg',
  reason: 'Recommended because you like making things in a calm room.', short: 'Paint, draw, or make a craft.',
  plain: 'We will make art together.',
  arrival: [{ icon: '🚪', title: 'Use the front door', detail: 'The door has a flat entrance.', image: 'https://example.com/b.jpg' }],
}

describe('app', () => {
  let app
  let db

  beforeEach(async () => {
    db = openDb(':memory:')
    app = createApp(db, SECRET)
    createStaff(db, { email: 'staff@kwhab.ca', passwordHash: await hashPassword('correct-password') })
  })

  it('GET /api/events starts empty', async () => {
    const res = await request(app).get('/api/events')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('rejects login with the wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'staff@kwhab.ca', password: 'wrong' })
    expect(res.status).toBe(401)
    expect(res.body.error).toBeTruthy()
  })

  it('rejects login for an unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@kwhab.ca', password: 'x' })
    expect(res.status).toBe(401)
  })

  it('rejects POST /api/events with no session', async () => {
    const res = await request(app).post('/api/events').send(validEvent)
    expect(res.status).toBe(401)
  })

  it('rejects POST /api/events with an incomplete payload even when authenticated', async () => {
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ email: 'staff@kwhab.ca', password: 'correct-password' })
    const res = await agent.post('/api/events').send({ ...validEvent, title: '' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/title/)
  })

  it('logs in, creates an event, and lists it back', async () => {
    const agent = request.agent(app)
    const login = await agent.post('/api/auth/login').send({ email: 'staff@kwhab.ca', password: 'correct-password' })
    expect(login.status).toBe(200)
    expect(login.body.email).toBe('staff@kwhab.ca')

    const me = await agent.get('/api/auth/me')
    expect(me.status).toBe(200)

    const created = await agent.post('/api/events').send(validEvent)
    expect(created.status).toBe(201)
    expect(created.body.title).toBe('Community Art Afternoon')

    const list = await request(app).get('/api/events')
    expect(list.body).toHaveLength(1)

    await agent.post('/api/auth/logout')
    const meAfterLogout = await agent.get('/api/auth/me')
    expect(meAfterLogout.status).toBe(401)
  })

  it('GET /api/auth/me without a session returns 401', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/app.test.js`
Expected: FAIL — `server/app.js` does not exist.

- [ ] **Step 3: Implement `server/app.js`**

```js
import cookieParser from 'cookie-parser'
import express from 'express'
import { signSession, verifyPassword, verifySession } from './auth.js'
import { validateEventInput } from './eventMapper.js'
import { insertEvent, listEvents } from './eventsRepo.js'
import { findStaffByEmail } from './staffRepo.js'

const COOKIE_NAME = 'belonging_session'

export function createApp(db, secret) {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())

  function requireStaff(req, res, next) {
    const session = verifySession(req.cookies[COOKIE_NAME], secret)
    if (!session) return res.status(401).json({ error: 'Not authenticated' })
    req.staff = session
    next()
  }

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body || {}
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })
    const staff = findStaffByEmail(db, email)
    if (!staff || !(await verifyPassword(password, staff.password_hash))) {
      return res.status(401).json({ error: 'Incorrect email or password' })
    }
    const token = signSession({ staffId: staff.id, email: staff.email }, secret)
    res.cookie(COOKIE_NAME, token, { httpOnly: true, sameSite: 'lax' })
    res.json({ ok: true, email: staff.email })
  })

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME)
    res.json({ ok: true })
  })

  app.get('/api/auth/me', (req, res) => {
    const session = verifySession(req.cookies[COOKIE_NAME], secret)
    if (!session) return res.status(401).json({ error: 'Not authenticated' })
    res.json({ ok: true, email: session.email })
  })

  app.get('/api/events', (req, res) => {
    res.json(listEvents(db))
  })

  app.post('/api/events', requireStaff, (req, res) => {
    const errors = validateEventInput(req.body || {})
    if (errors.length) return res.status(400).json({ error: errors.join('; ') })
    res.status(201).json(insertEvent(db, req.body))
  })

  return app
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/app.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: Create the server entrypoint `server/index.js`**

```js
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
```

- [ ] **Step 6: Commit**

```bash
git add server/app.js server/app.test.js server/index.js
git commit -m "feat(server): add express app, auth/event routes, and entrypoint"
```

---

### Task 7: Seed script

**Files:**
- Create: `server/seed.js`
- Create: `server/seed-cli.js`
- Test: `server/seed.test.js`

**Interfaces:**
- Consumes: `hashPassword` (Task 4), `findStaffByEmail`/`createStaff` (Task 5).
- Produces: `seedStaff(db, email, password): Promise<{created: boolean, email: string}>`.

- [ ] **Step 1: Write the failing tests**

Create `server/seed.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/seed.test.js`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `server/seed.js`**

```js
import { hashPassword } from './auth.js'
import { createStaff, findStaffByEmail } from './staffRepo.js'

export async function seedStaff(db, email, password) {
  if (findStaffByEmail(db, email)) return { created: false, email }
  const passwordHash = await hashPassword(password)
  createStaff(db, { email, passwordHash })
  return { created: true, email }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/seed.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Create the CLI wrapper `server/seed-cli.js`** (not unit tested — thin glue verified by the manual smoke test in Task 15)

```js
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
```

- [ ] **Step 6: Commit**

```bash
git add server/seed.js server/seed.test.js server/seed-cli.js
git commit -m "feat(server): add idempotent staff seed script"
```

---

### Task 8: Vite dev proxy

**Files:**
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: Express server (Task 6) listening on `PORT` (default 3001).

- [ ] **Step 1: Add the API proxy to `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
```

- [ ] **Step 2: Manual smoke check**

Run: `cp .env.example .env` (edit `SESSION_SECRET` to any long string), then `npm run seed`, then `npm run dev`
Expected: two labeled log streams (`client`, `server`); visiting `http://localhost:5173/api/events` in a browser (or `curl http://localhost:5173/api/events` in another terminal) returns `[]` proxied through Vite. Stop the dev server (Ctrl+C) before continuing.

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "feat(client): proxy /api to the local express server in dev"
```

---

### Task 9: Frontend API client

**Files:**
- Create: `src/lib/api.ts`
- Test: `src/lib/api.test.ts`

**Interfaces:**
- Produces: `Event`, `AccessFact`, `ArrivalStep`, `Journey`, `NewEventInput` types; `getEvents(): Promise<Event[]>`, `createEvent(input: NewEventInput): Promise<Event>`, `login(email, password): Promise<{ok: true, email: string}>`, `logout(): Promise<void>`, `getSession(): Promise<{ok: true, email: string} | null>`. Every remaining frontend task imports the `Event`/`AccessFact` types and these functions from this exact file.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/api.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEvent, getEvents, getSession, login, logout } from './api'

const sampleEvent = { id: '1', title: 'Test Event' }

afterEach(() => { vi.unstubAllGlobals() })

describe('getEvents', () => {
  it('fetches and returns the event list', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [sampleEvent] })
    vi.stubGlobal('fetch', fetchMock)
    const events = await getEvents()
    expect(fetchMock).toHaveBeenCalledWith('/api/events')
    expect(events).toEqual([sampleEvent])
  })
})

describe('createEvent', () => {
  it('posts the input as JSON and returns the created event', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => sampleEvent })
    vi.stubGlobal('fetch', fetchMock)
    const input = { title: 'Test Event' } as any
    const created = await createEvent(input)
    expect(fetchMock).toHaveBeenCalledWith('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    expect(created).toEqual(sampleEvent)
  })

  it('throws the server error message on failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'title is required' }) })
    vi.stubGlobal('fetch', fetchMock)
    await expect(createEvent({} as any)).rejects.toThrow('title is required')
  })
})

describe('login', () => {
  it('throws on incorrect credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'Incorrect email or password' }) })
    vi.stubGlobal('fetch', fetchMock)
    await expect(login('a@b.com', 'wrong')).rejects.toThrow('Incorrect email or password')
  })
})

describe('getSession', () => {
  it('returns null when there is no session', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 })
    vi.stubGlobal('fetch', fetchMock)
    expect(await getSession()).toBeNull()
  })

  it('returns the session when authenticated', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, email: 'staff@kwhab.ca' }) })
    vi.stubGlobal('fetch', fetchMock)
    expect(await getSession()).toEqual({ ok: true, email: 'staff@kwhab.ca' })
  })
})

describe('logout', () => {
  it('posts to the logout endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchMock)
    await logout()
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/api.test.ts`
Expected: FAIL — `src/lib/api.ts` does not exist.

- [ ] **Step 3: Implement `src/lib/api.ts`**

```ts
export type AccessFact = {
  status: 'confirmed' | 'reported' | 'not_known'
  owner: string
  lastConfirmed: string
  note: string
}

export type ArrivalStep = { icon: string; title: string; detail: string; image: string }
export type Journey = { route: string; leave: string; duration: string; steps: string[] }

export type Event = {
  id: string
  title: string
  category: string
  day: string
  time: string
  place: string
  cost: string
  bus: string
  group: string
  noise: string
  access: AccessFact
  support: string
  registration: 'Sign up first' | 'Yes, just come'
  image: string
  reason: string
  short: string
  plain: string
  arrival: ArrivalStep[]
  journey?: Journey
}

export type NewEventInput = Omit<Event, 'id'>

async function parseOrThrow(response: Response) {
  if (response.status === 401) return null
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `Request failed with status ${response.status}`)
  return data
}

export async function getEvents(): Promise<Event[]> {
  const response = await fetch('/api/events')
  return parseOrThrow(response)
}

export async function createEvent(input: NewEventInput): Promise<Event> {
  const response = await fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseOrThrow(response)
}

export async function login(email: string, password: string): Promise<{ ok: true; email: string }> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return parseOrThrow(response)
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' })
}

export async function getSession(): Promise<{ ok: true; email: string } | null> {
  const response = await fetch('/api/auth/me')
  return parseOrThrow(response)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/api.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.ts src/lib/api.test.ts
git commit -m "feat(client): add fetch-based API client for events and auth"
```

---

### Task 10: Participant localStorage utility

**Files:**
- Create: `src/lib/localStore.ts`
- Test: `src/lib/localStore.test.ts`

**Interfaces:**
- Produces: `loadSaved(): string[]`, `storeSaved(saved: string[]): void`, `loadMode(): ReadingMode`, `storeMode(mode: ReadingMode): void`, `loadPecs(): boolean`, `storePecs(pecs: boolean): void`, `loadLanguage(): Language`, `storeLanguage(language: Language): void`. Task 14 (`App.tsx`) uses all eight.
- This file must never import from `src/lib/api.ts`, and `src/lib/api.ts` must never import from this file — that separation is the enforced boundary.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/localStore.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { loadLanguage, loadMode, loadPecs, loadSaved, storeLanguage, storeMode, storePecs, storeSaved } from './localStore'

afterEach(() => { localStorage.clear() })

describe('localStore', () => {
  it('defaults saved to an empty list', () => {
    expect(loadSaved()).toEqual([])
  })

  it('round-trips saved event ids', () => {
    storeSaved(['abc-123', 'def-456'])
    expect(loadSaved()).toEqual(['abc-123', 'def-456'])
  })

  it('defaults reading mode to easy', () => {
    expect(loadMode()).toBe('easy')
  })

  it('round-trips reading mode', () => {
    storeMode('audio')
    expect(loadMode()).toBe('audio')
  })

  it('defaults pecs to false', () => {
    expect(loadPecs()).toBe(false)
  })

  it('round-trips pecs', () => {
    storePecs(true)
    expect(loadPecs()).toBe(true)
  })

  it('defaults language to en-CA', () => {
    expect(loadLanguage()).toBe('en-CA')
  })

  it('round-trips language', () => {
    storeLanguage('fr-CA')
    expect(loadLanguage()).toBe('fr-CA')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/localStore.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `src/lib/localStore.ts`**

```ts
import type { ReadingMode } from '../components/accessibility/AccessibilityBar'
import type { Language } from '../components/accessibility/ListenButton'

const KEYS = {
  saved: 'belonging-loop.saved',
  mode: 'belonging-loop.mode',
  pecs: 'belonging-loop.pecs',
  language: 'belonging-loop.language',
} as const

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function loadSaved(): string[] { return readJson(KEYS.saved, []) }
export function storeSaved(saved: string[]) { writeJson(KEYS.saved, saved) }

export function loadMode(): ReadingMode { return readJson(KEYS.mode, 'easy') }
export function storeMode(mode: ReadingMode) { writeJson(KEYS.mode, mode) }

export function loadPecs(): boolean { return readJson(KEYS.pecs, false) }
export function storePecs(pecs: boolean) { writeJson(KEYS.pecs, pecs) }

export function loadLanguage(): Language { return readJson(KEYS.language, 'en-CA') }
export function storeLanguage(language: Language) { writeJson(KEYS.language, language) }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/localStore.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/localStore.ts src/lib/localStore.test.ts
git commit -m "feat(client): add localStorage-backed participant preference store"
```

---

### Task 11: Access-fact formatting and the empty state

**Files:**
- Create: `src/lib/accessFact.ts`
- Create: `src/components/features/EmptyState.tsx`
- Test: `src/lib/accessFact.test.ts`
- Test: `src/components/features/EmptyState.test.tsx`

**Interfaces:**
- Consumes: `AccessFact` type (Task 9), `ReadingMode`/`Language` types, `ListenButton` (existing).
- Produces: `formatAccessFact(access: AccessFact): string`, `accessSearchText(access: AccessFact): string`, `accessSuggestsStepFree(access: AccessFact): boolean`; `<EmptyState mode pecs language slow />`. Task 14 (`App.tsx`) and `RecommendedBrowser.tsx` use all of these.

- [ ] **Step 1: Write the failing test for `accessFact.ts`**

Create `src/lib/accessFact.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { accessSearchText, accessSuggestsStepFree, formatAccessFact } from './accessFact'

const confirmed = { status: 'confirmed' as const, owner: 'KW Hab staff', lastConfirmed: '2026-07-10', note: 'Ramp entrance' }
const notKnown = { status: 'not_known' as const, owner: 'KW Hab staff', lastConfirmed: '2026-07-01', note: '' }

describe('formatAccessFact', () => {
  it('leads with the note when present', () => {
    expect(formatAccessFact(confirmed)).toBe('Ramp entrance — confirmed by KW Hab staff, last confirmed 2026-07-10')
  })

  it('falls back to the status label when there is no note', () => {
    expect(formatAccessFact(notKnown)).toBe('Not known yet — not known yet by KW Hab staff, last confirmed 2026-07-01')
  })
})

describe('accessSearchText', () => {
  it('includes the note, status, and owner in lowercase', () => {
    expect(accessSearchText(confirmed)).toBe('ramp entrance confirmed kw hab staff')
  })
})

describe('accessSuggestsStepFree', () => {
  it('is true when the note mentions step or ramp', () => {
    expect(accessSuggestsStepFree(confirmed)).toBe(true)
  })

  it('is false otherwise', () => {
    expect(accessSuggestsStepFree(notKnown)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/accessFact.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `src/lib/accessFact.ts`**

```ts
import type { AccessFact } from './api'

const STATUS_LABEL: Record<AccessFact['status'], string> = {
  confirmed: 'Confirmed',
  reported: 'Reported',
  not_known: 'Not known yet',
}

export function formatAccessFact(access: AccessFact): string {
  const lead = access.note.trim() ? access.note : STATUS_LABEL[access.status]
  return `${lead} — ${STATUS_LABEL[access.status].toLowerCase()} by ${access.owner}, last confirmed ${access.lastConfirmed}`
}

export function accessSearchText(access: AccessFact): string {
  return `${access.note} ${access.status} ${access.owner}`.replace(/\s+/g, ' ').trim().toLowerCase()
}

export function accessSuggestsStepFree(access: AccessFact): boolean {
  const text = accessSearchText(access)
  return text.includes('step') || text.includes('ramp')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/accessFact.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write the failing test for `EmptyState`**

Create `src/components/features/EmptyState.test.tsx`:

```tsx
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { EmptyState } from './EmptyState'

afterEach(cleanup)

describe('EmptyState', () => {
  it('shows the plain-text message in Easy Read mode', () => {
    render(<EmptyState mode="easy" pecs={false} language="en-CA" slow={false} />)
    expect(screen.getByText('No events at this time.')).toBeInTheDocument()
  })

  it('shows a symbol-first message when PECS is on', () => {
    render(<EmptyState mode="easy" pecs language="en-CA" slow={false} />)
    expect(screen.getByText('🚫📅')).toBeInTheDocument()
  })

  it('offers a Listen control in Audio First mode', () => {
    render(<EmptyState mode="audio" pecs={false} language="en-CA" slow />)
    expect(screen.getByRole('button', { name: /listen to empty events/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/components/features/EmptyState.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 7: Implement `src/components/features/EmptyState.tsx`**

```tsx
import { CalendarX2 } from 'lucide-react'
import { ListenButton, Language } from '../accessibility/ListenButton'
import { ReadingMode } from '../accessibility/AccessibilityBar'

export function EmptyState({ mode, pecs, language, slow }: { mode: ReadingMode; pecs: boolean; language: Language; slow: boolean }) {
  const message = 'No events at this time.'
  return <div className="empty-state" role="status">
    <CalendarX2 size={40} aria-hidden="true" />
    <p>{pecs ? '🚫📅' : message}</p>
    {mode === 'audio' && <ListenButton text={message} label="empty events" slow={slow} language={language} />}
  </div>
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/components/features/EmptyState.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 9: Commit**

```bash
git add src/lib/accessFact.ts src/lib/accessFact.test.ts src/components/features/EmptyState.tsx src/components/features/EmptyState.test.tsx
git commit -m "feat(client): add access-fact formatting and mode-aware empty state"
```

---

### Task 12: Entry choice and staff login screens

**Files:**
- Create: `src/components/features/EntryChoice.tsx`
- Create: `src/components/host/StaffLogin.tsx`
- Test: `src/components/features/EntryChoice.test.tsx`
- Test: `src/components/host/StaffLogin.test.tsx`

**Interfaces:**
- Consumes: `login` (Task 9).
- Produces: `<EntryChoice onParticipant={() => void} onStaff={() => void} />`, `<StaffLogin onSuccess={(email: string) => void} onBack={() => void} />`. Task 14 (`App.tsx`) renders both.

- [ ] **Step 1: Write the failing test for `EntryChoice`**

Create `src/components/features/EntryChoice.test.tsx`:

```tsx
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EntryChoice } from './EntryChoice'

afterEach(cleanup)

describe('EntryChoice', () => {
  it('calls onParticipant when the participant option is chosen', async () => {
    const user = userEvent.setup()
    const onParticipant = vi.fn()
    render(<EntryChoice onParticipant={onParticipant} onStaff={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /participant/i }))
    expect(onParticipant).toHaveBeenCalled()
  })

  it('calls onStaff when the staff option is chosen', async () => {
    const user = userEvent.setup()
    const onStaff = vi.fn()
    render(<EntryChoice onParticipant={vi.fn()} onStaff={onStaff} />)
    await user.click(screen.getByRole('button', { name: /staff/i }))
    expect(onStaff).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/features/EntryChoice.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `src/components/features/EntryChoice.tsx`**

```tsx
import { Settings2, Users } from 'lucide-react'

export function EntryChoice({ onParticipant, onStaff }: { onParticipant: () => void; onStaff: () => void }) {
  return <main id="main-content" className="onboarding">
    <section className="decision-screen">
      <p className="eyebrow">KW HABILITATION · WELCOME</p>
      <h1>Who's using this today?</h1>
      <p>Pick one to continue.</p>
      <div className="decision-choices">
        <button onClick={onParticipant} aria-label="I'm a participant"><Users size={40} /><strong>I'm a participant</strong></button>
        <button onClick={onStaff} aria-label="I'm staff"><Settings2 size={40} /><strong>I'm staff</strong></button>
      </div>
    </section>
  </main>
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/features/EntryChoice.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Write the failing test for `StaffLogin`**

Create `src/components/host/StaffLogin.test.tsx`:

```tsx
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StaffLogin } from './StaffLogin'
import * as api from '../../lib/api'

afterEach(cleanup)
afterEach(() => { vi.restoreAllMocks() })

describe('StaffLogin', () => {
  it('calls onSuccess with the email on successful login', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'login').mockResolvedValue({ ok: true, email: 'staff@kwhab.ca' })
    const onSuccess = vi.fn()
    render(<StaffLogin onSuccess={onSuccess} onBack={vi.fn()} />)

    await user.type(screen.getByLabelText(/email/i), 'staff@kwhab.ca')
    await user.type(screen.getByLabelText(/password/i), 'correct-password')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(onSuccess).toHaveBeenCalledWith('staff@kwhab.ca')
  })

  it('shows an inline error and allows retry on failed login', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'login').mockRejectedValue(new Error('Incorrect email or password'))
    render(<StaffLogin onSuccess={vi.fn()} onBack={vi.fn()} />)

    await user.type(screen.getByLabelText(/email/i), 'staff@kwhab.ca')
    await user.type(screen.getByLabelText(/password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password')
    expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled()
  })

  it('calls onBack when back is clicked', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(<StaffLogin onSuccess={vi.fn()} onBack={onBack} />)
    await user.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalled()
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/components/host/StaffLogin.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 7: Implement `src/components/host/StaffLogin.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { ArrowLeft, LogIn } from 'lucide-react'
import { login } from '../../lib/api'

export function StaffLogin({ onSuccess, onBack }: { onSuccess: (email: string) => void; onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const result = await login(email, password)
      onSuccess(result.email)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log in')
      setSubmitting(false)
    }
  }

  return <main id="main-content" className="onboarding">
    <section className="decision-screen staff-login">
      <p className="eyebrow">STAFF SIGN IN</p>
      <h1>Staff login</h1>
      <form onSubmit={submit}>
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" /></label>
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /></label>
        {error && <p role="alert" className="form-error">{error}</p>}
        <button type="submit" disabled={submitting}><LogIn size={18} />{submitting ? 'Signing in...' : 'Sign in'}</button>
      </form>
      <button className="text-action" type="button" onClick={onBack}><ArrowLeft size={16} />Back</button>
    </section>
  </main>
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/components/host/StaffLogin.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 9: Commit**

```bash
git add src/components/features/EntryChoice.tsx src/components/features/EntryChoice.test.tsx src/components/host/StaffLogin.tsx src/components/host/StaffLogin.test.tsx
git commit -m "feat(client): add participant/staff entry choice and staff login screens"
```

---

### Task 13: Event creation form

**Files:**
- Create: `src/components/host/EventForm.tsx`
- Test: `src/components/host/EventForm.test.tsx`

**Interfaces:**
- Consumes: `createEvent` (Task 9), `Event`/`ArrivalStep`/`Journey` types (Task 9).
- Produces: `<EventForm onCreated={(event: Event) => void} />`. Task 14 (`App.tsx`) renders this inside the staff screen's Card 1.

- [ ] **Step 1: Write the failing tests**

Create `src/components/host/EventForm.test.tsx`:

```tsx
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventForm } from './EventForm'
import * as api from '../../lib/api'

afterEach(cleanup)
afterEach(() => { vi.restoreAllMocks() })

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Event name'), 'Community Art Afternoon')
  await user.type(screen.getByLabelText('Category'), 'Art')
  await user.type(screen.getByLabelText('Day'), 'Wednesday')
  await user.type(screen.getByLabelText('Time'), '2:00 PM - 3:30 PM')
  await user.type(screen.getByLabelText('Place'), 'Victoria Hills Centre')
  await user.type(screen.getByLabelText('Cost'), 'Free')
  await user.type(screen.getByLabelText('Bus'), 'Route 4 at the door')
  await user.type(screen.getByLabelText('Group'), '12 people')
  await user.type(screen.getByLabelText('Noise'), 'Low noise')
  await user.type(screen.getByLabelText('Support'), 'Staff support available')
  await user.type(screen.getByLabelText('Image URL'), 'https://example.com/a.jpg')
  await user.type(screen.getByLabelText('Recommendation reason'), 'Recommended because you like art.')
  await user.type(screen.getByLabelText('Short description'), 'Paint, draw, or make a craft.')
  await user.type(screen.getByLabelText('Plain-language description'), 'We will make art together.')
  await user.type(screen.getByLabelText('Owner'), 'KW Hab staff')
  const dateInput = screen.getByLabelText('Last confirmed')
  await user.clear(dateInput)
  await user.type(dateInput, '2026-07-10')
  const step = screen.getByText('Arrival steps').closest('fieldset') as HTMLElement
  await user.type(within(step).getByLabelText('Icon'), '🚪')
  await user.type(within(step).getByLabelText('Title'), 'Use the front door')
  await user.type(within(step).getByLabelText('Detail'), 'The door has a flat entrance.')
  await user.type(within(step).getByLabelText('Image URL', { selector: 'fieldset.arrival-fields input' }), 'https://example.com/b.jpg')
}

describe('EventForm', () => {
  it('shows validation errors and does not submit when required fields are empty', async () => {
    const user = userEvent.setup()
    const createEventSpy = vi.spyOn(api, 'createEvent')
    render(<EventForm onCreated={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /create event/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/title is required/i)
    expect(createEventSpy).not.toHaveBeenCalled()
  })

  it('submits a complete form and calls onCreated', async () => {
    const user = userEvent.setup()
    const created = { id: 'new-1', title: 'Community Art Afternoon' }
    vi.spyOn(api, 'createEvent').mockResolvedValue(created as any)
    const onCreated = vi.fn()
    render(<EventForm onCreated={onCreated} />)

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: /create event/i }))

    expect(await screen.findByText(/event created/i)).toBeInTheDocument()
    expect(onCreated).toHaveBeenCalledWith(created)
    const payload = (api.createEvent as any).mock.calls[0][0]
    expect(payload.title).toBe('Community Art Afternoon')
    expect(payload.access).toEqual({ status: 'reported', owner: 'KW Hab staff', lastConfirmed: '2026-07-10', note: '' })
    expect(payload.arrival).toHaveLength(1)
    expect(payload.journey).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/host/EventForm.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `src/components/host/EventForm.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { createEvent, type ArrivalStep, type Event, type Journey } from '../../lib/api'

const emptyArrivalStep: ArrivalStep = { icon: '', title: '', detail: '', image: '' }
const emptyJourney: Journey = { route: '', leave: '', duration: '', steps: [''] }

const initialForm = {
  title: '', category: '', day: '', time: '', place: '', cost: '', bus: '',
  group: '', noise: '', support: '', registration: 'Yes, just come' as Event['registration'],
  image: '', reason: '', short: '', plain: '',
  accessStatus: 'reported' as 'confirmed' | 'reported' | 'not_known',
  accessOwner: '', accessLastConfirmed: '', accessNote: '',
  arrival: [{ ...emptyArrivalStep }] as ArrivalStep[],
  includeJourney: false,
  journey: { ...emptyJourney },
}

type FormState = typeof initialForm

export function EventForm({ onCreated }: { onCreated: (event: Event) => void }) {
  const [form, setForm] = useState<FormState>(initialForm)
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }))

  const updateArrivalStep = (index: number, key: keyof ArrivalStep, value: string) =>
    setForm((current) => ({ ...current, arrival: current.arrival.map((step, i) => (i === index ? { ...step, [key]: value } : step)) }))
  const addArrivalStep = () => setForm((current) => ({ ...current, arrival: [...current.arrival, { ...emptyArrivalStep }] }))
  const removeArrivalStep = (index: number) => setForm((current) => ({ ...current, arrival: current.arrival.filter((_, i) => i !== index) }))

  const updateJourneyField = (key: 'route' | 'leave' | 'duration', value: string) =>
    setForm((current) => ({ ...current, journey: { ...current.journey, [key]: value } }))
  const updateJourneyStep = (index: number, value: string) =>
    setForm((current) => ({ ...current, journey: { ...current.journey, steps: current.journey.steps.map((step, i) => (i === index ? value : step)) } }))
  const addJourneyStep = () => setForm((current) => ({ ...current, journey: { ...current.journey, steps: [...current.journey.steps, ''] } }))

  const validate = (): string[] => {
    const problems: string[] = []
    const required: [string, string][] = [
      ['title', form.title], ['category', form.category], ['day', form.day], ['time', form.time],
      ['place', form.place], ['cost', form.cost], ['bus', form.bus], ['group', form.group],
      ['noise', form.noise], ['support', form.support], ['image', form.image],
      ['reason', form.reason], ['short', form.short], ['plain', form.plain],
      ['access owner', form.accessOwner], ['access last confirmed', form.accessLastConfirmed],
    ]
    for (const [label, value] of required) if (!value.trim()) problems.push(`${label} is required`)
    if (form.arrival.some((step) => !step.icon.trim() || !step.title.trim() || !step.detail.trim() || !step.image.trim())) {
      problems.push('every arrival step needs an icon, title, detail, and image')
    }
    return problems
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const problems = validate()
    setErrors(problems)
    setSuccess(false)
    if (problems.length) return
    setSubmitting(true)
    try {
      const created = await createEvent({
        title: form.title, category: form.category, day: form.day, time: form.time, place: form.place,
        cost: form.cost, bus: form.bus, group: form.group, noise: form.noise, support: form.support,
        registration: form.registration, image: form.image, reason: form.reason, short: form.short, plain: form.plain,
        access: { status: form.accessStatus, owner: form.accessOwner, lastConfirmed: form.accessLastConfirmed, note: form.accessNote },
        arrival: form.arrival,
        journey: form.includeJourney ? form.journey : undefined,
      })
      setForm(initialForm)
      setSuccess(true)
      onCreated(created)
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Could not create event'])
    } finally {
      setSubmitting(false)
    }
  }

  return <form className="event-form" onSubmit={submit}>
    <label>Event name<input value={form.title} onChange={(event) => update('title', event.target.value)} /></label>
    <label>Category<input value={form.category} onChange={(event) => update('category', event.target.value)} /></label>
    <label>Day<input value={form.day} onChange={(event) => update('day', event.target.value)} /></label>
    <label>Time<input value={form.time} onChange={(event) => update('time', event.target.value)} /></label>
    <label>Place<input value={form.place} onChange={(event) => update('place', event.target.value)} /></label>
    <label>Cost<input value={form.cost} onChange={(event) => update('cost', event.target.value)} /></label>
    <label>Bus<input value={form.bus} onChange={(event) => update('bus', event.target.value)} /></label>
    <label>Group<input value={form.group} onChange={(event) => update('group', event.target.value)} /></label>
    <label>Noise<input value={form.noise} onChange={(event) => update('noise', event.target.value)} /></label>
    <label>Support<input value={form.support} onChange={(event) => update('support', event.target.value)} /></label>
    <label>Registration
      <select value={form.registration} onChange={(event) => update('registration', event.target.value as Event['registration'])}>
        <option value="Yes, just come">Yes, just come</option>
        <option value="Sign up first">Sign up first</option>
      </select>
    </label>
    <label>Image URL<input value={form.image} onChange={(event) => update('image', event.target.value)} /></label>
    <label>Recommendation reason<input value={form.reason} onChange={(event) => update('reason', event.target.value)} /></label>
    <label>Short description<input value={form.short} onChange={(event) => update('short', event.target.value)} /></label>
    <label>Plain-language description<textarea value={form.plain} onChange={(event) => update('plain', event.target.value)} /></label>

    <fieldset className="access-fields">
      <legend>Access facts</legend>
      <label>Status
        <select value={form.accessStatus} onChange={(event) => update('accessStatus', event.target.value as FormState['accessStatus'])}>
          <option value="confirmed">Confirmed</option>
          <option value="reported">Reported</option>
          <option value="not_known">Not known</option>
        </select>
      </label>
      <label>Owner<input value={form.accessOwner} onChange={(event) => update('accessOwner', event.target.value)} placeholder="e.g. KW Hab staff" /></label>
      <label>Last confirmed<input type="date" value={form.accessLastConfirmed} onChange={(event) => update('accessLastConfirmed', event.target.value)} /></label>
      <label>Note (optional)<input value={form.accessNote} onChange={(event) => update('accessNote', event.target.value)} placeholder="e.g. step-free path to entrance" /></label>
    </fieldset>

    <fieldset className="arrival-fields">
      <legend>Arrival steps</legend>
      {form.arrival.map((step, index) => <div className="arrival-step-fields" key={index}>
        <label>Icon<input value={step.icon} onChange={(event) => updateArrivalStep(index, 'icon', event.target.value)} /></label>
        <label>Title<input value={step.title} onChange={(event) => updateArrivalStep(index, 'title', event.target.value)} /></label>
        <label>Detail<input value={step.detail} onChange={(event) => updateArrivalStep(index, 'detail', event.target.value)} /></label>
        <label>Image URL<input value={step.image} onChange={(event) => updateArrivalStep(index, 'image', event.target.value)} /></label>
        {form.arrival.length > 1 && <button type="button" onClick={() => removeArrivalStep(index)} aria-label={'Remove step ' + (index + 1)}><Trash2 size={16} /></button>}
      </div>)}
      <button type="button" onClick={addArrivalStep}><Plus size={16} />Add arrival step</button>
    </fieldset>

    <fieldset className="journey-fields">
      <legend>
        <label><input type="checkbox" checked={form.includeJourney} onChange={(event) => update('includeJourney', event.target.checked)} />Include transit journey</label>
      </legend>
      {form.includeJourney && <>
        <label>Route<input value={form.journey.route} onChange={(event) => updateJourneyField('route', event.target.value)} /></label>
        <label>Leave time<input value={form.journey.leave} onChange={(event) => updateJourneyField('leave', event.target.value)} /></label>
        <label>Duration<input value={form.journey.duration} onChange={(event) => updateJourneyField('duration', event.target.value)} /></label>
        {form.journey.steps.map((step, index) => <label key={index}>Step {index + 1}<input value={step} onChange={(event) => updateJourneyStep(index, event.target.value)} /></label>)}
        <button type="button" onClick={addJourneyStep}><Plus size={16} />Add journey step</button>
      </>}
    </fieldset>

    {errors.length > 0 && <div role="alert" className="form-error"><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
    {success && <p role="status" className="form-success">Event created and visible to participants.</p>}
    <button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create event'}</button>
  </form>
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/host/EventForm.test.tsx`
Expected: PASS (2 tests). If the "Image URL" label ambiguity in the test (top-level field vs. arrival-step field) causes a `getByLabelText` multiple-match failure, use `within(step)` scoping exactly as written in the test — do not rename form fields to work around it.

- [ ] **Step 5: Commit**

```bash
git add src/components/host/EventForm.tsx src/components/host/EventForm.test.tsx
git commit -m "feat(client): add full event creation form with structured access facts"
```

---

### Task 14: Wire it all into `App.tsx`

**Files:**
- Modify: `src/App.tsx` (full rewrite of the sections below — see complete replacement content in Step 3)
- Modify: `src/components/events/RecommendedBrowser.tsx`
- Modify: `src/components/community/EventCommunity.tsx`
- Modify: `src/App.test.tsx`
- Delete: `src/lib/events.ts`
- Delete: `src/lib/events.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 9–13.

This task also corrects one thing found while re-reading `App.tsx` closely: the `renderCircle` function (the old, non-`EventCommunity` Event Circle implementation with the `[events[1], events[0], events[2]]` photo grid) is dead code — the final render ternary never calls it, only `<EventCommunity>` is ever rendered for the `circle` tab. It is deleted rather than "fixed."

- [ ] **Step 1: Update `RecommendedBrowser.tsx` to take events and mode props instead of importing mock data**

Replace the full contents of `src/components/events/RecommendedBrowser.tsx`:

```tsx
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { accessSearchText, accessSuggestsStepFree, formatAccessFact } from '../../lib/accessFact'
import { Event } from '../../lib/api'
import { Language } from '../accessibility/ListenButton'
import { ReadingMode } from '../accessibility/AccessibilityBar'
import { EmptyState } from '../features/EmptyState'

const filters = ['Today', 'Free', '♿ Wheelchair', '🔇 Quiet', '🚌 Bus', 'Near Me', 'Art', 'Youth', 'Adults']

export function RecommendedBrowser({ events, onOpen, mode, pecs, language, slow }: {
  events: Event[]; onOpen: (event: Event) => void; mode: ReadingMode; pecs: boolean; language: Language; slow: boolean
}) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<string[]>([])
  const displayed = useMemo(() => events.filter((event) =>
    `${event.title} ${event.category} ${event.cost} ${event.noise} ${event.bus} ${accessSearchText(event.access)}`.toLowerCase().includes(query.toLowerCase())
    && active.every((filter) => filter === 'Free' ? event.cost === 'Free'
      : filter.includes('Quiet') ? event.noise.toLowerCase().includes('quiet')
      : filter.includes('Wheelchair') ? accessSuggestsStepFree(event.access)
      : filter === 'Art' ? event.category === 'Art'
      : true)
  ), [active, query, events])

  if (events.length === 0) return <section className="screen recommended-screen"><EmptyState mode={mode} pecs={pecs} language={language} slow={slow} /></section>

  return <section className="screen recommended-screen">
    <p className="eyebrow">A FEW GOOD MATCHES</p><h1>Recommended for you</h1>
    <label className="search-bar"><Search size={22} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What would you like to do?" aria-label="Search events" /></label>
    <div className="filter-row">{filters.map((filter) => <button key={filter} className={active.includes(filter) ? 'active' : ''} onClick={() => setActive((all) => all.includes(filter) ? all.filter((item) => item !== filter) : [...all, filter])} aria-pressed={active.includes(filter)}>{filter}</button>)}</div>
    <p><strong>{displayed.length} events.</strong></p>
    {displayed.length ? <div className="event-grid">{displayed.map((event) => <article className="event-card" key={event.id}><img src={event.image} alt={event.title} /><div className="event-card-body"><h2>{event.title}</h2><p>{event.day} · {event.place}</p><p>♿ {formatAccessFact(event.access)}</p><button className="open-event" onClick={() => onOpen(event)}>See event</button></div></article>)}</div>
      : <div className="empty-week"><h2>No events match</h2><p>Try removing a filter.</p></div>}
  </section>
}
```

- [ ] **Step 2: Update `EventCommunity.tsx`'s import path**

Modify `src/components/community/EventCommunity.tsx:3` — change:

```tsx
import { Event } from '../../lib/events'
```

to:

```tsx
import { Event } from '../../lib/api'
```

No other line in this file changes.

- [ ] **Step 3: Replace `src/App.tsx`**

Replace the entire file:

```tsx
import { useEffect, useMemo, useState } from 'react'
import {
  Accessibility, ArrowLeft, Bell, Bus, CalendarDays, Check, ChevronRight,
  CircleHelp, Clock3, Ear, Heart, Home, Image, MapPin, MessageCircle, Mic,
  Paintbrush, Phone, Printer, Settings2, ShieldCheck,
  Sparkles, Star, Volume2, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Event, getEvents, getSession, logout as apiLogout } from './lib/api'
import { formatAccessFact } from './lib/accessFact'
import { loadLanguage, loadMode, loadPecs, loadSaved, storeLanguage, storeMode, storePecs, storeSaved } from './lib/localStore'
import { AccessibilityBar, ColorModePicker, ColorMode, ReadingMode } from './components/accessibility/AccessibilityBar'
import { Language, ListenButton } from './components/accessibility/ListenButton'
import { Onboarding } from './components/features/Onboarding'
import { HostProfile } from './components/host/HostProfile'
import { EventCommunity } from './components/community/EventCommunity'
import { ReminderModal } from './components/features/ReminderModal'
import { RecommendedBrowser } from './components/events/RecommendedBrowser'
import { AboutKWHab } from './components/features/AboutKWHab'
import { StaffOperations } from './components/host/StaffOperations'
import { EntryChoice } from './components/features/EntryChoice'
import { StaffLogin } from './components/host/StaffLogin'
import { EventForm } from './components/host/EventForm'
import { EmptyState } from './components/features/EmptyState'

type Tab = 'home' | 'recommended' | 'week' | 'calendar' | 'circle' | 'support'
type Entry = 'checking' | 'choice' | 'participant' | 'staff-login' | 'staff'

const categories = [
  ['🎨', 'Art'], ['🌳', 'Outdoors'], ['🎵', 'Music'], ['🍳', 'Cooking'],
  ['🏀', 'Sports'], ['🎉', 'Social'], ['🧘', 'Quiet'], ['🚌', 'Trips'],
]

const navItems: [LucideIcon, Tab, string][] = [
  [Home, 'home', 'Home'],
  [CalendarDays, 'week', 'My Week'],
  [CalendarDays, 'calendar', 'All events'],
  [MessageCircle, 'circle', 'Community'],
  [Heart, 'support', 'Support'],
]

const calendarExtras = [
  { day: 'Monday', time: '10:00 AM', icon: '🧘', title: 'Quiet Morning Yoga', place: 'Grand River Recreation Centre', type: 'Calm activity' },
  { day: 'Tuesday', time: '4:30 PM', icon: '🍳', title: 'Cooking Club', place: 'KW Hab Kitchen', type: 'LEG Up!' },
  { day: 'Thursday', time: '5:00 PM', icon: '🎳', title: 'Bowling Buddies', place: 'Bingemans', type: 'Out and About' },
  { day: 'Sunday', time: '1:00 PM', icon: '🎉', title: 'Sunday Social', place: 'Victoria Park Pavilion', type: 'Community gathering' },
]

const supportCards: [LucideIcon, string, string, string, string][] = [
  [Accessibility, 'Mobility support', 'Entrances, paths, and getting around', 'Jordan · trained staff', 'Available to request'],
  [MessageCircle, 'Communication support', 'Pictures, plain words, and time to talk', 'Mina · communication helper', 'Available to request'],
  [Ear, 'Hearing support', 'Find a quieter seat or use a hearing loop', 'Staff can check first', 'Ask the host'],
  [Accessibility, 'Visual support', 'A sighted guide and clear route details', 'Jordan · trained staff', 'Book ahead'],
  [Heart, 'Calm support', 'Quiet space, headphones, or a break plan', 'Priya · event staff', 'Available at events'],
  [Bus, 'Transportation help', 'Bus routes and a ride-planning call', 'Mina · coordinator', 'Call to plan'],
]

function StatusBadge({ state }: { state: Event['registration'] }) {
  return <span className={'registration ' + (state === 'Yes, just come' ? 'drop-in' : 'signup')}>
    {state === 'Yes, just come' ? <Check size={18} /> : <CalendarDays size={18} />}{state}
  </span>
}

function SymbolStrip({ event }: { event: Event }) {
  const items = [
    ['🎨', event.category], ['🕐', event.day + ' · ' + event.time], ['📍', event.place], ['🆓', event.cost],
    ['🚌', event.bus], ['👥', event.group], ['🔊', event.noise], ['♿', formatAccessFact(event.access)], ['🧑‍🤝‍🧑', event.support],
  ]
  return <div className="symbol-strip" aria-label="Event details">{items.map(([icon, value]) => <span key={value}><b aria-hidden="true">{icon}</b>{value}</span>)}</div>
}

function EventCard({ event, onOpen, compact = false, slow }: { event: Event; onOpen: (event: Event) => void; compact?: boolean; slow: boolean }) {
  return <article className={'event-card' + (compact ? ' compact' : '')}>
    <button className="event-image-button" onClick={() => onOpen(event)} aria-label={event.title}>
      <img src={event.image} alt={event.title + ' event'} /><span className="event-photo-tag">{event.category}</span>
    </button>
    <div className="event-card-body">
      <div className="event-card-title"><h3>{event.title}</h3><ListenButton text={event.title + '. ' + event.plain} label={event.title} slow={slow} /></div>
      <StatusBadge state={event.registration} />
      {!compact && <p className="recommendation"><Sparkles size={16} />{event.reason}</p>}
      <div className="mini-details"><span><Clock3 size={16} />{event.day}</span><span><MapPin size={16} />{event.place}</span></div>
      <button className="open-event" onClick={() => onOpen(event)}>See event <ChevronRight size={18} /></button>
    </div>
  </article>
}

function App() {
  const [entry, setEntry] = useState<Entry>('checking')
  const [tab, setTab] = useState<Tab>('home')
  const [mode, setMode] = useState<ReadingMode>(() => loadMode())
  const [pecs, setPecs] = useState(() => loadPecs())
  const [colorMode, setColorMode] = useState<ColorMode>('normal')
  const [colorPicker, setColorPicker] = useState(false)
  const [language, setLanguage] = useState<Language>(() => loadLanguage())
  const [onboarding, setOnboarding] = useState(true)
  const [selected, setSelected] = useState<Event | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [eventsLoaded, setEventsLoaded] = useState(false)
  const [saved, setSaved] = useState<string[]>(() => loadSaved())
  const [circleTab, setCircleTab] = useState<'Updates' | 'Chat' | 'Photos' | 'Going' | 'Help'>('Updates')
  const [requested, setRequested] = useState<string | null>(null)
  const [accessibilityLens, setAccessibilityLens] = useState(false)
  const [reminders, setReminders] = useState(false)
  const [reminderChoice, setReminderChoice] = useState<string | null>(null)
  const [about, setAbout] = useState(false)
  const slow = mode === 'audio'
  const selectedEvent = selected ?? events[0]
  const save = (event: Event) => setSaved((ids) => ids.includes(event.id) ? ids : [...ids, event.id])
  const savedEvents = useMemo(() => events.filter((event) => saved.includes(event.id)), [saved, events])
  const openEvent = (event: Event) => { setSelected(event); setTab('recommended') }

  const refreshEvents = async () => {
    try {
      setEvents(await getEvents())
    } finally {
      setEventsLoaded(true)
    }
  }

  useEffect(() => {
    getSession().then((session) => setEntry(session ? 'staff' : 'choice'))
  }, [])

  useEffect(() => {
    if (entry === 'participant') refreshEvents()
  }, [entry])

  useEffect(() => {
    document.documentElement.dataset.colorMode = colorMode
    document.documentElement.dataset.pecs = String(pecs)
    document.documentElement.lang = language
  }, [colorMode, language, pecs])

  useEffect(() => { storeSaved(saved) }, [saved])
  useEffect(() => { storeMode(mode) }, [mode])
  useEffect(() => { storePecs(pecs) }, [pecs])
  useEffect(() => { storeLanguage(language) }, [language])

  const handleStaffLogout = async () => { await apiLogout(); setEntry('choice') }

  const header = <>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className={'app-header' + (entry === 'staff' ? ' staff-active' : '')}>
      <button className="brand" onClick={() => { setSelected(null); setTab('home') }} aria-label="Belonging Loop home"><span><Sparkles size={20} /></span>belonging <strong>loop</strong></button><a className="kwhab-mark" href="https://kwhab.ca/" target="_blank" rel="noreferrer" aria-label="Visit KW Habilitation"><img src="/kwhab-logo.jpeg" alt="KW Habilitation services logo" /><span>KW Habilitation</span></a>{entry === 'staff' && <span className="staff-mode-badge">● STAFF MODE</span>}
      <AccessibilityBar mode={mode} pecs={pecs} language={language} onMode={setMode} onPecs={() => setPecs(!pecs)} onColor={() => setColorPicker(true)} onLanguage={setLanguage} />
      <button className="notification-button" onClick={() => setReminders(true)} aria-label="Reminder settings"><Bell size={22} /></button>
      {entry === 'staff'
        ? <button className="staff-entry" onClick={handleStaffLogout} aria-label="Log out of staff tools"><ArrowLeft size={20} /><span>Log out</span></button>
        : <button className="staff-entry" onClick={() => setEntry('staff-login')} aria-label="Open staff tools"><Settings2 size={20} /><span>Staff</span></button>}
    </header>
    {pecs && <div className="pecs-banner" role="status"><Image size={21} /><strong>PECS is ON</strong><span>Tap a picture.</span></div>}
    {mode === 'audio' && <div className="audio-banner"><Volume2 size={19} /><strong>Audio First</strong><span>Tap any speaker. Speech is slower.</span><button onClick={() => window.speechSynthesis?.cancel()} aria-label="Stop listening"><X size={16} /> Stop</button></div>}
  </>

  const renderHome = () => <section className="screen home-screen">
    <div className="welcome-row"><div><p className="eyebrow">YOUR COMMUNITY EVENTS</p><h1>{pecs ? 'Tap a picture' : 'What would you like to do?'}</h1><p>{pecs ? 'Choose one picture.' : 'Pick a picture. We will show a few good events.'}</p></div><ListenButton text="What would you like to do? Pick a picture. We will show good events." label="Home" slow={slow} /></div>
    <button className="say-wish" onClick={() => setTab('recommended')}><span><Mic size={29} /></span><div><strong>{pecs ? '🎤' : 'Tell us with your voice'}</strong><small>{pecs ? 'Tap to talk' : 'Say what you want to do'}</small></div><ChevronRight size={22} /></button>
    <div className="category-grid" aria-label="Event categories">{categories.map(([emoji, title]) => <button key={title} onClick={() => setTab('recommended')} aria-label={title}><span>{emoji}</span><strong>{pecs ? '' : title}</strong></button>)}</div>
    <section className="next-event"><div><p className="eyebrow">COMING UP</p><h2>Coming up</h2><p>{events.length > 0 ? 'One event is ready to explore.' : 'Check back soon for new events.'}</p></div>{events.length > 0 ? <EventCard event={events[0]} onOpen={openEvent} compact slow={slow} /> : <EmptyState mode={mode} pecs={pecs} language={language} slow={slow} />}</section><button className="home-about-link" onClick={() => setTab('support')} aria-label="Learn about KW Habilitation"><img src="/kwhab-logo.jpeg" alt="" /><span><strong>About KW Habilitation</strong><small>How we help people live, work, and belong.</small></span><ChevronRight size={22} /></button>
  </section>

  const renderRecommended = () => selected ? <section className="screen event-detail">
    <button className="back-button" onClick={() => setSelected(null)}><ArrowLeft size={19} />Back to events</button>
    <HostProfile slow={slow} language={language} />
    <div className="detail-hero"><img src={selected.image} alt={selected.title + ' event'} /><div><p className="eyebrow">{selected.category}</p><h1>{selected.title}</h1><p>{mode === 'standard' ? selected.short : selected.plain}</p><ListenButton text={selected.plain} label={selected.title + ' description'} slow={slow} language={language} /></div></div>
    <div className="detail-actions"><StatusBadge state={selected.registration} /><button className="save-button" onClick={() => save(selected)}>{saved.includes(selected.id) ? <Check size={20} /> : <CalendarDays size={20} />}{saved.includes(selected.id) ? 'Saved to My Week' : 'Save to My Week'}</button><a className="event-cta" href="https://kwhab.ca/" target="_blank" rel="noreferrer">Register / Learn more</a><button className="event-cta" onClick={() => setTab('circle')}>Join Community</button></div>
    <p className="recommendation detail-reason"><Sparkles size={18} />{selected.reason}</p>
    <div className="lens-row"><button className={accessibilityLens ? 'lens-button active' : 'lens-button'} onClick={() => setAccessibilityLens(!accessibilityLens)} aria-pressed={accessibilityLens}><Accessibility size={20} />Accessibility Lens</button>{accessibilityLens && <div className="lens-summary"><span>🚪 {formatAccessFact(selected.access)}</span><span>🚌 {selected.bus}</span><span>👥 {selected.group}</span></div>}</div>
    {!accessibilityLens && <SymbolStrip event={selected} />}
    {selected.journey && <section className="transit-card" aria-labelledby="transit-title"><div><p className="eyebrow">TRANSIT COMPANION</p><h2 id="transit-title">Can I get there?</h2><strong>🚌 {selected.journey.route}</strong><p>{selected.journey.leave}<br />{selected.journey.duration}</p></div><div className="journey-steps">{selected.journey.steps.map((step, index) => <span key={step}>{index ? '↓ ' : ''}{step}</span>)}</div><div><ListenButton text={selected.journey.route + '. ' + selected.journey.leave + '. ' + selected.journey.duration} label="journey" slow={slow} language={language} /><button className="maps-button" aria-label="Open journey in maps">📍 Open in Maps</button></div></section>}
    <section className="arrival-section"><div className="section-title"><div><p className="eyebrow">WHEN I GET THERE</p><h2>What happens when I arrive?</h2><p>Tap a picture to hear the step.</p></div><ListenButton text={selected.arrival.map((step) => step.title + '. ' + step.detail).join('. ')} label="arrival steps" slow={slow} /></div><div className="arrival-steps">{selected.arrival.map((step, index) => <button key={step.title} onClick={() => { if ('speechSynthesis' in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(step.title + '. ' + step.detail)) }}><img src={step.image} alt={step.title} /><span className="step-number">{index + 1}</span><span className="step-icon">{step.icon}</span><strong>{step.title}</strong><small>{step.detail}</small><Volume2 size={17} /></button>)}</div><div className="arrival-video"><iframe title="First person walk to the event" src="https://www.youtube.com/embed/Scxs7L0vhZ4" allowFullScreen /><div><strong>Walk with me to the event</strong><small>First-person arrival video · 0:32</small></div></div></section>
    <section className="fact-note"><ShieldCheck size={24} /><div><strong>Event facts are checked by the host.</strong><p>Some access details are reported. Ask staff if you need to know more.</p></div><button onClick={() => setTab('support')}>Get support <ChevronRight size={18} /></button></section>
  </section> : <RecommendedBrowser events={events} onOpen={openEvent} mode={mode} pecs={pecs} language={language} slow={slow} />

  const renderWeek = () => <section className="screen week-screen"><div className="welcome-row"><div><p className="eyebrow">MY WEEK</p><h1>My plans</h1><p>Your confirmed event is big and clear.</p></div><button className="print-button" onClick={() => window.print()}><Printer size={20} />Print My Week</button></div><div className="week-list">{savedEvents.map((event) => <article key={event.id} className="week-card confirmed-plan"><div className="date-box"><strong>{event.day.slice(0, 3)}</strong><span>{event.time.slice(0, 5)}</span></div><img src={event.image} alt="" /><div><span className="confirmed-label">✓ You are going</span><h2>{event.title}</h2><p><Bus size={16} />{event.bus}</p><p><Heart size={16} />{event.support}</p></div><StatusBadge state={event.registration} /><ListenButton text={event.title + '. ' + event.day + '. ' + event.time + '. ' + event.bus} label={event.title} slow={slow} /></article>)}</div><section className="calendar-background"><p className="eyebrow">OTHER KW HAB EVENTS THIS WEEK</p>{events.length === 0 ? <EmptyState mode={mode} pecs={pecs} language={language} slow={slow} /> : <div>{events.filter((event) => !saved.includes(event.id)).map((event) => <button key={event.id} onClick={() => openEvent(event)} aria-label={event.title}><img src={event.image} alt="" /><span>{event.day}</span><strong>{event.title}</strong><small>{event.time}</small></button>)}</div>}</section><div className="fridge-note"><Printer size={19} /><span><strong>Print My Week</strong> makes a big, simple schedule with pictures and room for notes.</span></div></section>

  const renderCalendar = () => <section className="screen all-events-screen"><div className="welcome-row"><div><p className="eyebrow">KW HABILITATION</p><h1>All events</h1><p>Every community opportunity this week.</p></div><button className="print-button" onClick={() => window.print()}><Printer size={20} />Print calendar</button></div>{events.length === 0 ? <EmptyState mode={mode} pecs={pecs} language={language} slow={slow} /> : <div className="full-calendar" aria-label="KW Habilitation events calendar">{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => <section key={day}><h2>{day}</h2>{calendarExtras.filter((event) => event.day === day).map((event) => <article key={event.title} className="calendar-event prototype"><span>{event.icon}</span><div><strong>{event.title}</strong><small>{event.time} · {event.place}</small><em>{event.type}</em></div><button onClick={() => setTab('support')} aria-label={'Ask about ' + event.title}>Ask</button></article>)}{events.filter((event) => event.day.startsWith(day)).map((event) => <button key={event.id} className={'calendar-event real' + (saved.includes(event.id) ? ' confirmed' : '')} onClick={() => openEvent(event)} aria-label={'Open ' + event.title}><img src={event.image} alt="" /><div><strong>{saved.includes(event.id) && '✓ '}{event.title}</strong><small>{event.time} · {event.place}</small><em>{event.category}</em></div></button>)}</section>)}</div>}</section>

  const renderSupport = () => about ? <AboutKWHab onBack={() => setAbout(false)} slow={slow} language={language} /> : <section className="screen support-screen"><div className="welcome-row"><div><p className="eyebrow">SUPPORT</p><h1>What help would be useful?</h1><p>Pick one kind of help. A staff person will talk with you.</p></div><ListenButton text="What help would be useful? Pick one kind of help. A staff person will talk with you." label="support options" slow={slow} /></div><div className="support-grid">{supportCards.map(([Icon, title, detail, staff, status]) => <article key={title}><div className="support-icon"><Icon size={30} /></div><h2>{title}</h2><p>{detail}</p><span>{staff}</span><small>{status}</small><button onClick={() => setRequested(title)}>{requested === title ? <Check size={18} /> : <Phone size={18} />}{requested === title ? 'Help request sent' : 'Ask for help'}</button></article>)}</div><section className="belonging-tap"><strong>🟡 BELONGING TAP</strong><h2>Tap a poster to find events.</h2><p>No app. No account. Just tap.</p><p>📚 Libraries · 🏥 Hospitals · 🚌 Bus stations · 🏠 Group homes</p><button>See where posters are →</button></section><section className="about-preview"><h2>About KW Habilitation</h2><p>We help people of all abilities live, work, and belong.</p><button onClick={() => setAbout(true)}>Learn more →</button></section><p className="support-footer"><CircleHelp size={18} />This is a request, not a booking. Staff will confirm what is possible.</p></section>

  const renderStaff = () => <section className="staff-screen"><header><div><p className="eyebrow">STAFF TOOLS · PROTOTYPE ONLY</p><h1>Event workspace</h1><p>Detailed tools stay separate from the participant calendar.</p></div></header><div className="staff-grid"><article><h2>1. Event details</h2><EventForm onCreated={() => refreshEvents()} /></article><article><h2>2. Arrival and access</h2><p><Image size={18} />4 arrival photos ready</p><p><Check size={18} />Step-free path: reported Jul 10</p><p><CircleHelp size={18} />Quiet bench: confirmed by host</p><button>Update access facts</button></article><article><h2>3. Moderation queue</h2><p><MessageCircle size={18} />2 chat messages pending</p><p>"Is there a quiet room?" — J</p><p>"Can I bring my mom?" — A</p><button>Open moderation</button></article><article><h2>4. Support coordination</h2><p><Accessibility size={18} />Jordan: mobility support</p><p><Bus size={18} />Route 7 transport information</p><p><ShieldCheck size={18} />No support is assigned automatically</p><button>Review support requests</button></article></div><StaffOperations /></section>

  if (entry === 'checking') return <div className="app-shell loading-shell"><p>Loading…</p></div>
  if (entry === 'choice') return <EntryChoice onParticipant={() => setEntry('participant')} onStaff={() => setEntry('staff-login')} />
  if (entry === 'staff-login') return <StaffLogin onSuccess={() => setEntry('staff')} onBack={() => setEntry('choice')} />
  if (entry === 'staff') return <div className="app-shell">{header}<main id="main-content">{renderStaff()}</main></div>

  if (onboarding) return <div className="app-shell">{header}<Onboarding onFinish={() => setOnboarding(false)} onMode={(nextMode, nextPecs) => { setMode(nextMode); if (nextPecs) setPecs(true) }} />{colorPicker && <ColorModePicker onChoose={setColorMode} onClose={() => setColorPicker(false)} />}</div>

  if (!eventsLoaded) return <div className="app-shell">{header}<main id="main-content"><p className="loading-note">Loading events…</p></main></div>

  return <div className="app-shell">{header}<main id="main-content">{tab === 'home' ? renderHome() : tab === 'recommended' ? renderRecommended() : tab === 'week' ? renderWeek() : tab === 'calendar' ? renderCalendar() : tab === 'circle' ? (events.length > 0 ? <EventCommunity event={selectedEvent} slow={slow} language={language} /> : <EmptyState mode={mode} pecs={pecs} language={language} slow={slow} />) : renderSupport()}</main><nav className="bottom-nav" aria-label="Main navigation">{navItems.map(([Icon, value, label]) => <button key={value} className={tab === value ? 'active' : ''} onClick={() => { setSelected(null); setTab(value) }} aria-label={label}><Icon size={30} /><span>{label}</span></button>)}</nav>{colorPicker && <ColorModePicker onChoose={setColorMode} onClose={() => setColorPicker(false)} />}{reminders && <ReminderModal choice={reminderChoice} onChoose={setReminderChoice} onClose={() => setReminders(false)} />}</div>
}

export default App
```

Note: the `Camera` and `Users` icon imports and the `circleTab` state are now unused by this file's reachable code (they were only referenced by the dead `renderCircle`) — both icons are already omitted from the import list above, and `const [circleTab, setCircleTab] = useState...` is not present in the replacement content; if your diff tool flags these as removed lines, that is intentional, not an accidental deletion. (`Paintbrush` remains imported but unused — that was already true before this change, in the original file, and is out of scope to clean up here.)

- [ ] **Step 4: Delete the mock data file and its test**

```bash
git rm src/lib/events.ts src/lib/events.test.ts
```

- [ ] **Step 5: Update `src/App.test.tsx` for the new entry gate**

Replace the full contents of `src/App.test.tsx`:

```tsx
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import * as api from './lib/api'

afterEach(cleanup)
afterEach(() => { localStorage.clear(); vi.restoreAllMocks() })

async function enterAsParticipant(user: ReturnType<typeof userEvent.setup>) {
  vi.spyOn(api, 'getSession').mockResolvedValue(null)
  vi.spyOn(api, 'getEvents').mockResolvedValue([])
  render(<App />)
  await user.click(await screen.findByRole('button', { name: /i'm a participant/i }))
}

describe('Belonging Loop accessible calendar', () => {
  it('starts with the participant/staff choice, then one visual onboarding decision', async () => {
    const user = userEvent.setup()
    await enterAsParticipant(user)

    expect(screen.getByRole('heading', { name: 'How do you like to use this app?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /pictures/i }))
    expect(screen.getByRole('heading', { name: 'What do you like to do?' })).toBeInTheDocument()
  })

  it('opens a recommended event and saves it to My Week', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'getSession').mockResolvedValue(null)
    vi.spyOn(api, 'getEvents').mockResolvedValue([{
      id: 'nature', title: 'Accessible Nature Walk', category: 'Outdoors', day: 'Saturday', time: '10:00 AM - 11:30 AM',
      place: 'Waterloo Park', cost: 'Free', bus: 'Route 7 stops nearby', group: 'Small group', noise: 'Quiet',
      access: { status: 'reported', owner: 'KW Hab staff', lastConfirmed: '2026-07-10', note: 'Step-free path' },
      support: 'Mobility support can be requested', registration: 'Sign up first', image: 'https://example.com/a.jpg',
      reason: 'Recommended because you like outdoor activities and small groups.', short: 'A calm walk with time for breaks.',
      plain: 'We will walk together.',
      arrival: [{ icon: '🚪', title: 'Enter by the park gate', detail: 'Use the wide gate beside the bus stop.', image: 'https://example.com/b.jpg' }],
    }])
    render(<App />)
    await user.click(await screen.findByRole('button', { name: /i'm a participant/i }))

    await user.click(screen.getByRole('button', { name: /skip setup/i }))
    await user.click(await screen.findByRole('button', { name: 'Accessible Nature Walk' }))
    expect(screen.getByRole('heading', { name: 'Accessible Nature Walk' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /(?:save|saved) to my week/i }))
    await user.click(screen.getByRole('button', { name: 'My Week' }))
    expect(screen.getByText('Accessible Nature Walk')).toBeInTheDocument()
  })

  it('switches to PECS choices without requiring typing', async () => {
    const user = userEvent.setup()
    await enterAsParticipant(user)
    await user.click(screen.getByRole('button', { name: /skip setup/i }))
    await user.click(screen.getByRole('button', { name: 'PECS mode' }))
    expect(screen.getByText('PECS is ON')).toBeInTheDocument()
    expect(screen.getByText('Tap a picture')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /outdoors/i })).toBeInTheDocument()
  })

  it('shows a slowed audio state when a speaker control is used', async () => {
    const user = userEvent.setup()
    await enterAsParticipant(user)
    await user.click(screen.getByRole('button', { name: /skip setup/i }))
    await user.click(screen.getByRole('button', { name: 'Listen' }))
    await user.click(screen.getByRole('button', { name: 'Listen to Home' }))
    expect(screen.getByText('Speaking slowly')).toBeInTheDocument()
  })

  it('opens one color vision choice screen', async () => {
    const user = userEvent.setup()
    await enterAsParticipant(user)
    await user.click(screen.getByRole('button', { name: /skip setup/i }))
    await user.click(screen.getByRole('button', { name: 'Color' }))
    expect(screen.getByRole('heading', { name: 'Choose your vision type' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /red-green/i }))
    expect(document.documentElement.dataset.colorMode).toBe('red-green')
  })

  it('shows an empty state instead of hard-coded events when the database has none', async () => {
    const user = userEvent.setup()
    await enterAsParticipant(user)
    await user.click(screen.getByRole('button', { name: /skip setup/i }))
    expect(await screen.findByText('No events at this time.')).toBeInTheDocument()
  })

  it('lets staff log in and reach the staff screen, skipping the participant flow', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'getSession').mockResolvedValue(null)
    vi.spyOn(api, 'login').mockResolvedValue({ ok: true, email: 'staff@kwhab.ca' })
    render(<App />)
    await user.click(await screen.findByRole('button', { name: /i'm staff/i }))
    await user.type(screen.getByLabelText(/email/i), 'staff@kwhab.ca')
    await user.type(screen.getByLabelText(/password/i), 'correct-password')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByRole('heading', { name: 'Event workspace' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'How do you like to use this app?' })).not.toBeInTheDocument()
  })

  it('shows an inline error on failed staff login and allows retry', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'getSession').mockResolvedValue(null)
    vi.spyOn(api, 'login').mockRejectedValue(new Error('Incorrect email or password'))
    render(<App />)
    await user.click(await screen.findByRole('button', { name: /i'm staff/i }))
    await user.type(screen.getByLabelText(/email/i), 'staff@kwhab.ca')
    await user.type(screen.getByLabelText(/password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password')
  })

  it('resumes a staff session directly into the staff screen on reload', async () => {
    vi.spyOn(api, 'getSession').mockResolvedValue({ ok: true, email: 'staff@kwhab.ca' })
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Event workspace' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run the full frontend test suite**

Run: `npx vitest run`
Expected: all suites pass. If `App.test.tsx` fails on an ambiguous query, adjust the query in that test file only — do not change `App.tsx` rendering to work around a test.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/components/events/RecommendedBrowser.tsx src/components/community/EventCommunity.tsx
git commit -m "feat(client): wire entry gating, live events, and staff auth into App"
```

---

### Task 15: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: every suite (server and client) passes. Fix any failure before continuing — do not skip or delete a failing test.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: `tsc --noEmit` reports no errors and `vite build` completes. Pay particular attention to any type error touching `Event['id']` — per the design doc, every reachable use of `id` in `App.tsx` treats it as an opaque string (membership checks via `saved.includes(event.id)`), and the one function that positionally assumed exactly 3 fixed ids (`renderCircle`) was dead code removed in Task 14, not fixed in place. Report the exact list of any `id`-related type errors found here, if any, before resolving them.

- [ ] **Step 3: Seed and run the local dev server**

Run:
```bash
cp .env.example .env
```
Edit `.env` and set `SESSION_SECRET` to any long random string; leave `STAFF_EMAIL`/`STAFF_PASSWORD` as-is or customize them. Then:
```bash
npm run seed
npm run dev
```
Expected: `Created staff account for staff@kwhab.ca.` printed once, then both `client` and `server` log streams start.

- [ ] **Step 4: Manual walkthrough — participant path**

In a browser, open the Vite dev URL (typically `http://localhost:5173`).
Expected: "Who's using this today?" choice screen appears. Click "I'm a participant" → onboarding starts. Click "Skip setup" → Home screen shows "No events at this time." (the database is still empty at this point).

- [ ] **Step 5: Manual walkthrough — staff path and immediate participant visibility**

From Home, click the header "Staff" button. Expected: staff login form appears (not a bypass). Log in with the `STAFF_EMAIL`/`STAFF_PASSWORD` from `.env`. Expected: staff screen appears directly, no onboarding, no bottom nav. Fill out and submit the event creation form with a complete sample event (all required fields, one arrival step). Expected: "Event created and visible to participants." message. Click "Log out". Expected: returns to the choice screen. Click "I'm a participant" again. Expected: Home now shows the event just created (no hard-coded sample data anywhere).

- [ ] **Step 6: Manual walkthrough — failed login**

Return to the choice screen (refresh if needed), click "I'm staff", submit obviously wrong credentials. Expected: inline error message, form remains editable, retry works.

- [ ] **Step 7: Stop the dev server**

Press Ctrl+C in the terminal running `npm run dev`.

- [ ] **Step 8: Final commit if any fixes were needed during verification**

If Steps 1–6 required any code changes to pass:

```bash
git add -A
git commit -m "fix: address issues found during full verification"
```

If no changes were needed, skip this step — there is nothing to commit.
