import type {
  AppointmentReport,
  LabReport,
  PatientReport,
  PharmacyReport,
  RevenueReport,
  StaffReport,
} from '../types/report'
import { apiFetch, queryString } from './client'

// One function per endpoint in ReportsController.cs. Empty filter values are left out of the address.

export type PeriodFilter = { fromDate: string; toDate: string }

export function getPatientReport(filter: PeriodFilter) {
  return apiFetch<PatientReport>(`/reports/patients?${queryString(filter)}`)
}

export function getAppointmentReport(filter: PeriodFilter & { doctorId: string; status: string }) {
  return apiFetch<AppointmentReport>(`/reports/appointments?${queryString(filter)}`)
}

export function getRevenueReport(filter: PeriodFilter) {
  return apiFetch<RevenueReport>(`/reports/revenue?${queryString(filter)}`)
}

export function getPharmacyReport(filter: PeriodFilter) {
  return apiFetch<PharmacyReport>(`/reports/pharmacy?${queryString(filter)}`)
}

export function getLabReport(filter: PeriodFilter & { labTestId: string; status: string }) {
  return apiFetch<LabReport>(`/reports/laboratory?${queryString(filter)}`)
}

// month: "YYYY-MM", as an <input type="month"> gives it.
export function getStaffReport(filter: { month: string; departmentId: string }) {
  const [year, month] = filter.month.split('-')
  return apiFetch<StaffReport>(`/reports/staff?${queryString({ year, month: String(Number(month)), departmentId: filter.departmentId })}`)
}
