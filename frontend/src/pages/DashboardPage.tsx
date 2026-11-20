import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { listAppointments } from '../api/appointments'
import { openLabRequestCount } from '../api/lab'
import { countPharmacyAlerts } from '../api/pharmacy'
import { Permissions } from '../auth/permissions'
import { hasAnyRole } from '../auth/roles'
import { useAuth } from '../auth/useAuth'
import { StatusBadge } from '../components/appointments/StatusBadge'
import type { Appointment } from '../types/appointment'
import type { PharmacyAlertCounts } from '../types/pharmacy'
import { formatClock, todayInHospital } from '../utils/format'

// PDF section 7, Dashboard. The five tiles get real numbers as each module is built.
const placeholderTiles = ['Total Patients', 'Revenue Summary']

export default function DashboardPage() {
  const { user } = useAuth()
  const canSeeAppointments = hasAnyRole(user?.roles, Permissions.viewAppointments)
  const [today, setToday] = useState<Appointment[] | null>(null)
  const canSeeLab = hasAnyRole(user?.roles, Permissions.viewLabRequests)
  const [openLab, setOpenLab] = useState<number | null>(null)
  // Role table: the Pharmacy Alerts tile is for the administrator and the pharmacist.
  const canSeePharmacy = hasAnyRole(user?.roles, Permissions.pharmacyQueue)
  const [pharmacy, setPharmacy] = useState<PharmacyAlertCounts | null>(null)

  // UI-DSH-05 Pharmacy Alerts: low stock, expiring soon and expired batches.
  useEffect(() => {
    if (!canSeePharmacy) return
    countPharmacyAlerts()
      .then(setPharmacy)
      .catch(() => setPharmacy(null))
  }, [canSeePharmacy])

  // UI-DSH-04 Laboratory Requests: tests waiting for a sample or a result.
  useEffect(() => {
    if (!canSeeLab) return
    openLabRequestCount()
      .then((r) => setOpenLab(r.count))
      .catch(() => setOpenLab(null))
  }, [canSeeLab])

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
        <Link
          to={canSeeLab ? '/laboratory' : '/'}
          className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:ring-blue-300"
        >
          <p className="text-sm text-slate-600">Laboratory Requests</p>
          <p className={`mt-2 text-2xl font-semibold ${openLab !== null ? 'text-slate-900' : 'text-slate-400'}`}>
            {openLab ?? '--'}
          </p>
          {openLab !== null && <p className="text-xs text-slate-500">waiting for sample or result</p>}
        </Link>
        <Link
          to={canSeePharmacy ? '/pharmacy?tab=alerts' : '/'}
          className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:ring-blue-300"
        >
          <p className="text-sm text-slate-600">Pharmacy Alerts</p>
          <p className={`mt-2 text-2xl font-semibold ${pharmacy ? 'text-slate-900' : 'text-slate-400'}`}>
            {pharmacy ? pharmacy.lowStock + pharmacy.nearExpiry + pharmacy.expired : '--'}
          </p>
          {pharmacy && (
            <p className="text-xs text-slate-500">
              {pharmacy.lowStock} low stock, {pharmacy.nearExpiry} expiring soon, {pharmacy.expired} expired
            </p>
          )}
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
