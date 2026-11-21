import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { changePassword } from '../api/auth'
import { useAuth } from '../auth/useAuth'
import { AuthAlert, AuthCard, AuthNotice } from '../components/auth/AuthCard'
import { FormField, inputClass, primaryButtonClass } from '../components/ui/FormField'
import { allErrors } from '../utils/formErrors'

// PDF 3.1 Password Management. Also shown straight after login when an administrator set the password
// (new account or reset): the user must choose their own before using the system.
export default function ChangePasswordPage() {
  const { user, refreshUser, logout } = useAuth()
  const navigate = useNavigate()
  const forced = user?.mustChangePassword ?? false

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (next !== confirm) {
      setError('The two new passwords are not the same.')
      return
    }
    if (next === current) {
      setError('Choose a password that is different from the current one.')
      return
    }
    setSaving(true)
    try {
      await changePassword(current, next)
      await refreshUser()
      navigate('/', { replace: true })
    } catch (err) {
      setError(allErrors(err, 'Could not change the password.').join(' '))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AuthCard title="Change password">
      {forced ? (
        <AuthNotice>Your password was set by an administrator. Choose your own password to continue.</AuthNotice>
      ) : (
        <p className="mt-1 text-sm text-slate-600">Signed in as {user?.userName}.</p>
      )}

      {error && <AuthAlert>{error}</AuthAlert>}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <FormField id="currentPassword" label={forced ? 'Temporary password' : 'Current password'} required>
          <input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={inputClass}
          />
        </FormField>
        <FormField id="newPassword" label="New password" required>
          <input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={inputClass}
          />
        </FormField>
        <FormField id="confirmPassword" label="New password again" required>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
          />
        </FormField>
        <p className="text-xs text-slate-500">
          At least 8 characters, with an upper-case letter, a lower-case letter, a number and a symbol.
        </p>
        <button type="submit" disabled={saving} className={`${primaryButtonClass} w-full`}>
          {saving ? 'Saving...' : 'Change password'}
        </button>
      </form>

      <div className="mt-4 text-center text-sm">
        {forced ? (
          <button type="button" onClick={() => void logout()} className="text-blue-700 hover:underline">
            Log out
          </button>
        ) : (
          <Link to="/" className="text-blue-700 hover:underline">
            Back to the dashboard
          </Link>
        )}
      </div>
    </AuthCard>
  )
}
