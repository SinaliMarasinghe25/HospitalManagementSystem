import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { renderWithAuth } from '../test/renderWithAuth'
import LoginPage from './LoginPage'

// PDF section 7, Login Page (UI-LOG-01 to UI-LOG-03).
describe('LoginPage', () => {
  it('has a username field, a hidden password field and a Login button', () => {
    renderWithAuth(<LoginPage />, { roles: null, path: '/login' })

    expect(screen.getByLabelText('Username')).toBeRequired()
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Login' })).toBeEnabled()
  })

  it('sends the username without extra spaces, and the password', async () => {
    const user = userEvent.setup()
    const login = vi.fn().mockResolvedValue(undefined)
    renderWithAuth(<LoginPage />, { roles: null, auth: { login }, path: '/login' })

    await user.type(screen.getByLabelText('Username'), '  admin  ')
    await user.type(screen.getByLabelText('Password'), 'Secret#123')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    expect(login).toHaveBeenCalledWith({ userName: 'admin', password: 'Secret#123' })
  })

  it('shows the error from the API and empties the password field', async () => {
    const user = userEvent.setup()
    const login = vi.fn().mockRejectedValue(new ApiError(401, 'Invalid username or password.'))
    renderWithAuth(<LoginPage />, { roles: null, auth: { login }, path: '/login' })

    await user.type(screen.getByLabelText('Username'), 'admin')
    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    expect(await screen.findByText('Invalid username or password.')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })

  it('says the server cannot be reached when there is no answer', async () => {
    const user = userEvent.setup()
    const login = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    renderWithAuth(<LoginPage />, { roles: null, auth: { login }, path: '/login' })

    await user.type(screen.getByLabelText('Username'), 'admin')
    await user.type(screen.getByLabelText('Password'), 'Secret#123')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    expect(await screen.findByText('Cannot reach the server. Please try again.')).toBeInTheDocument()
  })

  it('shows "Signing in..." and disables the button while waiting', async () => {
    const user = userEvent.setup()
    const login = vi.fn(() => new Promise<void>(() => {})) // never answers
    renderWithAuth(<LoginPage />, { roles: null, auth: { login }, path: '/login' })

    await user.type(screen.getByLabelText('Username'), 'admin')
    await user.type(screen.getByLabelText('Password'), 'Secret#123')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled()
  })

  it('tells the user when the session expired', () => {
    renderWithAuth(<LoginPage />, { roles: null, auth: { sessionExpired: true }, path: '/login' })

    expect(screen.getByText('Your session expired. Please sign in again.')).toBeInTheDocument()
  })
})
