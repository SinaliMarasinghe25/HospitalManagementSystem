import type { AdmissionDetail, AdmissionSummary, VitalSign, VitalSignForm, Ward } from '../types/admission'
import { apiFetch } from './client'

// One function per endpoint in WardsController.cs and AdmissionsController.cs.

// ---------- Wards and beds ----------

export function listWards() {
  return apiFetch<Ward[]>('/wards')
}

export function saveWard(id: number | null, body: { name: string; wardType: string; dailyCharge: number }) {
  return apiFetch<void>(id === null ? '/wards' : `/wards/${id}`, {
    method: id === null ? 'POST' : 'PUT',
    body: JSON.stringify(body),
  })
}

export function addBeds(wardId: number, prefix: string, count: number) {
  return apiFetch<void>(`/wards/${wardId}/beds`, { method: 'POST', body: JSON.stringify({ prefix, count }) })
}

export function setBedActive(bedId: number, isActive: boolean) {
  return apiFetch<void>(`/wards/beds/${bedId}/status`, { method: 'PUT', body: JSON.stringify({ isActive }) })
}

// ---------- Admissions ----------

export function listAdmissions(filter: { status?: string; fromDate?: string; toDate?: string; patientId?: string }) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filter)) {
    if (value) params.set(key, value)
  }
  return apiFetch<AdmissionSummary[]>(`/admissions?${params}`)
}

export function getAdmission(id: number) {
  return apiFetch<AdmissionDetail>(`/admissions/${id}`)
}

export function admitPatient(body: { patientId: number; bedId: number; admittingDoctorId: number; admissionReason: string }) {
  return apiFetch<AdmissionDetail>('/admissions', { method: 'POST', body: JSON.stringify(body) })
}

export function transferPatient(id: number, toBedId: number, reason: string) {
  return apiFetch<AdmissionDetail>(`/admissions/${id}/transfer`, {
    method: 'POST',
    body: JSON.stringify({ toBedId, reason: reason.trim() || null }),
  })
}

export function dischargePatient(id: number, dischargeSummary: string) {
  return apiFetch<AdmissionDetail>(`/admissions/${id}/discharge`, {
    method: 'POST',
    body: JSON.stringify({ dischargeSummary: dischargeSummary.trim() }),
  })
}

export function listVitals(id: number) {
  return apiFetch<VitalSign[]>(`/admissions/${id}/vitals`)
}

export function addVitals(id: number, form: VitalSignForm) {
  const num = (value: string) => (value.trim() === '' ? null : Number(value))
  return apiFetch<{ id: number }>(`/admissions/${id}/vitals`, {
    method: 'POST',
    body: JSON.stringify({
      temperatureC: num(form.temperatureC),
      pulseBpm: num(form.pulseBpm),
      systolicBp: num(form.systolicBp),
      diastolicBp: num(form.diastolicBp),
      respiratoryRate: num(form.respiratoryRate),
      oxygenSaturation: num(form.oxygenSaturation),
      notes: form.notes.trim() || null,
    }),
  })
}
