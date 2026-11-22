import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { getDoctor, saveSchedule } from '../../api/doctors'
import { Permissions } from '../../auth/permissions'
import { hasAnyRole } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import { daysOfWeek, type DayOfWeek, type DoctorDetail, type ScheduleItem } from '../../types/doctor'
import { formatDate, formatMoney, formatTime } from '../../utils/format'
import { allErrors } from '../../utils/formErrors'

// One doctor's details and weekly schedule (PDF 3.3 "Schedule Management").
export default function DoctorDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const canManage = hasAnyRole(user?.roles, Permissions.manageDoctors)
  const [doctor, setDoctor] = useState<DoctorDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDoctor(Number(id))
      .then(setDoctor)
      .catch((err: unknown) => setError(err instanceof ApiError && err.status === 404 ? 'Doctor not found.' : 'Could not load doctor.'))
  }, [id])

  if (error) return <p className="border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>
  if (!doctor) return <p role="status">Loading...</p>

  const details: [string, string | null][] = [
    ['Employee number', doctor.employeeNumber],
    ['Department', doctor.departmentName],
    ['Specialisation', doctor.specialization],
    ['SLMC registration', doctor.licenseNumber],
    ['Consultation fee', formatMoney(doctor.consultationFee)],
    ['Appointment length', `${doctor.slotMinutes} minutes`],
    ['Phone', doctor.phone],
    ['Email', doctor.email],
    ['Hire date', formatDate(doctor.hireDate)],
    ['Login account', doctor.userName],
    ['Status', doctor.isActive ? 'Active' : 'Inactive'],
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/doctors" className="text-sm text-brand-700 hover:underline">
            &larr; All doctors
          </Link>
          <h1 className="mt-1 text-[1.75rem] leading-tight font-medium text-slate-900">
            Dr {doctor.firstName} {doctor.lastName}
          </h1>
        </div>
        {canManage && (
          // Doctors are edited with every other member of staff, on the Staff page.
          <Link to={`/staff/employees/${doctor.employeeId}`} className={secondaryButtonClass}>
            Open staff record
          </Link>
        )}
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70" aria-labelledby="details-heading">
        <h2 id="details-heading" className="font-semibold text-slate-900">Details</h2>
        <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {details.map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-slate-500">{label}</dt>
              <dd className="text-slate-900">{value ?? '-'}</dd>
            </div>
          ))}
        </dl>
      </section>

      <ScheduleSection doctor={doctor} canEdit={canManage} onSaved={setDoctor} />
    </div>
  )
}

function ScheduleSection({
  doctor,
  canEdit,
  onSaved,
}: {
  doctor: DoctorDetail
  canEdit: boolean
  onSaved: (d: DoctorDetail) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [rows, setRows] = useState<ScheduleItem[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  function startEditing() {
    setRows(doctor.schedule.map((s) => ({ ...s, startTime: formatTime(s.startTime), endTime: formatTime(s.endTime) })))
    setErrors([])
    setIsEditing(true)
  }

  function updateRow(index: number, change: Partial<ScheduleItem>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...change } : row)))
  }

  async function save() {
    setIsSaving(true)
    setErrors([])
    try {
      onSaved(await saveSchedule(doctor.id, rows))
      setIsEditing(false)
    } catch (err) {
      setErrors(allErrors(err, 'Could not save.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70" aria-labelledby="schedule-heading">
      <div className="flex items-center justify-between">
        <h2 id="schedule-heading" className="font-semibold text-slate-900">Weekly schedule</h2>
        {canEdit && !isEditing && (
          <button type="button" className={secondaryButtonClass} onClick={startEditing}>
            Edit schedule
          </button>
        )}
      </div>

      {!isEditing && (
        <dl className="mt-3 divide-y divide-slate-100">
          {daysOfWeek.map((day) => {
            const blocks = doctor.schedule.filter((s) => s.dayOfWeek === day)
            return (
              <div key={day} className="flex justify-between py-2 text-sm">
                <dt className="font-medium text-slate-700">{day}</dt>
                <dd className={blocks.length ? 'text-slate-900' : 'text-slate-400'}>
                  {blocks.length
                    ? blocks.map((b) => `${formatTime(b.startTime)} - ${formatTime(b.endTime)}`).join(', ')
                    : 'Not working'}
                </dd>
              </div>
            )
          })}
        </dl>
      )}

      {isEditing && (
        <div className="mt-3 space-y-3">
          {errors.length > 0 && (
            <ul className="border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800" role="alert">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {rows.map((row, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor={`day-${index}`}>Day</label>
              <select
                id={`day-${index}`}
                value={row.dayOfWeek}
                onChange={(e) => updateRow(index, { dayOfWeek: e.target.value as DayOfWeek })}
                className={`${inputClass} w-40`}
              >
                {daysOfWeek.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <label className="sr-only" htmlFor={`start-${index}`}>Start time</label>
              <input id={`start-${index}`} type="time" value={row.startTime} required
                onChange={(e) => updateRow(index, { startTime: e.target.value })} className={`${inputClass} w-32`} />
              <span className="text-slate-500">to</span>
              <label className="sr-only" htmlFor={`end-${index}`}>End time</label>
              <input id={`end-${index}`} type="time" value={row.endTime} required
                onChange={(e) => updateRow(index, { endTime: e.target.value })} className={`${inputClass} w-32`} />
              <button type="button" className="text-sm text-red-700 hover:underline"
                onClick={() => setRows((current) => current.filter((_, i) => i !== index))}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="text-sm font-medium text-brand-700 hover:underline"
            onClick={() => setRows((current) => [...current, { dayOfWeek: 'Monday', startTime: '08:00', endTime: '12:00' }])}>
            + Add time block
          </button>
          <div className="flex gap-3 pt-2">
            <button type="button" className={primaryButtonClass} onClick={() => void save()} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save schedule'}
            </button>
            <button type="button" className={secondaryButtonClass} onClick={() => setIsEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
