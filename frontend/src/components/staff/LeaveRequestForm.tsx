import { useState, type ChangeEvent, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { leaveTypes, type EmployeeSummary, type LeaveForm } from '../../types/staff'
import { addDays, todayInHospital } from '../../utils/format'
import { errorsByField } from '../../utils/formErrors'
import { FormField, inputClass, primaryButtonClass } from '../ui/FormField'

const emptyForm: LeaveForm = { leaveType: '', startDate: '', endDate: '', reason: '' }

// The leave request form, used for "My leave" and, with an employee list, by an administrator
// recording leave for someone else. The API checks the same rules again (overlap, date window).
export function LeaveRequestForm({
  employees,
  onSubmit,
  submitLabel,
  sentMessage = 'Request sent. It is pending until an administrator approves it.',
}: {
  sentMessage?: string
  employees?: EmployeeSummary[]
  onSubmit: (form: LeaveForm, employeeId: number | null) => Promise<void>
  submitLabel: string
}) {
  const [form, setForm] = useState<LeaveForm>(emptyForm)
  const [employeeId, setEmployeeId] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  // Assumption A24: leave may start up to 30 days ago (sick leave recorded afterwards).
  const [minDate] = useState(() => addDays(todayInHospital(), -30))

  const days =
    form.startDate && form.endDate && form.endDate >= form.startDate
      ? Math.round((Date.parse(form.endDate) - Date.parse(form.startDate)) / 86_400_000) + 1
      : null

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = event.target
    setForm((current) => ({
      ...current,
      [name]: value,
      // Picking a start date fills the end date, since most requests are for one day.
      ...(name === 'startDate' && (!current.endDate || current.endDate < value) ? { endDate: value } : {}),
    }))
    setSaved(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    setFieldErrors({})
    try {
      await onSubmit(form, employees ? Number(employeeId) : null)
      setForm(emptyForm)
      setEmployeeId('')
      setSaved(true)
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) {
        const byField = errorsByField(err.fieldErrors)
        setFieldErrors(byField)
        // Errors that do not belong to a field on this form (for example "not linked").
        setError(byField.employee ?? 'Please correct the highlighted fields.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not send the request. Please try again.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const field = (name: keyof LeaveForm) => ({
    id: `leave-${name}`,
    name,
    value: form[name],
    onChange: handleChange,
    className: inputClass,
    'aria-invalid': fieldErrors[name] ? true : undefined,
    'aria-describedby': fieldErrors[name] ? `leave-${name}-error` : undefined,
  })

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="rounded-md bg-green-50 p-3 text-sm text-green-800" role="status">
          {sentMessage}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {employees && (
          <FormField id="leave-employeeId" label="Employee" required error={fieldErrors.employeeId}>
            <select
              id="leave-employeeId"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className={inputClass}
              required
            >
              <option value="">Select...</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName} ({e.employeeNumber})
                </option>
              ))}
            </select>
          </FormField>
        )}
        <FormField id="leave-leaveType" label="Leave type" required error={fieldErrors.leaveType}>
          <select {...field('leaveType')} required>
            <option value="">Select...</option>
            {leaveTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="leave-startDate" label="First day" required error={fieldErrors.startDate}>
          <input {...field('startDate')} type="date" min={minDate} required />
        </FormField>
        <FormField id="leave-endDate" label="Last day" required error={fieldErrors.endDate}>
          <input {...field('endDate')} type="date" min={form.startDate || minDate} required />
        </FormField>
        <div className="sm:col-span-2">
          <FormField id="leave-reason" label="Reason (optional)" error={fieldErrors.reason}>
            <textarea {...field('reason')} rows={2} maxLength={500} />
          </FormField>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={primaryButtonClass} disabled={isSaving}>
          {isSaving ? 'Sending...' : submitLabel}
        </button>
        {days !== null && (
          <p className="text-sm text-slate-600">
            {days} calendar {days === 1 ? 'day' : 'days'}
          </p>
        )}
      </div>
    </form>
  )
}
