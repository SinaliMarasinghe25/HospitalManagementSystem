import { Link } from 'react-router'
import { Permissions } from '../auth/permissions'
import { hasAnyRole, Roles, type Role } from '../auth/roles'
import { useAuth } from '../auth/useAuth'
import { StatusBadge } from '../components/appointments/StatusBadge'
import { DashboardTile } from '../components/dashboard/DashboardTile'
import { useDashboard } from '../components/dashboard/useDashboard'
import type { DashboardSummary, DashboardTile as TileKey } from '../types/dashboard'
import { formatClock, formatMoney, formatTimestamp } from '../utils/format'

// PDF section 7, Dashboard: five tiles (UI-DSH-01 to 05).
// The API decides which tiles each role gets (Services/DashboardService.cs) and sends every number in one answer,
// so all tiles are counted at the same moment. A role only sees its own tiles; nothing is shown as "--".

export default function DashboardPage() {
  const { user } = useAuth()
  const { summary, error, loading, refresh } = useDashboard()
  const can = (allowed: readonly Role[]) => hasAnyRole(user?.roles, allowed)
  // A doctor's tile counts only their own appointments (role table: Doctor "Own").
  const ownAppointmentsOnly = can([Roles.Doctor]) && !can([Roles.Administrator, Roles.Nurse, Roles.Receptionist])

  // How each tile looks. `to` is only set when the user may open that page.
  function tile(key: TileKey, s: DashboardSummary) {
    switch (key) {
      case 'patients':
        return (
          <DashboardTile key={key} label="Total Patients" value={s.totalPatients} detail="registered"
            to={can(Permissions.viewPatients) ? '/patients' : undefined} />
        )
      case 'appointments':
        return (
          <DashboardTile key={key} label="Today's Appointments" value={s.appointments?.count}
            detail={ownAppointmentsOnly ? 'yours, not cancelled' : 'not cancelled'}
            to="/appointments" />
        )
      case 'lab':
        return (
          <DashboardTile key={key} label="Laboratory Requests" value={s.openLabRequests}
            detail="waiting for sample or result" to="/laboratory" />
        )
      case 'pharmacy': {
        const p = s.pharmacyAlerts!
        return (
          <DashboardTile key={key} label="Pharmacy Alerts" value={p.lowStock + p.nearExpiry + p.expired}
            detail={`${p.lowStock} low stock, ${p.nearExpiry} expiring soon, ${p.expired} expired`}
            to="/pharmacy?tab=alerts" />
        )
      }
      case 'revenue': {
        const r = s.revenue!
        return (
          <DashboardTile key={key} label="Revenue Summary" value={formatMoney(r.today)}
            detail={`received today; ${formatMoney(r.thisMonth)} this month; ${formatMoney(r.outstandingBalance)} still due`}
            to="/billing?tab=due" />
        )
      }
    }
  }

  const today = summary?.appointments?.items ?? []

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <span className="text-xs text-slate-500" aria-live="polite">
          {summary ? `Updated ${formatTimestamp(summary.generatedAt)}` : loading ? 'Loading...' : ''}
        </span>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="ml-auto rounded-md px-3 py-1.5 text-sm font-medium text-blue-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">
          {error} {summary && 'The numbers below may be out of date.'}
        </p>
      )}

      {summary && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {summary.tiles.map((key) => tile(key, summary))}
        </div>
      )}

      {today.length > 0 && (
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
