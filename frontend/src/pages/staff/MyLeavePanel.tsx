import { useEffect, useState } from 'react'
import { ApiError } from '../../api/client'
import { cancelMyLeave, getMyLeave, requestMyLeave } from '../../api/staff'
import { LeaveRequestForm } from '../../components/staff/LeaveRequestForm'
import { LeaveStatusBadge } from '../../components/staff/StaffBadges'
import { secondaryButtonClass } from '../../components/ui/FormField'
import type { LeaveForm, MyLeave } from '../../types/staff'
import { formatDate, todayInHospital } from '../../utils/format'
import { firstError } from '../../utils/formErrors'

// "Own (leave)" in the role table: every member of staff requests leave and follows its status.
// The API finds the employee from the login, so nobody can ask for leave in someone else's name.
export default function MyLeavePanel() {
  const [data, setData] = useState<MyLeave | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [year] = useState(() => todayInHospital().slice(0, 4))

  useEffect(() => {
    getMyLeave()
      .then(setData)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load your leave.'))
  }, [reloadKey])

  async function submit(form: LeaveForm) {
    await requestMyLeave(form)
    setReloadKey((k) => k + 1)
  }

  async function withdraw(id: number) {
    setError(null)
    try {
      await cancelMyLeave(id)
      setReloadKey((k) => k + 1)
    } catch (err) {
      setError(firstError(err, 'Could not withdraw the request.'))
    }
  }

  if (error && !data) {
    return (
      <p className="border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800" role="alert">
        {error}
      </p>
    )
  }
  if (!data) return <p role="status">Loading...</p>

  if (!data.linked) {
    return (
      <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
        Your login is not linked to an employee record. Contact an administrator.
      </p>
    )
  }

  const usedThisYear = data.requests
    .filter((r) => r.status === 'Approved' && r.startDate.slice(0, 4) === year)
    .reduce((sum, r) => sum + r.days, 0)

  return (
    <div className="space-y-6">
      <section aria-labelledby="new-leave-heading" className="space-y-2">
        <h2 id="new-leave-heading" className="font-semibold text-slate-900">
          Request leave
        </h2>
        <p className="text-sm text-slate-600">
          {data.employeeName}
        </p>
        <LeaveRequestForm onSubmit={submit} submitLabel="Send request" />
      </section>

      <section aria-labelledby="my-requests-heading" className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="my-requests-heading" className="font-semibold text-slate-900">
            My requests
          </h2>
          <p className="text-sm text-slate-600">
            Approved this year: <strong>{usedThisYear}</strong> {usedThisYear === 1 ? 'day' : 'days'}
          </p>
        </div>
        {error && (
          <p className="border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}
        <ul className="divide-y divide-slate-100 rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70">
          {data.requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-900">
                  {r.leaveType} leave, {r.days} {r.days === 1 ? 'day' : 'days'}
                </p>
                <p className="text-slate-700">
                  {formatDate(r.startDate)}
                  {r.endDate !== r.startDate && <> to {formatDate(r.endDate)}</>}
                </p>
                {r.reason && <p className="text-slate-500">{r.reason}</p>}
                {r.reviewNote && (
                  <p className="mt-1 text-slate-600">
                    Note from {r.reviewedBy ?? 'administrator'}: {r.reviewNote}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <LeaveStatusBadge status={r.status} />
                {r.status === 'Pending' && (
                  <button type="button" className={secondaryButtonClass} onClick={() => withdraw(r.id)}>
                    Withdraw
                  </button>
                )}
              </div>
            </li>
          ))}
          {data.requests.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">No requests yet.</li>}
        </ul>
      </section>
    </div>
  )
}
