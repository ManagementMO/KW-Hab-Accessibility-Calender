import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventForm } from './EventForm'
import * as api from '../../lib/api'

afterEach(cleanup)
afterEach(() => { vi.restoreAllMocks() })

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Event name'), 'Community Art Afternoon')
  await user.type(screen.getByLabelText('Category'), 'Art')
  await user.type(screen.getByLabelText('Day'), 'Wednesday')
  await user.type(screen.getByLabelText('Time'), '2:00 PM - 3:30 PM')
  await user.type(screen.getByLabelText('Place'), 'Victoria Hills Centre')
  await user.type(screen.getByLabelText('Cost'), 'Free')
  await user.type(screen.getByLabelText('Bus'), 'Route 4 at the door')
  await user.type(screen.getByLabelText('Group'), '12 people')
  await user.type(screen.getByLabelText('Noise'), 'Low noise')
  await user.type(screen.getByLabelText('Support'), 'Staff support available')
  await user.type(screen.getByLabelText('Image URL', { selector: 'form.event-form > label > input' }), 'https://example.com/a.jpg')
  await user.type(screen.getByLabelText('Recommendation reason'), 'Recommended because you like art.')
  await user.type(screen.getByLabelText('Short description'), 'Paint, draw, or make a craft.')
  await user.type(screen.getByLabelText('Plain-language description'), 'We will make art together.')
  await user.type(screen.getByLabelText('Owner'), 'KW Hab staff')
  const dateInput = screen.getByLabelText('Last confirmed')
  await user.clear(dateInput)
  await user.type(dateInput, '2026-07-10')
  const step = screen.getByText('Arrival steps').closest('fieldset') as HTMLElement
  await user.type(within(step).getByLabelText('Icon'), '🚪')
  await user.type(within(step).getByLabelText('Title'), 'Use the front door')
  await user.type(within(step).getByLabelText('Detail'), 'The door has a flat entrance.')
  await user.type(within(step).getByLabelText('Image URL', { selector: 'fieldset.arrival-fields input' }), 'https://example.com/b.jpg')
}

describe('EventForm', () => {
  it('shows validation errors and does not submit when required fields are empty', async () => {
    const user = userEvent.setup()
    const createEventSpy = vi.spyOn(api, 'createEvent')
    render(<EventForm onCreated={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /create event/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/title is required/i)
    expect(createEventSpy).not.toHaveBeenCalled()
  })

  it('submits a complete form and calls onCreated', async () => {
    const user = userEvent.setup()
    const created = { id: 'new-1', title: 'Community Art Afternoon' }
    vi.spyOn(api, 'createEvent').mockResolvedValue(created as any)
    const onCreated = vi.fn()
    render(<EventForm onCreated={onCreated} />)

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: /create event/i }))

    expect(await screen.findByText(/event created/i)).toBeInTheDocument()
    expect(onCreated).toHaveBeenCalledWith(created)
    const payload = (api.createEvent as any).mock.calls[0][0]
    expect(payload.title).toBe('Community Art Afternoon')
    expect(payload.access).toEqual({ status: 'reported', owner: 'KW Hab staff', lastConfirmed: '2026-07-10', note: '' })
    expect(payload.arrival).toHaveLength(1)
    expect(payload.journey).toBeUndefined()
  }, 15000)
})
