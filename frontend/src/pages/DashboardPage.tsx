import { Link } from 'react-router'
import { Permissions } from '../auth/permissions'
import { hasAnyRole, Roles, type Role } from '../auth/roles'
import { useAuth } from '../auth/useAuth'
import { StatusBadge } from '../components/appointments/StatusBadge'
import { DashboardTile } from '../components/dashboard/DashboardTile'
import { BillingIcon, CalendarIcon, FlaskIcon, PatientsIcon, PillIcon, RefreshIcon } from '../components/layout/icons'
import { useDashboard } from '../components/dashboard/useDashboard'
import { CornerCard, PanelPicture } from '../components/ui/NotchedPanel'
import type { DashboardSummary, DashboardTile as TileKey } from '../types/dashboard'
import { formatClock, formatTimestamp } from '../utils/format'

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
          <DashboardTile key={key} label="Total Patients" value={s.totalPatients}
            icon={<PatientsIcon width={16} height={16} />} tone="blue"
            to={can(Permissions.viewPatients) ? '/patients' : undefined} />
        )
      case 'appointments':
        return (
          <DashboardTile key={key} label="Today's Appointments" value={s.appointments?.count}
            detail={ownAppointmentsOnly ? 'Yours only' : undefined}
            icon={<CalendarIcon width={16} height={16} />} tone="aqua"
            to="/appointments" />
        )
      case 'lab':
        return (
          <DashboardTile key={key} label="Open Lab Requests" value={s.openLabRequests} to="/laboratory"
            icon={<FlaskIcon width={16} height={16} />} tone="violet" />
        )
      case 'pharmacy': {
        const p = s.pharmacyAlerts!
        return (
          <DashboardTile key={key} label="Pharmacy Alerts" value={p.lowStock + p.nearExpiry + p.expired}
            detail={`${p.lowStock} low · ${p.nearExpiry} expiring · ${p.expired} expired`}
            to="/pharmacy?tab=alerts" icon={<PillIcon width={16} height={16} />} tone="coral" />
        )
      }
      case 'revenue': {
        const r = s.revenue!
        return (
          <DashboardTile key={key} label="Revenue Today" value={`LKR ${Math.round(r.today).toLocaleString('en-LK')}`}
            detail={`Month ${compact(r.thisMonth)} · Due ${compact(r.outstandingBalance)}`}
            to="/billing?tab=due" icon={<BillingIcon width={16} height={16} />} tone="amber" />
        )
      }
    }
  }

  const today = summary?.appointments?.items ?? []

  return (
    <>
      {/* Banner: a soft notched panel with the hospital picture, and the title card in its corner. */}
      <section className="relative min-h-56 sm:min-h-64 lg:min-h-72">
        <div className="absolute inset-x-0 top-0 h-40 sm:h-48 lg:inset-0 lg:h-auto">
          <PanelPicture photo="/images/dashboard-hero.jpg" artClassName="inset-y-4 right-4 left-1/3 lg:left-[45%]" />
        </div>
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <span className="hidden rounded-full bg-white/85 px-4 py-2 font-mono text-[11px] text-slate-600 shadow-sm backdrop-blur sm:inline-block" aria-live="polite">
            {summary ? `Updated ${formatTimestamp(summary.generatedAt)}` : loading ? 'Loading...' : ''}
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            <RefreshIcon width={16} height={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
        <CornerCard side="left" className="pt-28 sm:pt-36 lg:pt-0 lg:w-[24rem]">
          <div className="rounded-[1.5rem] bg-white p-6 shadow-card ring-1 ring-slate-200/60">
            <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.08em] text-slate-500 uppercase">
              <span className="h-2 w-2 rounded-full bg-accent-400 shadow-[0_0_8px] shadow-accent-400/70" aria-hidden="true" />
              {greeting()}, {user?.userName}
            </p>
            <h1 className="mt-3 text-5xl leading-none font-semibold tracking-[-0.035em] text-slate-900">Dashboard</h1>
          </div>
        </CornerCard>
      </section>

      {summary && (
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5 [&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-1">
          {summary.tiles.map((key) => tile(key, summary))}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800">
          {error} {summary && 'The numbers above may be out of date.'}
        </p>
      )}

      {today.length > 0 && (
        <section
          className="mt-8 overflow-hidden rounded-[1.5rem] bg-white shadow-card ring-1 ring-slate-200/70"
          aria-labelledby="today-heading"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 id="today-heading" className="font-display text-xl text-slate-900">Today&apos;s appointments</h2>
            <Link to="/appointments" className="font-mono text-[11px] tracking-wide text-brand-700 uppercase hover:underline">
              View all
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {today.map((a) => (
              <li key={a.id} className="flex items-center gap-4 px-5 py-3 text-sm hover:bg-slate-50/60">
                <Link
                  to={`/appointments/${a.id}`}
                  className="w-14 shrink-0 font-mono text-sm font-medium text-brand-700 hover:underline"
                >
                  {formatClock(a.startTime)}
                </Link>
                <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:gap-4">
                  <span className="truncate font-medium text-slate-800 sm:flex-1">{a.patientName}</span>
                  <span className="truncate text-slate-500">Dr {a.doctorName}</span>
                </span>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

// "Good morning" before noon, "Good afternoon" until 6 pm, then "Good evening" (the browser's clock).
function greeting() {
  const hour = new Date().getHours()
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}

// 3942100 -> "3.9M", 412300 -> "412.3K": short enough for one line under the revenue figure.
const compactFormat = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
function compact(amount: number) {
  return compactFormat.format(amount)
}
