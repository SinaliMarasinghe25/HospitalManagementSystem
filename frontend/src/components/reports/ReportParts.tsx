import { useState, type ReactNode } from 'react'
import { useAuth } from '../../auth/useAuth'
import { formatDateTime } from '../../utils/format'
import { compactInputClass, secondaryButtonClass } from '../ui/FormField'
import type { PeriodFilter } from '../../api/reports'
import { periodPresets } from './reportUtils'

// The pieces every report page shares: the date filter, the title block, number tiles and messages.

// From and To dates plus quick choices. Hidden when printing; the printed title shows the period instead.
export function PeriodFields({ value, onChange }: { value: PeriodFilter; onChange: (period: PeriodFilter) => void }) {
  return (
    <>
      <div>
        <label htmlFor="report-from" className="block text-sm font-medium text-slate-700">
          From
        </label>
        <input
          id="report-from"
          type="date"
          value={value.fromDate}
          max={value.toDate}
          onChange={(e) => e.target.value && onChange({ ...value, fromDate: e.target.value })}
          className={`${compactInputClass} mt-1`}
        />
      </div>
      <div>
        <label htmlFor="report-to" className="block text-sm font-medium text-slate-700">
          To
        </label>
        <input
          id="report-to"
          type="date"
          value={value.toDate}
          min={value.fromDate}
          onChange={(e) => e.target.value && onChange({ ...value, toDate: e.target.value })}
          className={`${compactInputClass} mt-1`}
        />
      </div>
      <div className="flex flex-wrap gap-2 self-end">
        {periodPresets.map((p) => (
          <button key={p.label} type="button" onClick={() => onChange(p.period())} className={secondaryButtonClass}>
            {p.label}
          </button>
        ))}
      </div>
    </>
  )
}

// The bar of filters above a report.
export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-start gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 print:hidden">{children}</div>
}

// The report's title, what it covers, and the Print button. When printed it also says who printed it and when.
export function ReportHeader({ title, covers, children }: { title: string; covers: string; children?: ReactNode }) {
  const { user } = useAuth()
  const [printedAt] = useState(() => new Date().toISOString())
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 print:text-xl">{title}</h2>
        <p className="text-sm text-slate-600">{covers}</p>
        {children}
        <p className="hidden text-xs text-slate-500 print:block">
          Printed {formatDateTime(printedAt)} by {user?.userName} &middot; Hospital Management System &middot; Demonstration
          system with fictitious data
        </p>
      </div>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 print:hidden"
      >
        Print / Save as PDF
      </button>
    </div>
  )
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-4">{children}</div>
}

export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 print:p-2 print:shadow-none">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
      {note && <p className="text-xs text-slate-500">{note}</p>}
    </div>
  )
}

// Shown while loading, on an error, and when a long list was cut short.
export function ReportMessage({ error, loading }: { error: string | null; loading: boolean }) {
  if (error) {
    return (
      <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
        {error}
      </p>
    )
  }
  return loading ? <p className="text-sm text-slate-500 print:hidden">Loading...</p> : null
}

export function TruncatedNote({ shown, total }: { shown: number; total: number }) {
  return (
    <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
      The list below shows the first {shown.toLocaleString()} of {total.toLocaleString()} rows. The totals above count
      all of them. Choose a shorter period to see every row.
    </p>
  )
}
