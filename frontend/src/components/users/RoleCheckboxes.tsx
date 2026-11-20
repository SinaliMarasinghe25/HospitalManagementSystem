import { AllRoles, Roles, type Role } from '../../auth/roles'
import { roleLabels } from '../../types/user'

// Role tick boxes, used on the Users page and when creating a login on the Staff page.
// Assumption A25 (proposed): the Doctor role follows the doctor profile, so its box cannot be ticked by hand.
// It shows ticked for a doctor's login and is added by the API; for everyone else it stays empty.
export function RoleCheckboxes({
  idPrefix,
  value,
  onChange,
  isDoctor,
  error,
}: {
  idPrefix: string
  value: Role[]
  onChange: (roles: Role[]) => void
  isDoctor: boolean
  error?: string
}) {
  return (
    <fieldset aria-describedby={error ? `${idPrefix}-error` : `${idPrefix}-hint`}>
      <legend className="block text-sm font-medium text-slate-700">
        Roles<span className="text-red-600"> *</span>
      </legend>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {AllRoles.map((role) => {
          const isDoctorBox = role === Roles.Doctor
          return (
            <label
              key={role}
              htmlFor={`${idPrefix}-${role}`}
              className={`flex items-center gap-1.5 text-sm ${isDoctorBox ? 'text-slate-500' : 'text-slate-700'}`}
            >
              <input
                id={`${idPrefix}-${role}`}
                type="checkbox"
                disabled={isDoctorBox}
                checked={isDoctorBox ? isDoctor : value.includes(role)}
                onChange={(e) => onChange(e.target.checked ? [...value, role] : value.filter((r) => r !== role))}
              />
              {roleLabels[role]}
            </label>
          )
        })}
      </div>
      <p id={`${idPrefix}-hint`} className="mt-1 text-xs text-slate-500">
        {isDoctor
          ? 'Doctor is ticked because this person has a doctor profile. Add other roles only if they also do that work.'
          : 'Doctor is given automatically to staff with a doctor profile (Staff → edit the employee → This person is a doctor).'}
      </p>
      {error && (
        <p id={`${idPrefix}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  )
}
