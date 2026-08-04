import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EntryChoice } from './EntryChoice'

afterEach(cleanup)

describe('EntryChoice', () => {
  it('calls onParticipant when the participant option is chosen', async () => {
    const user = userEvent.setup()
    const onParticipant = vi.fn()
    render(<EntryChoice onParticipant={onParticipant} onStaff={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /participant/i }))
    expect(onParticipant).toHaveBeenCalled()
  })

  it('calls onStaff when the staff option is chosen', async () => {
    const user = userEvent.setup()
    const onStaff = vi.fn()
    render(<EntryChoice onParticipant={vi.fn()} onStaff={onStaff} />)
    await user.click(screen.getByRole('button', { name: /staff/i }))
    expect(onStaff).toHaveBeenCalled()
  })
})
