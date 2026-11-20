import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { createUser, listUsers, resetUserPassword, setUserActive, updateUserRoles } from '../../api/users'
import { AllRoles, type Role } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { FormField, inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import { roleLabels, type UserAccount } from '../../types/user'

// Identity reports problems like "PasswordRequiresDigit"; show every message in one line.
function messages(err: unknown, fallback: string) {
  if (!(err instanceof ApiError)) return fallback
  const all = Object.values(err.fieldErrors).flat()
  return all.length ? all.join(' ') : err.message
}

// PDF 3.1 User Management (Administrator only). Staff accounts are never deleted, only deactivated,
// because the audit log and clinical records must keep who did what.
// Doctors get their login from the Doctors page, which also creates their doctor profile (assumption A20).
export default function UsersPage() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<UserAccount[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string; mode: 'roles' | 'password' } | null>(null)

  function load() {
    listUsers()
      .then(setUsers)
      .catch(() => setError('Could not load the users.'))
  }
  useEffect(load, [])

  // Runs an action; returns true when it worked, so a form can stay open (with its input) when refused.
  async function act(action: () => Promise<unknown>, done: string) {
    setError(null)
    setNotice(null)
    try {
      await action()
      setNotice(done)
      setEditing(null)
      load()
      return true
    } catch (err) {
      setError(messages(err, 'Could not save.'))
      return false
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Users</h1>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-md bg-green-50 p-3 text-sm text-green-800" role="status">
          {notice}
        </p>
      )}

      <AddUserForm onCreated={(name) => act(async () => undefined, `User ${name} was created.`)} />

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Username</th>
              <th scope="col" className="px-4 py-3 font-medium">Roles</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users?.map((u) => (
              <UserRow
                key={u.id}
                account={u}
                isMe={u.id === me?.id}
                editing={editing?.id === u.id ? editing.mode : null}
                onEdit={(mode) => setEditing(mode ? { id: u.id, mode } : null)}
                onRoles={(roles) => act(() => updateUserRoles(u.id, roles), `Roles of ${u.userName} were saved.`)}
                onPassword={(password) =>
                  act(() => resetUserPassword(u.id, password), `The password of ${u.userName} was reset.`)
                }
                onActive={(active) =>
                  act(
                    () => setUserActive(u.id, active),
                    active ? `${u.userName} can log in again.` : `${u.userName} can no longer log in.`,
                  )
                }
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RoleCheckboxes({ idPrefix, value, onChange }: { idPrefix: string; value: Role[]; onChange: (roles: Role[]) => void }) {
  return (
    <fieldset>
      <legend className="block text-sm font-medium text-slate-700">
        Roles<span className="text-red-600"> *</span>
      </legend>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {AllRoles.map((role) => (
          <label key={role} htmlFor={`${idPrefix}-${role}`} className="flex items-center gap-1.5 text-sm text-slate-700">
            <input
              id={`${idPrefix}-${role}`}
              type="checkbox"
              checked={value.includes(role)}
              onChange={(e) => onChange(e.target.checked ? [...value, role] : value.filter((r) => r !== role))}
            />
            {roleLabels[role]}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function AddUserForm({ onCreated }: { onCreated: (userName: string) => Promise<boolean> }) {
  const [userName, setUserName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [roles, setRoles] = useState<Role[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('The password must have at least 8 characters.')
      return
    }
    if (roles.length === 0) {
      setError('Choose at least one role.')
      return
    }
    setSaving(true)
    try {
      await createUser({ userName: userName.trim(), email: email.trim() || null, password, roles })
      await onCreated(userName.trim())
      setUserName('')
      setEmail('')
      setPassword('')
      setRoles([])
    } catch (err) {
      setError(messages(err, 'Could not create the user.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="font-semibold text-slate-900">Add user</h2>
      <p className="text-sm text-slate-600">For doctors, use Doctors &rarr; Add doctor instead: it also creates the doctor profile.</p>
      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField id="new-userName" label="Username" required>
          <input
            id="new-userName"
            autoComplete="off"
            maxLength={50}
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className={inputClass}
          />
        </FormField>
        <FormField id="new-email" label="Email">
          <input
            id="new-email"
            type="email"
            autoComplete="off"
            maxLength={256}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </FormField>
        <FormField id="new-password" label="Temporary password" required>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </FormField>
      </div>
      <p className="text-xs text-slate-500">At least 8 characters, with an upper-case letter, a lower-case letter and a number.</p>
      <RoleCheckboxes idPrefix="new-role" value={roles} onChange={setRoles} />
      <button type="submit" disabled={saving} className={primaryButtonClass}>
        {saving ? 'Saving...' : 'Add user'}
      </button>
    </form>
  )
}

function UserRow({
  account,
  isMe,
  editing,
  onEdit,
  onRoles,
  onPassword,
  onActive,
}: {
  account: UserAccount
  isMe: boolean
  editing: 'roles' | 'password' | null
  onEdit: (mode: 'roles' | 'password' | null) => void
  onRoles: (roles: Role[]) => Promise<boolean>
  onPassword: (password: string) => Promise<boolean>
  onActive: (active: boolean) => Promise<boolean>
}) {
  const [roles, setRoles] = useState<Role[]>(account.roles)
  const [password, setPassword] = useState('')

  function submitRoles(event: FormEvent) {
    event.preventDefault()
    void onRoles(roles)
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault()
    if (await onPassword(password)) setPassword('')
  }

  const link = 'text-blue-700 hover:underline'
  return (
    <>
      <tr className={account.isActive ? '' : 'text-slate-400'}>
        <td className="px-4 py-3 font-medium">
          {account.userName}
          {isMe && <span className="ml-1 text-xs font-normal text-slate-500">(you)</span>}
          {account.email && <span className="block text-xs font-normal text-slate-500">{account.email}</span>}
        </td>
        <td className="px-4 py-3">{account.roles.map((r) => roleLabels[r] ?? r).join(', ')}</td>
        <td className="px-4 py-3">
          {account.isActive ? 'Active' : 'Deactivated'}
          {account.isLockedOut && <span className="block text-xs text-red-700">Locked after failed logins</span>}
        </td>
        <td className="space-x-3 px-4 py-3 text-right whitespace-nowrap">
          <button
            type="button"
            className={link}
            onClick={() => {
              setRoles(account.roles)
              onEdit(editing === 'roles' ? null : 'roles')
            }}
          >
            Roles<span className="sr-only"> of {account.userName}</span>
          </button>
          <button type="button" className={link} onClick={() => onEdit(editing === 'password' ? null : 'password')}>
            Reset password<span className="sr-only"> of {account.userName}</span>
          </button>
          {!isMe && (
            <button
              type="button"
              className={account.isActive ? 'text-red-700 hover:underline' : link}
              onClick={() => void onActive(!account.isActive)}
            >
              {account.isActive ? 'Deactivate' : 'Activate'}
              <span className="sr-only"> {account.userName}</span>
            </button>
          )}
        </td>
      </tr>
      {editing === 'roles' && (
        <tr>
          <td colSpan={4} className="px-4 pb-4">
            <form onSubmit={submitRoles} className="space-y-3 rounded-md bg-slate-50 p-3">
              <RoleCheckboxes idPrefix={`roles-${account.id}`} value={roles} onChange={setRoles} />
              <div className="flex gap-2">
                <button type="submit" disabled={roles.length === 0} className={primaryButtonClass}>
                  Save roles
                </button>
                <button type="button" onClick={() => onEdit(null)} className={secondaryButtonClass}>
                  Cancel
                </button>
              </div>
              <p className="text-xs text-slate-500">The user is signed out so the new roles apply at their next login.</p>
            </form>
          </td>
        </tr>
      )}
      {editing === 'password' && (
        <tr>
          <td colSpan={4} className="px-4 pb-4">
            <form onSubmit={submitPassword} className="flex flex-wrap items-end gap-2 rounded-md bg-slate-50 p-3">
              <div>
                <label htmlFor={`pw-${account.id}`} className="block text-sm font-medium text-slate-700">
                  New temporary password
                </label>
                <input
                  id={`pw-${account.id}`}
                  type="password"
                  autoComplete="new-password"
                  required
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} mt-1`}
                />
              </div>
              <button type="submit" className={primaryButtonClass}>
                Reset password
              </button>
              <p className="w-full text-xs text-slate-500">This also unlocks an account locked after failed logins.</p>
            </form>
          </td>
        </tr>
      )}
    </>
  )
}
