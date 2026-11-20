import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { getEmployee, getEmployeeAttendance, listUnlinkedUsers, setEmployeeLogin } from '../../api/staff'
import { LeaveTable } from '../../components/staff/LeaveTable'
import { AttendanceBadge } from '../../components/staff/StaffBadges'
import { compactInputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import {
  attendanceLabels,
  attendanceStatuses,
  type EmployeeAttendance,
  type EmployeeDetail,
  type UnlinkedUser,
} from '../../types/staff'
import { addDays, formatDate, formatTime, todayInHospital } from '../../utils/format'

// One employee: details, linked login, attendance (FR-ST-02, viewable per employee)
// and leave (FR-ST-04, listed per employee).
export default function EmployeePage() {
  const { id } = useParams()
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEmployee(Number(id))
      .then(setEmployee)
      .catch((err: unknown) =>
        setError(err instanceof ApiError && err.status === 404 ? 'Employee not found.' : 'Could not load employee.'),
      )
  }, [id])

  if (error) return <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>
  if (!employee) return <p role="status">Loading...</p>

  const details: [string, string | null][] = [
    ['Employee number', employee.employeeNumber],
    ['Job title', employee.jobTitle],
    ['Department', employee.departmentName],
    ['Phone', employee.phone],
    ['Email', employee.email],
    ['Hire date', formatDate(employee.hireDate)],
    ['Status', employee.isActive ? 'Active' : 'Inactive'],
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/staff" className="text-sm text-blue-700 hover:underline">
            &larr; All staff
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            {employee.firstName} {employee.lastName}
          </h1>
        </div>
        {employee.doctorId === null ? (
          <Link to={`/staff/employees/${employee.id}/edit`} className={secondaryButtonClass}>
            Edit employee
          </Link>
        ) : (
          <Link to={`/doctors/${employee.doctorId}`} className={secondaryButtonClass}>
            Open doctor profile
          </Link>
        )}
      </div>

      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200" aria-labelledby="details-heading">
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

      <LoginSection employee={employee} onSaved={setEmployee} />
      <AttendanceSection employeeId={employee.id} />

      <section aria-labelledby="leave-heading" className="space-y-2">
        <h2 id="leave-heading" className="font-semibold text-slate-900">Leave</h2>
        <p className="text-sm text-slate-600">
          Review pending requests on the{' '}
          <Link to="/staff?tab=leave" className="text-blue-700 hover:underline">Leave requests</Link> tab.
        </p>
        <LeaveTable rows={employee.leave} />
      </section>
    </div>
  )
}

// The link between this employee and a login account. With it, the person can request their own leave.
function LoginSection({ employee, onSaved }: { employee: EmployeeDetail; onSaved: (e: EmployeeDetail) => void }) {
  const [users, setUsers] = useState<UnlinkedUser[] | null>(null)
  const [userId, setUserId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (employee.userId) return
    listUnlinkedUsers()
      .then(setUsers)
      .catch(() => setError('Could not load login accounts.'))
  }, [employee.userId])

  async function save(newUserId: string | null) {
    setIsSaving(true)
    setError(null)
    try {
      onSaved(await setEmployeeLogin(employee.id, newUserId))
      setUserId('')
    } catch (err) {
      const fieldMessage = err instanceof ApiError ? Object.values(err.fieldErrors).flat()[0] : undefined
      setError(fieldMessage ?? (err instanceof ApiError ? err.message : 'Could not save. Please try again.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200" aria-labelledby="login-heading">
      <h2 id="login-heading" className="font-semibold text-slate-900">Login account</h2>
      {error && (
        <p className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {employee.userName ? (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <p>
            Linked to <strong>{employee.userName}</strong>. They can request their own leave.
          </p>
          <button type="button" className={secondaryButtonClass} disabled={isSaving} onClick={() => save(null)}>
            Unlink
          </button>
        </div>
      ) : (
        <div className="mt-2 space-y-2 text-sm">
          <p className="text-slate-600">
            Not linked. Link a login account so this person can request leave. New accounts are created in
            Hms.Api.http.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="link-user" className="sr-only">
              Login account
            </label>
            <select
              id="link-user"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className={`${compactInputClass} w-auto`}
            >
              <option value="">{users && users.length === 0 ? 'No free login accounts' : 'Choose a login...'}</option>
              {users?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.userName} ({u.roles.join(', ') || 'no role'})
                </option>
              ))}
            </select>
            <button type="button" className={primaryButtonClass} disabled={!userId || isSaving} onClick={() => save(userId)}>
              Link
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function AttendanceSection({ employeeId }: { employeeId: number }) {
  const [toDate, setToDate] = useState(() => todayInHospital())
  const [data, setData] = useState<EmployeeAttendance | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    getEmployeeAttendance(employeeId, addDays(toDate, -29), toDate)
      .then((d) => {
        if (ignore) return
        setData(d)
        setError(null)
      })
      .catch((err: unknown) => !ignore && setError(err instanceof ApiError ? err.message : 'Could not load attendance.'))
    return () => {
      ignore = true
    }
  }, [employeeId, toDate])

  return (
    <section aria-labelledby="attendance-heading" className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
        <h2 id="attendance-heading" className="text-base font-semibold text-slate-900">Attendance</h2>
        <label htmlFor="attendance-to">30 days up to</label>
        <input
          id="attendance-to"
          type="date"
          value={toDate}
          onChange={(e) => e.target.value && setToDate(e.target.value)}
          className={`${compactInputClass} w-auto`}
        />
      </div>
      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {data && (
        <>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
            {attendanceStatuses.map((s) => (
              <span key={s}>
                {attendanceLabels[s]}: <strong>{data.counts[s]}</strong>
              </span>
            ))}
          </p>
          <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Date</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Check-in</th>
                  <th scope="col" className="px-4 py-3 font-medium">Check-out</th>
                  <th scope="col" className="px-4 py-3 font-medium">Recorded by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.records.map((r) => (
                  <tr key={r.date}>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="px-4 py-3">
                      <AttendanceBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3">{r.checkIn ? formatTime(r.checkIn) : '-'}</td>
                    <td className="px-4 py-3">{r.checkOut ? formatTime(r.checkOut) : '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{r.recordedBy ?? '-'}</td>
                  </tr>
                ))}
                {data.records.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                      Nothing recorded in these 30 days.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
