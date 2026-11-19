import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { createPatient, getPatient, updatePatient } from '../../api/patients'
import { FormField, inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import type { PatientDetail, PatientRequest } from '../../types/patient'

const emptyForm: PatientRequest = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  nationalId: '',
  phone: '',
  email: '',
  address: '',
  bloodGroup: '',
  allergies: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
}

function toForm(p: PatientDetail): PatientRequest {
  return {
    firstName: p.firstName,
    lastName: p.lastName,
    dateOfBirth: p.dateOfBirth,
    gender: p.gender,
    nationalId: p.nationalId ?? '',
    phone: p.phone,
    email: p.email ?? '',
    address: p.address ?? '',
    bloodGroup: p.bloodGroup ?? '',
    allergies: p.allergies ?? '',
    emergencyContactName: p.emergencyContactName ?? '',
    emergencyContactPhone: p.emergencyContactPhone ?? '',
  }
}

// The API sends field names like "FirstName"; our form uses "firstName".
function errorsByField(fieldErrors: Record<string, string[]>) {
  const result: Record<string, string> = {}
  for (const [key, messages] of Object.entries(fieldErrors)) {
    const field = key.replace(/^\$\./, '')
    result[field.charAt(0).toLowerCase() + field.slice(1)] = messages[0]
  }
  return result
}

// PDF 3.2 "Register Patient" and "Update Patient Information" (section 7: Add Patient, Edit Patient).
// One form for both: /patients/new creates, /patients/:id/edit updates.
export default function PatientFormPage() {
  const { id } = useParams()
  const isEdit = id !== undefined
  const navigate = useNavigate()

  const [form, setForm] = useState<PatientRequest>(emptyForm)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(isEdit)
  const [today] = useState(() => new Date().toISOString().slice(0, 10)) // latest allowed date of birth

  useEffect(() => {
    if (!isEdit) return
    getPatient(Number(id))
      .then((p) => setForm(toForm(p)))
      .catch(() => setError('Could not load this patient.'))
      .finally(() => setIsLoading(false))
  }, [id, isEdit])

  // One change handler for every input: the input's "name" says which field to update.
  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    setFieldErrors({})
    try {
      const saved = isEdit ? await updatePatient(Number(id), form) : await createPatient(form)
      navigate(`/patients/${saved.id}`)
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

  // Builds the props every text input needs, so the JSX below stays short.
  const field = (name: keyof PatientRequest) => ({
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
      <h1 className="text-xl font-semibold text-slate-900">{isEdit ? 'Edit patient' : 'Register patient'}</h1>

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
          <FormField id="dateOfBirth" label="Date of birth" required error={fieldErrors.dateOfBirth}>
            <input {...field('dateOfBirth')} type="date" required max={today} />
          </FormField>
          <FormField id="gender" label="Gender" required error={fieldErrors.gender}>
            <select {...field('gender')} required>
              <option value="">Select...</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>
          </FormField>
          <FormField id="nationalId" label="NIC" error={fieldErrors.nationalId}>
            <input {...field('nationalId')} placeholder="851234567V or 198512345678" />
          </FormField>
          <FormField id="bloodGroup" label="Blood group" error={fieldErrors.bloodGroup}>
            <select {...field('bloodGroup')}>
              <option value="">Unknown</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </FormField>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 font-medium text-slate-900">Contact</legend>
          <FormField id="phone" label="Phone" required error={fieldErrors.phone}>
            <input {...field('phone')} type="tel" required />
          </FormField>
          <FormField id="email" label="Email" error={fieldErrors.email}>
            <input {...field('email')} type="email" />
          </FormField>
          <div className="sm:col-span-2">
            <FormField id="address" label="Address" error={fieldErrors.address}>
              <input {...field('address')} maxLength={300} />
            </FormField>
          </div>
          <FormField id="emergencyContactName" label="Emergency contact name" error={fieldErrors.emergencyContactName}>
            <input {...field('emergencyContactName')} maxLength={200} />
          </FormField>
          <FormField id="emergencyContactPhone" label="Emergency contact phone" error={fieldErrors.emergencyContactPhone}>
            <input {...field('emergencyContactPhone')} type="tel" />
          </FormField>
        </fieldset>

        <FormField id="allergies" label="Allergies" error={fieldErrors.allergies}>
          <textarea {...field('allergies')} rows={2} maxLength={500} />
        </FormField>

        <div className="flex gap-3">
          <button type="submit" className={primaryButtonClass} disabled={isSaving}>
            {isSaving ? 'Saving...' : isEdit ? 'Save changes' : 'Register patient'}
          </button>
          <Link to={isEdit ? `/patients/${id}` : '/patients'} className={secondaryButtonClass}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
