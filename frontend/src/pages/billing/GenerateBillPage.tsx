import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { createInvoice, getUnbilledCharges } from '../../api/billing'
import { Permissions } from '../../auth/permissions'
import { hasAnyRole } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { inputClass, primaryButtonClass } from '../../components/ui/FormField'
import { chargeTypeLabels, type UnbilledCharges } from '../../types/billing'
import { formatDateTime, formatMoney } from '../../utils/format'
import { allErrors } from '../../utils/formErrors'

// UI-BIL-01 Generate Bill: the accountant picks the patient's unbilled charges and issues an invoice.
// The totals shown here are a preview; the API works them out again from the charges, so they always match.
export default function GenerateBillPage() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canBill = hasAnyRole(user?.roles, Permissions.manageBilling)

  const [data, setData] = useState<UnbilledCharges | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [discount, setDiscount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getUnbilledCharges(Number(patientId))
      .then((d) => {
        setData(d)
        setSelected(d.charges.map((c) => c.id))
      })
      .catch(() => setError('Could not load the charges.'))
  }, [patientId])

  if (!data) {
    return error ? (
      <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
        {error}
      </p>
    ) : (
      <p className="text-slate-500">Loading...</p>
    )
  }

  const subtotal = data.charges.filter((c) => selected.includes(c.id)).reduce((sum, c) => sum + c.amount, 0)
  const discountValue = Number(discount || 0)
  const total = subtotal - discountValue

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (selected.length === 0) {
      setError('Choose at least one charge.')
      return
    }
    if (discountValue < 0 || discountValue > subtotal) {
      setError('The discount must be between 0 and the subtotal.')
      return
    }
    setSaving(true)
    try {
      const invoice = await createInvoice(data!.patientId, selected, discountValue)
      navigate(`/billing/invoices/${invoice.id}`)
    } catch (err) {
      setError(allErrors(err, 'Could not create the invoice.').join(' '))
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <Link to="/billing" className="text-sm text-blue-700 hover:underline">
          &larr; Billing
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Generate bill</h1>
        <p className="text-sm text-slate-600">
          {data.patientName} ({data.patientNumber})
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th scope="col" className="py-2 pr-3 font-medium">
                  <span className="sr-only">Include</span>
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">Date</th>
                <th scope="col" className="py-2 pr-3 font-medium">Type</th>
                <th scope="col" className="py-2 pr-3 font-medium">Description</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Qty</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Unit price</th>
                <th scope="col" className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {data.charges.map((c) => (
                <tr key={c.id}>
                  <td className="py-2 pr-3">
                    <input
                      type="checkbox"
                      aria-label={`Include ${c.description}`}
                      checked={selected.includes(c.id)}
                      disabled={!canBill}
                      onChange={(e) => setSelected(e.target.checked ? [...selected, c.id] : selected.filter((id) => id !== c.id))}
                    />
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(c.createdAt)}</td>
                  <td className="py-2 pr-3">{chargeTypeLabels[c.chargeType]}</td>
                  <td className="py-2 pr-3">{c.description}</td>
                  <td className="py-2 pr-3 text-right">{c.quantity}</td>
                  <td className="py-2 pr-3 text-right">{formatMoney(c.unitPrice)}</td>
                  <td className="py-2 text-right">{formatMoney(c.amount)}</td>
                </tr>
              ))}
              {data.charges.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-slate-500">
                    This patient has nothing to bill.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <dl className="ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-600">Subtotal</dt>
            <dd>{formatMoney(subtotal)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt>
              <label htmlFor="discount" className="text-slate-600">
                Discount (LKR)
              </label>
            </dt>
            <dd>
              <input
                id="discount"
                type="number"
                min={0}
                step="0.01"
                value={discount}
                disabled={!canBill}
                onChange={(e) => setDiscount(e.target.value)}
                className={`${inputClass} w-32 text-right`}
              />
            </dd>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-semibold">
            <dt>Total</dt>
            <dd>{formatMoney(total)}</dd>
          </div>
        </dl>

        {canBill && data.charges.length > 0 && (
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className={primaryButtonClass}>
              {saving ? 'Saving...' : 'Generate invoice'}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
