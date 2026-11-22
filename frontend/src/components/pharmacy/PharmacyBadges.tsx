import type { PrescriptionStatus } from '../../types/medicalRecord'
import type { ExpiryState } from '../../types/pharmacy'

const badge = 'badge ring-1'

const prescriptionStyles: Record<PrescriptionStatus, string> = {
  Pending: 'bg-sky-50 text-sky-800 ring-sky-200',
  PartiallyDispensed: 'bg-amber-50 text-amber-800 ring-amber-200',
  Dispensed: 'bg-green-50 text-green-800 ring-green-200',
  Cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
}

const prescriptionLabels: Record<PrescriptionStatus, string> = {
  Pending: 'Waiting',
  PartiallyDispensed: 'Partly dispensed',
  Dispensed: 'Dispensed',
  Cancelled: 'Cancelled',
}

export function PrescriptionStatusBadge({ status }: { status: PrescriptionStatus }) {
  return <span className={`${badge} ${prescriptionStyles[status]}`}>{prescriptionLabels[status]}</span>
}

// Text and colour together, so the state is never shown by colour alone.
export function ExpiryBadge({ state }: { state: ExpiryState }) {
  if (state === 'Ok') return null
  return state === 'Expired' ? (
    <span className={`${badge} bg-red-50 text-red-800 ring-red-200`}>Expired</span>
  ) : (
    <span className={`${badge} bg-amber-50 text-amber-800 ring-amber-200`}>Expires soon</span>
  )
}

export function LowStockBadge() {
  return <span className={`${badge} bg-red-50 text-red-800 ring-red-200`}>Low stock</span>
}
