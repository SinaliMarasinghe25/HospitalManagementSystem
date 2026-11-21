import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { listLabRequests, listLabTests, requestLabTests } from '../../api/lab'
import type { LabRequest, LabTest } from '../../types/lab'
import { formatMoney } from '../../utils/format'
import { primaryButtonClass, secondaryButtonClass } from '../ui/FormField'
import { LabStatusBadge, ResultText } from './LabStatusBadge'
import { firstError } from '../../utils/formErrors'

// On a visit's medical record page: the tests ordered for this visit, and (for its doctor) a form to order more.
export function LabTestsSection({ patientId, medicalRecordId, canRequest }: { patientId: number; medicalRecordId: number; canRequest: boolean }) {
  const [requests, setRequests] = useState<LabRequest[] | null>(null)
  const [catalogue, setCatalogue] = useState<LabTest[]>([])
  const [chosen, setChosen] = useState<number[]>([])
  const [ordering, setOrdering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    listLabRequests({ medicalRecordId: String(medicalRecordId) }).then(setRequests).catch(() => setRequests([]))
  }, [medicalRecordId, reloadKey])

  useEffect(() => {
    if (ordering) listLabTests().then(setCatalogue).catch(() => setError('Could not load the test catalogue.'))
  }, [ordering])

  async function submit() {
    setError(null)
    try {
      await requestLabTests(patientId, medicalRecordId, chosen)
      setOrdering(false)
      setChosen([])
      setReloadKey((k) => k + 1)
    } catch (err) {
      setError(firstError(err, 'Could not request tests.'))
    }
  }

  return (
    <section className="space-y-3 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200" aria-labelledby="lab-heading">
      <div className="flex items-center justify-between">
        <h2 id="lab-heading" className="font-semibold text-slate-900">Laboratory tests</h2>
        {canRequest && !ordering && (
          <button type="button" onClick={() => setOrdering(true)} className={primaryButtonClass}>
            Request tests
          </button>
        )}
      </div>
      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {ordering && (
        <fieldset className="space-y-2 rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
          <legend className="sr-only">Choose tests</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {catalogue.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={chosen.includes(t.id)}
                  onChange={(e) => setChosen((list) => (e.target.checked ? [...list, t.id] : list.filter((x) => x !== t.id)))}
                />
                {t.name} <span className="text-slate-500">({t.code}, {formatMoney(t.price)})</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" disabled={chosen.length === 0} onClick={() => void submit()} className={primaryButtonClass}>
              Send {chosen.length || ''} to the lab
            </button>
            <button type="button" onClick={() => setOrdering(false)} className={secondaryButtonClass}>
              Cancel
            </button>
          </div>
        </fieldset>
      )}

      {requests && requests.length === 0 && !ordering && <p className="text-sm text-slate-500">No tests requested for this visit.</p>}
      {requests && requests.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <Link to={`/laboratory/requests/${r.id}`} className="font-mono text-blue-700 hover:underline">
                {r.requestNumber}
              </Link>
              <span className="flex-1 text-slate-800">{r.testName}</span>
              <ResultText value={r.resultValue} unit={r.unit} isAbnormal={r.isAbnormal} />
              <LabStatusBadge status={r.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
