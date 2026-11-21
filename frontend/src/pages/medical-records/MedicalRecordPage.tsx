import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { addPrescription, cancelPrescription, getMedicalRecord, searchMedicines } from '../../api/medicalRecords'
import { LabTestsSection } from '../../components/lab/LabTestsSection'
import { inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import type { Medicine, MedicalRecord, Prescription, PrescriptionLine } from '../../types/medicalRecord'
import { ageFrom, formatDate, formatDateTime } from '../../utils/format'
import { firstError } from '../../utils/formErrors'

// One visit's medical record (FR-EMR-01 to 03), with its prescriptions (FR-EMR-02)
// and a link to the printable medical report (FR-EMR-04).
export default function MedicalRecordPage() {
  const { id } = useParams()
  const recordId = Number(id)
  const [record, setRecord] = useState<MedicalRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    getMedicalRecord(recordId)
      .then(setRecord)
      .catch((err: unknown) =>
        setError(err instanceof ApiError && err.status === 404 ? 'Medical record not found.' : 'Could not load the medical record.'),
      )
  }, [recordId, reloadKey])

  if (!record) {
    return error ? (
      <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
        {error}
      </p>
    ) : (
      <p className="text-slate-500">Loading...</p>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to={`/patients/${record.patientId}`} className="text-sm text-blue-700 hover:underline">
            &larr; {record.patientName}
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">Medical record #{record.id}</h1>
          <p className="text-sm text-slate-600">
            Visit {formatDateTime(record.visitDate)} &middot; Dr {record.doctorName} ({record.departmentName})
          </p>
        </div>
        <div className="flex gap-2">
          {/* Opens in a new tab, so the doctor keeps this page. */}
          <Link to={`/medical-records/${record.id}/report`} target="_blank" className={secondaryButtonClass}>
            Print report
          </Link>
          {record.canEdit && (
            <Link to={`/medical-records/${record.id}/edit`} className={primaryButtonClass}>
              Edit record
            </Link>
          )}
        </div>
      </div>

      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm text-slate-700">
          <strong>{record.patientName}</strong> ({record.patientNumber}) &middot; {record.gender} &middot; Age{' '}
          {ageFrom(record.dateOfBirth)} (born {formatDate(record.dateOfBirth)})
          {record.bloodGroup && <> &middot; Blood group {record.bloodGroup}</>}
        </p>
        {record.allergies && <p className="mt-1 text-sm font-medium text-red-800">Allergies: {record.allergies}</p>}

        <dl className="mt-4 space-y-4">
          <Block label="Chief complaint">{record.chiefComplaint ?? '-'}</Block>
          <Block label="Examination and notes">
            <span className="whitespace-pre-line">{record.clinicalNotes ?? '-'}</span>
          </Block>
          <Block label="Diagnoses">
            {record.diagnoses.length === 0
              ? '-'
              : (
                <ul className="list-disc pl-5">
                  {record.diagnoses.map((d, i) => (
                    <li key={i}>
                      {d.code && <span className="font-mono">{d.code} </span>}
                      {d.description}
                      {d.isPrimary && <span className="ml-2 rounded bg-blue-50 px-1.5 text-xs text-blue-800">main</span>}
                    </li>
                  ))}
                </ul>
              )}
          </Block>
          <Block label="Treatments and procedures">
            {record.treatments.length === 0
              ? '-'
              : (
                <ul className="list-disc pl-5">
                  {record.treatments.map((t, i) => (
                    <li key={i}>{t.description}</li>
                  ))}
                </ul>
              )}
          </Block>
        </dl>
      </section>

      <PrescriptionsSection record={record} onChanged={() => setReloadKey((k) => k + 1)} />
      <LabTestsSection patientId={record.patientId} medicalRecordId={record.id} canRequest={record.canEdit} />
    </div>
  )
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-900">{children}</dd>
    </div>
  )
}

const prescriptionStatusLabels: Record<Prescription['status'], string> = {
  Pending: 'Waiting for pharmacy',
  PartiallyDispensed: 'Partly dispensed',
  Dispensed: 'Dispensed',
  Cancelled: 'Cancelled',
}

