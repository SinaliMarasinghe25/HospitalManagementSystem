import type {
  MedicalHistory,
  PatientDetail,
  PatientDocument,
  PatientRequest,
  PatientSummary,
} from '../types/patient'
import type { PagedResult } from '../types/paged'
import { apiFetch } from './client'

// One function per endpoint in PatientsController.cs.

export function searchPatients(search: string, page: number, pageSize = 20) {
  const params = new URLSearchParams({ search, page: String(page), pageSize: String(pageSize) })
  return apiFetch<PagedResult<PatientSummary>>(`/patients?${params}`)
}

export function getPatient(id: number) {
  return apiFetch<PatientDetail>(`/patients/${id}`)
}

// Empty text boxes are sent as null so the API stores "no value".
function toBody(request: PatientRequest) {
  const body: Record<string, string | null> = {}
  for (const [key, value] of Object.entries(request)) {
    body[key] = value.trim() === '' ? null : value.trim()
  }
  return JSON.stringify(body)
}

export function createPatient(request: PatientRequest) {
  return apiFetch<PatientDetail>('/patients', { method: 'POST', body: toBody(request) })
}

export function updatePatient(id: number, request: PatientRequest) {
  return apiFetch<PatientDetail>(`/patients/${id}`, { method: 'PUT', body: toBody(request) })
}

export function getMedicalHistory(id: number) {
  return apiFetch<MedicalHistory>(`/patients/${id}/history`)
}

export function listDocuments(id: number) {
  return apiFetch<PatientDocument[]>(`/patients/${id}/documents`)
}

export function uploadDocument(id: number, file: File, description: string) {
  const form = new FormData()
  form.append('file', file)
  form.append('description', description)
  return apiFetch<PatientDocument>(`/patients/${id}/documents`, { method: 'POST', body: form })
}

// The browser downloads this with the login cookie, like any same-site link.
export function documentDownloadUrl(patientId: number, documentId: number) {
  return `/api/patients/${patientId}/documents/${documentId}`
}
