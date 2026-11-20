import type { Prescription } from '../types/medicalRecord'
import type {
  DispenseView,
  MedicineDetail,
  MedicineRequest,
  MedicineStock,
  PharmacyAlertCounts,
  PharmacyAlerts,
} from '../types/pharmacy'
import { apiFetch } from './client'

// One function per endpoint in PharmacyController.cs (and the prescription lists in PrescriptionsController.cs).

export function listMedicineStock(search = '', includeInactive = false) {
  const params = new URLSearchParams({ includeInactive: String(includeInactive) })
  if (search.trim()) params.set('search', search.trim())
  return apiFetch<MedicineStock[]>(`/pharmacy/medicines?${params}`)
}

export function getMedicine(id: number) {
  return apiFetch<MedicineDetail>(`/pharmacy/medicines/${id}`)
}

export function saveMedicine(id: number | null, body: MedicineRequest) {
  return apiFetch<{ id: number } | undefined>(id === null ? '/pharmacy/medicines' : `/pharmacy/medicines/${id}`, {
    method: id === null ? 'POST' : 'PUT',
    body: JSON.stringify(body),
  })
}

export function setMedicinePrice(id: number, unitPrice: number) {
  return apiFetch<void>(`/pharmacy/medicines/${id}/price`, { method: 'PUT', body: JSON.stringify({ unitPrice }) })
}

export function stockIn(medicineId: number, body: { batchNumber: string; expiryDate: string; quantity: number; costPrice: number }) {
  return apiFetch<MedicineDetail>(`/pharmacy/medicines/${medicineId}/stock-in`, {
    method: 'POST',
    body: JSON.stringify({ ...body, batchNumber: body.batchNumber.trim() }),
  })
}

export function adjustStock(batchId: number, quantityChange: number, reason: string) {
  return apiFetch<MedicineDetail>(`/pharmacy/batches/${batchId}/adjust`, {
    method: 'POST',
    body: JSON.stringify({ quantityChange, reason: reason.trim() }),
  })
}

export function writeOffExpired(batchId: number) {
  return apiFetch<MedicineDetail>(`/pharmacy/batches/${batchId}/write-off`, { method: 'POST' })
}

export function getPharmacyAlerts() {
  return apiFetch<PharmacyAlerts>('/pharmacy/alerts')
}

export function countPharmacyAlerts() {
  return apiFetch<PharmacyAlertCounts>('/pharmacy/alerts/count')
}

// The pharmacy queue: Pending and PartiallyDispensed, oldest first.
export function listOpenPrescriptions() {
  return apiFetch<Prescription[]>('/prescriptions?open=true')
}

export function listDispensedPrescriptions() {
  return apiFetch<Prescription[]>('/prescriptions?status=Dispensed')
}

export function getDispenseView(prescriptionId: number) {
  return apiFetch<DispenseView>(`/pharmacy/prescriptions/${prescriptionId}`)
}

export function dispense(prescriptionId: number, items: { prescriptionItemId: number; quantity: number }[]) {
  return apiFetch<DispenseView>(`/pharmacy/prescriptions/${prescriptionId}/dispense`, {
    method: 'POST',
    body: JSON.stringify({ items }),
  })
}
