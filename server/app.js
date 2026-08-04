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
