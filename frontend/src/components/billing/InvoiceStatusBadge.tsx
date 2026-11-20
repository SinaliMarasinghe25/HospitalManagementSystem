import type { InvoiceStatus } from '../../types/billing'

const styles: Record<InvoiceStatus, string> = {
  Draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  Issued: 'bg-blue-50 text-blue-800 ring-blue-200',
  PartiallyPaid: 'bg-amber-50 text-amber-800 ring-amber-200',
  Paid: 'bg-green-50 text-green-800 ring-green-200',
  Cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
}

const labels: Record<InvoiceStatus, string> = {
  Draft: 'Draft',
  Issued: 'Unpaid',
  PartiallyPaid: 'Part paid',
  Paid: 'Paid',
  Cancelled: 'Cancelled',
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${styles[status]}`}>{labels[status]}</span>
  )
}
