import type { NewLogin } from '../../types/staff'
import { FormField, inputClass } from '../ui/FormField'
import { RoleCheckboxes } from '../users/RoleCheckboxes'

// Username, temporary password and roles for a new login account, made from the person's staff record.
// For a doctor the Doctor role is ticked automatically (assumption A25).
export function NewLoginFields({
  value,
  onChange,
  errors,
  isDoctor,
}: {
  value: NewLogin
  onChange: (login: NewLogin) => void
  errors: Record<string, string>
  isDoctor: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="login-userName" label="Username" required error={errors.userName}>
          <input
            id="login-userName"
            autoComplete="off"
            maxLength={50}
            value={value.userName}
            onChange={(e) => onChange({ ...value, userName: e.target.value })}
            className={inputClass}
            aria-invalid={errors.userName ? true : undefined}
            aria-describedby={errors.userName ? 'login-userName-error' : undefined}
          />
        </FormField>
        <FormField id="login-password" label="Temporary password" required error={errors.password}>
          <input
            id="login-password"
            type="password"
            autoComplete="new-password"
            maxLength={128}
            value={value.password}
            onChange={(e) => onChange({ ...value, password: e.target.value })}
            className={inputClass}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? 'login-password-error' : undefined}
          />
        </FormField>
      </div>
      <p className="text-xs text-slate-500">
        Minimum 8 characters, with upper- and lower-case letters, a number and a symbol. The user must change it at
        first sign-in.
      </p>
      <RoleCheckboxes
        idPrefix="login-role"
        value={value.roles}
        onChange={(roles) => onChange({ ...value, roles })}
        isDoctor={isDoctor}
        error={errors.roles}
      />
    </div>
  )
}
