import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { listAppointments } from '../api/appointments'
import { Permissions } from '../auth/permissions'
import { hasAnyRole } from '../auth/roles'
import { useAuth } from '../auth/useAuth'
import { StatusBadge } from '../components/appointments/StatusBadge'
import type { Appointment } from '../types/appointment'
import { formatClock, todayInHospital } from '../utils/format'

// PDF section 7, Dashboard. The five tiles get real numbers as each module is built.
const placeholderTiles = ['Total Patients', 'Revenue Summary', 'Laboratory Requests', 'Pharmacy Alerts']

export default function DashboardPage() {
  const { user } = useAuth()
  const canSeeAppointments = hasAnyRole(user?.roles, Permissions.viewAppointments)
  const [today, setToday] = useState<Appointment[] | null>(null)

  useEffect(() => {
    if (!canSeeAppointments) return
    const date = todayInHospital()
    listAppointments({ fromDate: date, toDate: date })
      // Cancelled and rescheduled appointments are not real visits today.
      .then((data) => setToday(data.filter((a) => a.status !== 'Cancelled' && a.status !== 'Rescheduled')))
      .catch(() => setToday(null))
  }, [canSeeAppointments])

  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {/* UI-DSH-02 Today's Appointments (a doctor sees only their own) */}
        <Link
          to={canSeeAppointments ? '/appointments' : '/'}
          className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:ring-blue-300"
        >
          <p className="text-sm text-slate-600">Today&apos;s Appointments</p>
          <p className={`mt-2 text-2xl font-semibold ${today ? 'text-slate-900' : 'text-slate-400'}`}>
            {today ? today.length : '--'}
          </p>
        </Link>
        {placeholderTiles.map((tile) => (
          <div key={tile} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-600">{tile}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-400">--</p>
          </div>
        ))}
      </div>

      {today && today.length > 0 && (
        <section className="mt-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200" aria-labelledby="today-heading">
          <h2 id="today-heading" className="font-semibold text-slate-900">Today&apos;s appointments</h2>
          <ul className="mt-2 divide-y divide-slate-100">
            {today.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <Link to={`/appointments/${a.id}`} className="w-14 font-medium text-blue-700 hover:underline">
                  {formatClock(a.startTime)}
                </Link>
                <span className="flex-1 text-slate-800">{a.patientName}</span>
                <span className="text-slate-600">Dr {a.doctorName}</span>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
