import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { listUsers, resetUserPassword, setUserActive, updateUserRoles } from '../../api/users'
import { Roles, type Role } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { RoleCheckboxes } from '../../components/users/RoleCheckboxes'
import { inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import { roleLabels, type UserAccount } from '../../types/user'
import { allErrors } from '../../utils/formErrors'

// PDF 3.1 User Management (Administrator only), as the "Logins" tab of the Staff page.
// Logins are never deleted, only deactivated, because the audit log and clinical records must keep who did what.
// New logins are created on the person's staff record (Employees tab → the person → Login account), so every
// login belongs to someone. This tab only changes existing logins: roles, password reset, active or not.
export default function LoginsTab() {
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
      setError(allErrors(err, 'Could not save.').join(' '))
      return false
    }
  }

  return (
    <div className="space-y-4">

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

      <p className="text-sm text-slate-600">
        To give someone a new login, open them on the{' '}
        <Link to="/staff" className="text-blue-700 hover:underline">Employees</Link> tab and use &ldquo;Login account&rdquo;.
        A login marked &ldquo;Not linked&rdquo; was made before this; link it from the person&apos;s page. There must always be at least one active administrator, and you cannot remove your own Administrator role.
      </p>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Username</th>
              <th scope="col" className="px-4 py-3 font-medium">Roles</th>
              <th scope="col" className="px-4 py-3 font-medium">Staff record</th>
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

  // The Doctor role follows the doctor profile (assumption A25): kept for a doctor, never added by hand.
  const otherRoles = roles.filter((r) => r !== Roles.Doctor)

  function submitRoles(event: FormEvent) {
    event.preventDefault()
    void onRoles(account.isDoctor ? [...otherRoles, Roles.Doctor] : otherRoles)
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
          {account.employeeId !== null ? (
            <Link to={`/staff/employees/${account.employeeId}`} className={link}>
              {account.employeeName}
            </Link>
          ) : (
            <span className="text-slate-400">Not linked</span>
          )}
        </td>
        <td className="px-4 py-3">
          {account.isActive ? 'Active' : 'Deactivated'}
          {account.isLockedOut && <span className="block text-xs text-red-700">Locked after failed logins</span>}
          {account.mustChangePassword && <span className="block text-xs text-amber-700">Temporary password</span>}
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
          <td colSpan={5} className="px-4 pb-4">
            <form onSubmit={submitRoles} className="space-y-3 rounded-md bg-slate-50 p-3">
              <RoleCheckboxes
                idPrefix={`roles-${account.id}`}
                value={roles}
                onChange={setRoles}
                isDoctor={account.isDoctor}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={otherRoles.length === 0 && !account.isDoctor}
                  className={primaryButtonClass}
                >
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
          <td colSpan={5} className="px-4 pb-4">
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
              <p className="w-full text-xs text-slate-500">This also unlocks a locked account. The user must change it at their next login.</p>
            </form>
          </td>
        </tr>
      )}
    </>
  )
}
