import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { listAppointments, updateAppointmentStatus } from '../../api/appointments'
import { ApiError } from '../../api/client'
import { Permissions } from '../../auth/permissions'
import { hasAnyRole, Roles } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { canChangeBooking, statusActions, statusLabels } from '../../components/appointments/appointmentRules'
import { DoctorPicker } from '../../components/appointments/DoctorPicker'
import { StatusBadge } from '../../components/appointments/StatusBadge'
import { inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import { appointmentStatuses, type Appointment, type AppointmentStatus } from '../../types/appointment'
import {
  addDays,
  formatClock,
  formatDate,
  formatDayHeading,
  hospitalDateOf,
  startOfWeek,
  todayInHospital,
} from '../../utils/format'

type View = 'day' | 'week'

// PDF 3.4 and section 7 Appointment Screen: Calendar View (UI-APT-02), with day and week views.
// The view, date, doctor and status live in the URL, so a refresh or a shared link shows the same calendar.
export default function AppointmentsPage() {
  const { user } = useAuth()
  const canBook = hasAnyRole(user?.roles, Permissions.bookAppointments)
  // A doctor only sees their own appointments, so the doctor filter is not needed.
  const onlyOwn = hasAnyRole(user?.roles, [Roles.Doctor]) && !hasAnyRole(user?.roles, [Roles.Administrator, Roles.Nurse, Roles.Receptionist])

  const [params, setParams] = useSearchParams()
  const view: View = params.get('view') === 'week' ? 'week' : 'day'
  const date = params.get('date') ?? todayInHospital()
  const doctorId = params.get('doctorId') ?? ''
  const status = params.get('status') ?? ''

  const fromDate = view === 'week' ? startOfWeek(date) : date
  const toDate = view === 'week' ? addDays(fromDate, 6) : date

  const [appointments, setAppointments] = useState<Appointment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let ignore = false
    listAppointments({ fromDate, toDate, doctorId, status })
      .then((data) => {
        if (!ignore) {
          setAppointments(data)
          setError(null)
        }
      })
      .catch((err: unknown) => !ignore && setError(err instanceof ApiError ? err.message : 'Could not load appointments.'))
    return () => {
      ignore = true
    }
  }, [fromDate, toDate, doctorId, status, reloadKey])

  function update(next: Partial<Record<'view' | 'date' | 'doctorId' | 'status', string>>) {
    const merged = { view, date, doctorId, status, ...next }
    setParams(Object.fromEntries(Object.entries(merged).filter(([, v]) => v)))
  }

  async function changeStatus(appointment: Appointment, next: AppointmentStatus) {
    try {
      await updateAppointmentStatus(appointment.id, next)
      setReloadKey((k) => k + 1)
    } catch (err) {
      const message = err instanceof ApiError ? (Object.values(err.fieldErrors)[0]?.[0] ?? err.message) : 'Could not update.'
      setError(message)
    }
  }

  const step = view === 'week' ? 7 : 1
  const days = view === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(fromDate, i)) : [date]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Appointments</h1>
        {canBook && (
          <Link to="/appointments/new" className={primaryButtonClass}>
            Book appointment
          </Link>
        )}
      </div>

      {/* Toolbar: view, date navigation, filters */}
      <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-end gap-2">
          <div className="inline-flex rounded-md shadow-sm" role="group" aria-label="Calendar view">
            {(['day', 'week'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => update({ view: v })}
                className={`border border-slate-300 px-3 py-2 text-sm font-medium first:rounded-l-md last:rounded-r-md ${
                  view === v ? 'bg-blue-700 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {v === 'day' ? 'Day' : 'Week'}
              </button>
            ))}
          </div>
          <button type="button" className={secondaryButtonClass} onClick={() => update({ date: addDays(date, -step) })}>
            <span aria-hidden="true">&larr;</span> Previous
          </button>
          <button type="button" className={secondaryButtonClass} onClick={() => update({ date: todayInHospital() })}>
            Today
          </button>
          <button type="button" className={secondaryButtonClass} onClick={() => update({ date: addDays(date, step) })}>
            Next <span aria-hidden="true">&rarr;</span>
          </button>
          <div>
            <label htmlFor="calendar-date" className="sr-only">
              Date
            </label>
            <input
              id="calendar-date"
              type="date"
              value={date}
              onChange={(e) => e.target.value && update({ date: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="status-filter" className="sr-only">
              Status
            </label>
            <select
              id="status-filter"
              value={status}
              onChange={(e) => update({ status: e.target.value })}
              className={inputClass}
            >
              <option value="">All statuses</option>
              {appointmentStatuses.map((s) => (
                <option key={s} value={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {!onlyOwn && (
          <div className="max-w-2xl">
            <DoctorPicker idPrefix="filter" doctorId={doctorId} allowAll onChange={(id) => update({ doctorId: id })} />
          </div>
        )}
      </div>

      <h2 className="text-lg font-medium text-slate-800">
        {view === 'week' ? `Week of ${formatDate(fromDate)} to ${formatDate(toDate)}` : formatDayHeading(date)}
        {appointments && <span className="ml-2 text-sm font-normal text-slate-500">({appointments.length} appointments)</span>}
      </h2>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {view === 'day' ? (
        <DayTable
          appointments={appointments}
          roles={user?.roles}
          onStatus={changeStatus}
          showDoctor={!onlyOwn}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-7">
          {days.map((day) => {
            const items = appointments?.filter((a) => hospitalDateOf(a.startTime) === day) ?? []
            const isToday = day === todayInHospital()
            return (
              <section
                key={day}
                aria-label={formatDayHeading(day)}
                className={`min-h-32 rounded-xl bg-white p-2 shadow-sm ring-1 ${isToday ? 'ring-blue-400' : 'ring-slate-200'}`}
              >
                <h3 className="mb-2 text-sm font-semibold text-slate-700">
                  <button type="button" className="hover:underline" onClick={() => update({ view: 'day', date: day })}>
                    {formatDayHeading(day)}
                  </button>
                </h3>
                <ul className="space-y-2">
                  {items.map((a) => (
                    <li key={a.id}>
                      <Link
                        to={`/appointments/${a.id}`}
                        className={`block rounded-md border border-slate-200 p-2 text-xs hover:bg-slate-50 ${
                          a.status === 'Cancelled' || a.status === 'Rescheduled' ? 'opacity-60' : ''
                        }`}
                      >
                        <span className="font-semibold text-slate-900">{formatClock(a.startTime)}</span>{' '}
                        <span className="text-slate-800">{a.patientName}</span>
                        {!onlyOwn && <span className="block text-slate-500">Dr {a.doctorName}</span>}
                        <span className="mt-1 block">
                          <StatusBadge status={a.status} />
                        </span>
                      </Link>
                    </li>
                  ))}
                  {appointments && items.length === 0 && <li className="text-xs text-slate-400">No appointments</li>}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DayTable({
  appointments,
  roles,
  onStatus,
  showDoctor,
}: {
  appointments: Appointment[] | null
  roles: string[] | undefined
  onStatus: (a: Appointment, s: AppointmentStatus) => void
  showDoctor: boolean
}) {
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Time</th>
            <th scope="col" className="px-4 py-3 font-medium">Patient</th>
            {showDoctor && <th scope="col" className="px-4 py-3 font-medium">Doctor</th>}
            <th scope="col" className="px-4 py-3 font-medium">Reason</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
            <th scope="col" className="px-4 py-3 font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {appointments?.map((a) => (
            <tr key={a.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 whitespace-nowrap">
                <Link to={`/appointments/${a.id}`} className="font-medium text-blue-700 hover:underline">
                  {formatClock(a.startTime)} to {formatClock(a.endTime)}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate-700">
                {a.patientName}
                <span className="block text-xs text-slate-500">{a.patientNumber}</span>
              </td>
              {showDoctor && (
                <td className="px-4 py-3 text-slate-700">
                  Dr {a.doctorName}
                  <span className="block text-xs text-slate-500">{a.departmentName}</span>
                </td>
              )}
              <td className="px-4 py-3 text-slate-700">{a.reason ?? '-'}</td>
              <td className="px-4 py-3">
                <StatusBadge status={a.status} />
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap justify-end gap-2">
                  {statusActions(a, roles).map((action) => (
                    <button
                      key={action.status}
                      type="button"
                      onClick={() => onStatus(a, action.status)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      {action.label}
                      <span className="sr-only"> for {a.patientName}</span>
                    </button>
                  ))}
                  {canChangeBooking(a, roles) && (
                    <Link
                      to={`/appointments/${a.id}/reschedule`}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Reschedule<span className="sr-only"> for {a.patientName}</span>
                    </Link>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {appointments && appointments.length === 0 && (
            <tr>
              <td colSpan={showDoctor ? 6 : 5} className="px-4 py-6 text-center text-slate-500">
                No appointments on this day.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