function PrescriptionsSection({ record, onChanged }: { record: MedicalRecord; onChanged: () => void }) {
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cancel(id: number) {
    setError(null)
    try {
      await cancelPrescription(id)
      onChanged()
    } catch (err) {
      setError(firstError(err, 'Could not cancel.'))
    }
  }

  return (
    <section className="space-y-3 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200" aria-labelledby="rx-heading">
      <div className="flex items-center justify-between">
        <h2 id="rx-heading" className="font-semibold text-slate-900">Prescriptions</h2>
        {record.canEdit && !adding && (
          <button type="button" onClick={() => setAdding(true)} className={primaryButtonClass}>
            New prescription
          </button>
        )}
      </div>
      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {record.prescriptions.length === 0 && !adding && <p className="text-sm text-slate-500">No prescriptions for this visit.</p>}

      {record.prescriptions.map((p) => (
        <div key={p.id} className="rounded-lg border border-slate-200 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-slate-700">
              Prescription #{p.id} &middot; {formatDateTime(p.prescribedAt)} &middot;{' '}
              <span className={p.status === 'Cancelled' ? 'text-slate-500' : 'font-medium text-slate-900'}>
                {prescriptionStatusLabels[p.status]}
              </span>
            </span>
            {record.canEdit && p.status === 'Pending' && (
              <button type="button" onClick={() => void cancel(p.id)} className="text-sm text-red-700 hover:underline">
                Cancel prescription #{p.id}
              </button>
            )}
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th scope="col" className="py-1 pr-3 font-medium">Medicine</th>
                  <th scope="col" className="py-1 pr-3 font-medium">Dose</th>
                  <th scope="col" className="py-1 pr-3 font-medium">How often</th>
                  <th scope="col" className="py-1 pr-3 font-medium">Days</th>
                  <th scope="col" className="py-1 pr-3 font-medium">Qty</th>
                  <th scope="col" className="py-1 font-medium">Instructions</th>
                </tr>
              </thead>
              <tbody className={p.status === 'Cancelled' ? 'text-slate-400 line-through' : 'text-slate-800'}>
                {p.items.map((i) => (
                  <tr key={i.id}>
                    <td className="py-1 pr-3">
                      {i.medicineName} {i.strength} {i.form.toLowerCase()}
                    </td>
                    <td className="py-1 pr-3">{i.dosage}</td>
                    <td className="py-1 pr-3">{i.frequency}</td>
                    <td className="py-1 pr-3">{i.durationDays}</td>
                    <td className="py-1 pr-3">
                      {i.quantity}
                      {i.quantityDispensed > 0 && i.quantityDispensed < i.quantity && (
                        <span className="block text-xs text-slate-500">{i.quantityDispensed} given</span>
                      )}
                    </td>
                    <td className="py-1">{i.instructions ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {adding && (
        <PrescriptionForm
          recordId={record.id}
          allergies={record.allergies}
          onDone={(saved) => {
            setAdding(false)
            if (saved) onChanged()
          }}
        />
      )}
    </section>
  )
}

const emptyLine = (): PrescriptionLine => ({
  medicineId: '',
  dosage: '1 tablet',
  frequency: '',
  durationDays: '',
  quantity: '',
  instructions: '',
})

function PrescriptionForm({
  recordId,
  allergies,
  onDone,
}: {
  recordId: number
  allergies: string | null
  onDone: (saved: boolean) => void
}) {
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [lines, setLines] = useState<PrescriptionLine[]>([emptyLine()])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    searchMedicines().then(setMedicines).catch(() => setError('Could not load the medicine list.'))
  }, [])

  function update(index: number, change: Partial<PrescriptionLine>) {
    setLines((list) => list.map((l, i) => (i === index ? { ...l, ...change } : l)))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await addPrescription(recordId, lines)
      onDone(true)
    } catch (err) {
      if (err instanceof ApiError) {
        // Show every message, e.g. "Items[0].Frequency: The Frequency field is required."
        const messages = Object.entries(err.fieldErrors).flatMap(([field, list]) =>
          list.map((m) => (field.startsWith('Items[') ? `Line ${Number(field.match(/\d+/)?.[0]) + 1}: ${m}` : m)),
        )
        setError(messages.join(' ') || err.message)
      } else {
        setError('Could not save the prescription.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3 rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
      <h3 className="font-medium text-slate-900">New prescription</h3>
      {allergies && <p className="text-sm font-medium text-red-800">Check allergies: {allergies}</p>}
      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {lines.map((line, i) => (
        <fieldset key={i} className="grid gap-2 rounded-md bg-white p-3 ring-1 ring-slate-200 sm:grid-cols-6">
          <legend className="sr-only">Medicine {i + 1}</legend>
          <div className="sm:col-span-2">
            <label htmlFor={`rx-med-${i}`} className="block text-xs font-medium text-slate-600">
              Medicine
            </label>
            <select
              id={`rx-med-${i}`}
              value={line.medicineId}
              onChange={(e) => update(i, { medicineId: e.target.value })}
              className={inputClass}
            >
              <option value="">Choose...</option>
              {medicines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.strength} ({m.form})
                </option>
              ))}
            </select>
          </div>
          <SmallInput id={`rx-dose-${i}`} label="Dose" value={line.dosage} onChange={(v) => update(i, { dosage: v })} />
          <SmallInput
            id={`rx-freq-${i}`}
            label="How often"
            placeholder="3 times a day"
            value={line.frequency}
            onChange={(v) => update(i, { frequency: v })}
          />
          <SmallInput
            id={`rx-days-${i}`}
            label="Days"
            type="number"
            value={line.durationDays}
            onChange={(v) => update(i, { durationDays: v })}
          />
          <SmallInput
            id={`rx-qty-${i}`}
            label="Quantity"
            type="number"
            value={line.quantity}
            onChange={(v) => update(i, { quantity: v })}
          />
          <div className="sm:col-span-5">
            <SmallInput
              id={`rx-note-${i}`}
              label="Instructions"
              placeholder="After meals"
              value={line.instructions}
              onChange={(v) => update(i, { instructions: v })}
            />
          </div>
          <div className="flex items-end">
            {lines.length > 1 && (
              <button
                type="button"
                onClick={() => setLines((list) => list.filter((_, j) => j !== i))}
                className="pb-2 text-sm text-red-700 hover:underline"
              >
                Remove<span className="sr-only"> medicine {i + 1}</span>
              </button>
            )}
          </div>
        </fieldset>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setLines((list) => [...list, emptyLine()])} className={secondaryButtonClass}>
          + Add medicine
        </button>
        <button type="submit" disabled={saving} className={primaryButtonClass}>
          {saving ? 'Saving...' : 'Save prescription'}
        </button>
        <button type="button" onClick={() => onDone(false)} className={secondaryButtonClass}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function SmallInput({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-600">
        {label}
      </label>
      <input
        id={id}
        type={type}
        min={type === 'number' ? 1 : undefined}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </div>
  )
}
