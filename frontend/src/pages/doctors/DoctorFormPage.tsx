import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { createDoctor, getDoctor, listDepartments, updateDoctor } from '../../api/doctors'
import { FormField, inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import type { Department, DoctorForm } from '../../types/doctor'
import { errorsByField } from '../../utils/formErrors'

const emptyForm: DoctorForm = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  hireDate: '',
  departmentId: '',
  specialization: '',
  licenseNumber: '',
  consultationFee: '',
  slotMinutes: '15',
  isActive: true,
  userName: '',
  password: '',
}

// PDF 3.3 "Add Doctor", "Update Doctor Details" and "Department Assignment".
export default function DoctorFormPage() {
  const { id } = useParams()
  const isEdit = id !== undefined
  const navigate = useNavigate()

  const [form, setForm] = useState<DoctorForm>(emptyForm)
  const [departments, setDepartments] = useState<Department[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(isEdit)

  useEffect(() => {
    listDepartments().then(setDepartments).catch(() => setError('Could not load departments.'))
    if (!isEdit) return
    getDoctor(Number(id))
      .then((d) =>
        setForm({
          firstName: d.firstName,
          lastName: d.lastName,
          phone: d.phone ?? '',
          email: d.email ?? '',
          hireDate: d.hireDate,
          departmentId: String(d.departmentId),
          specialization: d.specialization,
          licenseNumber: d.licenseNumber,
          consultationFee: String(d.consultationFee),
          slotMinutes: String(d.slotMinutes),
          isActive: d.isActive,
          userName: '',
          password: '',
        }),
      )
      .catch(() => setError('Could not load this doctor.'))
      .finally(() => setIsLoading(false))
  }, [id, isEdit])

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
      const saved = isEdit ? await updateDoctor(Number(id), form) : await createDoctor(form)
      navigate(`/doctors/${saved.id}`)
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) {
        setFieldErrors(errorsByField(err.fieldErrors))
        setError('Please correct the highlighted fields.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not save. Please try again.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const field = (name: Exclude<keyof DoctorForm, 'isActive'>) => ({
    id: name,
    name,
    value: form[name],
    onChange: handleChange,
    className: inputClass,
    'aria-invalid': fieldErrors[name] ? true : undefined,
    'aria-describedby': fieldErrors[name] ? `${name}-error` : undefined,
  })

  if (isLoading) return <p role="status">Loading...</p>

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">{isEdit ? 'Edit doctor' : 'Add doctor'}</h1>

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
            <input {...field('email')} type="email" />
          </FormField>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 font-medium text-slate-900">Professional details</legend>
          <FormField id="departmentId" label="Department" required error={fieldErrors.departmentId}>
            <select {...field('departmentId')} required>
              <option value="">Select...</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="specialization" label="Specialisation" required error={fieldErrors.specialization}>
            <input {...field('specialization')} required maxLength={100} placeholder="e.g. Cardiologist" />
          </FormField>
          <FormField id="licenseNumber" label="SLMC registration number" required error={fieldErrors.licenseNumber}>
            <input {...field('licenseNumber')} required maxLength={50} />
          </FormField>
          <FormField id="hireDate" label="Hire date" required error={fieldErrors.hireDate}>
            <input {...field('hireDate')} type="date" required />
          </FormField>
          <FormField id="consultationFee" label="Consultation fee (LKR)" required error={fieldErrors.consultationFee}>
            <input {...field('consultationFee')} type="number" min={0} step="0.01" required />
          </FormField>
          <FormField id="slotMinutes" label="Appointment length (minutes)" required error={fieldErrors.slotMinutes}>
            <input {...field('slotMinutes')} type="number" min={5} max={120} step={5} required />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleChange} />
            Active (can be booked)
          </label>
        </fieldset>

        {!isEdit && (
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-1 font-medium text-slate-900">Login account (optional)</legend>
            <p className="text-sm text-slate-600 sm:col-span-2">
              Fill these in to let the doctor sign in. They get the Doctor role.
            </p>
            <FormField id="userName" label="Username" error={fieldErrors.userName}>
              <input {...field('userName')} autoComplete="off" />
            </FormField>
            <FormField id="password" label="Temporary password" error={fieldErrors.password}>
              <input {...field('password')} type="password" autoComplete="new-password" />
            </FormField>
          </fieldset>
        )}

        <div className="flex gap-3">
          <button type="submit" className={primaryButtonClass} disabled={isSaving}>
            {isSaving ? 'Saving...' : isEdit ? 'Save changes' : 'Add doctor'}
          </button>
          <Link to={isEdit ? `/doctors/${id}` : '/doctors'} className={secondaryButtonClass}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
