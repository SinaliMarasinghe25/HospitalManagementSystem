// These match Hms.Api/Dtos/BillingDtos.cs.

import type { PagedResult } from './paged'

export type ChargeType = 'Consultation' | 'Laboratory' | 'Pharmacy' | 'Admission'

export const chargeTypeLabels: Record<ChargeType, string> = {
  Consultation: 'Consultation',
  Laboratory: 'Laboratory',
  Pharmacy: 'Pharmacy',
  Admission: 'Ward / bed',
}

export type Charge = {
  id: number
  chargeType: ChargeType
  description: string
  quantity: number
  unitPrice: number
  amount: number
  createdAt: string
}

export type UnbilledPatient = {
  patientId: number
  patientNumber: string
  patientName: string
  chargeCount: number
  total: number
  oldestChargeAt: string
}

export type UnbilledCharges = { patientId: number; patientNumber: string; patientName: string; charges: Charge[] }

export type InvoiceStatus = 'Draft' | 'Issued' | 'PartiallyPaid' | 'Paid' | 'Cancelled'

export type InvoiceSummary = {
  id: number
  invoiceNumber: string
  patientId: number
  patientNumber: string
  patientName: string
  issuedAt: string
  status: InvoiceStatus
  total: number
  amountPaid: number
  balance: number
}

// One page of invoices. totalBalance is the money still due on every matching invoice, not only this page.
export type InvoicePage = PagedResult<InvoiceSummary> & { totalBalance: number }

export type PaymentMethod = 'Cash' | 'Card' | 'BankTransfer'

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  Cash: 'Cash',
  Card: 'Card',
  BankTransfer: 'Bank transfer',
}

export type Payment = {
  id: number
  receiptNumber: string
  amount: number
  method: PaymentMethod
  referenceNumber: string | null
  paidAt: string
  receivedBy: string | null
}

export type InvoiceDetail = {
  id: number
  invoiceNumber: string
  patientId: number
  patientNumber: string
  patientName: string
  patientPhone: string | null
  issuedAt: string
  issuedBy: string | null
  status: InvoiceStatus
  lines: Charge[]
  subtotal: number
  discount: number
  total: number
  amountPaid: number
  balance: number
  payments: Payment[]
}

export type Receipt = {
  payment: Payment
  invoiceNumber: string
  invoiceId: number
  patientNumber: string
  patientName: string
  invoiceTotal: number
  paidToDate: number
  balanceAfter: number
}

export type RevenueSummary = { today: number; thisMonth: number; outstandingBalance: number }
