import type { LabRequest, LabTest } from '../types/lab'
import { apiFetch } from './client'

// One function per endpoint in LabController.cs.

export function listLabTests(includeInactive = false) {
  return apiFetch<LabTest[]>(`/lab/tests?includeInactive=${includeInactive}`)
}

export function saveLabTest(id: number | null, body: Omit<LabTest, 'id'>) {
  return apiFetch<void>(id === null ? '/lab/tests' : `/lab/tests/${id}`, {
    method: id === null ? 'POST' : 'PUT',
    body: JSON.stringify({ ...body, unit: body.unit || null, referenceRange: body.referenceRange || null }),
  })
}

export function listLabRequests(filter: {
  status?: string
  fromDate?: string
  toDate?: string
  patientId?: string
  medicalRecordId?: string
}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filter)) {
    if (value) params.set(key, value)
  }
  return apiFetch<LabRequest[]>(`/lab/requests?${params}`)
}

export function getLabRequest(id: number) {
  return apiFetch<LabRequest>(`/lab/requests/${id}`)
}

export function openLabRequestCount() {
  return apiFetch<{ count: number }>('/lab/requests/open-count')
}

export function requestLabTests(patientId: number, medicalRecordId: number | null, labTestIds: number[]) {
  return apiFetch<number[]>('/lab/requests', {
    method: 'POST',
    body: JSON.stringify({ patientId, medicalRecordId, labTestIds }),
  })
}

export function cancelLabRequest(id: number) {
  return apiFetch<LabRequest>(`/lab/requests/${id}/cancel`, { method: 'POST' })
}

export function collectSample(id: number, sampleId: string) {
  return apiFetch<LabRequest>(`/lab/requests/${id}/sample`, {
    method: 'POST',
    body: JSON.stringify({ sampleId: sampleId.trim() }),
  })
}

export function enterResult(id: number, body: { resultValue: string; resultNotes: string; isAbnormal: boolean }) {
  return apiFetch<LabRequest>(`/lab/requests/${id}/result`, {
    method: 'PUT',
    body: JSON.stringify({ ...body, resultValue: body.resultValue.trim(), resultNotes: body.resultNotes.trim() || null }),
  })
}
