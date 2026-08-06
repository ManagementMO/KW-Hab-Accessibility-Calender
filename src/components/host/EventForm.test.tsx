import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventForm } from './EventForm'
import * as api from '../../lib/api'
import type { Event } from '../../lib/api'

afterEach(cleanup)
afterEach(() => { vi.restoreAllMocks() })

const sampleEvent: Event = {
  id: 'event-1', title: 'Community Art Afternoon', category: 'Art', day: 'Wednesday', date: '2026-08-12', time: '2:00 PM - 3:30 PM',
  place: 'Victoria Hills Centre', cost: 'Free', bus: 'Route 4 at the door', group: '12 people', noise: 'Low noise',
  access: { status: 'reported', owner: 'KW Hab staff', lastConfirmed: '2026-07-10', note: 'Indoor and step-free' },
  support: 'Staff support available', registration: 'Sign up first', registrationUrl: 'https://kwhab.ca/register',
  image: 'https://example.com/a.jpg', reason: 'Recommended because you like art.', short: 'Paint, draw, or make a craft.',
  plain: 'We will make art together.', host: 'Priya, Program Coordinator',
  arrival: [{ icon: '🚪', title: 'Use the front door', detail: 'The door has a flat entrance.', image: '' }],
  createdBy: 'staff-1',
}

async function fillMinimumRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Event name'), 'Community Art Afternoon')
  await user.selectOptions(screen.getByLabelText('Category'), 'Art')
  await user.type(screen.getByLabelText('Day'), 'Wednesday')
  const dateField = screen.getByLabelText('Date')
  await user.clear(dateField)
  await user.type(dateField, '2026-08-12')
  await user.type(screen.getByLabelText('Time'), '2:00 PM - 3:30 PM')
  await user.type(screen.getByLabelText('Place'), 'Victoria Hills Centre')
  await user.type(screen.getByLabelText('Cost'), 'Free')
  await user.type(screen.getByLabelText('Plain-language description'), 'We will make art together.')
  await user.type(screen.getByLabelText('Host'), 'Priya, Program Coordinator')
  await user.type(screen.getByLabelText('Owner'), 'KW Hab staff')
  const dateInput = screen.getByLabelText('Last confirmed')
  await user.clear(dateInput)
  await user.type(dateInput, '2026-07-10')
  const step = screen.getByText('Arrival steps').closest('fieldset') as HTMLElement
  await user.type(within(step).getByLabelText('Title'), 'Use the front door')
  await user.type(within(step).getByLabelText('Detail'), 'The door has a flat entrance.')
}

describe('EventForm (create mode)', () => {
  it('shows validation errors and does not submit when required fields are empty', async () => {
    const user = userEvent.setup()
    const createEventSpy = vi.spyOn(api, 'createEvent')
    render(<EventForm onSaved={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /create event/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/title is required/i)
    expect(createEventSpy).not.toHaveBeenCalled()
  })

  it('submits with only the required fields filled, deriving the arrival icon automatically', async () => {
    const user = userEvent.setup()
    const created = { id: 'new-1', title: 'Community Art Afternoon' }
    vi.spyOn(api, 'createEvent').mockResolvedValue(created as any)
    const onSaved = vi.fn()
    render(<EventForm onSaved={onSaved} />)

    await fillMinimumRequiredFields(user)
    await user.click(screen.getByRole('button', { name: /create event/i }))

    expect(await screen.findByText(/event created/i)).toBeInTheDocument()
    expect(onSaved).toHaveBeenCalledWith(created)
    const payload = (api.createEvent as any).mock.calls[0][0]
    expect(payload.title).toBe('Community Art Afternoon')
    expect(payload.category).toBe('Art')
    expect(payload.access).toEqual({ status: 'reported', owner: 'KW Hab staff', lastConfirmed: '2026-07-10', note: '' })
    expect(payload.bus).toBe('')
    expect(payload.image).toBe('')
    expect(payload.registrationUrl).toBe('')
    expect(payload.date).toBe('2026-08-12')
    expect(payload.host).toBe('Priya, Program Coordinator')
    expect(payload.arrival).toEqual([{ icon: '🚪', title: 'Use the front door', detail: 'The door has a flat entrance.', image: '' }])
    expect(payload.journey).toBeUndefined()
  }, 15000)

  it('shows a live icon preview that updates as the arrival step text changes', async () => {
    const user = userEvent.setup()
    render(<EventForm onSaved={vi.fn()} />)
    const step = screen.getByText('Arrival steps').closest('fieldset') as HTMLElement

    expect(within(step).getByLabelText(/icon for this step: 📍/i)).toBeInTheDocument()
    await user.type(within(step).getByLabelText('Title'), 'Ramp entrance')
    expect(within(step).getByLabelText(/icon for this step: ♿/i)).toBeInTheDocument()
  })

  it('only shows and requires the registration link when registration is "Sign up first"', async () => {
    const user = userEvent.setup()
    render(<EventForm onSaved={vi.fn()} />)
    expect(screen.queryByLabelText('Registration link')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Registration'), 'Sign up first')
    expect(screen.getByLabelText('Registration link')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /create event/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/registration link is required/i)
  })

  it('lists the participant category set plus a plain Other option, with no extra input for Other', async () => {
    render(<EventForm onSaved={vi.fn()} />)
    const select = screen.getByLabelText('Category') as HTMLSelectElement
    const optionLabels = Array.from(select.options).map((option) => option.textContent)
    expect(optionLabels).toEqual([
      'Choose a category', '🎨 Art', '🌳 Outdoors', '🎵 Music', '🍳 Cooking', '🏀 Sports', '🎉 Social', '🧘 Quiet', '🚌 Trips', 'Other',
    ])
    expect(screen.queryByLabelText(/other category/i)).not.toBeInTheDocument()
  })
})

describe('EventForm (edit mode)', () => {
  it('pre-fills the form from the given event and shows Save changes instead of Create event', () => {
    render(<EventForm event={sampleEvent} onSaved={vi.fn()} />)
    expect(screen.getByLabelText('Event name')).toHaveValue('Community Art Afternoon')
    expect(screen.getByLabelText('Category')).toHaveValue('Art')
    expect(screen.getByLabelText('Date')).toHaveValue('2026-08-12')
    expect(screen.getByLabelText('Host')).toHaveValue('Priya, Program Coordinator')
    expect(screen.getByLabelText('Registration link')).toHaveValue('https://kwhab.ca/register')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /create event/i })).not.toBeInTheDocument()
  })

  it('calls updateEvent with the event id instead of createEvent on submit', async () => {
    const user = userEvent.setup()
    const updated = { ...sampleEvent, title: 'Updated Title' }
    const updateEventSpy = vi.spyOn(api, 'updateEvent').mockResolvedValue(updated)
    const createEventSpy = vi.spyOn(api, 'createEvent')
    const onSaved = vi.fn()
    render(<EventForm event={sampleEvent} onSaved={onSaved} />)

    await user.clear(screen.getByLabelText('Event name'))
    await user.type(screen.getByLabelText('Event name'), 'Updated Title')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText(/event updated/i)).toBeInTheDocument()
    expect(updateEventSpy).toHaveBeenCalledWith('event-1', expect.objectContaining({ title: 'Updated Title' }))
    expect(createEventSpy).not.toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalledWith(updated)
  }, 15000)
})
