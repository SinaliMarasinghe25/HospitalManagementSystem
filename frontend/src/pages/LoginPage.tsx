import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/useAuth'

// PDF section 7, Login Page: Username, Password, Login Button.
export default function LoginPage() {
  const { user, login, sessionExpired } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  // Controlled inputs: React state holds the value of each field.
  const [userName, setUserName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (user) {
    return <Navigate to={from} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault() // stop the browser from reloading the page
    setError(null)
    setIsSubmitting(true)
    try {
      await login({ userName: userName.trim(), password })
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Cannot reach the server. Please try again.')
      setPassword('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-semibold text-slate-900">Hospital Management System</h1>
        <p className="mt-1 text-sm text-slate-600">Sign in with your staff account.</p>

        {sessionExpired && !error && (
          <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800" role="status">
            Your session expired. Please sign in again.
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate={false}>
          <div>
            <label htmlFor="userName" className="block text-sm font-medium text-slate-700">
              Username
            </label>
            <input
              id="userName"
              name="userName"
              type="text"
              autoComplete="username"
              required
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/30 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/30 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-blue-700 px-4 py-2 font-medium text-white hover:bg-blue-800 focus:ring-2 focus:ring-blue-600/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Signing in...' : 'Login'}
          </button>
        </form>
      </div>
    </main>
  )
}
