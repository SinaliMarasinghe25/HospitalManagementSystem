import type {
  InvoiceDetail,
  InvoicePage,
  PaymentMethod,
  Receipt,
  UnbilledCharges,
  UnbilledPatient,
} from '../types/billing'
import { apiFetch } from './client'

// One function per endpoint in BillingController.cs.

export function listUnbilledPatients() {
  return apiFetch<UnbilledPatient[]>('/billing/unbilled')
}

export function getUnbilledCharges(patientId: number) {
  return apiFetch<UnbilledCharges>(`/billing/unbilled/${patientId}`)
}

// One page of invoices, newest first, with the money still due on all of them (totalBalance).
export function listInvoices(filter: { due?: boolean; search?: string; fromDate?: string; toDate?: string; page?: number }) {
  const params = new URLSearchParams()
  if (filter.due) params.set('due', 'true')
  if (filter.search?.trim()) params.set('search', filter.search.trim())
  if (filter.fromDate) params.set('fromDate', filter.fromDate)
  if (filter.toDate) params.set('toDate', filter.toDate)
  if (filter.page) params.set('page', String(filter.page))
  return apiFetch<InvoicePage>(`/billing/invoices?${params}`)
}

export function getInvoice(id: number) {
  return apiFetch<InvoiceDetail>(`/billing/invoices/${id}`)
}

export function createInvoice(patientId: number, chargeIds: number[], discount: number) {
  return apiFetch<InvoiceDetail>('/billing/invoices', {
    method: 'POST',
    body: JSON.stringify({ patientId, chargeIds, discount }),
  })
}

export function cancelInvoice(id: number) {
  return apiFetch<InvoiceDetail>(`/billing/invoices/${id}/cancel`, { method: 'POST' })
}

export function addPayment(invoiceId: number, body: { amount: number; method: PaymentMethod; referenceNumber: string }) {
  return apiFetch<Receipt>(`/billing/invoices/${invoiceId}/payments`, {
    method: 'POST',
    body: JSON.stringify({ ...body, referenceNumber: body.referenceNumber.trim() || null }),
  })
}

export function getReceipt(paymentId: number) {
  return apiFetch<Receipt>(`/billing/payments/${paymentId}/receipt`)
}
