import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventForm } from './EventForm'
import * as api from '../../lib/api'

afterEach(cleanup)
afterEach(() => { vi.restoreAllMocks() })

async function fillMinimumRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Event name'), 'Community Art Afternoon')
  await user.type(screen.getByLabelText('Category'), 'Art')
  await user.type(screen.getByLabelText('Day'), 'Wednesday')
  await user.type(screen.getByLabelText('Time'), '2:00 PM - 3:30 PM')
  await user.type(screen.getByLabelText('Place'), 'Victoria Hills Centre')
  await user.type(screen.getByLabelText('Cost'), 'Free')
  await user.type(screen.getByLabelText('Plain-language description'), 'We will make art together.')
  await user.type(screen.getByLabelText('Owner'), 'KW Hab staff')
  const dateInput = screen.getByLabelText('Last confirmed')
  await user.clear(dateInput)
  await user.type(dateInput, '2026-07-10')
  const step = screen.getByText('Arrival steps').closest('fieldset') as HTMLElement
  await user.type(within(step).getByLabelText('Title'), 'Use the front door')
  await user.type(within(step).getByLabelText('Detail'), 'The door has a flat entrance.')
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

  it('submits with only the required fields filled, deriving the arrival icon automatically', async () => {
    const user = userEvent.setup()
    const created = { id: 'new-1', title: 'Community Art Afternoon' }
    vi.spyOn(api, 'createEvent').mockResolvedValue(created as any)
    const onCreated = vi.fn()
    render(<EventForm onCreated={onCreated} />)

    await fillMinimumRequiredFields(user)
    await user.click(screen.getByRole('button', { name: /create event/i }))

    expect(await screen.findByText(/event created/i)).toBeInTheDocument()
    expect(onCreated).toHaveBeenCalledWith(created)
    const payload = (api.createEvent as any).mock.calls[0][0]
    expect(payload.title).toBe('Community Art Afternoon')
    expect(payload.access).toEqual({ status: 'reported', owner: 'KW Hab staff', lastConfirmed: '2026-07-10', note: '' })
    expect(payload.bus).toBe('')
    expect(payload.image).toBe('')
    expect(payload.arrival).toEqual([{ icon: '🚪', title: 'Use the front door', detail: 'The door has a flat entrance.', image: '' }])
    expect(payload.journey).toBeUndefined()
  }, 15000)

  it('shows a live icon preview that updates as the arrival step text changes', async () => {
    const user = userEvent.setup()
    render(<EventForm onCreated={vi.fn()} />)
    const step = screen.getByText('Arrival steps').closest('fieldset') as HTMLElement

    expect(within(step).getByLabelText(/icon for this step: 📍/i)).toBeInTheDocument()
    await user.type(within(step).getByLabelText('Title'), 'Ramp entrance')
    expect(within(step).getByLabelText(/icon for this step: ♿/i)).toBeInTheDocument()
  })
})
