import { describe, expect, it } from 'vitest'
import { eventInputToRow, rowToEvent, validateEventInput } from './eventMapper.js'

const sampleInput = {
  title: 'Community Art Afternoon', category: 'Art', date: '2026-08-12', time: '2:00 PM - 3:30 PM',
  place: 'Victoria Hills Centre', cost: 'Free', bus: 'Route 4 at the door', group: '12 people', noise: 'Low noise',
  access: { status: 'reported', owner: 'KW Hab staff', lastConfirmed: '2026-07-10', note: 'Indoor and step-free' },
  support: 'Staff support available', registration: 'Yes, just come', registrationUrl: '', image: 'https://example.com/a.jpg',
  reason: 'Recommended because you like making things in a calm room.', short: 'Paint, draw, or make a craft.',
  plain: 'We will make art together.', host: 'KW Hab staff',
  arrival: [{ icon: '🚪', title: 'Use the front door', detail: 'The door has a flat entrance.', image: 'https://example.com/b.jpg' }],
  journey: { route: 'Bus 4 to Victoria Hills', leave: 'Leaves at 1:26 PM', duration: '14 min', steps: ['Leave home', 'Bus 4'] },
}

describe('eventInputToRow / rowToEvent round trip', () => {
  it('maps a full input to a row and back to an equivalent Event', () => {
    const row = eventInputToRow(sampleInput, 'abc-123', '2026-08-02T00:00:00.000Z', 'staff-1')
    expect(row.id).toBe('abc-123')
    expect(row.group_label).toBe('12 people')
    expect(row.access_status).toBe('reported')
    expect(row.access_note).toBe('Indoor and step-free')
    expect(row.created_by).toBe('staff-1')

    const event = rowToEvent(row)
    expect(event).toEqual({
      id: 'abc-123', ...sampleInput, createdBy: 'staff-1',
    })
  })

  it('maps a row with no journey to an event with journey undefined', () => {
    const row = eventInputToRow({ ...sampleInput, journey: undefined }, 'abc-124', '2026-08-02T00:00:00.000Z', 'staff-1')
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
      .toContain('each arrival step needs a title and detail')
  })

  it('allows bus, group, noise, support, image, reason, and short to be omitted', () => {
    const { bus, group, noise, support, image, reason, short, ...rest } = sampleInput
    expect(validateEventInput(rest)).toEqual([])
  })

  it('allows an arrival step with no image', () => {
    const errors = validateEventInput({ ...sampleInput, arrival: [{ icon: '🚪', title: 'Use the door', detail: 'Flat entrance.' }] })
    expect(errors).toEqual([])
  })

  it('flags an optional field that is present but not text', () => {
    const errors = validateEventInput({ ...sampleInput, bus: 42 })
    expect(errors).toContain('bus must be text')
  })

  it('requires registrationUrl when registration is "Sign up first"', () => {
    const errors = validateEventInput({ ...sampleInput, registration: 'Sign up first', registrationUrl: '' })
    expect(errors).toContain('registrationUrl is required when registration is "Sign up first"')
  })

  it('allows registrationUrl to be empty when registration is "Yes, just come"', () => {
    const errors = validateEventInput({ ...sampleInput, registration: 'Yes, just come', registrationUrl: '' })
    expect(errors).toEqual([])
  })

  it('accepts a "Sign up first" event once registrationUrl is provided', () => {
    const errors = validateEventInput({ ...sampleInput, registration: 'Sign up first', registrationUrl: 'https://kwhab.ca/register' })
    expect(errors).toEqual([])
  })

  it('requires date and host', () => {
    const errors = validateEventInput({ ...sampleInput, date: '', host: '' })
    expect(errors).toContain('date is required')
    expect(errors).toContain('host is required')
  })

  it('flags a date that is not in YYYY-MM-DD format', () => {
    const errors = validateEventInput({ ...sampleInput, date: '08/12/2026' })
    expect(errors).toContain('date must be in YYYY-MM-DD format')
  })
})
