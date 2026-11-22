import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ApiError } from '../../api/client'
import { listDepartments } from '../../api/doctors'
import { listEmployees } from '../../api/staff'
import { Permissions } from '../../auth/permissions'
import { hasAnyRole } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { compactInputClass, primaryButtonClass } from '../../components/ui/FormField'
import type { Department } from '../../types/doctor'
import type { EmployeeSummary } from '../../types/staff'
import AttendanceTab from './AttendanceTab'
import DepartmentsTab from './DepartmentsTab'
import LoginsTab from './LoginsTab'
import LeaveRequestsTab from './LeaveRequestsTab'
import MyLeavePanel from './MyLeavePanel'
import { Tabs } from '../../components/ui/Tabs'

type Tab = 'employees' | 'departments' | 'logins' | 'attendance' | 'leave' | 'mine'

const tabLabels: Record<Tab, string> = {
  employees: 'Employees',
  departments: 'Departments',
  logins: 'Logins',
  attendance: 'Attendance',
  leave: 'Leave requests',
  mine: 'My leave',
}

// PDF 3.9 Staff Management and 3.1 User Management, on ONE page for the administrator:
// people (employees and doctors), departments, logins, attendance and leave.
// Every other role sees only their own leave here.
export default function StaffPage() {
  const { user } = useAuth()
  const isAdmin = hasAnyRole(user?.roles, Permissions.manageStaff)
  const [params, setParams] = useSearchParams()

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-[1.75rem] leading-tight font-medium text-slate-900">My leave</h1>
        <MyLeavePanel />
      </div>
    )
  }

  const tabs: Tab[] = ['employees', 'departments', 'logins', 'attendance', 'leave', 'mine']
  const requested = params.get('tab') as Tab | null
  const tab = requested && tabs.includes(requested) ? requested : 'employees'

  return (
    <div className="space-y-4">
      <h1 className="text-[1.75rem] leading-tight font-medium text-slate-900">Staff</h1>
      <Tabs label="Staff views" tabs={tabs} labels={tabLabels} value={tab} onChange={(t) => setParams({ tab: t })} />
      {tab === 'employees' && <EmployeesTab />}
      {tab === 'departments' && <DepartmentsTab />}
      {tab === 'logins' && <LoginsTab />}
      {tab === 'attendance' && <AttendanceTab />}
      {tab === 'leave' && <LeaveRequestsTab />}
      {tab === 'mine' && <MyLeavePanel />}
    </div>
  )
}

function EmployeesTab() {
  const [search, setSearch] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [rows, setRows] = useState<EmployeeSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listDepartments(true).then(setDepartments).catch(() => setError('Could not load departments.'))
  }, [])

  useEffect(() => {
    let ignore = false
    // A short pause so typing a name makes one request, not one per letter.
    const timer = setTimeout(() => {
      listEmployees({ search, departmentId, includeInactive })
        .then((data) => {
          if (ignore) return
          setRows(data)
          setError(null)
        })
        .catch((err: unknown) => !ignore && setError(err instanceof ApiError ? err.message : 'Could not load employees.'))
    }, 250)
    return () => {
      ignore = true
      clearTimeout(timer)
    }
  }, [search, departmentId, includeInactive])

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
        <label htmlFor="employee-search" className="sr-only">
          Search employees
        </label>
        <input
          id="employee-search"
          type="search"
          placeholder="Name, employee no. or job title"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${compactInputClass} max-w-xs`}
        />
        <label htmlFor="employee-department" className="sr-only">
          Department
        </label>
        <select
          id="employee-department"
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          className={`${compactInputClass} w-auto`}
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
          Show inactive
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <Link to="/staff/employees/new" className={primaryButtonClass}>
            Add employee
          </Link>
        </div>
      </div>
      {error && (
        <p className="border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/60 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Employee</th>
              <th scope="col" className="px-4 py-3 font-medium">Job title</th>
              <th scope="col" className="px-4 py-3 font-medium">Department</th>
              <th scope="col" className="px-4 py-3 font-medium">Phone</th>
              <th scope="col" className="px-4 py-3 font-medium">Login</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows?.map((e) => (
              <tr key={e.id} className={e.isActive ? 'hover:bg-brand-50/40' : 'text-slate-400'}>
                <td className="px-4 py-3">
                  <Link to={`/staff/employees/${e.id}`} className="font-medium text-brand-700 hover:underline">
                    {e.fullName}
                  </Link>
                  <span className="block text-xs text-slate-500">{e.employeeNumber}</span>
                </td>
                <td className="px-4 py-3">{e.jobTitle}</td>
                <td className="px-4 py-3">{e.departmentName}</td>
                <td className="px-4 py-3 whitespace-nowrap">{e.phone ?? '-'}</td>
                <td className="px-4 py-3">{e.userName ?? <span className="text-slate-400">None</span>}</td>
                <td className="px-4 py-3">{e.isActive ? 'Active' : 'Inactive'}</td>
              </tr>
            ))}
            {rows && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No employees found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
