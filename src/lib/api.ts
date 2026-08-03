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
  let data = {}
  try {
    data = await response.json()
  } catch {
    // Ignore errors
  }

  if (response.status === 401) {
    if (data.error) throw new Error(data.error)
    return null
  }

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
