import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { cancelLabRequest, collectSample, enterResult, getLabRequest } from '../../api/lab'
import { Permissions } from '../../auth/permissions'
import { hasAnyRole } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { LabStatusBadge, ResultText } from '../../components/lab/LabStatusBadge'
import { inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import type { LabRequest } from '../../types/lab'
import { ageFrom, formatDateTime } from '../../utils/format'
import { firstError } from '../../utils/formErrors'

// One lab request: collect the sample (FR-LAB-02), enter the result (FR-LAB-03), print the report (FR-LAB-04).
export default function LabRequestPage() {
  const { id } = useParams()
  const requestId = Number(id)
  const { user } = useAuth()
  const isLab = hasAnyRole(user?.roles, Permissions.processLabRequests)
  const isDoctor = hasAnyRole(user?.roles, Permissions.requestLabTests)

  const [lab, setLab] = useState<LabRequest | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getLabRequest(requestId)
      .then(setLab)
      .catch((err: unknown) =>
        setError(err instanceof ApiError && err.status === 404 ? 'Lab request not found.' : 'Could not load the lab request.'),
      )
  }, [requestId])

  async function act(action: () => Promise<LabRequest>) {
    setError(null)
    try {
      setLab(await action())
    } catch (err) {
      setError(firstError(err, 'Could not save.'))
    }
  }

  if (!lab) {
    return error ? (
      <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
        {error}
      </p>
    ) : (
      <p className="text-slate-500">Loading...</p>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/laboratory" className="text-sm text-blue-700 hover:underline">
            &larr; Laboratory
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            {lab.testName} <span className="font-mono text-base text-slate-500">{lab.requestNumber}</span>
          </h1>
        </div>
        <LabStatusBadge status={lab.status} />
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Item label="Patient">
            {lab.patientName}{' '}
            <span className="text-slate-500">
              ({lab.patientNumber}, {lab.gender}, age {ageFrom(lab.dateOfBirth)})
            </span>
          </Item>
          <Item label="Requested by">
            Dr {lab.doctorName}, {formatDateTime(lab.requestedAt)}
          </Item>
          <Item label="Test">
            {lab.testName} <span className="font-mono text-slate-500">({lab.testCode})</span>
          </Item>
          <Item label="Reference range">
            {lab.referenceRange ?? '-'}
            {lab.unit && lab.referenceRange && ` ${lab.unit}`}
          </Item>
          <Item label="Sample">
            {lab.sampleId ? (
              <>
                <span className="font-mono">{lab.sampleId}</span>, {formatDateTime(lab.sampleCollectedAt!)} by {lab.collectedBy}
              </>
            ) : (
              '-'
            )}
          </Item>
          <Item label="Result">
            <ResultText value={lab.resultValue} unit={lab.unit} isAbnormal={lab.isAbnormal} />
            {lab.resultEnteredAt && (
              <span className="block text-xs text-slate-500">
                Entered {formatDateTime(lab.resultEnteredAt)} by {lab.resultEnteredBy}
              </span>
            )}
          </Item>
          {lab.resultNotes && <Item label="Notes">{lab.resultNotes}</Item>}
          {lab.medicalRecordId && hasAnyRole(user?.roles, Permissions.viewMedicalHistory) && (
            <Item label="Visit">
              <Link to={`/medical-records/${lab.medicalRecordId}`} className="text-blue-700 hover:underline">
                Medical record #{lab.medicalRecordId}
              </Link>
            </Item>
          )}
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          {lab.status === 'Completed' && (
            <Link to={`/laboratory/requests/${lab.id}/report`} target="_blank" className={secondaryButtonClass}>
              Print lab report
            </Link>
          )}
          {isDoctor && lab.status === 'Requested' && (
            <button type="button" onClick={() => void act(() => cancelLabRequest(lab.id))} className={secondaryButtonClass}>
              Cancel request
            </button>
          )}
        </div>
      </section>

      {isLab && lab.status === 'Requested' && <SampleForm onSave={(sampleId) => act(() => collectSample(lab.id, sampleId))} />}
      {isLab && (lab.status === 'SampleCollected' || lab.status === 'Completed') && (
        <ResultForm lab={lab} onSave={(body) => act(() => enterResult(lab.id, body))} />
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

function SampleForm({ onSave }: { onSave: (sampleId: string) => Promise<void> }) {
  const [sampleId, setSampleId] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void onSave(sampleId)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="font-semibold text-slate-900">Record sample collection</h2>
      <div className="max-w-xs">
        <label htmlFor="sampleId" className="block text-sm font-medium text-slate-700">
          Sample ID (tube label)<span className="text-red-600"> *</span>
        </label>
        <input
          id="sampleId"
          required
          maxLength={30}
          placeholder="S-1001"
          value={sampleId}
          onChange={(e) => setSampleId(e.target.value)}
          className={`${inputClass} mt-1 font-mono`}
        />
      </div>
      <p className="text-sm text-slate-600">The collection time and your username are recorded automatically.</p>
      <button type="submit" className={primaryButtonClass}>
        Sample collected
      </button>
    </form>
  )
}

function ResultForm({
  lab,
  onSave,
}: {
  lab: LabRequest
  onSave: (body: { resultValue: string; resultNotes: string; isAbnormal: boolean }) => Promise<void>
}) {
  const isCorrection = lab.status === 'Completed'
  const [resultValue, setResultValue] = useState(lab.resultValue ?? '')
  const [resultNotes, setResultNotes] = useState(lab.resultNotes ?? '')
  const [isAbnormal, setIsAbnormal] = useState(lab.isAbnormal ?? false)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void onSave({ resultValue, resultNotes, isAbnormal })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="font-semibold text-slate-900">{isCorrection ? 'Correct the result' : 'Enter result'}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="resultValue" className="block text-sm font-medium text-slate-700">
            Result{lab.unit && ` (${lab.unit})`}
            <span className="text-red-600"> *</span>
          </label>
          <input
            id="resultValue"
            required
            maxLength={200}
            value={resultValue}
            onChange={(e) => setResultValue(e.target.value)}
            className={`${inputClass} mt-1`}
          />
          {lab.referenceRange && <p className="mt-1 text-xs text-slate-500">Reference range: {lab.referenceRange}</p>}
        </div>
        <label className="flex items-center gap-2 self-center text-sm text-slate-700">
          <input type="checkbox" checked={isAbnormal} onChange={(e) => setIsAbnormal(e.target.checked)} />
          Outside the reference range (abnormal)
        </label>
      </div>
      <div>
        <label htmlFor="resultNotes" className="block text-sm font-medium text-slate-700">
          Notes
        </label>
        <textarea
          id="resultNotes"
          rows={2}
          maxLength={2000}
          value={resultNotes}
          onChange={(e) => setResultNotes(e.target.value)}
          className={`${inputClass} mt-1`}
        />
      </div>
      {isCorrection && <p className="text-sm text-slate-600">A correction replaces the result; the audit log keeps who changed it and when.</p>}
      <button type="submit" className={primaryButtonClass}>
        {isCorrection ? 'Save correction' : 'Save result'}
      </button>
    </form>
  )
}
