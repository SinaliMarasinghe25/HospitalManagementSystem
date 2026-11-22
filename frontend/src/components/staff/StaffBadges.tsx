import { attendanceLabels, type AttendanceStatus, type LeaveStatus } from '../../types/staff'

const badge = 'badge ring-1'

const leaveStyles: Record<LeaveStatus, string> = {
  Pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  Approved: 'bg-green-50 text-green-800 ring-green-200',
  Rejected: 'bg-red-50 text-red-700 ring-red-200',
  Cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
}

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return <span className={`${badge} ${leaveStyles[status]}`}>{status === 'Cancelled' ? 'Withdrawn' : status}</span>
}

const attendanceStyles: Record<AttendanceStatus, string> = {
  Present: 'bg-green-50 text-green-800 ring-green-200',
  Late: 'bg-amber-50 text-amber-800 ring-amber-200',
  Absent: 'bg-red-50 text-red-700 ring-red-200',
  OnLeave: 'bg-sky-50 text-sky-800 ring-sky-200',
}

export function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  return <span className={`${badge} ${attendanceStyles[status]}`}>{attendanceLabels[status]}</span>
}
