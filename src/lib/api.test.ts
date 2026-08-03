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
