import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { addPayment, cancelInvoice, getInvoice } from '../../api/billing'
import { ApiError } from '../../api/client'
import { Permissions } from '../../auth/permissions'
import { hasAnyRole } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { InvoiceStatusBadge } from '../../components/billing/InvoiceStatusBadge'
import { FormField, inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import { chargeTypeLabels, paymentMethodLabels, type InvoiceDetail, type PaymentMethod } from '../../types/billing'
import { errorsByField, firstError } from '../../utils/formErrors'
import { formatDateTime, formatMoney } from '../../utils/format'

// One invoice: its lines and totals (FR-BL-05), payments (FR-BL-06, UI-BIL-02) and receipts (UI-BIL-03).
export default function InvoicePage() {
  const { id } = useParams()
  const invoiceId = Number(id)
  const { user } = useAuth()
  const canManage = hasAnyRole(user?.roles, Permissions.manageBilling)

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastReceiptId, setLastReceiptId] = useState<number | null>(null)

  function load() {
    getInvoice(invoiceId)
      .then(setInvoice)
      .catch((err: unknown) =>
        setError(err instanceof ApiError && err.status === 404 ? 'Invoice not found.' : 'Could not load the invoice.'),
      )
  }
  useEffect(load, [invoiceId])

  async function cancel() {
    setError(null)
    try {
      setInvoice(await cancelInvoice(invoiceId))
    } catch (err) {
      setError(firstError(err, 'Could not cancel.'))
    }
  }

  if (!invoice) {
    return error ? (
      <p className="border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800" role="alert">
        {error}
      </p>
    ) : (
      <p className="text-slate-500">Loading...</p>
    )
  }

  const open = invoice.status === 'Issued' || invoice.status === 'PartiallyPaid'

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/billing?tab=due" className="text-sm text-brand-700 hover:underline">
            &larr; Billing
          </Link>
          <h1 className="mt-1 text-[1.75rem] leading-tight font-medium text-slate-900">
            Invoice <span className="font-mono">{invoice.invoiceNumber}</span>
          </h1>
          <p className="text-sm text-slate-600">
            {invoice.patientName} ({invoice.patientNumber}) &middot; issued {formatDateTime(invoice.issuedAt)}
            {invoice.issuedBy && ` by ${invoice.issuedBy}`}
          </p>
        </div>
        <InvoiceStatusBadge status={invoice.status} />
      </div>

      {error && (
        <p className="border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
      {lastReceiptId && (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800" role="status">
          Payment recorded.{' '}
          <Link to={`/billing/payments/${lastReceiptId}/receipt`} target="_blank" className="font-medium underline">
            Print the receipt
          </Link>
        </p>
      )}

      <section className="space-y-4 rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70">
        {invoice.status === 'Cancelled' ? (
          <p className="text-sm text-slate-600">
            This invoice was cancelled. Its charges went back to &quot;Ready to bill&quot;; the audit log keeps what was on it.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">Type</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Description</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Qty</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Unit price</th>
                  <th scope="col" className="py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {invoice.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2 pr-3">{chargeTypeLabels[l.chargeType]}</td>
                    <td className="py-2 pr-3">{l.description}</td>
                    <td className="py-2 pr-3 text-right">{l.quantity}</td>
                    <td className="py-2 pr-3 text-right">{formatMoney(l.unitPrice)}</td>
                    <td className="py-2 text-right">{formatMoney(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Totals invoice={invoice} />
        <div className="flex flex-wrap gap-2">
          {invoice.status !== 'Cancelled' && (
            <Link to={`/billing/invoices/${invoice.id}/print`} target="_blank" className={secondaryButtonClass}>
              Print invoice
            </Link>
          )}
          {canManage && open && invoice.amountPaid === 0 && (
            <button type="button" onClick={() => void cancel()} className={secondaryButtonClass}>
              Cancel invoice
            </button>
          )}
        </div>
      </section>

      {canManage && open && (
        <PaymentForm
          balance={invoice.balance}
          onSave={async (body) => {
            const receipt = await addPayment(invoice.id, body)
            setLastReceiptId(receipt.payment.id)
            load()
          }}
        />
      )}

      <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70" aria-labelledby="payments-heading">
        <h2 id="payments-heading" className="font-semibold text-slate-900">Payments</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th scope="col" className="py-1 pr-3 font-medium">Receipt</th>
                <th scope="col" className="py-1 pr-3 font-medium">When</th>
                <th scope="col" className="py-1 pr-3 font-medium">Method</th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">Amount</th>
                <th scope="col" className="py-1 font-medium">Received by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {invoice.payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-1 pr-3 font-mono">
                    <Link to={`/billing/payments/${p.id}/receipt`} target="_blank" className="text-brand-700 hover:underline">
                      {p.receiptNumber}
                    </Link>
                  </td>
                  <td className="py-1 pr-3">{formatDateTime(p.paidAt)}</td>
                  <td className="py-1 pr-3">
                    {paymentMethodLabels[p.method]}
                    {p.referenceNumber && <span className="block text-xs text-slate-500">Ref. {p.referenceNumber}</span>}
                  </td>
                  <td className="py-1 pr-3 text-right">{formatMoney(p.amount)}</td>
                  <td className="py-1">{p.receivedBy ?? '-'}</td>
                </tr>
              ))}
              {invoice.payments.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-3 text-slate-500">
                    No payments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Totals({ invoice }: { invoice: InvoiceDetail }) {
  return (
    <dl className="ml-auto max-w-xs space-y-1 text-sm">
      <div className="flex justify-between">
        <dt className="text-slate-600">Subtotal</dt>
        <dd>{formatMoney(invoice.subtotal)}</dd>
      </div>
      {invoice.discount > 0 && (
        <div className="flex justify-between">
          <dt className="text-slate-600">Discount</dt>
          <dd>- {formatMoney(invoice.discount)}</dd>
        </div>
      )}
      <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold">
        <dt>Total</dt>
        <dd>{formatMoney(invoice.total)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-slate-600">Paid</dt>
        <dd>{formatMoney(invoice.amountPaid)}</dd>
      </div>
      <div className="flex justify-between text-base font-semibold">
        <dt>Balance due</dt>
        <dd>{formatMoney(invoice.balance)}</dd>
      </div>
    </dl>
  )
}

function PaymentForm({
  balance,
  onSave,
}: {
  balance: number
  onSave: (body: { amount: number; method: PaymentMethod; referenceNumber: string }) => Promise<void>
}) {
  const [amount, setAmount] = useState(String(balance))
  const [method, setMethod] = useState<PaymentMethod>('Cash')
  const [reference, setReference] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErrors({})
    setSaving(true)
    try {
      await onSave({ amount: Number(amount || 0), method, referenceNumber: reference })
      setReference('')
    } catch (err) {
      if (err instanceof ApiError) setErrors(errorsByField(err.fieldErrors))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3 rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70">
      <h2 className="font-semibold text-slate-900">Receive payment</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField id="amount" label="Amount (LKR)" required error={errors.amount}>
          <input
            id="amount"
            type="number"
            min={0.01}
            max={balance}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
          />
        </FormField>
        <FormField id="method" label="Method" required error={errors.method}>
          <select id="method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className={inputClass}>
            {(Object.keys(paymentMethodLabels) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {paymentMethodLabels[m]}
              </option>
            ))}
          </select>
        </FormField>
        {method !== 'Cash' && (
          <FormField id="referenceNumber" label="Card slip / transfer reference" required error={errors.referenceNumber}>
            <input
              id="referenceNumber"
              maxLength={100}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className={inputClass}
            />
          </FormField>
        )}
      </div>
      <p className="text-xs text-slate-500">A part payment is allowed. More than the balance due is refused.</p>
      <button type="submit" disabled={saving} className={primaryButtonClass}>
        {saving ? 'Saving...' : 'Record payment'}
      </button>
    </form>
  )
}
