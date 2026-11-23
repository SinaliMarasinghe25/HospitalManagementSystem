import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { bookAppointment, getAppointment, getSlots, rescheduleAppointment } from '../../api/appointments'
import { ApiError } from '../../api/client'
import { getPatient } from '../../api/patients'
import { PatientSearch, type ChosenPatient } from '../../components/patients/PatientSearch'
import { DoctorPicker } from '../../components/appointments/DoctorPicker'
import { FormField, inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import type { Appointment, Slot } from '../../types/appointment'
import { errorsByField } from '../../utils/formErrors'
import { formatClock, formatDateTime, hospitalDateOf, todayInHospital } from '../../utils/format'

// UI-APT-01 Schedule Appointment. One page for both:
//   /appointments/new                 book (FR-AP-01), optional ?patientId=3
//   /appointments/:id/reschedule      reschedule (FR-AP-03)
// Only free slots can be picked, so most mistakes are prevented before the API is called.
export default function AppointmentFormPage() {
  const { id } = useParams()
  const rescheduleId = id ? Number(id) : null
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const [original, setOriginal] = useState<Appointment | null>(null)
  const [patient, setPatient] = useState<ChosenPatient | null>(null)
  const [doctorId, setDoctorId] = useState('')
  const [date, setDate] = useState(() => todayInHospital())
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [startTime, setStartTime] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Reschedule: load the appointment being moved. Book: optionally preselect a patient.
  useEffect(() => {
    if (rescheduleId) {
      getAppointment(rescheduleId)
        .then((a) => {
          setOriginal(a)
          setPatient({ id: a.patientId, name: a.patientName, patientNumber: a.patientNumber })
          setDoctorId(String(a.doctorId))
          setDate(hospitalDateOf(a.startTime))
        })
        .catch(() => setFormError('Could not load the appointment.'))
      return
    }
    const patientId = params.get('patientId')
    if (patientId) {
      getPatient(Number(patientId))
        .then((p) => setPatient({ id: p.id, name: `${p.firstName} ${p.lastName}`, patientNumber: p.patientNumber }))
        .catch(() => setFormError('Could not load the patient.'))
    }
  }, [rescheduleId, params])

  // Free slots for the chosen doctor and date.
  useEffect(() => {
    if (!doctorId || !date) {
      return
    }
    let ignore = false
    getSlots(doctorId, date, rescheduleId ?? undefined)
      .then((data) => !ignore && setSlots(data))
      .catch(() => !ignore && setSlots([]))
    return () => {
      ignore = true
    }
  }, [doctorId, date, rescheduleId])

  // Remove a field's error message as soon as the user changes that field.
  function clearError(field: string) {
    setErrors((current) => {
      const { [field]: _removed, ...rest } = current
      return rest
    })
  }

  function chooseDoctor(value: string) {
    setDoctorId(value)
    setStartTime('')
    setSlots(null)
    clearError('doctorId')
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const missing: Record<string, string> = {}
    if (!patient) missing.patientId = 'Choose a patient.'
    if (!doctorId) missing.doctorId = 'Choose a doctor.'
    if (!startTime) missing.startTime = 'Choose a free time slot.'
    setErrors(missing)
    setFormError(null)
    if (Object.keys(missing).length > 0 || !patient) {
      return
    }

    setSaving(true)
    try {
      const saved = rescheduleId
        ? await rescheduleAppointment(rescheduleId, { doctorId: Number(doctorId), startTime })
        : await bookAppointment({ patientId: patient.id, doctorId: Number(doctorId), startTime, reason })
      navigate(`/appointments/${saved.id}`)
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(errorsByField(err.fieldErrors))
        setFormError(err.message)
        // The slot list may be out of date (someone else booked it), so reload it.
        setStartTime('')
        getSlots(doctorId, date, rescheduleId ?? undefined).then(setSlots).catch(() => setSlots([]))
      } else {
        setFormError('Could not save the appointment.')
      }
    } finally {
      setSaving(false)
    }
  }

  const visibleSlots = doctorId ? slots : null

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-[1.75rem] leading-tight font-medium text-slate-900">{rescheduleId ? 'Reschedule appointment' : 'Book appointment'}</h1>

      {original && (
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200">
          Currently booked for <strong>{formatDateTime(original.startTime)}</strong> with Dr {original.doctorName}.
        </p>
      )}

      {formError && (
        <p className="border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {formError}
          {errors.startTime && <span className="block">{errors.startTime}</span>}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-6 rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70">
        {/* 1. Patient */}
        <fieldset className="space-y-2">
          <legend className="text-base font-medium text-slate-900">1. Patient</legend>
          {patient ? (
            <div className="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2 text-sm">
              <span>
                <strong>{patient.name}</strong> ({patient.patientNumber})
              </span>
              {!rescheduleId && (
                <button type="button" className="text-brand-700 hover:underline" onClick={() => setPatient(null)}>
                  Change
                </button>
              )}
            </div>
          ) : (
            <PatientSearch
              onChoose={(p) => {
                setPatient(p)
                clearError('patientId')
              }}
              error={errors.patientId}
            />
          )}
        </fieldset>

        {/* 2. Doctor (UI-APT-03) */}
        <fieldset className="space-y-2">
          <legend className="text-base font-medium text-slate-900">2. Doctor</legend>
          {/* key: when the original appointment loads, the picker starts again with its doctor selected */}
          <DoctorPicker key={original?.id ?? 'new'} idPrefix="book" doctorId={doctorId} onChange={chooseDoctor} error={errors.doctorId} />
        </fieldset>

        {/* 3. Date and free slot */}
        <fieldset className="space-y-3">
          <legend className="text-base font-medium text-slate-900">3. Date and time</legend>
          <div className="max-w-xs">
            <FormField id="date" label="Date" required>
              <input
                id="date"
                type="date"
                min={todayInHospital()}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value)
                  setStartTime('')
                  setSlots(null)
                }}
                className={inputClass}
              />
            </FormField>
          </div>

          {!doctorId && <p className="text-sm text-slate-500">Choose a doctor to see the free times.</p>}
          {doctorId && visibleSlots === null && <p className="text-sm text-slate-500">Loading times...</p>}
          {visibleSlots && visibleSlots.length === 0 && (
            <p className="text-sm text-slate-600">The doctor is not available on this date.</p>
          )}
          {visibleSlots && visibleSlots.length > 0 && (
            <div role="radiogroup" aria-label="Free time slots" aria-describedby={errors.startTime ? 'slot-error' : undefined}>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {visibleSlots.map((slot) => {
                  const selected = slot.startTime === startTime
                  return (
                    <button
                      key={slot.startTime}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={!slot.isAvailable}
                      onClick={() => {
                        setStartTime(slot.startTime)
                        clearError('startTime')
                      }}
                      className={`rounded-lg border px-2 py-2 text-sm font-medium ${
                        selected
                          ? 'border-brand-700 bg-brand-700 text-white'
                          : slot.isAvailable
                            ? 'border-slate-300 bg-white text-slate-800 hover:bg-brand-50'
                            : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through'
                      }`}
                    >
                      {formatClock(slot.startTime)}
                      {!slot.isAvailable && <span className="sr-only"> (not available)</span>}
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-slate-500">Crossed-out times are booked or already past.</p>
            </div>
          )}
          {errors.startTime && (
            <p id="slot-error" className="text-sm text-red-700">
              {errors.startTime}
            </p>
          )}
        </fieldset>

        {/* 4. Reason (booking only; a rescheduled appointment keeps its reason) */}
        {!rescheduleId && (
          <FormField id="reason" label="Reason for visit" error={errors.reason}>
            <textarea
              id="reason"
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={inputClass}
            />
          </FormField>
        )}

        <div className="flex gap-2">
          <button type="submit" disabled={saving} className={primaryButtonClass}>
            {saving ? 'Saving...' : rescheduleId ? 'Reschedule' : 'Book appointment'}
          </button>
          <Link to={rescheduleId ? `/appointments/${rescheduleId}` : '/appointments'} className={secondaryButtonClass}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
