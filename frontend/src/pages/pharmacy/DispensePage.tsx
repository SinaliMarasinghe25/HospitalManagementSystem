import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { dispense, getDispenseView } from '../../api/pharmacy'
import { Permissions } from '../../auth/permissions'
import { hasAnyRole } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { PrescriptionStatusBadge } from '../../components/pharmacy/PharmacyBadges'
import { inputClass, primaryButtonClass } from '../../components/ui/FormField'
import type { DispenseView } from '../../types/pharmacy'
import { formatDate, formatDateTime, formatMoney } from '../../utils/format'

// FR-PH-02 Prescription processing. The pharmacist enters how many of each medicine is handed over.
// The API takes stock from the batch that expires first (never an expired one) and adds the charge to the bill.
export default function DispensePage() {
  const { id } = useParams()
  const prescriptionId = Number(id)
  const { user } = useAuth()
  const canDispense = hasAnyRole(user?.roles, Permissions.dispenseMedicines)

  const [view, setView] = useState<DispenseView | null>(null)
  const [quantities, setQuantities] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  function show(data: DispenseView) {
    setView(data)
    // Suggest the full remaining quantity, or what is in stock if that is less.
    const next: Record<number, string> = {}
    for (const item of data.prescription.items) {
      const remaining = item.quantity - item.quantityDispensed
      const inStock = data.stock.find((s) => s.medicineId === item.medicineId)?.usableStock ?? 0
      next[item.id] = String(Math.max(0, Math.min(remaining, inStock)))
    }
    setQuantities(next)
  }

  useEffect(() => {
    getDispenseView(prescriptionId)
      .then(show)
      .catch((err: unknown) =>
        setError(err instanceof ApiError && err.status === 404 ? 'Prescription not found.' : 'Could not load the prescription.'),
      )
  }, [prescriptionId])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!view) return
    setError(null)
    setSaved(false)
    setSaving(true)
    try {
      const items = view.prescription.items.map((i) => ({ prescriptionItemId: i.id, quantity: Number(quantities[i.id] || 0) }))
      show(await dispense(prescriptionId, items))
      setSaved(true)
    } catch (err) {
      setError(err instanceof ApiError ? (Object.values(err.fieldErrors).flat().join(' ') || err.message) : 'Could not dispense.')
    } finally {
      setSaving(false)
    }
  }

  if (!view) {
    return error ? (
      <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
        {error}
      </p>
    ) : (
      <p className="text-slate-500">Loading...</p>
    )
  }

  const p = view.prescription
  const isOpen = p.status === 'Pending' || p.status === 'PartiallyDispensed'
  const total = view.history.reduce((sum, h) => sum + h.amount, 0)

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/pharmacy" className="text-sm text-blue-700 hover:underline">
            &larr; Pharmacy
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">Prescription #{p.id}</h1>
          <p className="text-sm text-slate-600">
            {p.patientName} ({p.patientNumber}) &middot; Dr {p.doctorName} &middot; {formatDateTime(p.prescribedAt)}
          </p>
        </div>
        <PrescriptionStatusBadge status={p.status} />
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="rounded-md bg-green-50 p-3 text-sm text-green-800" role="status">
          Dispensed. Stock and the patient&apos;s bill have been updated.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th scope="col" className="py-2 pr-3 font-medium">Medicine</th>
                <th scope="col" className="py-2 pr-3 font-medium">How to take</th>
                <th scope="col" className="py-2 pr-3 font-medium">Prescribed</th>
                <th scope="col" className="py-2 pr-3 font-medium">Given</th>
                <th scope="col" className="py-2 pr-3 font-medium">In stock</th>
                {canDispense && isOpen && <th scope="col" className="py-2 font-medium">Give now</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {p.items.map((i) => {
                const remaining = i.quantity - i.quantityDispensed
                const stock = view.stock.find((s) => s.medicineId === i.medicineId)
                return (
                  <tr key={i.id}>
                    <td className="py-2 pr-3">
                      {i.medicineName} {i.strength}
                      <span className="block text-xs text-slate-500">
                        {i.form}, {formatMoney(stock?.unitPrice ?? 0)} each
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      {i.dosage}, {i.frequency}, {i.durationDays} days
                      {i.instructions && <span className="block text-xs text-slate-500">{i.instructions}</span>}
                    </td>
                    <td className="py-2 pr-3">{i.quantity}</td>
                    <td className="py-2 pr-3">{i.quantityDispensed}</td>
                    <td className={`py-2 pr-3 ${stock && stock.usableStock < remaining ? 'font-medium text-red-700' : ''}`}>
                      {stock?.usableStock ?? 0}
                    </td>
                    {canDispense && isOpen && (
                      <td className="py-2">
                        {remaining > 0 ? (
                          <>
                            <label htmlFor={`qty-${i.id}`} className="sr-only">
                              Quantity of {i.medicineName} to give now
                            </label>
                            <input
                              id={`qty-${i.id}`}
                              type="number"
                              min={0}
                              max={remaining}
                              value={quantities[i.id] ?? '0'}
                              onChange={(e) => setQuantities({ ...quantities, [i.id]: e.target.value })}
                              className={`${inputClass} w-24`}
                            />
                          </>
                        ) : (
                          <span className="text-green-700">Complete</span>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {canDispense && isOpen && (
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={saving} className={primaryButtonClass}>
              {saving ? 'Saving...' : 'Dispense'}
            </button>
            <p className="text-sm text-slate-600">
              Stock is taken from the batch that expires first. Expired batches are never used.
            </p>
          </div>
        )}
        {p.status === 'Cancelled' && <p className="text-sm text-slate-600">The doctor cancelled this prescription.</p>}
      </form>

      {view.history.length > 0 && (
        <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200" aria-labelledby="given-heading">
          <h2 id="given-heading" className="font-semibold text-slate-900">Handed over</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th scope="col" className="py-1 pr-3 font-medium">When</th>
                  <th scope="col" className="py-1 pr-3 font-medium">Medicine</th>
                  <th scope="col" className="py-1 pr-3 font-medium">Batch</th>
                  <th scope="col" className="py-1 pr-3 font-medium">Qty</th>
                  <th scope="col" className="py-1 pr-3 font-medium">Charged</th>
                  <th scope="col" className="py-1 font-medium">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {view.history.map((h, index) => (
                  <tr key={index}>
                    <td className="py-1 pr-3">{formatDateTime(h.dispensedAt)}</td>
                    <td className="py-1 pr-3">{h.medicineName}</td>
                    <td className="py-1 pr-3">
                      <span className="font-mono">{h.batchNumber}</span>
                      <span className="block text-xs text-slate-500">exp. {formatDate(h.expiryDate)}</span>
                    </td>
                    <td className="py-1 pr-3">{h.quantity}</td>
                    <td className="py-1 pr-3">{formatMoney(h.amount)}</td>
                    <td className="py-1">{h.dispensedBy ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 font-medium">
                  <td colSpan={4} className="py-2 pr-3 text-right">
                    Total added to the bill
                  </td>
                  <td colSpan={2} className="py-2">
                    {formatMoney(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
