import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { listDepartments } from '../../api/doctors'
import { getStaffReport } from '../../api/reports'
import { FilterBar, ReportHeader, ReportMessage, Stat, StatGrid } from '../../components/reports/ReportParts'
import { ReportTable } from '../../components/reports/ReportTable'
import { sumBy } from '../../components/reports/reportUtils'
import { useReport } from '../../components/reports/useReport'
import { LeaveStatusBadge } from '../../components/staff/StaffBadges'
import { compactInputClass } from '../../components/ui/FormField'
import type { Department } from '../../types/doctor'
import { formatDate, todayInHospital } from '../../utils/format'

// FR-RP-06 Staff reports: attendance and leave by employee and month.
export default function StaffReportView() {
  const [filter, setFilter] = useState(() => ({ month: todayInHospital().slice(0, 7), departmentId: '' }))
  const { data, error, loading } = useReport(getStaffReport, filter)
  const [departments, setDepartments] = useState<Department[]>([])

  useEffect(() => {
    listDepartments(true).then(setDepartments).catch(() => setDepartments([]))
  }, [])

  const monthName = data
    ? new Date(Date.UTC(data.year, data.month - 1, 1)).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' })
    : ''
  const departmentName = departments.find((d) => String(d.id) === filter.departmentId)?.name
  const employeeLink = (id: number, text: string) => (
    <Link to={`/staff/employees/${id}`} className="font-medium text-brand-700 hover:underline">
      {text}
    </Link>
  )

  return (
    <div className="space-y-4">
      <FilterBar>
        <div>
          <label htmlFor="report-month" className="block text-sm font-medium text-slate-700">
            Month
          </label>
          <input
            id="report-month"
            type="month"
            value={filter.month}
            onChange={(e) => e.target.value && setFilter({ ...filter, month: e.target.value })}
            className={`${compactInputClass} mt-1`}
          />
        </div>
        <div>
          <label htmlFor="report-department" className="block text-sm font-medium text-slate-700">
            Department
          </label>
          <select
            id="report-department"
            value={filter.departmentId}
            onChange={(e) => setFilter({ ...filter, departmentId: e.target.value })}
            className={`${compactInputClass} mt-1`}
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </FilterBar>
      <ReportMessage error={error} loading={loading && !data} />
      {data && (
        <>
          <ReportHeader title="Attendance and leave" covers={[monthName, departmentName].filter(Boolean).join(' · ')} />
          <StatGrid>
            <Stat label="Employees" value={data.employees.length} />
            <Stat label="Days absent" value={sumBy(data.employees, (e) => e.absent)} />
            <Stat label="Days late" value={sumBy(data.employees, (e) => e.late)} />
            <Stat label="Approved leave days" value={sumBy(data.employees, (e) => e.leaveDays)} />
          </StatGrid>
          <ReportTable
            title="By employee"
            rows={data.employees}
            rowKey={(e) => e.employeeId}
            empty="No employees."
            footer={[
              'Total',
              '',
              '',
              sumBy(data.employees, (e) => e.present),
              sumBy(data.employees, (e) => e.late),
              sumBy(data.employees, (e) => e.absent),
              sumBy(data.employees, (e) => e.onLeave),
              sumBy(data.employees, (e) => e.daysRecorded),
              sumBy(data.employees, (e) => e.leaveDays),
              sumBy(data.employees, (e) => e.pendingLeaveRequests),
            ]}
            columns={[
              { header: 'Employee', value: (e) => `${e.fullName} (${e.employeeNumber})`, show: (e) => employeeLink(e.employeeId, e.fullName) },
              { header: 'Job title', value: (e) => e.jobTitle },
              { header: 'Department', value: (e) => e.departmentName },
              { header: 'Present', value: (e) => e.present, numeric: true },
              { header: 'Late', value: (e) => e.late, numeric: true },
              { header: 'Absent', value: (e) => e.absent, numeric: true },
              { header: 'Marked on leave', value: (e) => e.onLeave, numeric: true },
              { header: 'Days recorded', value: (e) => e.daysRecorded, numeric: true },
              { header: 'Approved leave days', value: (e) => e.leaveDays, numeric: true },
              { header: 'Pending requests', value: (e) => e.pendingLeaveRequests, numeric: true },
            ]}
          />
          <ReportTable
            title="Leave requests in this month"
            rows={data.leave}
            rowKey={(l) => l.id}
            empty="No leave requests in this month."
            columns={[
              { header: 'Employee', value: (l) => `${l.fullName} (${l.employeeNumber})`, show: (l) => employeeLink(l.employeeId, l.fullName) },
              { header: 'Type', value: (l) => l.leaveType },
              { header: 'From', value: (l) => l.startDate, show: (l) => formatDate(l.startDate) },
              { header: 'To', value: (l) => l.endDate, show: (l) => formatDate(l.endDate) },
              { header: 'Days in this month', value: (l) => l.daysInMonth, numeric: true },
              { header: 'Status', value: (l) => l.status, show: (l) => <LeaveStatusBadge status={l.status} /> },
            ]}
          />
        </>
      )}
    </div>
  )
}
