import type { Appointment, AppointmentStatus, Slot } from '../types/appointment'
import { apiFetch } from './client'

// One function per endpoint in AppointmentsController.cs.

export type AppointmentFilter = {
  fromDate?: string // "YYYY-MM-DD", hospital time
  toDate?: string
  doctorId?: string
  patientId?: string
  status?: string
}

export function listAppointments(filter: AppointmentFilter) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filter)) {
    if (value) params.set(key, value)
  }
  return apiFetch<Appointment[]>(`/appointments?${params}`)
}

export function getAppointment(id: number) {
  return apiFetch<Appointment>(`/appointments/${id}`)
}

export function getSlots(doctorId: string, date: string, ignoreAppointmentId?: number) {
  const params = new URLSearchParams({ doctorId, date })
  if (ignoreAppointmentId) params.set('ignoreAppointmentId', String(ignoreAppointmentId))
  return apiFetch<Slot[]>(`/appointments/slots?${params}`)
}

export function bookAppointment(body: { patientId: number; doctorId: number; startTime: string; reason: string }) {
  return apiFetch<Appointment>('/appointments', {
    method: 'POST',
    body: JSON.stringify({ ...body, reason: body.reason.trim() || null }),
  })
}

export function rescheduleAppointment(id: number, body: { doctorId: number; startTime: string }) {
  return apiFetch<Appointment>(`/appointments/${id}/reschedule`, { method: 'POST', body: JSON.stringify(body) })
}

export function cancelAppointment(id: number, reason: string) {
  return apiFetch<Appointment>(`/appointments/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason.trim() }),
  })
}

export function updateAppointmentStatus(id: number, status: AppointmentStatus) {
  return apiFetch<Appointment>(`/appointments/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) })
}
