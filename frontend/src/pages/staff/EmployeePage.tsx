import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { createEmployeeLogin, getEmployee, getEmployeeAttendance, listUnlinkedUsers, setEmployeeLogin } from '../../api/staff'
import { LeaveTable } from '../../components/staff/LeaveTable'
import { NewLoginFields } from '../../components/staff/NewLoginFields'
import { emptyLogin, loginProblems } from '../../components/staff/newLogin'
import { AttendanceBadge } from '../../components/staff/StaffBadges'
import { compactInputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import {
  attendanceLabels,
  attendanceStatuses,
  type EmployeeAttendance,
  type EmployeeDetail,
  type NewLogin,
  type UnlinkedUser,
} from '../../types/staff'
import { addDays, formatDate, formatMoney, formatTime, todayInHospital } from '../../utils/format'
import { errorsByField, firstError } from '../../utils/formErrors'

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

  if (error) return <p className="border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>
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
  if (employee.doctor) {
    details.push(
      ['Specialisation', employee.doctor.specialization],
      ['SLMC registration number', employee.doctor.licenseNumber],
      ['Consultation fee', formatMoney(employee.doctor.consultationFee)],
      ['Appointment length', `${employee.doctor.slotMinutes} minutes`],
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/staff" className="text-sm text-brand-700 hover:underline">
            &larr; All staff
          </Link>
          <h1 className="mt-1 text-[1.75rem] leading-tight font-medium text-slate-900">
            {employee.firstName} {employee.lastName}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {employee.doctor && (
            <Link to={`/doctors/${employee.doctor.id}`} className={secondaryButtonClass}>
              Weekly schedule
            </Link>
          )}
          <Link to={`/staff/employees/${employee.id}/edit`} className={secondaryButtonClass}>
            Edit employee
          </Link>
        </div>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70" aria-labelledby="details-heading">
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
          <Link to="/staff?tab=leave" className="text-brand-700 hover:underline">Leave requests</Link> tab.
        </p>
        <LeaveTable rows={employee.leave} />
      </section>
    </div>
  )
}

// The link between this employee and a login account. With it, the person can request their own leave.
// An administrator can link an existing login or create a new one here in one step.
function LoginSection({ employee, onSaved }: { employee: EmployeeDetail; onSaved: (e: EmployeeDetail) => void }) {
  const isDoctor = employee.doctor !== null
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [users, setUsers] = useState<UnlinkedUser[] | null>(null)
  const [userId, setUserId] = useState('')
  const [login, setLogin] = useState<NewLogin>(emptyLogin)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (employee.userId) return
    listUnlinkedUsers()
      .then(setUsers)
      .catch(() => setError('Could not load login accounts.'))
  }, [employee.userId])

  async function run(action: () => Promise<EmployeeDetail>, done: string) {
    setIsSaving(true)
    setError(null)
    setNotice(null)
    try {
      onSaved(await action())
      setUserId('')
      setLogin(emptyLogin)
      setFieldErrors({})
      setNotice(done)
    } catch (err) {
      if (err instanceof ApiError) setFieldErrors(errorsByField(err.fieldErrors))
      setError(firstError(err, 'Could not save. Please try again.'))
    } finally {
      setIsSaving(false)
    }
  }

  function createLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const problems = loginProblems(login, isDoctor)
    setFieldErrors(problems)
    if (Object.keys(problems).length > 0) {
      setError('Please correct the highlighted fields.')
      return
    }
    void run(
      () => createEmployeeLogin(employee.id, login),
      `Login ${login.userName.trim()} was created. Give the temporary password to the person privately.`,
    )
  }

  const tab = (value: 'new' | 'existing', label: string) => (
    <label className="flex items-center gap-2">
      <input type="radio" name="login-mode" checked={mode === value} onChange={() => setMode(value)} />
      {label}
    </label>
  )

  return (
    <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70" aria-labelledby="login-heading">
      <h2 id="login-heading" className="font-semibold text-slate-900">Login account</h2>
      {error && (
        <p className="mt-2 border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="mt-2 rounded-lg bg-green-50 p-3 text-sm text-green-800" role="status">
          {notice}
        </p>
      )}
      {employee.userName ? (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <p>
            Linked to <strong>{employee.userName}</strong>. They can request their own leave. Reset the password or change
            roles on the <Link to="/staff?tab=logins" className="text-brand-700 hover:underline">Logins</Link> tab.
          </p>
          <button
            type="button"
            className={secondaryButtonClass}
            disabled={isSaving}
            onClick={() =>
              void run(
                () => setEmployeeLogin(employee.id, null),
                isDoctor
                  ? 'The login was unlinked. It lost the Doctor role, and it was deactivated if it had no other role.'
                  : 'The login was unlinked. It still exists.',
              )
            }
          >
            Unlink
          </button>
        </div>
      ) : (
        <div className="mt-2 space-y-3 text-sm">
          <p className="text-slate-600">Not linked yet. With a login, this person can sign in and request leave.</p>
          <fieldset className="flex flex-wrap gap-x-6 gap-y-1">
            <legend className="sr-only">How to add a login</legend>
            {tab('new', 'Create a new login')}
            {tab('existing', 'Link an existing login')}
          </fieldset>

          {mode === 'new' ? (
            <form onSubmit={createLogin} noValidate className="space-y-3">
              <NewLoginFields value={login} onChange={setLogin} errors={fieldErrors} isDoctor={isDoctor} />
              <button type="submit" className={primaryButtonClass} disabled={isSaving}>
                {isSaving ? 'Creating...' : 'Create and link login'}
              </button>
            </form>
          ) : (
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
              <button
                type="button"
                className={primaryButtonClass}
                disabled={!userId || isSaving}
                onClick={() => void run(() => setEmployeeLogin(employee.id, userId), 'The login was linked.')}
              >
                Link
              </button>
            </div>
          )}
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
        <p className="border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800" role="alert">
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
          <div className="overflow-x-auto rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/60 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
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
