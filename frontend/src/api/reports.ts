import type {
  AppointmentReport,
  LabReport,
  PatientReport,
  PharmacyReport,
  RevenueReport,
  StaffReport,
} from '../types/report'
import { apiFetch } from './client'

// One function per endpoint in ReportsController.cs. Empty filter values are left out of the address.

export type PeriodFilter = { fromDate: string; toDate: string }

function query(filter: Record<string, string>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filter)) {
    if (value) params.set(key, value)
  }
  return params.toString()
}

export function getPatientReport(filter: PeriodFilter) {
  return apiFetch<PatientReport>(`/reports/patients?${query(filter)}`)
}

export function getAppointmentReport(filter: PeriodFilter & { doctorId: string; status: string }) {
  return apiFetch<AppointmentReport>(`/reports/appointments?${query(filter)}`)
}

export function getRevenueReport(filter: PeriodFilter) {
  return apiFetch<RevenueReport>(`/reports/revenue?${query(filter)}`)
}

export function getPharmacyReport(filter: PeriodFilter) {
  return apiFetch<PharmacyReport>(`/reports/pharmacy?${query(filter)}`)
}

export function getLabReport(filter: PeriodFilter & { labTestId: string; status: string }) {
  return apiFetch<LabReport>(`/reports/laboratory?${query(filter)}`)
}

// month: "YYYY-MM", as an <input type="month"> gives it.
export function getStaffReport(filter: { month: string; departmentId: string }) {
  const [year, month] = filter.month.split('-')
  return apiFetch<StaffReport>(`/reports/staff?${query({ year, month: String(Number(month)), departmentId: filter.departmentId })}`)
}
