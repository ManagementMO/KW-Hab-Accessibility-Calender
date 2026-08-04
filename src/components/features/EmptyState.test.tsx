import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { EmptyState } from './EmptyState'

afterEach(cleanup)

describe('EmptyState', () => {
  it('shows the plain-text message in Easy Read mode', () => {
    render(<EmptyState mode="easy" pecs={false} language="en-CA" slow={false} />)
    expect(screen.getByText('No events at this time.')).toBeInTheDocument()
  })

  it('shows a symbol-first message when PECS is on', () => {
    render(<EmptyState mode="easy" pecs language="en-CA" slow={false} />)
    expect(screen.getByText('🚫📅')).toBeInTheDocument()
  })

  it('offers a Listen control in Audio First mode', () => {
    render(<EmptyState mode="audio" pecs={false} language="en-CA" slow />)
    expect(screen.getByRole('button', { name: /listen to empty events/i })).toBeInTheDocument()
  })
})
