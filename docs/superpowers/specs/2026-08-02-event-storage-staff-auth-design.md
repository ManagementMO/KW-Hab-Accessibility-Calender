# Event Storage, Staff Auth, and Role-Based Entry — Design

**Goal:** Move events from hard-coded mock data (`src/lib/events.ts`) into a real local database, add staff login gating a create-only staff section, and add a participant/staff entry choice — without changing existing participant-facing UX, copy, or flow logic once inside either path.

**Non-goals (explicitly out of scope for this pass):** wiring up moderation, attendance, or support-coordination staff tools; multi-organization accounts; production-grade auth infrastructure; any new recommendation/scoring logic; anything beyond event creation on the staff side.

---

## Current state (discovery)

- Stack: React 19 + Vite + TypeScript + Vitest. No router — a single `tab` state machine in `src/App.tsx`. No backend. No `localStorage` usage anywhere; `saved`, `mode`, `pecs`, `language`, and Home's wish text are plain `useState`, lost on refresh.
- The only mock data source is `src/lib/events.ts` (3 events + `recommendedEvents`, currently an alias for all 3). Consumed by `App.tsx` (Home, Recommended detail, My Week, All events/calendar, Event Circle default) and by `src/components/events/RecommendedBrowser.tsx`.
- `src/lib/belonging.ts` is a separate, currently-unused scoring utility with its own unrelated `AccessState` type (`'confirmed'|'reported'|'not-arranged'|'not-known'`). Not imported by `App.tsx` or any component. Out of scope — left untouched.
- Exact current `Event` fields (`src/lib/events.ts:1-21`):
  `id` (closed union `'nature'|'art'|'music'`), `title`, `category`, `day`, `time`, `place`, `cost`, `bus`, `group`, `noise`, `access` (free-text string), `support`, `registration` (`'Sign up first'|'Yes, just come'`), `image`, `reason`, `short`, `plain`, `arrival: {icon,title,detail,image}[]`, `journey?: {route,leave,duration,steps:string[]}`.
- The header already has an unauthenticated "Staff" button (`App.tsx:115`) that jumps straight into `renderStaff()` with zero login — the only existing staff entry point today.
- The Staff screen's "1. Event details" card (`App.tsx:149`) is a 2-field stub with a dead Save button. Cards 2-4 and `StaffOperations.tsx` are decorative scaffolding (moderation, support coordination, orgs, embed codes, fake analytics).

## Decisions made during design review

