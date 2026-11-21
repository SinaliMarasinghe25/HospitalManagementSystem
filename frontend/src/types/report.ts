// These match Hms.Api/Dtos/ReportDtos.cs (PDF 3.10 Reports).
import type { AppointmentStatus } from './appointment'
import type { ChargeType, PaymentMethod } from './billing'
import type { LabRequestStatus } from './lab'
import type { Gender } from './patient'
import type { AlertBatch, MedicineStock } from './pharmacy'
import type { LeaveStatus, LeaveType } from './staff'

// Hospital days, both inclusive, as "YYYY-MM-DD".
export type ReportPeriod = { from: string; to: string }

export type CountRow = { label: string; count: number }

// ---------- FR-RP-01 ----------
export type PatientReportRow = {
  id: number
  patientNumber: string
  fullName: string
  gender: Gender
  dateOfBirth: string
  phone: string
  registeredAt: string
}

export type PatientReport = {
  period: ReportPeriod
  totalRegistered: number
  byDay: CountRow[]
  byGender: CountRow[]
  byAgeGroup: CountRow[]
  patients: PatientReportRow[]
  detailTruncated: boolean
}

// ---------- FR-RP-02 ----------
export type DoctorAppointmentRow = {
  doctorId: number
  doctorName: string
  specialization: string
  total: number
  completed: number
  cancelled: number
  noShow: number
  open: number
}

export type AppointmentReportRow = {
  id: number
  startTime: string
  patientNumber: string
  patientName: string
  doctorName: string
  status: AppointmentStatus
}

export type AppointmentReport = {
  period: ReportPeriod
  total: number
  byStatus: CountRow[]
  byDoctor: DoctorAppointmentRow[]
  appointments: AppointmentReportRow[]
  detailTruncated: boolean
}

// ---------- FR-RP-03 ----------
export type RevenueSourceRow = { source: ChargeType; charges: number; amount: number }
export type PaymentMethodRow = { method: PaymentMethod; payments: number; amount: number }
export type DailyRevenueRow = { date: string; billed: number; collected: number }

export type RevenuePaymentRow = {
  id: number
  receiptNumber: string
  paidAt: string
  invoiceId: number
  invoiceNumber: string
  patientNumber: string
  patientName: string
  method: PaymentMethod
  amount: number
}

export type RevenueReport = {
  period: ReportPeriod
  bySource: RevenueSourceRow[]
  billedSubtotal: number
  discounts: number
  billedTotal: number
  invoiceCount: number
  byMethod: PaymentMethodRow[]
  collected: number
  byDay: DailyRevenueRow[]
  outstandingNow: number
  payments: RevenuePaymentRow[]
  detailTruncated: boolean
}

// ---------- FR-RP-04 ----------
export type DispensedRow = { medicineId: number; name: string; strength: string; form: string; quantity: number; amount: number }

export type PharmacyReport = {
  period: ReportPeriod
  nearExpiryDays: number
  stock: MedicineStock[]
  stockValue: number
  lowStock: MedicineStock[]
  nearExpiry: AlertBatch[]
  expired: AlertBatch[]
  dispensed: DispensedRow[]
  dispensedQuantity: number
  dispensedAmount: number
}

// ---------- FR-RP-05 ----------
export type LabTestCountRow = {
  labTestId: number
  code: string
  name: string
  total: number
  waiting: number
  completed: number
  abnormal: number
  cancelled: number
}

export type LabReportRow = {
  id: number
  requestNumber: string
  requestedAt: string
  patientNumber: string
  patientName: string
  testName: string
  doctorName: string
  status: LabRequestStatus
  isAbnormal: boolean | null
}

export type LabReport = {
  period: ReportPeriod
  total: number
  byStatus: CountRow[]
  byTest: LabTestCountRow[]
  requests: LabReportRow[]
  detailTruncated: boolean
}

// ---------- FR-RP-06 ----------
export type StaffMonthRow = {
  employeeId: number
  employeeNumber: string
  fullName: string
  jobTitle: string
  departmentName: string
  present: number
  late: number
  absent: number
  onLeave: number
  daysRecorded: number
  leaveDays: number
  pendingLeaveRequests: number
}

export type StaffLeaveRow = {
  id: number
  employeeId: number
  employeeNumber: string
  fullName: string
  leaveType: LeaveType
  startDate: string
  endDate: string
  daysInMonth: number
  status: LeaveStatus
}

export type StaffReport = {
  year: number
  month: number
  daysInMonth: number
  employees: StaffMonthRow[]
  leave: StaffLeaveRow[]
}
