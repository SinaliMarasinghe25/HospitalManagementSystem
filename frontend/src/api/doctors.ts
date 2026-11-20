import type { Department, DoctorDetail, DoctorSummary, ScheduleItem } from '../types/doctor'
import { apiFetch } from './client'

// ---------- Departments (DepartmentsController.cs) ----------

export function listDepartments(includeInactive = false) {
  return apiFetch<Department[]>(`/departments?includeInactive=${includeInactive}`)
}

export function saveDepartment(id: number | null, body: { name: string; description: string; isActive: boolean }) {
  return apiFetch<Department>(id === null ? '/departments' : `/departments/${id}`, {
    method: id === null ? 'POST' : 'PUT',
    body: JSON.stringify(body),
  })
}

// ---------- Doctors (DoctorsController.cs) ----------

export function listDoctors(departmentId: string, search: string, includeInactive = false) {
  const params = new URLSearchParams({ includeInactive: String(includeInactive) })
  if (departmentId) params.set('departmentId', departmentId)
  if (search) params.set('search', search)
  return apiFetch<DoctorSummary[]>(`/doctors?${params}`)
}

export function getDoctor(id: number) {
  return apiFetch<DoctorDetail>(`/doctors/${id}`)
}

// Doctors are added and edited on the Staff page (createEmployee / updateEmployee in api/staff.ts).

export function saveSchedule(id: number, items: ScheduleItem[]) {
  return apiFetch<DoctorDetail>(`/doctors/${id}/schedule`, { method: 'PUT', body: JSON.stringify({ items }) })
}
