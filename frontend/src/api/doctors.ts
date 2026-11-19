import type { Department, DoctorDetail, DoctorForm, DoctorSummary, ScheduleItem } from '../types/doctor'
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

// Converts the text in the form into the types the API expects (numbers, null for empty).
function toBody(form: DoctorForm) {
  const text = (value: string) => (value.trim() === '' ? null : value.trim())
  return JSON.stringify({
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    phone: form.phone.trim(),
    email: text(form.email),
    hireDate: text(form.hireDate),
    departmentId: form.departmentId ? Number(form.departmentId) : null,
    specialization: form.specialization.trim(),
    licenseNumber: form.licenseNumber.trim(),
    consultationFee: Number(form.consultationFee || 0),
    slotMinutes: Number(form.slotMinutes || 15),
    isActive: form.isActive,
    userName: text(form.userName),
    password: form.password === '' ? null : form.password,
  })
}

export function createDoctor(form: DoctorForm) {
  return apiFetch<DoctorDetail>('/doctors', { method: 'POST', body: toBody(form) })
}

export function updateDoctor(id: number, form: DoctorForm) {
  return apiFetch<DoctorDetail>(`/doctors/${id}`, { method: 'PUT', body: toBody(form) })
}

export function saveSchedule(id: number, items: ScheduleItem[]) {
  return apiFetch<DoctorDetail>(`/doctors/${id}/schedule`, { method: 'PUT', body: JSON.stringify({ items }) })
}
