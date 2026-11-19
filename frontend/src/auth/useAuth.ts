import { useContext } from 'react'
import { AuthContext } from './AuthContext'

// Use inside any component: const { user, login, logout } = useAuth()
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.')
  }
  return context
}
