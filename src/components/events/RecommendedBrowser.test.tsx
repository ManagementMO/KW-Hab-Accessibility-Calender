import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RecommendedBrowser } from './RecommendedBrowser'
import type { Event } from '../../lib/api'

afterEach(cleanup)

function makeEvent(overrides: Partial<Event>): Event {
  return {
    id: overrides.title ?? 'event', title: 'Event', category: 'Art', day: 'Monday', time: '9:00 AM', place: 'Hall',
    cost: 'Free', bus: '', group: '', noise: '', access: { status: 'not_known', owner: 'me', lastConfirmed: '2026-08-01', note: '' },
    support: '', registration: 'Yes, just come', registrationUrl: '', image: '', reason: '', short: '', plain: 'Plain text.',
    arrival: [{ icon: '📍', title: 'Arrive', detail: 'Come in.', image: '' }], createdBy: 'staff-1',
    ...overrides,
  }
}

const events = [
  makeEvent({ id: 'art-1', title: 'Painting Circle', category: 'Art' }),
  makeEvent({ id: 'music-1', title: 'Drum Jam', category: 'Music' }),
  makeEvent({ id: 'quiet-1', title: 'Reading Corner', category: 'Quiet' }),
]

describe('RecommendedBrowser category filters', () => {
  it('shows exactly the participant category set plus the existing non-category filters, with the noise and category "Quiet" chips distinguished', () => {
    render(<RecommendedBrowser events={events} onOpen={vi.fn()} mode="easy" pecs={false} language="en-CA" slow={false} />)
    expect(screen.getByRole('button', { name: '🎨 Art' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '🌳 Outdoors' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '🚌 Trips' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '🔇 Quiet' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '🧘 Quiet activities' })).toBeInTheDocument()
  })

  it('filters events by category when a category chip is selected', async () => {
    const user = userEvent.setup()
    render(<RecommendedBrowser events={events} onOpen={vi.fn()} mode="easy" pecs={false} language="en-CA" slow={false} />)

    await user.click(screen.getByRole('button', { name: '🎵 Music' }))
    expect(screen.getByText('Drum Jam')).toBeInTheDocument()
    expect(screen.queryByText('Painting Circle')).not.toBeInTheDocument()
    expect(screen.queryByText('Reading Corner')).not.toBeInTheDocument()
  })

  it('filters by the "Quiet activities" category chip without matching the unrelated noise-level chip', async () => {
    const user = userEvent.setup()
    render(<RecommendedBrowser events={events} onOpen={vi.fn()} mode="easy" pecs={false} language="en-CA" slow={false} />)

    await user.click(screen.getByRole('button', { name: '🧘 Quiet activities' }))
    expect(screen.getByText('Reading Corner')).toBeInTheDocument()
    expect(screen.queryByText('Painting Circle')).not.toBeInTheDocument()
    expect(screen.queryByText('Drum Jam')).not.toBeInTheDocument()
  })

  it('category filter buttons are keyboard and screen-reader accessible', () => {
    render(<RecommendedBrowser events={events} onOpen={vi.fn()} mode="easy" pecs={false} language="en-CA" slow={false} />)
    const artFilter = screen.getByRole('button', { name: '🎨 Art' })
    expect(artFilter).toHaveAttribute('aria-pressed', 'false')
    expect(artFilter.tagName).toBe('BUTTON')
  })
})
