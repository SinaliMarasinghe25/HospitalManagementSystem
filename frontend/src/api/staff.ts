import type {
  AttendanceEntry,
  AttendanceSheet,
  EmployeeAttendance,
  EmployeeDetail,
  EmployeeForm,
  EmployeeSummary,
  LeaveForm,
  LeaveResponse,
  LeaveStatus,
  MyLeave,
  NewLogin,
  UnlinkedUser,
} from '../types/staff'
import { apiFetch } from './client'

// One function per endpoint in StaffController.cs.

// ---------- Employees (Admin) ----------

export function listEmployees(filter: { search?: string; departmentId?: string; includeInactive?: boolean }) {
  const params = new URLSearchParams()
  if (filter.search?.trim()) params.set('search', filter.search.trim())
  if (filter.departmentId) params.set('departmentId', filter.departmentId)
  if (filter.includeInactive) params.set('includeInactive', 'true')
  return apiFetch<EmployeeSummary[]>(`/staff/employees?${params}`)
}

export function getEmployee(id: number) {
  return apiFetch<EmployeeDetail>(`/staff/employees/${id}`)
}

// Converts the text in the form into what the API expects (numbers, null for empty, the doctor part only for doctors).
function employeeBody(form: EmployeeForm, login: NewLogin | null = null) {
  return JSON.stringify({
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    jobTitle: form.jobTitle.trim(),
    phone: form.phone.trim(),
    email: form.email.trim() || null,
    hireDate: form.hireDate || null,
    departmentId: form.departmentId ? Number(form.departmentId) : null,
    isActive: form.isActive,
    doctor: form.isDoctor
      ? {
          specialization: form.specialization.trim(),
          licenseNumber: form.licenseNumber.trim(),
          consultationFee: Number(form.consultationFee || 0),
          slotMinutes: Number(form.slotMinutes || 15),
        }
      : null,
    ...(login ? { userName: login.userName.trim(), password: login.password, roles: login.roles } : {}),
  })
}

// With "login", the employee's login account is created and linked at the same time.
export function createEmployee(form: EmployeeForm, login: NewLogin | null) {
  return apiFetch<EmployeeDetail>('/staff/employees', { method: 'POST', body: employeeBody(form, login) })
}

export function updateEmployee(id: number, form: EmployeeForm) {
  return apiFetch<EmployeeDetail>(`/staff/employees/${id}`, { method: 'PUT', body: employeeBody(form) })
}

export function setEmployeeLogin(id: number, userId: string | null) {
  return apiFetch<EmployeeDetail>(`/staff/employees/${id}/login`, { method: 'PUT', body: JSON.stringify({ userId }) })
}

export function createEmployeeLogin(id: number, login: NewLogin) {
  return apiFetch<EmployeeDetail>(`/staff/employees/${id}/login`, {
    method: 'POST',
    body: JSON.stringify({ ...login, userName: login.userName.trim() }),
  })
}

export function listUnlinkedUsers() {
  return apiFetch<UnlinkedUser[]>('/staff/unlinked-users')
}

// ---------- Attendance (Admin) ----------

export function getAttendanceSheet(date: string) {
  return apiFetch<AttendanceSheet>(`/staff/attendance?date=${date}`)
}

export function saveAttendance(date: string, entries: AttendanceEntry[]) {
  return apiFetch<AttendanceSheet>('/staff/attendance', { method: 'PUT', body: JSON.stringify({ date, entries }) })
}

export function getEmployeeAttendance(id: number, fromDate: string, toDate: string) {
  return apiFetch<EmployeeAttendance>(`/staff/employees/${id}/attendance?fromDate=${fromDate}&toDate=${toDate}`)
}

// ---------- Leave ----------

function leaveBody(form: LeaveForm, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    ...extra,
    leaveType: form.leaveType || null,
    startDate: form.startDate || null,
    endDate: form.endDate || null,
    reason: form.reason.trim() || null,
  })
}

export function listLeave(status: LeaveStatus | '') {
  return apiFetch<LeaveResponse[]>(`/staff/leave${status ? `?status=${status}` : ''}`)
}

export function createLeaveFor(employeeId: number, form: LeaveForm) {
  return apiFetch<LeaveResponse>('/staff/leave', { method: 'POST', body: leaveBody(form, { employeeId }) })
}

export function reviewLeave(id: number, approve: boolean, note: string) {
  return apiFetch<LeaveResponse>(`/staff/leave/${id}/${approve ? 'approve' : 'reject'}`, {
    method: 'POST',
    body: JSON.stringify({ note: note.trim() || null }),
  })
}

export function getMyLeave() {
  return apiFetch<MyLeave>('/staff/my/leave')
}

export function requestMyLeave(form: LeaveForm) {
  return apiFetch<LeaveResponse>('/staff/my/leave', { method: 'POST', body: leaveBody(form) })
}

export function cancelMyLeave(id: number) {
  return apiFetch<LeaveResponse>(`/staff/my/leave/${id}/cancel`, { method: 'POST' })
}
