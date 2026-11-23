import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { addVitals, dischargePatient, getAdmission, listVitals, listWards, transferPatient } from '../../api/admissions'
import { ApiError } from '../../api/client'
import { Permissions } from '../../auth/permissions'
import { hasAnyRole, type Role } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import type { AdmissionDetail, VitalSign, VitalSignForm, Ward } from '../../types/admission'
import { ageFrom, formatDateTime, formatMoney } from '../../utils/format'
import { firstError } from '../../utils/formErrors'

// One admission: where the patient is, transfers, vital signs and nursing notes, and discharge.
export default function AdmissionDetailPage() {
  const { id } = useParams()
  const admissionId = Number(id)
  const { user } = useAuth()
  const can = (allowed: readonly Role[]) => hasAnyRole(user?.roles, allowed)

  const [admission, setAdmission] = useState<AdmissionDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAdmission(admissionId)
      .then(setAdmission)
      .catch((err: unknown) =>
        setError(err instanceof ApiError && err.status === 404 ? 'Admission not found.' : 'Could not load the admission.'),
      )
  }, [admissionId])

  if (!admission) {
    return error ? (
      <p className="border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800" role="alert">
        {error}
      </p>
    ) : (
      <p className="text-slate-500">Loading...</p>
    )
  }

  const isAdmitted = admission.status === 'Admitted'

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/admissions?tab=current" className="text-sm text-brand-700 hover:underline">
            &larr; Admissions
          </Link>
          <h1 className="mt-1 text-[1.75rem] leading-tight font-medium text-slate-900">
            {admission.patientName} <span className="font-mono text-base text-slate-500">{admission.admissionNumber}</span>
          </h1>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            isAdmitted ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200' : 'bg-green-50 text-green-800 ring-1 ring-green-200'
          }`}
        >
          {isAdmitted ? 'Admitted' : 'Discharged'}
        </span>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70">
        {admission.allergies && <p className="mb-3 text-sm font-medium text-red-800">Allergies: {admission.allergies}</p>}
        <dl className="grid gap-4 sm:grid-cols-2">
          <Item label="Patient">
            {can(Permissions.viewPatients) ? (
              <Link to={`/patients/${admission.patientId}`} className="text-brand-700 hover:underline">
                {admission.patientName}
              </Link>
            ) : (
              admission.patientName
            )}{' '}
            <span className="text-slate-500">
              ({admission.patientNumber}, {admission.gender}, age {ageFrom(admission.dateOfBirth)})
            </span>
          </Item>
          <Item label={isAdmitted ? 'Ward and bed' : 'Last ward and bed'}>
            {admission.wardName}, bed {admission.bedNumber}
          </Item>
          <Item label="Admitting doctor">Dr {admission.doctorName}</Item>
          <Item label="Reason for admission">{admission.admissionReason ?? '-'}</Item>
          <Item label="Admitted">{formatDateTime(admission.admittedAt)}</Item>
          <Item label="Discharged">{admission.dischargedAt ? formatDateTime(admission.dischargedAt) : '-'}</Item>
          <Item label={isAdmitted ? 'Bed days so far' : 'Bed days'}>
            {admission.daysCharged} &times; {formatMoney(admission.dailyCharge)}
          </Item>
        </dl>

        {admission.transfers.length > 0 && (
          <>
            <h2 className="mt-5 text-sm font-semibold text-slate-900">Bed transfers</h2>
            <ul className="mt-1 space-y-1 text-sm text-slate-700">
              {admission.transfers.map((t, i) => (
                <li key={i}>
                  {formatDateTime(t.transferredAt)}: {t.fromWard} {t.fromBed} &rarr; {t.toWard} {t.toBed}
                  {t.reason && ` (${t.reason})`}
                </li>
              ))}
            </ul>
          </>
        )}

        {admission.dischargeSummary && (
          <>
            <h2 className="mt-5 text-sm font-semibold text-slate-900">Discharge summary</h2>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{admission.dischargeSummary}</p>
            <Link
              to={`/admissions/${admission.id}/summary`}
              target="_blank"
              className={`${secondaryButtonClass} mt-3 inline-block`}
            >
              Print discharge summary
            </Link>
          </>
        )}
      </section>

      {isAdmitted && can(Permissions.transferPatients) && (
        <TransferSection admission={admission} onDone={setAdmission} />
      )}
      {can(Permissions.viewMedicalHistory) && (
        <VitalsSection admissionId={admission.id} canRecord={isAdmitted && can(Permissions.recordVitals)} />
      )}
      {isAdmitted && can(Permissions.dischargePatients) && (
        <DischargeSection admissionId={admission.id} onDone={setAdmission} />
      )}
    </div>
  )
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-900">{children}</dd>
    </div>
  )
}

function TransferSection({ admission, onDone }: { admission: AdmissionDetail; onDone: (a: AdmissionDetail) => void }) {
  const [open, setOpen] = useState(false)
  const [wards, setWards] = useState<Ward[]>([])
  const [toBedId, setToBedId] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) listWards().then(setWards).catch(() => setError('Could not load beds.'))
  }, [open])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!toBedId) {
      setError('Choose the new bed.')
      return
    }
    try {
      onDone(await transferPatient(admission.id, Number(toBedId), reason))
      setOpen(false)
    } catch (err) {
      setError(firstError(err, 'Could not transfer.'))
    }
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70" aria-labelledby="transfer-heading">
      <div className="flex items-center justify-between">
        <h2 id="transfer-heading" className="font-semibold text-slate-900">Transfer bed</h2>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className={secondaryButtonClass}>
            Transfer to another bed
          </button>
        )}
      </div>
      {open && (
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          {error && (
            <p className="border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800" role="alert">
              {error}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="toBedId" className="block text-sm font-medium text-slate-700">
                New bed<span className="text-red-600"> *</span>
              </label>
              <select id="toBedId" value={toBedId} onChange={(e) => setToBedId(e.target.value)} className={`${inputClass} mt-1`}>
                <option value="">Choose a free bed</option>
                {wards.map((w) => (
                  <optgroup key={w.id} label={w.name}>
                    {w.beds
                      .filter((b) => b.isActive && !b.admissionId)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {w.name}, bed {b.bedNumber}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="transferReason" className="block text-sm font-medium text-slate-700">
                Reason
              </label>
              <input
                id="transferReason"
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={`${inputClass} mt-1`}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className={primaryButtonClass}>
              Transfer
            </button>
            <button type="button" onClick={() => setOpen(false)} className={secondaryButtonClass}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

const emptyVitals: VitalSignForm = {
  temperatureC: '',
  pulseBpm: '',
  systolicBp: '',
  diastolicBp: '',
  respiratoryRate: '',
  oxygenSaturation: '',
  notes: '',
}

const vitalFields: { key: keyof VitalSignForm; label: string; step?: string }[] = [
  { key: 'temperatureC', label: 'Temp (°C)', step: '0.1' },
  { key: 'pulseBpm', label: 'Pulse (/min)' },
  { key: 'systolicBp', label: 'BP systolic' },
  { key: 'diastolicBp', label: 'BP diastolic' },
  { key: 'respiratoryRate', label: 'Resp. rate (/min)' },
  { key: 'oxygenSaturation', label: 'SpO₂ (%)' },
]

// Vital signs and nursing notes (assumption A3). Clinical roles see them; nurses and doctors add them.
function VitalsSection({ admissionId, canRecord }: { admissionId: number; canRecord: boolean }) {
  const [vitals, setVitals] = useState<VitalSign[] | null>(null)
  const [form, setForm] = useState<VitalSignForm>(emptyVitals)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    listVitals(admissionId).then(setVitals).catch(() => setError('Could not load vital signs.'))
  }, [admissionId, reloadKey])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      await addVitals(admissionId, form)
      setForm(emptyVitals)
      setReloadKey((k) => k + 1)
    } catch (err) {
      setError(firstError(err, 'Could not save.'))
    }
  }

  const show = (value: number | null) => (value === null ? '-' : value)

  return (
    <section className="space-y-3 rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70" aria-labelledby="vitals-heading">
      <h2 id="vitals-heading" className="font-semibold text-slate-900">Vital signs and nursing notes</h2>

      {canRecord && (
        <form onSubmit={handleSubmit} noValidate className="space-y-3 rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
          {error && (
            <p className="border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800" role="alert">
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            {vitalFields.map((f) => (
              <div key={f.key}>
                <label htmlFor={`v-${f.key}`} className="block text-xs font-medium text-slate-600">
                  {f.label}
                </label>
                <input
                  id={`v-${f.key}`}
                  type="number"
                  inputMode="decimal"
                  step={f.step ?? '1'}
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  className={inputClass}
                />
              </div>
            ))}
          </div>
          <div>
            <label htmlFor="v-notes" className="block text-xs font-medium text-slate-600">
              Nursing note
            </label>
            <textarea
              id="v-notes"
              rows={2}
              maxLength={500}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={inputClass}
            />
          </div>
          <button type="submit" className={primaryButtonClass}>
            Save observation
          </button>
        </form>
      )}

      {vitals && vitals.length === 0 && <p className="text-sm text-slate-500">No observations recorded yet.</p>}
      {vitals && vitals.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-600">
              <tr>
                <th scope="col" className="py-2 pr-3 font-medium">Time</th>
                <th scope="col" className="py-2 pr-3 font-medium">Temp</th>
                <th scope="col" className="py-2 pr-3 font-medium">Pulse</th>
                <th scope="col" className="py-2 pr-3 font-medium">BP</th>
                <th scope="col" className="py-2 pr-3 font-medium">Resp.</th>
                <th scope="col" className="py-2 pr-3 font-medium">SpO₂</th>
                <th scope="col" className="py-2 pr-3 font-medium">Note</th>
                <th scope="col" className="py-2 font-medium">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {vitals.map((v) => (
                <tr key={v.id}>
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(v.recordedAt)}</td>
                  <td className={`py-2 pr-3 ${v.temperatureC !== null && v.temperatureC >= 38 ? 'font-semibold text-red-700' : ''}`}>
                    {show(v.temperatureC)}
                  </td>
                  <td className="py-2 pr-3">{show(v.pulseBpm)}</td>
                  <td className="py-2 pr-3">{v.systolicBp !== null ? `${v.systolicBp}/${v.diastolicBp}` : '-'}</td>
                  <td className="py-2 pr-3">{show(v.respiratoryRate)}</td>
                  <td className={`py-2 pr-3 ${v.oxygenSaturation !== null && v.oxygenSaturation < 94 ? 'font-semibold text-red-700' : ''}`}>
                    {show(v.oxygenSaturation)}
                  </td>
                  <td className="py-2 pr-3">{v.notes ?? '-'}</td>
                  <td className="py-2 text-slate-500">{v.recordedBy ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-500">Temperature of 38 °C or more and SpO₂ below 94% are shown in red.</p>
        </div>
      )}
    </section>
  )
}

function DischargeSection({ admissionId, onDone }: { admissionId: number; onDone: (a: AdmissionDetail) => void }) {
  const [open, setOpen] = useState(false)
  const [summary, setSummary] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!summary.trim()) {
      setError('Write the discharge summary first.')
      return
    }
    try {
      onDone(await dischargePatient(admissionId, summary))
    } catch (err) {
      setError(firstError(err, 'Could not discharge.'))
    }
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70" aria-labelledby="discharge-heading">
      <div className="flex items-center justify-between">
        <h2 id="discharge-heading" className="font-semibold text-slate-900">Discharge</h2>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className={primaryButtonClass}>
            Discharge patient
          </button>
        )}
      </div>
      {open && (
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          {error && (
            <p className="border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800" role="alert">
              {error}
            </p>
          )}
          <label htmlFor="dischargeSummary" className="block text-sm font-medium text-slate-700">
            Discharge summary<span className="text-red-600"> *</span>
          </label>
          <textarea
            id="dischargeSummary"
            rows={5}
            maxLength={10000}
            placeholder="Condition on discharge, treatment given, medicines to continue, follow-up"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className={inputClass}
          />
          <p className="text-sm text-slate-600">Discharge releases the bed and adds the bed charge to the bill.</p>
          <div className="flex gap-2">
            <button type="submit" className={primaryButtonClass}>
              Confirm discharge
            </button>
            <button type="button" onClick={() => setOpen(false)} className={secondaryButtonClass}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
