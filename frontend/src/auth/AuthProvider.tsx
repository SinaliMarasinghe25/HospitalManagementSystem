import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as authApi from '../api/auth'
import { ApiError, SESSION_EXPIRED_EVENT } from '../api/client'
import type { CurrentUser, LoginRequest } from '../types/auth'
import { AuthContext, type AuthState } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)

  // When the page loads, ask the API who is logged in (the cookie may still be valid).
  useEffect(() => {
    authApi
      .getCurrentUser()
      .then(setUser)
      .catch((error: unknown) => {
        if (!(error instanceof ApiError && error.status === 401)) {
          console.error(error)
        }
        setUser(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  // The API answered 401 somewhere: the 20-minute session timeout has passed.
  useEffect(() => {
    const onExpired = () => {
      setUser(null)
      setSessionExpired(true)
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  }, [])

  const login = useCallback(async (request: LoginRequest) => {
    const currentUser = await authApi.login(request)
    setSessionExpired(false)
    setUser(currentUser)
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({ user, isLoading, sessionExpired, login, logout }),
    [user, isLoading, sessionExpired, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
