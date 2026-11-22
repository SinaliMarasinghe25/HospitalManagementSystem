import { useEffect, useState } from 'react'
import { ApiError } from '../../api/client'
import { createLeaveFor, listEmployees, listLeave } from '../../api/staff'
import { LeaveRequestForm } from '../../components/staff/LeaveRequestForm'
import { LeaveTable } from '../../components/staff/LeaveTable'
import { secondaryButtonClass } from '../../components/ui/FormField'
import { Pagination } from '../../components/ui/Pagination'
import type { PagedResult } from '../../types/paged'
import type { EmployeeSummary, LeaveForm, LeaveResponse, LeaveStatus } from '../../types/staff'

const statusFilters: { value: LeaveStatus | ''; label: string }[] = [
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
  { value: '', label: 'All' },
]

// FR-ST-04: the administrator approves or rejects leave, and can record leave for any employee.
export default function LeaveRequestsTab() {
  const [status, setStatus] = useState<LeaveStatus | ''>('Pending')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PagedResult<LeaveResponse> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [employees, setEmployees] = useState<EmployeeSummary[]>([])

  useEffect(() => {
    let ignore = false
    listLeave(status, page)
      .then((result) => {
        if (ignore) return
        setData(result)
        setError(null)
      })
      .catch((err: unknown) => !ignore && setError(err instanceof ApiError ? err.message : 'Could not load leave requests.'))
    return () => {
      ignore = true
    }
  }, [status, page, reloadKey])

  function openForm() {
    setShowForm(true)
    listEmployees({}).then(setEmployees).catch(() => setError('Could not load employees.'))
  }

  async function recordLeave(form: LeaveForm, employeeId: number | null) {
    await createLeaveFor(employeeId ?? 0, form)
    setReloadKey((k) => k + 1)
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
        <fieldset className="flex flex-wrap gap-1">
          <legend className="sr-only">Show</legend>
          {statusFilters.map((f) => (
            <button
              key={f.label}
              type="button"
              aria-pressed={status === f.value}
              onClick={() => {
                setStatus(f.value)
                setPage(1) // another status starts on page 1
              }}
              className={`rounded-full px-3 py-1 font-medium ring-1 ${
                status === f.value ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </fieldset>
        {!showForm && (
          <button type="button" className={`${secondaryButtonClass} ml-auto`} onClick={openForm}>
            Record leave for an employee
          </button>
        )}
      </div>

      {showForm && (
        <section aria-labelledby="record-leave-heading" className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 id="record-leave-heading" className="font-semibold text-slate-900">
              Record leave for an employee
            </h2>
            <button type="button" className="text-sm text-brand-700 hover:underline" onClick={() => setShowForm(false)}>
              Close
            </button>
          </div>
          <p className="text-sm text-slate-600">
            For staff without a login. The request is added as pending, so approve it below.
          </p>
          <LeaveRequestForm employees={employees} onSubmit={recordLeave} submitLabel="Add request"
            sentMessage="Added as pending. Approve it in the list below."
          />
        </section>
      )}

      {error && (
        <p className="border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      {/* After Approve or Reject the same page reloads. If it is now past the end, the API sends the last page. */}
      <LeaveTable rows={data?.items ?? null} showEmployee onReviewed={() => setReloadKey((k) => k + 1)} />
      {data && (
        <Pagination
          totalCount={data.totalCount}
          page={data.page}
          pageSize={data.pageSize}
          noun="leave request"
          onPageChange={setPage}
        />
      )}
    </>
  )
}
