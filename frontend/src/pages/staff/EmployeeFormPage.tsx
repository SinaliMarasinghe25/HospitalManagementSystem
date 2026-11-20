import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { listDepartments } from '../../api/doctors'
import { createEmployee, getEmployee, updateEmployee } from '../../api/staff'
import { FormField, inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import type { Department } from '../../types/doctor'
import type { EmployeeForm } from '../../types/staff'
import { todayInHospital } from '../../utils/format'
import { errorsByField } from '../../utils/formErrors'

const emptyForm: EmployeeForm = {
  firstName: '',
  lastName: '',
  jobTitle: '',
  phone: '',
  email: '',
  hireDate: '',
  departmentId: '',
  isActive: true,
}

// FR-ST-01 "Employee registration" and FR-ST-03 "Department assignment".
// Doctors are added on the Doctors page instead, because they also need a licence, fee and schedule.
export default function EmployeeFormPage() {
  const { id } = useParams()
  const isEdit = id !== undefined
  const navigate = useNavigate()

  const [form, setForm] = useState<EmployeeForm>(emptyForm)
  const [currentDepartmentId, setCurrentDepartmentId] = useState<number | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(isEdit)
  const [today] = useState(() => todayInHospital())

  useEffect(() => {
    listDepartments(true).then(setDepartments).catch(() => setError('Could not load departments.'))
    if (!isEdit) return
    getEmployee(Number(id))
      .then((e) => {
        if (e.doctorId !== null) {
          // Doctors are edited in one place only.
          navigate(`/doctors/${e.doctorId}/edit`, { replace: true })
          return
        }
        setCurrentDepartmentId(e.departmentId)
        setForm({
          firstName: e.firstName,
          lastName: e.lastName,
          jobTitle: e.jobTitle,
          phone: e.phone ?? '',
          email: e.email ?? '',
          hireDate: e.hireDate,
          departmentId: String(e.departmentId),
          isActive: e.isActive,
        })
      })
      .catch(() => setError('Could not load this employee.'))
      .finally(() => setIsLoading(false))
  }, [id, isEdit, navigate])

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = event.target
    const newValue = type === 'checkbox' ? (event.target as HTMLInputElement).checked : value
    setForm((current) => ({ ...current, [name]: newValue }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    setFieldErrors({})
    try {
      const saved = isEdit ? await updateEmployee(Number(id), form) : await createEmployee(form)
      navigate(`/staff/employees/${saved.id}`)
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) {
        const byField = errorsByField(err.fieldErrors)
        setFieldErrors(byField)
        setError(byField.employee ?? 'Please correct the highlighted fields.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not save. Please try again.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const field = (name: Exclude<keyof EmployeeForm, 'isActive'>) => ({
    id: name,
    name,
    value: form[name],
    onChange: handleChange,
    className: inputClass,
    'aria-invalid': fieldErrors[name] ? true : undefined,
    'aria-describedby': fieldErrors[name] ? `${name}-error` : undefined,
  })

  if (isLoading) return <p role="status">Loading...</p>

  // Inactive departments are hidden, except the one the employee is already in.
  const departmentOptions = departments.filter((d) => d.isActive || d.id === currentDepartmentId)

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">{isEdit ? 'Edit employee' : 'Add employee'}</h1>
      {!isEdit && (
        <p className="text-sm text-slate-600">
          Adding a doctor? Use <Link to="/doctors/new" className="text-blue-700 hover:underline">Add doctor</Link>{' '}
          instead, so the licence, fee and schedule are recorded too.
        </p>
      )}

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 font-medium text-slate-900">Personal details</legend>
          <FormField id="firstName" label="First name" required error={fieldErrors.firstName}>
            <input {...field('firstName')} required maxLength={100} />
          </FormField>
          <FormField id="lastName" label="Last name" required error={fieldErrors.lastName}>
            <input {...field('lastName')} required maxLength={100} />
          </FormField>
          <FormField id="phone" label="Phone" required error={fieldErrors.phone}>
            <input {...field('phone')} type="tel" required />
          </FormField>
          <FormField id="email" label="Email" error={fieldErrors.email}>
            <input {...field('email')} type="email" maxLength={256} />
          </FormField>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 font-medium text-slate-900">Job</legend>
          <FormField id="jobTitle" label="Job title" required error={fieldErrors.jobTitle}>
            <input {...field('jobTitle')} required maxLength={100} placeholder="e.g. Staff Nurse" />
          </FormField>
          <FormField id="departmentId" label="Department" required error={fieldErrors.departmentId}>
            <select {...field('departmentId')} required>
              <option value="">Select...</option>
              {departmentOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.isActive ? '' : ' (inactive)'}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="hireDate" label="Hire date" required error={fieldErrors.hireDate}>
            <input {...field('hireDate')} type="date" max={today} required />
          </FormField>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
            <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleChange} />
            Active (still working here)
          </label>
        </fieldset>

        <div className="flex gap-3">
          <button type="submit" className={primaryButtonClass} disabled={isSaving}>
            {isSaving ? 'Saving...' : isEdit ? 'Save changes' : 'Add employee'}
          </button>
          <Link to={isEdit ? `/staff/employees/${id}` : '/staff'} className={secondaryButtonClass}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
