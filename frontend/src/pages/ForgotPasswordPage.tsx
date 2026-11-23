import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router'
import { forgotPassword } from '../api/auth'
import { useAuth } from '../auth/useAuth'
import { AuthAlert, AuthCard, AuthNotice } from '../components/auth/AuthCard'
import { FormField, inputClass, primaryButtonClass } from '../components/ui/FormField'
import { firstError } from '../utils/formErrors'

// "Forgot password" (assumption A28). The administrators get a notification and set a temporary password,
// which the person changes at the next login. Nothing is emailed: PDF section 12 makes email future work.
// The answer is the same whether or not the username exists, so this page cannot reveal who has an account.
export default function ForgotPasswordPage() {
  const { user } = useAuth()
  const [userName, setUserName] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  if (user) {
    return <Navigate to="/change-password" replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSending(true)
    try {
      await forgotPassword(userName.trim())
      setSent(true)
    } catch (err) {
      setError(firstError(err, 'Cannot reach the server. Please try again.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <AuthCard title="Forgot password">
      {sent ? (
        <AuthNotice tone="green">
          If <strong>{userName.trim()}</strong> is an active account, the administrators have been told. An administrator
          will give you a temporary password, and you choose your own the next time you log in.
        </AuthNotice>
      ) : (
        <>
          <p className="mt-1 text-sm text-slate-600">
            Enter your username. An administrator will reset your password.
          </p>
          {error && <AuthAlert>{error}</AuthAlert>}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <FormField id="userName" label="Username" required>
              <input
                id="userName"
                type="text"
                autoComplete="username"
                required
                maxLength={256}
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className={inputClass}
              />
            </FormField>
            <button type="submit" disabled={sending} className={`${primaryButtonClass} w-full`}>
              {sending ? 'Sending...' : 'Ask for a password reset'}
            </button>
          </form>
        </>
      )}
      <p className="mt-4 text-center text-sm">
        <Link to="/login" className="text-brand-700 hover:underline">
          Back to login
        </Link>
      </p>
    </AuthCard>
  )
}
