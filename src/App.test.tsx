import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import * as api from './lib/api'

afterEach(cleanup)
afterEach(() => { localStorage.clear(); vi.restoreAllMocks() })

async function enterAsParticipant() {
  vi.spyOn(api, 'getSession').mockResolvedValue(null)
  vi.spyOn(api, 'getEvents').mockResolvedValue([])
  render(<App />)
  await screen.findByRole('heading', { name: 'How do you like to use this app?' })
}

describe('Belonging Loop accessible calendar', () => {
  it('starts directly with one visual onboarding decision, no participant/staff prompt', async () => {
    const user = userEvent.setup()
    await enterAsParticipant()

    expect(screen.getByRole('heading', { name: 'How do you like to use this app?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /pictures/i }))
    expect(screen.getByRole('heading', { name: 'What do you like to do?' })).toBeInTheDocument()
  })

  it('opens a recommended event and saves it to My Week', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'getSession').mockResolvedValue(null)
    vi.spyOn(api, 'getEvents').mockResolvedValue([{
      id: 'nature', title: 'Accessible Nature Walk', category: 'Outdoors', day: 'Saturday', time: '10:00 AM - 11:30 AM',
      place: 'Waterloo Park', cost: 'Free', bus: 'Route 7 stops nearby', group: 'Small group', noise: 'Quiet',
      access: { status: 'reported', owner: 'KW Hab staff', lastConfirmed: '2026-07-10', note: 'Step-free path' },
      support: 'Mobility support can be requested', registration: 'Sign up first', registrationUrl: 'https://kwhab.ca/register/nature-walk',
      image: 'https://example.com/a.jpg',
      reason: 'Recommended because you like outdoor activities and small groups.', short: 'A calm walk with time for breaks.',
      plain: 'We will walk together.',
      arrival: [{ icon: '🚪', title: 'Enter by the park gate', detail: 'Use the wide gate beside the bus stop.', image: 'https://example.com/b.jpg' }],
      createdBy: 'staff-1',
    }])
    render(<App />)
    await screen.findByRole('heading', { name: 'How do you like to use this app?' })

    await user.click(screen.getByRole('button', { name: /skip setup/i }))
    await user.click(await screen.findByRole('button', { name: 'Accessible Nature Walk' }))
    expect(screen.getByRole('heading', { name: 'Accessible Nature Walk' })).toBeInTheDocument()

    const registerLink = screen.getByRole('link', { name: 'Register here' })
    expect(registerLink).toHaveAttribute('href', 'https://kwhab.ca/register/nature-walk')
    expect(registerLink).toHaveAttribute('target', '_blank')

    await user.click(screen.getByRole('button', { name: /(?:save|saved) to my week/i }))
    await user.click(screen.getByRole('button', { name: 'My Week' }))
    expect(screen.getByText('Accessible Nature Walk')).toBeInTheDocument()
  })

  it('switches to PECS choices without requiring typing', async () => {
    const user = userEvent.setup()
    await enterAsParticipant()
    await user.click(screen.getByRole('button', { name: /skip setup/i }))
    await user.click(screen.getByRole('button', { name: 'PECS mode' }))
    expect(screen.getByText('PECS is ON')).toBeInTheDocument()
    expect(screen.getByText('Tap a picture')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /outdoors/i })).toBeInTheDocument()
  })

  it('shows a slowed audio state when a speaker control is used', async () => {
    const user = userEvent.setup()
    await enterAsParticipant()
    await user.click(screen.getByRole('button', { name: /skip setup/i }))
    await user.click(screen.getByRole('button', { name: 'Listen' }))
    await user.click(screen.getByRole('button', { name: 'Listen to Home' }))
    expect(screen.getByText('Speaking slowly')).toBeInTheDocument()
  })

  it('opens one color vision choice screen', async () => {
    const user = userEvent.setup()
    await enterAsParticipant()
    await user.click(screen.getByRole('button', { name: /skip setup/i }))
    await user.click(screen.getByRole('button', { name: 'Color' }))
    expect(screen.getByRole('heading', { name: 'Choose your vision type' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /red-green/i }))
    expect(document.documentElement.dataset.colorMode).toBe('red-green')
  })

  it('shows an empty state instead of hard-coded events when the database has none', async () => {
    const user = userEvent.setup()
    await enterAsParticipant()
    await user.click(screen.getByRole('button', { name: /skip setup/i }))
    expect(await screen.findByText('No events at this time.')).toBeInTheDocument()
  })

  it('lets staff log in via the header Staff button and reach the staff screen', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'getSession').mockResolvedValue(null)
    vi.spyOn(api, 'getEvents').mockResolvedValue([])
    vi.spyOn(api, 'getMyEvents').mockResolvedValue([])
    vi.spyOn(api, 'login').mockResolvedValue({ ok: true, email: 'staff@kwhab.ca' })
    render(<App />)
    await user.click(await screen.findByRole('button', { name: /open staff tools/i }))
    await user.type(screen.getByLabelText(/email/i), 'staff@kwhab.ca')
    await user.type(screen.getByLabelText(/password/i), 'correct-password')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByRole('heading', { name: 'Event workspace' })).toBeInTheDocument()
    expect(await screen.findByText("You haven't created any events yet.")).toBeInTheDocument()
  })

  it('shows an inline error on failed staff login and allows retry', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'getSession').mockResolvedValue(null)
    vi.spyOn(api, 'getEvents').mockResolvedValue([])
    vi.spyOn(api, 'login').mockRejectedValue(new Error('Incorrect email or password'))
    render(<App />)
    await user.click(await screen.findByRole('button', { name: /open staff tools/i }))
    await user.type(screen.getByLabelText(/email/i), 'staff@kwhab.ca')
    await user.type(screen.getByLabelText(/password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password')
  })

  it('resumes a staff session directly into the staff screen on reload', async () => {
    vi.spyOn(api, 'getSession').mockResolvedValue({ ok: true, email: 'staff@kwhab.ca' })
    vi.spyOn(api, 'getMyEvents').mockResolvedValue([])
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Event workspace' })).toBeInTheDocument()
  })

  it('lists only the staff member\'s own events on the staff screen and lets them edit one', async () => {
    const user = userEvent.setup()
    const myEvent = {
      id: 'my-event-1', title: 'My Event', category: 'Art', day: 'Monday', time: '9:00 AM', place: 'Hall',
      cost: 'Free', bus: '', group: '', noise: '', access: { status: 'not_known' as const, owner: 'me', lastConfirmed: '2026-08-01', note: '' },
      support: '', registration: 'Yes, just come' as const, registrationUrl: '', image: '', reason: '', short: '', plain: 'Plain text.',
      arrival: [{ icon: '📍', title: 'Arrive', detail: 'Come in.', image: '' }], createdBy: 'staff-1',
    }
    vi.spyOn(api, 'getSession').mockResolvedValue({ ok: true, email: 'staff@kwhab.ca' })
    vi.spyOn(api, 'getMyEvents').mockResolvedValue([myEvent])
    render(<App />)
    await screen.findByRole('heading', { name: 'Event workspace' })

    expect(await screen.findByText('My Event')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByLabelText('Event name')).toHaveValue('My Event')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
  })
})
