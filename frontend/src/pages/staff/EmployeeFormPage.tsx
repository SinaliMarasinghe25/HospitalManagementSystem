import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { ApiError } from '../../api/client'
import { listDepartments } from '../../api/doctors'
import { createEmployee, getEmployee, updateEmployee } from '../../api/staff'
import { NewLoginFields } from '../../components/staff/NewLoginFields'
import { emptyLogin, loginProblems } from '../../components/staff/newLogin'
import { FormField, inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import type { Department } from '../../types/doctor'
import type { EmployeeForm, NewLogin } from '../../types/staff'
import { todayInHospital } from '../../utils/format'
import { errorsByField, firstError } from '../../utils/formErrors'

const emptyForm: EmployeeForm = {
  firstName: '',
  lastName: '',
  jobTitle: '',
  phone: '',
  email: '',
  hireDate: '',
  departmentId: '',
  isActive: true,
  isDoctor: false,
  specialization: '',
  licenseNumber: '',
  consultationFee: '',
  slotMinutes: '15',
}

// The doctor fields come back from the API as "Doctor.LicenseNumber", which errorsByField turns into this.
const doctorFields = ['specialization', 'licenseNumber', 'consultationFee', 'slotMinutes'] as const
type TextField = Exclude<keyof EmployeeForm, 'isActive' | 'isDoctor'>
const errorKey = (name: TextField) =>
  (doctorFields as readonly string[]).includes(name) ? `doctor.${name}` : name

// The ONE form for adding or editing a member of staff (FR-ST-01, FR-ST-03), doctors included (FR-DM-01, FR-DM-02).
// Everyone gets an employee record. Doctors also get a doctor profile. Anyone who uses the system gets a login.
// "/staff/employees/new?doctor=1" opens it with "This person is a doctor" already ticked (from the Doctors page).
export default function EmployeeFormPage() {
  const { id } = useParams()
  const isEdit = id !== undefined
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [form, setForm] = useState<EmployeeForm>(() =>
    !isEdit && searchParams.get('doctor') === '1' ? { ...emptyForm, isDoctor: true, jobTitle: 'Doctor' } : emptyForm,
  )
  const [wasDoctor, setWasDoctor] = useState(false)
  const [currentDepartmentId, setCurrentDepartmentId] = useState<number | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(isEdit)
  const [today] = useState(() => todayInHospital())
  const [withLogin, setWithLogin] = useState(false)
  const [login, setLogin] = useState<NewLogin>(emptyLogin)

  useEffect(() => {
    listDepartments(true).then(setDepartments).catch(() => setError('Could not load departments.'))
    if (!isEdit) return
    getEmployee(Number(id))
      .then((e) => {
        setCurrentDepartmentId(e.departmentId)
        setWasDoctor(e.doctor !== null)
        setForm({
          firstName: e.firstName,
          lastName: e.lastName,
          jobTitle: e.jobTitle,
          phone: e.phone ?? '',
          email: e.email ?? '',
          hireDate: e.hireDate,
          departmentId: String(e.departmentId),
          isActive: e.isActive,
          isDoctor: e.doctor !== null,
          specialization: e.doctor?.specialization ?? '',
          licenseNumber: e.doctor?.licenseNumber ?? '',
          consultationFee: e.doctor ? String(e.doctor.consultationFee) : '',
          slotMinutes: e.doctor ? String(e.doctor.slotMinutes) : '15',
        })
      })
      .catch(() => setError('Could not load this employee.'))
      .finally(() => setIsLoading(false))
  }, [id, isEdit])

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = event.target
    const newValue = type === 'checkbox' ? (event.target as HTMLInputElement).checked : value
    setForm((current) => ({ ...current, [name]: newValue }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setFieldErrors({})
    const wantsLogin = !isEdit && withLogin
    if (wantsLogin) {
      const problems = loginProblems(login, form.isDoctor)
      if (Object.keys(problems).length > 0) {
        setFieldErrors(problems)
        setError('Please correct the highlighted fields.')
        return
      }
    }
    setIsSaving(true)
    try {
      const saved = isEdit ? await updateEmployee(Number(id), form) : await createEmployee(form, wantsLogin ? login : null)
      navigate(`/staff/employees/${saved.id}`)
    } catch (err) {
      const byField = err instanceof ApiError ? errorsByField(err.fieldErrors) : {}
      setFieldErrors(byField)
      setError(
        Object.keys(byField).length > 0
          ? (byField.doctor ?? 'Please correct the highlighted fields.')
          : firstError(err, 'Could not save. Please try again.'),
      )
    } finally {
      setIsSaving(false)
    }
  }

  const field = (name: TextField) => ({
    id: name,
    name,
    value: form[name],
    onChange: handleChange,
    className: inputClass,
    'aria-invalid': fieldErrors[errorKey(name)] ? true : undefined,
    'aria-describedby': fieldErrors[errorKey(name)] ? `${name}-error` : undefined,
  })

  if (isLoading) return <p role="status">Loading...</p>

  // Inactive departments are hidden, except the one the employee is already in.
  const departmentOptions = departments.filter((d) => d.isActive || d.id === currentDepartmentId)
  const title = isEdit ? (wasDoctor ? 'Edit doctor' : 'Edit employee') : form.isDoctor ? 'Add doctor' : 'Add employee'

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      {!isEdit && (
        <p className="text-sm text-slate-600">
          Use this form for everyone who works at the hospital: doctors, nurses, receptionists, accountants and others.
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
            <input {...field('jobTitle')} required maxLength={100} placeholder="e.g. Staff Nurse, Accountant" />
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
          <p className="text-xs text-slate-500 sm:col-span-2">
            Everyone belongs to one department. Office staff go in a non-clinical department, for example an accountant in
            &ldquo;Finance&rdquo; or a receptionist in &ldquo;Front Office&rdquo;. Missing one?{' '}
            <Link to="/staff?tab=departments" className="text-blue-700 hover:underline">
              Add it on Staff &rarr; Departments
            </Link>
            .
          </p>
          <FormField id="hireDate" label="Hire date" required error={fieldErrors.hireDate}>
            <input {...field('hireDate')} type="date" max={today} required />
          </FormField>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
            <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleChange} />
            Active (still working here)
          </label>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-1 font-medium text-slate-900">Doctor</legend>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="isDoctor"
              checked={form.isDoctor}
              onChange={handleChange}
              disabled={wasDoctor}
              aria-describedby="isDoctor-hint"
            />
            This person is a doctor
          </label>
          <p id="isDoctor-hint" className="text-xs text-slate-500">
            {wasDoctor
              ? 'A doctor profile cannot be removed, because appointments and medical records use it. Untick Active instead.'
              : 'Doctors can be booked for appointments. Their login gets the Doctor role automatically.'}
          </p>
          {fieldErrors.doctor && <p className="text-sm text-red-700">{fieldErrors.doctor}</p>}
          {form.isDoctor && (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="specialization" label="Specialisation" required error={fieldErrors['doctor.specialization']}>
                <input {...field('specialization')} required maxLength={100} placeholder="e.g. Cardiologist" />
              </FormField>
              <FormField
                id="licenseNumber"
                label="SLMC registration number"
                required
                error={fieldErrors['doctor.licenseNumber']}
              >
                <input {...field('licenseNumber')} required maxLength={50} />
              </FormField>
              <FormField
                id="consultationFee"
                label="Consultation fee (LKR)"
                required
                error={fieldErrors['doctor.consultationFee']}
              >
                <input {...field('consultationFee')} type="number" min={0} step="0.01" required />
              </FormField>
              <FormField
                id="slotMinutes"
                label="Appointment length (minutes)"
                required
                error={fieldErrors['doctor.slotMinutes']}
              >
                <input {...field('slotMinutes')} type="number" min={5} max={120} step={5} required />
              </FormField>
              <p className="text-xs text-slate-500 sm:col-span-2">
                Set the weekly working hours afterwards, from the employee&apos;s page (Weekly schedule).
              </p>
            </div>
          )}
        </fieldset>

        {!isEdit && (
          <fieldset className="space-y-3">
            <legend className="mb-1 font-medium text-slate-900">Login account (optional)</legend>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={withLogin} onChange={(e) => setWithLogin(e.target.checked)} />
              Create a login for this person now
            </label>
            {withLogin && (
              <NewLoginFields value={login} onChange={setLogin} errors={fieldErrors} isDoctor={form.isDoctor} />
            )}
            {!withLogin && (
              <p className="text-sm text-slate-600">
                Leave this off for staff who do not use the system. You can add a login later from the employee&apos;s page.
              </p>
            )}
          </fieldset>
        )}

        <div className="flex gap-3">
          <button type="submit" className={primaryButtonClass} disabled={isSaving}>
            {isSaving ? 'Saving...' : isEdit ? 'Save changes' : title}
          </button>
          <Link to={isEdit ? `/staff/employees/${id}` : '/staff'} className={secondaryButtonClass}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
