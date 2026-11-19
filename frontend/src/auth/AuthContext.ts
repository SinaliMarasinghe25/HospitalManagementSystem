import { createContext } from 'react'
import type { CurrentUser, LoginRequest } from '../types/auth'

export type AuthState = {
  user: CurrentUser | null
  isLoading: boolean
  sessionExpired: boolean
  login: (request: LoginRequest) => Promise<void>
  logout: () => Promise<void>
}

// Shared login state that any component can read with useAuth().
export const AuthContext = createContext<AuthState | null>(null)
