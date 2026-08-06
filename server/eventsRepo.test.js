import { describe, expect, it } from 'vitest'
import { openDb } from './db.js'
import { getEventById, insertEvent, listEvents, listEventsByStaff, updateEvent } from './eventsRepo.js'

const sampleInput = {
  title: 'Music and Games Night', category: 'Music', day: 'Friday', date: '2026-08-14', time: '6:00 PM - 8:00 PM',
  place: 'Kitchener Community Hall', cost: '$5', bus: 'Route 8 until 9 PM', group: '20 people', noise: 'Moderate noise',
  access: { status: 'confirmed', owner: 'KW Hab staff', lastConfirmed: '2026-07-01', note: 'Ramp entrance' },
  support: 'Support people are free', registration: 'Sign up first', registrationUrl: 'https://kwhab.ca/register',
  image: 'https://example.com/c.jpg',
  reason: 'Recommended because you enjoy music.', short: 'Listen to music and play games.',
  plain: 'We will listen to music.', host: 'KW Hab staff',
  arrival: [{ icon: '🚪', title: 'Use the ramp', detail: 'On the side of the hall.', image: 'https://example.com/d.jpg' }],
}

describe('eventsRepo', () => {
  it('starts empty', () => {
    const db = openDb(':memory:')
    expect(listEvents(db)).toEqual([])
  })

  it('inserts an event and returns it with a generated id and the creating staff id', () => {
    const db = openDb(':memory:')
    const created = insertEvent(db, sampleInput, 'staff-1')
    expect(created.id).toEqual(expect.any(String))
    expect(created.title).toBe('Music and Games Night')
    expect(created.access.status).toBe('confirmed')
    expect(created.registrationUrl).toBe('https://kwhab.ca/register')
    expect(created.createdBy).toBe('staff-1')
  })

  it('lists inserted events ordered by creation time', () => {
    const db = openDb(':memory:')
    insertEvent(db, sampleInput, 'staff-1')
    insertEvent(db, { ...sampleInput, title: 'Second Event' }, 'staff-1')
    const events = listEvents(db)
    expect(events).toHaveLength(2)
    expect(events.map((event) => event.title)).toEqual(['Music and Games Night', 'Second Event'])
  })

  it('getEventById returns the event or null', () => {
    const db = openDb(':memory:')
    const created = insertEvent(db, sampleInput, 'staff-1')
    expect(getEventById(db, created.id)).toEqual(created)
    expect(getEventById(db, 'no-such-id')).toBeNull()
  })

  it('listEventsByStaff only returns events created by that staff id', () => {
    const db = openDb(':memory:')
    insertEvent(db, sampleInput, 'staff-1')
    insertEvent(db, { ...sampleInput, title: 'Someone Else\'s Event' }, 'staff-2')
    const mine = listEventsByStaff(db, 'staff-1')
    expect(mine).toHaveLength(1)
    expect(mine[0].title).toBe('Music and Games Night')
  })

  it('updateEvent overwrites the stored fields but preserves id and createdBy', () => {
    const db = openDb(':memory:')
    const created = insertEvent(db, sampleInput, 'staff-1')
    const updated = updateEvent(db, created.id, { ...sampleInput, title: 'Updated Title', place: 'New Venue' }, 'staff-1')
    expect(updated.id).toBe(created.id)
    expect(updated.title).toBe('Updated Title')
    expect(updated.place).toBe('New Venue')
    expect(updated.createdBy).toBe('staff-1')
    expect(listEvents(db)).toHaveLength(1)
  })
})
