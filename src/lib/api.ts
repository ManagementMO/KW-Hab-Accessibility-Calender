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
  date: string
  time: string
  place: string
  cost: string
  bus: string
  group: string
  noise: string
  access: AccessFact
  support: string
  registration: 'Sign up first' | 'Yes, just come'
  registrationUrl: string
  image: string
  reason: string
  short: string
  plain: string
  host: string
  arrival: ArrivalStep[]
  journey?: Journey
  createdBy: string
}

export type NewEventInput = Omit<Event, 'id' | 'createdBy'>

async function parseJsonOrThrow(response: Response): Promise<any> {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `Request failed with status ${response.status}`)
  return data
}

export async function getEvents(): Promise<Event[]> {
  const response = await fetch('/api/events')
  return parseJsonOrThrow(response)
}

export async function createEvent(input: NewEventInput): Promise<Event> {
  const response = await fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseJsonOrThrow(response)
}

export async function updateEvent(id: string, input: NewEventInput): Promise<Event> {
  const response = await fetch(`/api/events/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseJsonOrThrow(response)
}

export async function deleteEvent(id: string): Promise<void> {
  const response = await fetch(`/api/events/${id}`, { method: 'DELETE' })
  if (response.ok) return
  const data = await response.json().catch(() => ({}))
  throw new Error(data.error || `Request failed with status ${response.status}`)
}

export async function getMyEvents(): Promise<Event[]> {
  const response = await fetch('/api/events/mine')
  return parseJsonOrThrow(response)
}

export async function login(email: string, password: string): Promise<{ ok: true; email: string }> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return parseJsonOrThrow(response)
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' })
}

export async function getSession(): Promise<{ ok: true; email: string } | null> {
  const response = await fetch('/api/auth/me')
  if (response.status === 401) return null
  return parseJsonOrThrow(response)
}