1. **`access` becomes structured**, replacing the free-text string:
   ```ts
   access: {
     status: 'confirmed' | 'reported' | 'not_known'
     owner: string        // e.g. "KW Hab staff"
     lastConfirmed: string // ISO date
     note: string          // optional free text, e.g. "step-free path to entrance"
   }
   ```
   This is the one deliberate exception to "use only fields that already exist" — CLAUDE.md's provenance model (confirmed/reported/not-known + owner + last-confirmed) doesn't exist as structured data today, only as prose (the "facts are checked by the host" note, the staff screen's mocked "Step-free path: reported Jul 10"). Every render site that currently shows `access` as a raw string is updated to phrase these four fields naturally per presentation mode, e.g. *"Step-free path to entrance — reported by KW Hab staff, last confirmed Jul 2026."* No other field is restructured.
2. **Staff Card 1 is replaced in place** with the full creation form. Cards 2-4 and `StaffOperations` are untouched.
3. **The header Staff button routes through the login gate** instead of bypassing it — the only change to the existing header's behavior.
4. **Participant preferences get real `localStorage` persistence** (new capability, not just a boundary rule): `saved`, `mode`, `pecs`, `language`, Home's wish text survive a refresh via a dedicated `src/lib/localStore.ts`, kept structurally separate from the new `src/lib/api.ts` so the boundary (nothing participant-identifying reaches the backend) is easy to verify by inspection.

## Id-union cleanup (flagged per user request)

`id` changes from the closed union `'nature'|'art'|'music'` to a generated string (`crypto.randomUUID()`). Places that only use `id` as an opaque map/membership key need no change (`App.tsx:99-100,141,143`, `RecommendedBrowser.tsx:9`). Four places assumed exactly 3 fixed, known mock events and need explicit handling:

1. `App.tsx:89` — `saved` was pre-seeded with `['nature']`. → Defaults to `[]`; no phantom pre-saved entry once `'nature'` can't match a generated id.
2. `App.tsx:125` — Home's next-event card has hardcoded copy ("Saturday morning / one calm outdoor event") pinned to `events[0]` regardless of what it actually is. → Generic copy ("Coming up / One event is ready to explore") plus an empty-state guard for zero events.
3. `App.tsx:145` — Event Circle Photos tab hardcodes `[events[1], events[0], events[2]]`, which throws below 3 events and is meaningless above 3. → `events.slice(0, 3)` in natural order; renders nothing when `events` is empty.
4. `App.tsx:98` — `selectedEvent = selected ?? events[0]` feeds the Event Circle default title; `undefined` when `events` is empty. → Circle tab renders the empty state instead of `EventCommunity` when there are zero events.

## Architecture

### Backend — `server/` (new, plain JS, no build step)

- **express** — HTTP API
- **better-sqlite3** — synchronous, file-based (`server/data.db`, gitignored). Ships prebuilt binaries for Node 22/win32; if install fails, fall back to a JSON-file store behind the identical repository interface, no other code changes.
- **bcryptjs** — pure-JS password hashing, no native compile
- **cookie-parser** — reads the session cookie
- **concurrently** (devDependency) — single `npm run dev` runs Vite + Express together

Session = signed httpOnly cookie, HMAC-SHA256 via Node's built-in `crypto`, secret from `.env`. No JWT library. `.env` (gitignored) holds `SESSION_SECRET`, `STAFF_EMAIL`, `STAFF_PASSWORD`, `PORT`; loaded via Node's built-in `--env-file` flag, no `dotenv` dependency. `.env.example` checked in with placeholder values.

Vite proxies `/api/*` to Express in dev, so the browser sees one origin.

### Schema

```
events: id, title, category, day, time, place, cost, bus, group_label, noise,
        access_status, access_owner, access_last_confirmed, access_note,
        support, registration, image, reason, short, plain,
        arrival (JSON text), journey (nullable JSON text), created_at

staff:  id, email (unique), password_hash, created_at
```

`group_label` (SQL reserves `group`) and the four `access_*` columns map back to `Event`'s `group` and nested `access` object in a small row↔`Event` mapping layer. `arrival`/`journey` are stored as JSON text, parsed on read.

`npm run seed` creates one staff account from `.env`, idempotent.

### API

- `POST /api/auth/login` `{email,password}` → session cookie or 401 + inline error
- `POST /api/auth/logout` → clears cookie
- `GET /api/auth/me` → resumes a staff session silently after refresh
- `GET /api/events` → public, returns all events in `Event` shape
- `POST /api/events` → requires valid session; required fields validated server-side (mirroring client-side validation) before insert

### Entry gate & routing (`App.tsx`)

New top-level state `entry: 'choice' | 'participant' | 'staff-login' | 'staff'`, independent of the existing `tab` state. On mount, `GET /api/auth/me` resumes a valid staff session directly into `staff`; otherwise shows the choice screen, styled to match the existing `.decision-screen` pattern from `Onboarding`.

- **Participant** → existing `onboarding` → `app-shell` flow, unchanged.
- **Staff** (via choice screen or the header button) → login form → success renders `renderStaff()` directly, no bottom nav; failure shows inline error, retry allowed. Logout clears the cookie and returns to the choice screen.

### Staff creation form

Replaces Card 1: all `Event` fields, the four structured access inputs (status dropdown, owner text, last-confirmed date picker, optional note), a repeating add/remove UI for `arrival` steps, and an optional `journey` sub-form. Client- and server-side required-field validation. Submission is the human-approval step — no separate publish action.

### Participant data source + empty state

`src/lib/api.ts` (new) replaces the `events.ts` import everywhere; `events.ts` is deleted. A mode-aware `EmptyState` component ("No events at this time" — plain text in Easy Read, spoken via `ListenButton` in Audio mode, symbol-first in PECS) replaces empty-array cases in Home, Recommended, My Week, and All events. Events refetch on entering the participant flow and immediately after a successful staff creation.

### localStorage boundary

`src/lib/localStore.ts` owns `saved`, `mode`, `pecs`, `language`, and Home's wish text. `src/lib/api.ts` only ever talks to `/api/events` and `/api/auth/*`. The two files never import each other's storage mechanism, making the boundary auditable by inspection.

## Testing

- `events.test.ts` rewritten around the row↔`Event` mapping function (data source changed).
- New: login success/failure, staff-only event creation (unauthenticated `POST /api/events` rejected), empty-state rendering per presentation mode, structured access-fact rendering.
- `App.test.tsx`: each existing test gains one line — clicking "I'm a participant" — before its current first assertion, since a real gate now precedes onboarding. No other assertion changes; the participant flow itself is unmodified once inside.

## Non-negotiables checked

- No diagnosis fields anywhere in schema or form.
- Access facts carry status/owner/date, never a boolean "accessible" flag.
- Nothing auto-publishes; staff submission is the human step.
- No streaks, no public attendance exposure, no care-substitution language — none of this pass touches those areas.
- Registration stays an external link; not rebuilt.
- Participant preference data never reaches the backend (see localStorage boundary above).
