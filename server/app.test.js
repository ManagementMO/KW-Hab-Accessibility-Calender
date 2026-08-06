import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { openDb } from './db.js'
import { createApp } from './app.js'
import { hashPassword } from './auth.js'
import { createStaff } from './staffRepo.js'

const SECRET = 'test-secret'
const validEvent = {
  title: 'Community Art Afternoon', category: 'Art', date: '2026-08-12', time: '2:00 PM - 3:30 PM',
  place: 'Victoria Hills Centre', cost: 'Free', bus: 'Route 4 at the door', group: '12 people', noise: 'Low noise',
  access: { status: 'reported', owner: 'KW Hab staff', lastConfirmed: '2026-07-10', note: 'Indoor and step-free' },
  support: 'Staff support available', registration: 'Yes, just come', image: 'https://example.com/a.jpg',
  reason: 'Recommended because you like making things in a calm room.', short: 'Paint, draw, or make a craft.',
  plain: 'We will make art together.', host: 'KW Hab staff',
  arrival: [{ icon: '🚪', title: 'Use the front door', detail: 'The door has a flat entrance.', image: 'https://example.com/b.jpg' }],
}

describe('app', () => {
  let app
  let db

  beforeEach(async () => {
    db = openDb(':memory:')
    app = createApp(db, SECRET)
    createStaff(db, { email: 'staff@kwhab.ca', passwordHash: await hashPassword('correct-password') })
    createStaff(db, { email: 'other-staff@kwhab.ca', passwordHash: await hashPassword('other-password') })
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

  it('rejects an event with registration "Sign up first" and no registrationUrl', async () => {
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ email: 'staff@kwhab.ca', password: 'correct-password' })
    const res = await agent.post('/api/events').send({ ...validEvent, registration: 'Sign up first' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/registrationUrl/)
  })

  it('GET /api/events/mine requires a session and returns only events created by that staff account', async () => {
    const unauthenticated = await request(app).get('/api/events/mine')
    expect(unauthenticated.status).toBe(401)

    const agentA = request.agent(app)
    await agentA.post('/api/auth/login').send({ email: 'staff@kwhab.ca', password: 'correct-password' })
    await agentA.post('/api/events').send(validEvent)

    const agentB = request.agent(app)
    await agentB.post('/api/auth/login').send({ email: 'other-staff@kwhab.ca', password: 'other-password' })
    await agentB.post('/api/events').send({ ...validEvent, title: 'Other Staff Event' })

    const mineA = await agentA.get('/api/events/mine')
    expect(mineA.body).toHaveLength(1)
    expect(mineA.body[0].title).toBe('Community Art Afternoon')

    const mineB = await agentB.get('/api/events/mine')
    expect(mineB.body).toHaveLength(1)
    expect(mineB.body[0].title).toBe('Other Staff Event')
  })

  it('PATCH /api/events/:id requires a session, returns 404 for an unknown id, and 403 for another staff member\'s event', async () => {
    const agentA = request.agent(app)
    await agentA.post('/api/auth/login').send({ email: 'staff@kwhab.ca', password: 'correct-password' })
    const created = await agentA.post('/api/events').send(validEvent)

    const unauthenticated = await request(app).patch(`/api/events/${created.body.id}`).send(validEvent)
    expect(unauthenticated.status).toBe(401)

    const missing = await agentA.patch('/api/events/no-such-id').send(validEvent)
    expect(missing.status).toBe(404)

    const agentB = request.agent(app)
    await agentB.post('/api/auth/login').send({ email: 'other-staff@kwhab.ca', password: 'other-password' })
    const forbidden = await agentB.patch(`/api/events/${created.body.id}`).send({ ...validEvent, title: 'Hijacked' })
    expect(forbidden.status).toBe(403)

    const stillOriginal = await request(app).get('/api/events')
    expect(stillOriginal.body[0].title).toBe('Community Art Afternoon')
  })

  it('PATCH /api/events/:id updates the event when the owning staff member is authenticated', async () => {
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ email: 'staff@kwhab.ca', password: 'correct-password' })
    const created = await agent.post('/api/events').send(validEvent)

    const updated = await agent.patch(`/api/events/${created.body.id}`).send({ ...validEvent, title: 'Updated Title', place: 'New Venue' })
    expect(updated.status).toBe(200)
    expect(updated.body.title).toBe('Updated Title')
    expect(updated.body.place).toBe('New Venue')
    expect(updated.body.id).toBe(created.body.id)

    const list = await request(app).get('/api/events')
    expect(list.body).toHaveLength(1)
    expect(list.body[0].title).toBe('Updated Title')
  })

  it('PATCH /api/events/:id rejects an invalid payload even for the owning staff member', async () => {
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ email: 'staff@kwhab.ca', password: 'correct-password' })
    const created = await agent.post('/api/events').send(validEvent)

    const res = await agent.patch(`/api/events/${created.body.id}`).send({ ...validEvent, title: '' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/title/)
  })
})
