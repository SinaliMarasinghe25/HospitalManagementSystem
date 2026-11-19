import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { cancelAppointment, getAppointment, updateAppointmentStatus } from '../../api/appointments'
import { ApiError } from '../../api/client'
import { Permissions } from '../../auth/permissions'
import { hasAnyRole } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { canChangeBooking, statusActions } from '../../components/appointments/appointmentRules'
import { StatusBadge } from '../../components/appointments/StatusBadge'
import { inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import type { Appointment, AppointmentStatus } from '../../types/appointment'
import { formatClock, formatDateTime } from '../../utils/format'

// One appointment: details, status tracking (FR-AP-04), cancel (FR-AP-02) and reschedule (FR-AP-03).
export default function AppointmentDetailPage() {
  const { id } = useParams()
  const appointmentId = Number(id)
  const { user } = useAuth()
  const canSeePatient = hasAnyRole(user?.roles, Permissions.viewPatients)

  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getAppointment(appointmentId)
      .then(setAppointment)
      .catch((err: unknown) =>
        setError(err instanceof ApiError && err.status === 404 ? 'Appointment not found.' : 'Could not load the appointment.'),
      )
  }, [appointmentId])

  function showError(err: unknown) {
    setError(err instanceof ApiError ? (Object.values(err.fieldErrors)[0]?.[0] ?? err.message) : 'Could not save.')
  }

  async function changeStatus(next: AppointmentStatus) {
    setBusy(true)
    setError(null)
    try {
      setAppointment(await updateAppointmentStatus(appointmentId, next))
    } catch (err) {
      showError(err)
    } finally {
      setBusy(false)
    }
  }

  async function handleCancel(event: FormEvent) {
    event.preventDefault()
    if (cancelReason.trim() === '') {
      setError('Enter a reason for cancelling.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      setAppointment(await cancelAppointment(appointmentId, cancelReason))
      setCancelling(false)
    } catch (err) {
      showError(err)
    } finally {
      setBusy(false)
    }
  }

  if (!appointment) {
    return error ? (
      <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
        {error}
      </p>
    ) : (
      <p className="text-slate-500">Loading...</p>
    )
  }

  const actions = statusActions(appointment, user?.roles)
  const canChange = canChangeBooking(appointment, user?.roles)

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Appointment #{appointment.id}</h1>
        <Link to="/appointments" className={secondaryButtonClass}>
          Back to calendar
        </Link>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Item label="Status">
            <StatusBadge status={appointment.status} />
          </Item>
          <Item label="Time">
            {formatDateTime(appointment.startTime)} to {formatClock(appointment.endTime)}
          </Item>
          <Item label="Patient">
            {canSeePatient ? (
              <Link to={`/patients/${appointment.patientId}`} className="text-blue-700 hover:underline">
                {appointment.patientName}
              </Link>
            ) : (
              appointment.patientName
            )}{' '}
            <span className="text-slate-500">({appointment.patientNumber})</span>
          </Item>
          <Item label="Doctor">
            Dr {appointment.doctorName} <span className="text-slate-500">({appointment.departmentName})</span>
          </Item>
          <Item label="Reason">{appointment.reason ?? '-'}</Item>
          <Item label="Booked">{formatDateTime(appointment.createdAt)}</Item>
          {appointment.cancellationReason && <Item label="Cancellation reason">{appointment.cancellationReason}</Item>}
          {appointment.rescheduledFromId && (
            <Item label="Rescheduled from">
              <Link to={`/appointments/${appointment.rescheduledFromId}`} className="text-blue-700 hover:underline">
                Appointment #{appointment.rescheduledFromId}
              </Link>
            </Item>
          )}
          {appointment.rescheduledToId && (
            <Item label="Moved to">
              <Link to={`/appointments/${appointment.rescheduledToId}`} className="text-blue-700 hover:underline">
                Appointment #{appointment.rescheduledToId}
              </Link>
            </Item>
          )}
        </dl>
      </section>

      {(actions.length > 0 || canChange) && (
        <section className="space-y-3 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-base font-medium text-slate-900">Actions</h2>
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <button
                key={action.status}
                type="button"
                disabled={busy}
                onClick={() => void changeStatus(action.status)}
                className={primaryButtonClass}
              >
                {action.label}
              </button>
            ))}
            {canChange && (
              <>
                <Link to={`/appointments/${appointment.id}/reschedule`} className={secondaryButtonClass}>
                  Reschedule
                </Link>
                {!cancelling && (
                  <button type="button" onClick={() => setCancelling(true)} className={secondaryButtonClass}>
                    Cancel appointment
                  </button>
                )}
              </>
            )}
          </div>

          {cancelling && (
            <form onSubmit={handleCancel} className="space-y-2">
              <label htmlFor="cancel-reason" className="block text-sm font-medium text-slate-700">
                Reason for cancelling<span className="text-red-600"> *</span>
              </label>
              <textarea
                id="cancel-reason"
                rows={2}
                maxLength={500}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className={inputClass}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
                >
                  Confirm cancellation
                </button>
                <button type="button" onClick={() => setCancelling(false)} className={secondaryButtonClass}>
                  Keep appointment
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
  )
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-900">{children}</dd>
    </div>
  )
}
