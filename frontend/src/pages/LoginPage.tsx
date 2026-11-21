import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { AuthAlert, AuthCard, AuthNotice } from '../components/auth/AuthCard'
import { FormField, inputClass, primaryButtonClass } from '../components/ui/FormField'

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
    <AuthCard title="Hospital Management System">
      <p className="mt-1 text-sm text-slate-600">Sign in with your staff account.</p>

      {sessionExpired && !error && <AuthNotice>Your session expired. Please sign in again.</AuthNotice>}
      {error && <AuthAlert>{error}</AuthAlert>}

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <FormField id="userName" label="Username">
          <input
            id="userName"
            name="userName"
            type="text"
            autoComplete="username"
            required
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className={inputClass}
          />
        </FormField>

        <FormField id="password" label="Password">
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </FormField>

        <button type="submit" disabled={isSubmitting} className={`${primaryButtonClass} w-full`}>
          {isSubmitting ? 'Signing in...' : 'Login'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm">
        <Link to="/forgot-password" className="text-blue-700 hover:underline">
          Forgot password?
        </Link>
      </p>
    </AuthCard>
  )
}
