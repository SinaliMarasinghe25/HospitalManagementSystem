import type {
  Medicine,
  MedicalRecord,
  MedicalRecordRequest,
  MedicalRecordSummary,
  Prescription,
  PrescriptionLine,
} from '../types/medicalRecord'
import { apiFetch } from './client'

// One function per endpoint in MedicalRecordsController.cs and PrescriptionsController.cs.

export function listMedicalRecords(filter: { fromDate?: string; toDate?: string; patientId?: string; doctorId?: string }) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filter)) {
    if (value) params.set(key, value)
  }
  return apiFetch<MedicalRecordSummary[]>(`/medical-records?${params}`)
}

export function getMedicalRecord(id: number) {
  return apiFetch<MedicalRecord>(`/medical-records/${id}`)
}

// Empty text is sent as null; empty diagnosis codes too.
function toBody(request: MedicalRecordRequest) {
  const text = (value: string) => (value.trim() === '' ? null : value.trim())
  return JSON.stringify({
    appointmentId: request.appointmentId ?? null,
    chiefComplaint: text(request.chiefComplaint),
    clinicalNotes: text(request.clinicalNotes),
    diagnoses: request.diagnoses.map((d) => ({ ...d, code: d.code ? text(d.code) : null, description: d.description.trim() })),
    treatments: request.treatments.map((t) => ({ description: t.description.trim(), performedAt: t.performedAt || null })),
  })
}

export function createMedicalRecord(request: MedicalRecordRequest) {
  return apiFetch<MedicalRecord>('/medical-records', { method: 'POST', body: toBody(request) })
}

export function updateMedicalRecord(id: number, request: MedicalRecordRequest) {
  return apiFetch<MedicalRecord>(`/medical-records/${id}`, { method: 'PUT', body: toBody(request) })
}

export function addPrescription(recordId: number, lines: PrescriptionLine[]) {
  return apiFetch<Prescription>(`/medical-records/${recordId}/prescriptions`, {
    method: 'POST',
    body: JSON.stringify({
      items: lines.map((l) => ({
        medicineId: l.medicineId ? Number(l.medicineId) : null,
        dosage: l.dosage.trim(),
        frequency: l.frequency.trim(),
        durationDays: Number(l.durationDays || 0),
        quantity: Number(l.quantity || 0),
        instructions: l.instructions.trim() || null,
      })),
    }),
  })
}

export function cancelPrescription(id: number) {
  return apiFetch<Prescription>(`/prescriptions/${id}/cancel`, { method: 'POST' })
}

export function searchMedicines(search = '') {
  return apiFetch<Medicine[]>(`/medicines?search=${encodeURIComponent(search)}`)
}
