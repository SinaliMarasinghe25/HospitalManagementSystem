// Mirrors Hms.Api/Dtos/StaffDtos.cs (PDF 3.9 Staff Management).

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'OnLeave'
export type LeaveType = 'Annual' | 'Sick' | 'Casual' | 'Other'
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'

export const attendanceStatuses: AttendanceStatus[] = ['Present', 'Late', 'Absent', 'OnLeave']
export const leaveTypes: LeaveType[] = ['Annual', 'Sick', 'Casual', 'Other']

export const attendanceLabels: Record<AttendanceStatus, string> = {
  Present: 'Present',
  Late: 'Late',
  Absent: 'Absent',
  OnLeave: 'On leave',
}

export type EmployeeSummary = {
  id: number
  employeeNumber: string
  fullName: string
  jobTitle: string
  departmentId: number
  departmentName: string
  phone: string | null
  isActive: boolean
  doctorId: number | null
  userName: string | null
}

export type LeaveResponse = {
  id: number
  employeeId: number
  employeeNumber: string
  employeeName: string
  departmentName: string
  leaveType: LeaveType
  startDate: string
  endDate: string
  days: number
  reason: string | null
  status: LeaveStatus
  createdAt: string
  requestedBy: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNote: string | null
}

export type EmployeeDetail = {
  id: number
  employeeNumber: string
  firstName: string
  lastName: string
  jobTitle: string
  phone: string | null
  email: string | null
  hireDate: string
  departmentId: number
  departmentName: string
  isActive: boolean
  doctorId: number | null
  userId: string | null
  userName: string | null
  leave: LeaveResponse[]
}

// Form values are strings, as typed in the inputs.
export type EmployeeForm = {
  firstName: string
  lastName: string
  jobTitle: string
  phone: string
  email: string
  hireDate: string
  departmentId: string
  isActive: boolean
}

export type UnlinkedUser = { id: string; userName: string; roles: string[] }

export type AttendanceSheetRow = {
  employeeId: number
  employeeNumber: string
  fullName: string
  jobTitle: string
  departmentName: string
  status: AttendanceStatus | null
  checkIn: string | null
  checkOut: string | null
  approvedLeave: LeaveType | null
  recordedBy: string | null
}

export type AttendanceSheet = { date: string; rows: AttendanceSheetRow[] }

export type AttendanceEntry = {
  employeeId: number
  status: AttendanceStatus
  checkIn: string | null
  checkOut: string | null
}

export type AttendanceRecord = {
  date: string
  status: AttendanceStatus
  checkIn: string | null
  checkOut: string | null
  recordedBy: string | null
}

export type EmployeeAttendance = {
  employeeId: number
  fromDate: string
  toDate: string
  counts: Record<AttendanceStatus, number>
  records: AttendanceRecord[]
}

export type LeaveForm = { leaveType: LeaveType | ''; startDate: string; endDate: string; reason: string }

export type MyLeave = { linked: boolean; employeeName: string | null; requests: LeaveResponse[] }
