import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ApiError } from '../../api/client'
import { getPharmacyAlerts, listDispensedPrescriptions, listMedicineStock, listOpenPrescriptions } from '../../api/pharmacy'
import { Permissions } from '../../auth/permissions'
import { hasAnyRole } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { LowStockBadge, PrescriptionStatusBadge } from '../../components/pharmacy/PharmacyBadges'
import { inputClass, primaryButtonClass } from '../../components/ui/FormField'
import type { Prescription } from '../../types/medicalRecord'
import type { AlertBatch, MedicineStock, PharmacyAlerts } from '../../types/pharmacy'
import { formatDate, formatDateTime, formatMoney } from '../../utils/format'
import { Tabs } from '../../components/ui/Tabs'

type Tab = 'queue' | 'dispensed' | 'stock' | 'alerts'

const tabLabels: Record<Tab, string> = {
  queue: 'Prescriptions to dispense',
  dispensed: 'Recently dispensed',
  stock: 'Stock',
  alerts: 'Alerts',
}

// PDF 3.7 Pharmacy Management. The pharmacist works from the queue; everyone with access sees stock and alerts.
export default function PharmacyPage() {
  const { user } = useAuth()
  const seesQueue = hasAnyRole(user?.roles, Permissions.pharmacyQueue)
  const tabs: Tab[] = seesQueue ? ['queue', 'dispensed', 'stock', 'alerts'] : ['stock', 'alerts']

  const [params, setParams] = useSearchParams()
  const requested = params.get('tab') as Tab | null
  const tab = requested && tabs.includes(requested) ? requested : tabs[0]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Pharmacy</h1>
        {hasAnyRole(user?.roles, Permissions.managePharmacyStock) && (
          <Link to="/pharmacy/medicines/new" className={primaryButtonClass}>
            Add medicine
          </Link>
        )}
      </div>

      <Tabs label="Pharmacy views" tabs={tabs} labels={tabLabels} value={tab} onChange={(t) => setParams({ tab: t })} />

      {(tab === 'queue' || tab === 'dispensed') && <PrescriptionList key={tab} dispensed={tab === 'dispensed'} />}
      {tab === 'stock' && <StockList />}
      {tab === 'alerts' && <AlertsView />}
    </div>
  )
}

function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
      {error}
    </p>
  ) : null
}

const card = 'overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200'
const th = 'px-4 py-3 font-medium'

