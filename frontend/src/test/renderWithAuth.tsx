import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import type { Role } from '../auth/roles'

// Draws a component as if a user with these roles were logged in, inside a router (for links).
// Pass roles: null for "nobody is logged in". Any part of the login state can be replaced with "auth".
export function renderWithAuth(
  ui: ReactNode,
  { roles = [], auth = {}, path = '/' }: { roles?: Role[] | null; auth?: Partial<AuthState>; path?: string } = {},
) {
  const state: AuthState = {
    user:
      roles === null
        ? null
        : { id: 'user-1', userName: 'tester', email: null, roles, mustChangePassword: false },
    isLoading: false,
    sessionExpired: false,
    login: async () => {},
    logout: async () => {},
    refreshUser: async () => {},
    ...auth,
  }
  return render(
    <AuthContext.Provider value={state}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </AuthContext.Provider>,
  )
}
