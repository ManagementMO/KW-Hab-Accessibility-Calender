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