function PrescriptionList({ dispensed }: { dispensed: boolean }) {
  const [rows, setRows] = useState<Prescription[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    ;(dispensed ? listDispensedPrescriptions() : listOpenPrescriptions())
      .then((data) => !ignore && setRows(data))
      .catch((err: unknown) => !ignore && setError(err instanceof ApiError ? err.message : 'Could not load prescriptions.'))
    return () => {
      ignore = true
    }
  }, [dispensed])

  return (
    <>
      <ErrorText error={error} />
      <div className={card}>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th scope="col" className={th}>Prescription</th>
              <th scope="col" className={th}>Patient</th>
              <th scope="col" className={th}>Medicines</th>
              <th scope="col" className={th}>Prescribed</th>
              <th scope="col" className={th}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows?.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link to={`/pharmacy/prescriptions/${p.id}`} className="font-medium text-blue-700 hover:underline">
                    #{p.id}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {p.patientName}
                  <span className="block text-xs text-slate-500">{p.patientNumber}</span>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {p.items.map((i) => (
                    <span key={i.id} className="block">
                      {i.medicineName} {i.strength} &times; {i.quantity}
                      {i.quantityDispensed > 0 && i.quantityDispensed < i.quantity && (
                        <span className="text-xs text-slate-500"> ({i.quantityDispensed} given)</span>
                      )}
                    </span>
                  ))}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {formatDateTime(p.prescribedAt)}
                  <span className="block text-xs text-slate-500">Dr {p.doctorName}</span>
                </td>
                <td className="px-4 py-3">
                  <PrescriptionStatusBadge status={p.status} />
                </td>
              </tr>
            ))}
            {rows && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  {dispensed ? 'Nothing dispensed yet.' : 'No prescriptions are waiting.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

function StockList() {
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [rows, setRows] = useState<MedicineStock[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    // A short pause so typing "parac" makes one request, not five.
    const timer = setTimeout(() => {
      listMedicineStock(search, showInactive)
        .then((data) => !ignore && setRows(data))
        .catch((err: unknown) => !ignore && setError(err instanceof ApiError ? err.message : 'Could not load stock.'))
    }, 250)
    return () => {
      ignore = true
      clearTimeout(timer)
    }
  }, [search, showInactive])

  const showValue = rows?.some((r) => r.stockValue !== null) ?? false
  const totalValue = rows?.reduce((sum, r) => sum + (r.stockValue ?? 0), 0) ?? 0

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="stock-search" className="sr-only">
          Search medicines
        </label>
        <input
          id="stock-search"
          type="search"
          placeholder="Search by name or generic name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} max-w-xs`}
        />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show inactive medicines
        </label>
        {showValue && (
          <p className="ml-auto text-sm text-slate-700">
            Stock value (cost): <strong>{formatMoney(totalValue)}</strong>
          </p>
        )}
      </div>
      <ErrorText error={error} />
      <div className={card}>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th scope="col" className={th}>Medicine</th>
              <th scope="col" className={th}>In stock</th>
              <th scope="col" className={th}>Reorder level</th>
              <th scope="col" className={th}>Next expiry</th>
              <th scope="col" className={th}>Price per unit</th>
              {showValue && <th scope="col" className={th}>Stock value</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows?.map((m) => (
              <tr key={m.id} className={m.isActive ? 'hover:bg-slate-50' : 'text-slate-400'}>
                <td className="px-4 py-3">
                  <Link to={`/pharmacy/medicines/${m.id}`} className="font-medium text-blue-700 hover:underline">
                    {m.name} {m.strength}
                  </Link>
                  <span className="block text-xs text-slate-500">
                    {m.form}
                    {m.genericName && m.genericName !== m.name && `, ${m.genericName}`}
                    {!m.isActive && ', inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="mr-2 font-medium text-slate-900">{m.usableStock}</span>
                  {m.isLowStock && <LowStockBadge />}
                  {m.expiredStock > 0 && <span className="block text-xs text-red-700">{m.expiredStock} expired</span>}
                </td>
                <td className="px-4 py-3 text-slate-700">{m.reorderLevel}</td>
                <td className="px-4 py-3 text-slate-700">{m.nextExpiry ? formatDate(m.nextExpiry) : '-'}</td>
                <td className="px-4 py-3 text-slate-700">{formatMoney(m.unitPrice)}</td>
                {showValue && <td className="px-4 py-3 text-slate-700">{formatMoney(m.stockValue ?? 0)}</td>}
              </tr>
            ))}
            {rows && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No medicines found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

function AlertsView() {
  const [alerts, setAlerts] = useState<PharmacyAlerts | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPharmacyAlerts()
      .then(setAlerts)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load alerts.'))
  }, [])

  if (!alerts) return <ErrorText error={error} />

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200" aria-labelledby="low-heading">
        <h2 id="low-heading" className="font-semibold text-slate-900">
          Low stock <span className="text-slate-500">({alerts.lowStock.length})</span>
        </h2>
        <p className="text-xs text-slate-500">Usable stock below the reorder level.</p>
        <ul className="mt-2 divide-y divide-slate-100 text-sm">
          {alerts.lowStock.map((m) => (
            <li key={m.id} className="flex justify-between gap-2 py-2">
              <Link to={`/pharmacy/medicines/${m.id}`} className="text-blue-700 hover:underline">
                {m.name} {m.strength}
              </Link>
              <span className="text-slate-700">
                <strong className="text-red-700">{m.usableStock}</strong> / {m.reorderLevel}
              </span>
            </li>
          ))}
          {alerts.lowStock.length === 0 && <li className="py-2 text-slate-500">None.</li>}
        </ul>
      </section>
      <BatchAlerts
        id="near-heading"
        title="Expiring soon"
        hint={`Expires within ${alerts.nearExpiryDays} days. Dispense these first.`}
        batches={alerts.nearExpiry}
      />
      <BatchAlerts
        id="expired-heading"
        title="Expired"
        hint="Cannot be dispensed. Open the medicine and remove the batch from stock."
        batches={alerts.expired}
        danger
      />
    </div>
  )
}

function BatchAlerts({
  id,
  title,
  hint,
  batches,
  danger,
}: {
  id: string
  title: string
  hint: string
  batches: AlertBatch[]
  danger?: boolean
}) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200" aria-labelledby={id}>
      <h2 id={id} className="font-semibold text-slate-900">
        {title} <span className="text-slate-500">({batches.length})</span>
      </h2>
      <p className="text-xs text-slate-500">{hint}</p>
      <ul className="mt-2 divide-y divide-slate-100 text-sm">
        {batches.map((b) => (
          <li key={b.batchId} className="py-2">
            <Link to={`/pharmacy/medicines/${b.medicineId}`} className="text-blue-700 hover:underline">
              {b.medicineName} {b.strength}
            </Link>
            <span className="block text-xs text-slate-600">
              Batch <span className="font-mono">{b.batchNumber}</span>, {b.quantityOnHand} units,{' '}
              <span className={danger ? 'font-medium text-red-700' : 'font-medium text-amber-800'}>
                {danger ? 'expired' : 'expires'} {formatDate(b.expiryDate)}
              </span>
            </span>
          </li>
        ))}
        {batches.length === 0 && <li className="py-2 text-slate-500">None.</li>}
      </ul>
    </section>
  )
}
