import type { Role } from '../auth/roles'
import type { UserAccount } from '../types/user'
import { apiFetch } from './client'

// One function per endpoint in UsersController.cs (Administrator only).
// New logins are created from the staff record (api/staff.ts), never here.

export function listUsers() {
  return apiFetch<UserAccount[]>('/users')
}

export function updateUserRoles(id: string, roles: Role[]) {
  return apiFetch<UserAccount>(`/users/${id}/roles`, { method: 'PUT', body: JSON.stringify({ roles }) })
}

export function resetUserPassword(id: string, newPassword: string) {
  return apiFetch<UserAccount>(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword }) })
}

export function setUserActive(id: string, isActive: boolean) {
  return apiFetch<UserAccount>(`/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ isActive }) })
}
