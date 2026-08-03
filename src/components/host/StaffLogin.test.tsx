import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StaffLogin } from './StaffLogin'
import * as api from '../../lib/api'

afterEach(cleanup)
afterEach(() => { vi.restoreAllMocks() })

describe('StaffLogin', () => {
  it('calls onSuccess with the email on successful login', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'login').mockResolvedValue({ ok: true, email: 'staff@kwhab.ca' })
    const onSuccess = vi.fn()
    render(<StaffLogin onSuccess={onSuccess} onBack={vi.fn()} />)

    await user.type(screen.getByLabelText(/email/i), 'staff@kwhab.ca')
    await user.type(screen.getByLabelText(/password/i), 'correct-password')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(onSuccess).toHaveBeenCalledWith('staff@kwhab.ca')
  })

  it('shows an inline error and allows retry on failed login', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'login').mockRejectedValue(new Error('Incorrect email or password'))
    render(<StaffLogin onSuccess={vi.fn()} onBack={vi.fn()} />)

    await user.type(screen.getByLabelText(/email/i), 'staff@kwhab.ca')
    await user.type(screen.getByLabelText(/password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password')
    expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled()
  })

  it('calls onBack when back is clicked', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(<StaffLogin onSuccess={vi.fn()} onBack={onBack} />)
    await user.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalled()
  })
})
