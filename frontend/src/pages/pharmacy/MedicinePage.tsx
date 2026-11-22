import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { adjustStock, getMedicine, setMedicinePrice, stockIn, writeOffExpired } from '../../api/pharmacy'
import { Permissions } from '../../auth/permissions'
import { hasAnyRole } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { ExpiryBadge, LowStockBadge } from '../../components/pharmacy/PharmacyBadges'
import { FormField, inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import { movementLabels, type Batch, type MedicineDetail } from '../../types/pharmacy'
import { errorsByField, firstError } from '../../utils/formErrors'
import { addDays, formatDate, formatDateTime, formatMoney, todayInHospital } from '../../utils/format'

// One medicine: stock by batch (FR-PH-01), stock in and corrections (FR-PH-03), expiry (FR-PH-04), price.
export default function MedicinePage() {
  const { id } = useParams()
  const medicineId = Number(id)
  const { user } = useAuth()
  const canManage = hasAnyRole(user?.roles, Permissions.managePharmacyStock)
  const canPrice = hasAnyRole(user?.roles, Permissions.editMedicinePrices)

  const [detail, setDetail] = useState<MedicineDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    getMedicine(medicineId)
      .then(setDetail)
      .catch((err: unknown) =>
        setError(err instanceof ApiError && err.status === 404 ? 'Medicine not found.' : 'Could not load the medicine.'),
      )
  }, [medicineId, reloadKey])

  // Returns true when saved, so a form can stay open (with the user's input) when it was refused.
  async function act(action: () => Promise<MedicineDetail>) {
    setError(null)
    try {
      setDetail(await action())
      return true
    } catch (err) {
      setError(firstError(err, 'Could not save.'))
      return false
    }
  }

  if (!detail) {
    return error ? (
      <p className="border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800" role="alert">
        {error}
      </p>
    ) : (
      <p className="text-slate-500">Loading...</p>
    )
  }

  const m = detail.medicine
  const showCost = m.stockValue !== null

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/pharmacy?tab=stock" className="text-sm text-brand-700 hover:underline">
            &larr; Pharmacy stock
          </Link>
          <h1 className="mt-1 text-[1.75rem] leading-tight font-medium text-slate-900">
            {m.name} {m.strength} <span className="text-base font-normal text-slate-500">{m.form}</span>
          </h1>
          {m.genericName && m.genericName !== m.name && <p className="text-sm text-slate-600">{m.genericName}</p>}
        </div>
        {canManage && (
          <Link to={`/pharmacy/medicines/${m.id}/edit`} className={secondaryButtonClass}>
            Edit medicine
          </Link>
        )}
      </div>

      {error && (
        <p className="border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70">
        <dl className="grid gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-sm text-slate-500">Usable stock</dt>
            <dd className="mt-1 text-2xl font-semibold text-slate-900">
              {m.usableStock} {m.isLowStock && <LowStockBadge />}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Reorder level</dt>
            <dd className="mt-1 text-slate-900">{m.reorderLevel}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Price per unit</dt>
            <dd className="mt-1 text-slate-900">{formatMoney(m.unitPrice)}</dd>
          </div>
          {showCost && (
            <div>
              <dt className="text-sm text-slate-500">Stock value (cost)</dt>
              <dd className="mt-1 text-slate-900">{formatMoney(m.stockValue ?? 0)}</dd>
            </div>
          )}
        </dl>
        {!m.isActive && <p className="mt-3 text-sm text-slate-600">This medicine is inactive: doctors cannot prescribe it.</p>}
        {canPrice && !canManage && <PriceForm price={m.unitPrice} onSave={(price) => setMedicinePrice(m.id, price).then(() => setReloadKey((k) => k + 1))} />}
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70" aria-labelledby="batches-heading">
        <h2 id="batches-heading" className="font-semibold text-slate-900">Batches in stock</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th scope="col" className="py-2 pr-3 font-medium">Batch</th>
                <th scope="col" className="py-2 pr-3 font-medium">Expiry</th>
                <th scope="col" className="py-2 pr-3 font-medium">Quantity</th>
                {showCost && <th scope="col" className="py-2 pr-3 font-medium">Cost per unit</th>}
                <th scope="col" className="py-2 pr-3 font-medium">Received</th>
                {canManage && <th scope="col" className="py-2 font-medium"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {detail.batches.map((b) => (
                <BatchRow
                  key={b.id}
                  batch={b}
                  showCost={showCost}
                  canManage={canManage}
                  onAdjust={(change, reason) => act(() => adjustStock(b.id, change, reason))}
                  onWriteOff={() => act(() => writeOffExpired(b.id))}
                />
              ))}
              {detail.batches.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-3 text-slate-500">
                    No stock.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {canManage && <StockInForm medicineId={m.id} onSaved={setDetail} />}

      <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70" aria-labelledby="moves-heading">
        <h2 id="moves-heading" className="font-semibold text-slate-900">Stock history</h2>
        <p className="text-xs text-slate-500">The latest 50 changes. Every change to stock is recorded here.</p>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th scope="col" className="py-1 pr-3 font-medium">When</th>
                <th scope="col" className="py-1 pr-3 font-medium">What</th>
                <th scope="col" className="py-1 pr-3 font-medium">Batch</th>
                <th scope="col" className="py-1 pr-3 font-medium">Change</th>
                <th scope="col" className="py-1 pr-3 font-medium">Details</th>
                <th scope="col" className="py-1 font-medium">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {detail.movements.map((s) => (
                <tr key={s.id}>
                  <td className="py-1 pr-3">{formatDateTime(s.createdAt)}</td>
                  <td className="py-1 pr-3">{movementLabels[s.movementType]}</td>
                  <td className="py-1 pr-3 font-mono">{s.batchNumber}</td>
                  <td className={`py-1 pr-3 font-medium ${s.quantity > 0 ? 'text-green-700' : 'text-slate-900'}`}>
                    {s.quantity > 0 ? `+${s.quantity}` : s.quantity}
                  </td>
                  <td className="py-1 pr-3">
                    {s.prescriptionId ? (
                      <Link to={`/pharmacy/prescriptions/${s.prescriptionId}`} className="text-brand-700 hover:underline">
                        Prescription #{s.prescriptionId} ({s.patientNumber})
                      </Link>
                    ) : (
                      (s.reason ?? '-')
                    )}
                  </td>
                  <td className="py-1">{s.createdBy ?? '-'}</td>
                </tr>
              ))}
              {detail.movements.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-3 text-slate-500">
                    No stock changes yet.
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

function BatchRow({
  batch,
  showCost,
  canManage,
  onAdjust,
  onWriteOff,
}: {
  batch: Batch
  showCost: boolean
  canManage: boolean
  onAdjust: (change: number, reason: string) => Promise<boolean>
  onWriteOff: () => Promise<boolean>
}) {
  const [correcting, setCorrecting] = useState(false)
  const [change, setChange] = useState('')
  const [reason, setReason] = useState('')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!(await onAdjust(Number(change), reason))) return
    setCorrecting(false)
    setChange('')
    setReason('')
  }

  const expired = batch.expiryState === 'Expired'
  return (
    <>
      <tr className={expired ? 'bg-red-50/50' : ''}>
        <td className="py-2 pr-3 font-mono">{batch.batchNumber}</td>
        <td className="py-2 pr-3">
          {formatDate(batch.expiryDate)} <ExpiryBadge state={batch.expiryState} />
        </td>
        <td className="py-2 pr-3">{batch.quantityOnHand}</td>
        {showCost && <td className="py-2 pr-3">{formatMoney(batch.costPrice ?? 0)}</td>}
        <td className="py-2 pr-3">{formatDate(batch.receivedAt.slice(0, 10))}</td>
        {canManage && (
          <td className="py-2 text-right whitespace-nowrap">
            {expired ? (
              <button type="button" onClick={() => void onWriteOff()} className="text-red-700 hover:underline">
                Remove expired stock<span className="sr-only"> of batch {batch.batchNumber}</span>
              </button>
            ) : (
              <button type="button" onClick={() => setCorrecting(!correcting)} className="text-brand-700 hover:underline">
                Correct count<span className="sr-only"> of batch {batch.batchNumber}</span>
              </button>
            )}
          </td>
        )}
      </tr>
      {correcting && (
        <tr>
          <td colSpan={6} className="pb-3">
            <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-3">
              <div>
                <label htmlFor={`change-${batch.id}`} className="block text-xs font-medium text-slate-700">
                  Add (+) or remove (-)
                </label>
                <input
                  id={`change-${batch.id}`}
                  type="number"
                  required
                  value={change}
                  onChange={(e) => setChange(e.target.value)}
                  className={`${inputClass} mt-1 w-28`}
                />
              </div>
              <div className="min-w-48 flex-1">
                <label htmlFor={`reason-${batch.id}`} className="block text-xs font-medium text-slate-700">
                  Reason
                </label>
                <input
                  id={`reason-${batch.id}`}
                  required
                  maxLength={300}
                  placeholder="Damaged strip, recount..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={`${inputClass} mt-1`}
                />
              </div>
              <button type="submit" className={primaryButtonClass}>
                Save correction
              </button>
            </form>
          </td>
        </tr>
      )}
    </>
  )
}

function StockInForm({ medicineId, onSaved }: { medicineId: number; onSaved: (detail: MedicineDetail) => void }) {
  const [minExpiry] = useState(() => addDays(todayInHospital(), 1))
  const [form, setForm] = useState({ batchNumber: '', expiryDate: '', quantity: '', costPrice: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErrors({})
    setDone(false)
    try {
      onSaved(
        await stockIn(medicineId, {
          batchNumber: form.batchNumber,
          expiryDate: form.expiryDate,
          quantity: Number(form.quantity || 0),
          costPrice: Number(form.costPrice || 0),
        }),
      )
      setForm({ batchNumber: '', expiryDate: '', quantity: '', costPrice: '' })
      setDone(true)
    } catch (err) {
      if (err instanceof ApiError) setErrors(errorsByField(err.fieldErrors))
    }
  }

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value })

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3 rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70">
      <h2 className="font-semibold text-slate-900">Stock in (receive a delivery)</h2>
      <div className="grid gap-3 sm:grid-cols-4">
        <FormField id="batchNumber" label="Batch number" required error={errors.batchNumber}>
          <input id="batchNumber" maxLength={50} value={form.batchNumber} onChange={set('batchNumber')} className={`${inputClass} font-mono`} />
        </FormField>
        <FormField id="expiryDate" label="Expiry date" required error={errors.expiryDate}>
          <input id="expiryDate" type="date" min={minExpiry} value={form.expiryDate} onChange={set('expiryDate')} className={inputClass} />
        </FormField>
        <FormField id="quantity" label="Quantity (units)" required error={errors.quantity}>
          <input id="quantity" type="number" min={1} value={form.quantity} onChange={set('quantity')} className={inputClass} />
        </FormField>
        <FormField id="costPrice" label="Cost per unit (LKR)" required error={errors.costPrice}>
          <input id="costPrice" type="number" min={0} step="0.01" value={form.costPrice} onChange={set('costPrice')} className={inputClass} />
        </FormField>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={primaryButtonClass}>
          Add to stock
        </button>
        {done && (
          <p className="text-sm text-green-800" role="status">
            Added to stock.
          </p>
        )}
      </div>
    </form>
  )
}

function PriceForm({ price, onSave }: { price: number; onSave: (price: number) => Promise<void> }) {
  const [value, setValue] = useState(String(price))
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      await onSave(Number(value || 0))
    } catch (err) {
      setError(firstError(err, 'Could not save the price.'))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
      <div>
        <label htmlFor="unitPrice" className="block text-sm font-medium text-slate-700">
          Change price per unit (LKR)
        </label>
        <input
          id="unitPrice"
          type="number"
          min={0}
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={`${inputClass} mt-1 w-36`}
        />
      </div>
      <button type="submit" className={secondaryButtonClass}>
        Save price
      </button>
      {error && <p className="w-full text-sm text-red-700">{error}</p>}
      <p className="w-full text-xs text-slate-500">Medicines already dispensed keep the price they were charged at.</p>
    </form>
  )
}
