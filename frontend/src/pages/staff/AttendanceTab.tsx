import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../../api/client'
import { getAttendanceSheet, saveAttendance } from '../../api/staff'
import { compactInputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import {
  attendanceLabels,
  attendanceStatuses,
  type AttendanceEntry,
  type AttendanceSheetRow,
  type AttendanceStatus,
} from '../../types/staff'
import { addDays, formatDate, formatTime, todayInHospital } from '../../utils/format'
import { allErrors } from '../../utils/formErrors'

// What the administrator is editing on one row. Status '' = nothing recorded yet.
type Draft = { status: AttendanceStatus | ''; checkIn: string; checkOut: string }

const withTimes: (AttendanceStatus | '')[] = ['Present', 'Late']

function draftOf(row: AttendanceSheetRow): Draft {
  return {
    status: row.status ?? '',
    checkIn: row.checkIn ? formatTime(row.checkIn) : '',
    checkOut: row.checkOut ? formatTime(row.checkOut) : '',
  }
}

function sameDraft(a: Draft, b: Draft) {
  return a.status === b.status && a.checkIn === b.checkIn && a.checkOut === b.checkOut
}

// FR-ST-02 daily attendance, entered by an administrator (assumption A14).
// The database keeps one row per employee per day, so saving again corrects the day.
export default function AttendanceTab() {
  const [today] = useState(() => todayInHospital())
  const [date, setDate] = useState(today)
  const [rows, setRows] = useState<AttendanceSheetRow[] | null>(null)
  const [drafts, setDrafts] = useState<Record<number, Draft>>({})
  const [error, setError] = useState<string | null>(null)
  const [errorList, setErrorList] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let ignore = false
    getAttendanceSheet(date)
      .then((sheet) => {
        if (ignore) return
        setRows(sheet.rows)
        setDrafts(Object.fromEntries(sheet.rows.map((r) => [r.employeeId, draftOf(r)])))
        setError(null)
      })
      .catch((err: unknown) => !ignore && setError(err instanceof ApiError ? err.message : 'Could not load attendance.'))
    return () => {
      ignore = true
    }
  }, [date])

  const changed = (rows ?? []).filter((r) => drafts[r.employeeId] && !sameDraft(drafts[r.employeeId], draftOf(r)))
  const unrecorded = (rows ?? []).filter((r) => drafts[r.employeeId]?.status === '')

  function update(employeeId: number, patch: Partial<Draft>) {
    setDrafts((current) => {
      const next = { ...current[employeeId], ...patch }
      // Times only make sense when the person came in.
      if (!withTimes.includes(next.status)) {
        next.checkIn = ''
        next.checkOut = ''
      }
      return { ...current, [employeeId]: next }
    })
    setMessage(null)
  }

  // Quick fill for the usual case: everyone not yet marked is present, or on leave if leave was approved.
  function fillBlanks() {
    setDrafts((current) => {
      const next = { ...current }
      for (const row of rows ?? []) {
        if (next[row.employeeId].status === '') {
          next[row.employeeId] = { status: row.approvedLeave ? 'OnLeave' : 'Present', checkIn: '', checkOut: '' }
        }
      }
      return next
    })
    setMessage(null)
  }

  function changeDate(value: string) {
    if (!value || value > today) return
    if (changed.length > 0 && !window.confirm('You have unsaved changes for this day. Discard them?')) return
    setRows(null)
    setMessage(null)
    setErrorList([])
    setDate(value)
  }

  async function handleSave() {
    const entries: AttendanceEntry[] = changed
      .filter((r) => drafts[r.employeeId].status !== '')
      .map((r) => {
        const d = drafts[r.employeeId]
        return {
          employeeId: r.employeeId,
          status: d.status as AttendanceStatus,
          checkIn: d.checkIn || null,
          checkOut: d.checkOut || null,
        }
      })
    if (entries.length === 0) return

    setIsSaving(true)
    setError(null)
    setErrorList([])
    try {
      const sheet = await saveAttendance(date, entries)
      setRows(sheet.rows)
      setDrafts(Object.fromEntries(sheet.rows.map((r) => [r.employeeId, draftOf(r)])))
      setMessage(`Saved ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}.`)
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) {
        setError('Nothing was saved. Please correct these:')
        setErrorList(allErrors(err, ''))
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not save. Please try again.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const counts = attendanceStatuses.map((s) => [s, Object.values(drafts).filter((d) => d.status === s).length] as const)

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
        <button type="button" className={secondaryButtonClass} onClick={() => changeDate(addDays(date, -1))}>
          <span aria-hidden="true">&larr;</span> <span className="sr-only">Previous day</span>
        </button>
        <label htmlFor="attendance-date" className="sr-only">
          Date
        </label>
        <input
          id="attendance-date"
          type="date"
          value={date}
          max={today}
          onChange={(e) => changeDate(e.target.value)}
          className={`${compactInputClass} w-auto`}
        />
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => changeDate(addDays(date, 1))}
          disabled={date >= today}
        >
          <span aria-hidden="true">&rarr;</span> <span className="sr-only">Next day</span>
        </button>
        <span className="font-medium text-slate-900">{formatDate(date)}</span>
        <p className="ml-auto flex flex-wrap gap-x-4 gap-y-1">
          {counts.map(([s, n]) => (
            <span key={s}>
              {attendanceLabels[s]}: <strong>{n}</strong>
            </span>
          ))}
          <span>
            Not marked: <strong>{unrecorded.length}</strong>
          </span>
        </p>
      </div>

      {error && (
        <div className="border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800" role="alert">
          <p>{error}</p>
          {errorList.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {errorList.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {message && (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800" role="status">
          {message}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/60 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Employee</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="px-4 py-3 font-medium">Check-in</th>
              <th scope="col" className="px-4 py-3 font-medium">Check-out</th>
              <th scope="col" className="px-4 py-3 font-medium">Recorded by</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows?.map((r) => {
              const d = drafts[r.employeeId]
              if (!d) return null
              const isChanged = !sameDraft(d, draftOf(r))
              const timesOff = !withTimes.includes(d.status)
              return (
                <tr key={r.employeeId} className={isChanged ? 'bg-amber-50/60' : undefined}>
                  <td className="px-4 py-3">
                    <Link to={`/staff/employees/${r.employeeId}`} className="font-medium text-brand-700 hover:underline">
                      {r.fullName}
                    </Link>
                    <span className="block text-xs text-slate-500">
                      {r.jobTitle}, {r.departmentName}
                    </span>
                    {r.approvedLeave && (
                      <span className="mt-1 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800 ring-1 ring-brand-200">
                        Approved {r.approvedLeave.toLowerCase()} leave
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <label htmlFor={`status-${r.employeeId}`} className="sr-only">
                      Status for {r.fullName}
                    </label>
                    <select
                      id={`status-${r.employeeId}`}
                      value={d.status}
                      onChange={(e) => update(r.employeeId, { status: e.target.value as AttendanceStatus | '' })}
                      className={`${compactInputClass} w-32`}
                    >
                      {/* A saved day can be corrected but not blanked again. */}
                      {r.status === null && <option value="">Not marked</option>}
                      {attendanceStatuses.map((s) => (
                        <option key={s} value={s}>
                          {attendanceLabels[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <label htmlFor={`in-${r.employeeId}`} className="sr-only">
                      Check-in time for {r.fullName}
                    </label>
                    <input
                      id={`in-${r.employeeId}`}
                      type="time"
                      value={d.checkIn}
                      disabled={timesOff}
                      onChange={(e) => update(r.employeeId, { checkIn: e.target.value })}
                      className={`${compactInputClass} w-28 disabled:bg-slate-50`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <label htmlFor={`out-${r.employeeId}`} className="sr-only">
                      Check-out time for {r.fullName}
                    </label>
                    <input
                      id={`out-${r.employeeId}`}
                      type="time"
                      value={d.checkOut}
                      disabled={timesOff}
                      onChange={(e) => update(r.employeeId, { checkOut: e.target.value })}
                      className={`${compactInputClass} w-28 disabled:bg-slate-50`}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.recordedBy ?? '-'}</td>
                </tr>
              )
            })}
            {rows && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No active employees were hired by this date.
                </td>
              </tr>
            )}
            {!rows && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500" role="status">
                  Loading...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={primaryButtonClass} onClick={handleSave} disabled={isSaving || changed.length === 0}>
          {isSaving ? 'Saving...' : changed.length > 0 ? `Save ${changed.length} ${changed.length === 1 ? 'change' : 'changes'}` : 'Save'}
        </button>
        <button type="button" className={secondaryButtonClass} onClick={fillBlanks} disabled={unrecorded.length === 0}>
          Mark the rest present
        </button>
        <p className="text-sm text-slate-600">Staff with approved leave are marked On leave.</p>
      </div>
    </>
  )
}
