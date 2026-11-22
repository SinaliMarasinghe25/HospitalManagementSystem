import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { reviewLeave } from '../../api/staff'
import type { LeaveResponse } from '../../types/staff'
import { formatDate, formatDateTime } from '../../utils/format'
import { inputClass, primaryButtonClass, secondaryButtonClass } from '../ui/FormField'
import { LeaveStatusBadge } from './StaffBadges'
import { firstError } from '../../utils/formErrors'

// The leave list, on the Leave requests tab and the employee page.
// With onReviewed, pending rows get Approve and Reject buttons.
export function LeaveTable({
  rows,
  showEmployee,
  onReviewed,
}: {
  rows: LeaveResponse[] | null
  showEmployee?: boolean
  onReviewed?: () => void
}) {
  const columns = showEmployee ? 6 : 5
  return (
    <div className="overflow-x-auto rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50/60 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
          <tr>
            {showEmployee && <th scope="col" className="px-4 py-3 font-medium">Employee</th>}
            <th scope="col" className="px-4 py-3 font-medium">Leave</th>
            <th scope="col" className="px-4 py-3 font-medium">Dates</th>
            <th scope="col" className="px-4 py-3 font-medium">Reason</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
            <th scope="col" className="px-4 py-3 font-medium">Requested</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows?.map((l) => (
            <tr key={l.id} className="align-top">
              {showEmployee && (
                <td className="px-4 py-3">
                  <Link to={`/staff/employees/${l.employeeId}`} className="font-medium text-brand-700 hover:underline">
                    {l.employeeName}
                  </Link>
                  <span className="block text-xs text-slate-500">{l.departmentName}</span>
                </td>
              )}
              <td className="px-4 py-3">
                {l.leaveType}
                <span className="block text-xs text-slate-500">
                  {l.days} {l.days === 1 ? 'day' : 'days'}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {formatDate(l.startDate)}
                {l.endDate !== l.startDate && <span className="block">to {formatDate(l.endDate)}</span>}
              </td>
              <td className="max-w-xs px-4 py-3 break-words text-slate-700">{l.reason ?? '-'}</td>
              <td className="px-4 py-3">
                <LeaveStatusBadge status={l.status} />
                {l.reviewedBy && (
                  <span className="mt-1 block text-xs text-slate-500">
                    by {l.reviewedBy}
                    {l.reviewNote && <>: {l.reviewNote}</>}
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <span className="block text-xs whitespace-nowrap text-slate-500">
                  {formatDateTime(l.createdAt)}
                  {l.requestedBy && <span className="block">by {l.requestedBy}</span>}
                </span>
                {onReviewed && l.status === 'Pending' && (
                  <div className="mt-2">
                    <ReviewButtons leave={l} onReviewed={onReviewed} />
                  </div>
                )}
              </td>
            </tr>
          ))}
          {rows && rows.length === 0 && (
            <tr>
              <td colSpan={columns} className="px-4 py-6 text-center text-slate-500">
                No leave requests.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// Approve needs no note; reject asks for a reason, so the employee knows why.
function ReviewButtons({ leave, onReviewed }: { leave: LeaveResponse; onReviewed: () => void }) {
  const [mode, setMode] = useState<'approve' | 'reject' | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    try {
      await reviewLeave(leave.id, mode === 'approve', note)
      onReviewed()
    } catch (err) {
      setError(firstError(err, 'Could not save. Please try again.'))
      setIsSaving(false)
    }
  }

  if (!mode) {
    return (
      <div className="flex gap-2">
        <button type="button" className={primaryButtonClass} onClick={() => setMode('approve')}>
          Approve
        </button>
        <button type="button" className={secondaryButtonClass} onClick={() => setMode('reject')}>
          Reject
        </button>
      </div>
    )
  }

  const noteId = `note-${leave.id}`
  return (
    <form onSubmit={handleSubmit} className="w-64 space-y-2">
      <label htmlFor={noteId} className="block text-xs font-medium text-slate-700">
        {mode === 'approve' ? 'Note (optional)' : 'Reason for rejecting'}
      </label>
      <textarea
        id={noteId}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={500}
        required={mode === 'reject'}
        className={inputClass}
      />
      {error && (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" className={primaryButtonClass} disabled={isSaving}>
          {mode === 'approve' ? 'Approve leave' : 'Reject leave'}
        </button>
        <button type="button" className={secondaryButtonClass} onClick={() => setMode(null)}>
          Back
        </button>
      </div>
    </form>
  )
}
