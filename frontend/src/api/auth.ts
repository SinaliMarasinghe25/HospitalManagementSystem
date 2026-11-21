import type { CurrentUser, LoginRequest } from '../types/auth'
import { apiFetch } from './client'

// One function per endpoint in AuthController.cs.

export function login(request: LoginRequest): Promise<CurrentUser> {
  return apiFetch<CurrentUser>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export function logout(): Promise<void> {
  return apiFetch<void>('/auth/logout', { method: 'POST' })
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiFetch<void>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

export function getCurrentUser(): Promise<CurrentUser> {
  return apiFetch<CurrentUser>('/auth/me')
}

// "Forgot password": tells the administrators. The API answers the same way whether or not the username exists.
export function forgotPassword(userName: string): Promise<void> {
  return apiFetch<void>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ userName }),
  })
}
