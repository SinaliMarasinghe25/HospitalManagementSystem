import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router'
import { getInvoice, getReceipt } from '../../api/billing'
import { paymentMethodLabels, type InvoiceDetail, type Receipt } from '../../types/billing'
import { formatDateTime, formatMoney } from '../../utils/format'

// Printable pages (HW-02 printer): the invoice and a payment receipt (UI-BIL-03).
// They sit outside the app layout, so only the document prints. "Print / Save as PDF" uses the browser.

function PrintFrame({ title, children }: { title: string; children: ReactNode }) {
  const [printedAt] = useState(() => new Date().toISOString())
  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
        >
          Print / Save as PDF
        </button>
      </div>
      <article className="mx-auto max-w-[210mm] bg-white p-[15mm] text-sm text-black shadow print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-end justify-between border-b-2 border-slate-800 pb-3">
          <div>
            <h1 className="text-xl font-bold">Hospital Management System</h1>
          </div>
          <p className="text-lg font-semibold uppercase">{title}</p>
        </header>
        {children}
        <p className="mt-10 text-xs text-slate-600">Printed {formatDateTime(printedAt)}</p>
      </article>
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p>
      <span className="inline-block w-32 text-slate-600">{label}</span>
      {children}
    </p>
  )
}

export function InvoicePrintPage() {
  const { id } = useParams()
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getInvoice(Number(id)).then(setInvoice).catch(() => setError('Could not load the invoice.'))
  }, [id])

  if (error) return <p className="p-8 text-red-700">{error}</p>
  if (!invoice) return <p className="p-8 text-slate-500">Loading...</p>
  if (invoice.status === 'Cancelled') return <p className="p-8 text-slate-600">This invoice was cancelled.</p>

  return (
    <PrintFrame title="Invoice">
      <section className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1">
        <Row label="Invoice no.">{invoice.invoiceNumber}</Row>
        <Row label="Issued">{formatDateTime(invoice.issuedAt)}</Row>
        <Row label="Patient">{invoice.patientName}</Row>
        <Row label="Patient no.">{invoice.patientNumber}</Row>
      </section>
      <table className="mt-6 w-full border-collapse text-left">
        <thead>
          <tr className="border-b-2 border-slate-800">
            <th className="py-2 pr-3">Description</th>
            <th className="py-2 pr-3 text-right">Qty</th>
            <th className="py-2 pr-3 text-right">Unit price</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((l) => (
            <tr key={l.id} className="border-b border-slate-300">
              <td className="py-1.5 pr-3">{l.description}</td>
              <td className="py-1.5 pr-3 text-right">{l.quantity}</td>
              <td className="py-1.5 pr-3 text-right">{formatMoney(l.unitPrice)}</td>
              <td className="py-1.5 text-right">{formatMoney(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="mt-4 ml-auto w-80 space-y-1">
        <Line label="Subtotal" value={invoice.subtotal} />
        {invoice.discount > 0 && <Line label="Discount" value={-invoice.discount} />}
        <Line label="Total" value={invoice.total} bold />
        <Line label="Paid" value={invoice.amountPaid} />
        <Line label="Balance due" value={invoice.balance} bold />
      </dl>
    </PrintFrame>
  )
}

function Line({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'border-t border-slate-800 pt-1 font-bold' : ''}`}>
      <dt>{label}</dt>
      <dd className="whitespace-nowrap">{value < 0 ? `- ${formatMoney(-value)}` : formatMoney(value)}</dd>
    </div>
  )
}

export function ReceiptPage() {
  const { id } = useParams()
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getReceipt(Number(id)).then(setReceipt).catch(() => setError('Could not load the receipt.'))
  }, [id])

  if (error) return <p className="p-8 text-red-700">{error}</p>
  if (!receipt) return <p className="p-8 text-slate-500">Loading...</p>

  const p = receipt.payment
  return (
    <PrintFrame title="Receipt">
      <section className="mt-4 space-y-1">
        <Row label="Receipt no.">{p.receiptNumber}</Row>
        <Row label="Date">{formatDateTime(p.paidAt)}</Row>
        <Row label="Received from">
          {receipt.patientName} ({receipt.patientNumber})
        </Row>
        <Row label="For invoice">{receipt.invoiceNumber}</Row>
        <Row label="Method">
          {paymentMethodLabels[p.method]}
          {p.referenceNumber && `, ref. ${p.referenceNumber}`}
        </Row>
      </section>
      <p className="mt-6 border-y-2 border-slate-800 py-3 text-center text-2xl font-bold">
        Amount received: {formatMoney(p.amount)}
      </p>
      <dl className="mt-4 ml-auto w-80 space-y-1">
        <Line label="Invoice total" value={receipt.invoiceTotal} />
        <Line label="Paid to date" value={receipt.paidToDate} />
        <Line label="Balance after this payment" value={receipt.balanceAfter} bold />
      </dl>
      <div className="mt-12 flex justify-end">
        <div className="text-center">
          <div className="mb-1 w-56 border-b border-slate-800" />
          <p>Received by {p.receivedBy ?? '-'}</p>
        </div>
      </div>
    </PrintFrame>
  )
}
