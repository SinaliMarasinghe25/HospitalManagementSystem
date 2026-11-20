import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { documentDownloadUrl, getMedicalHistory, getPatient, listDocuments, uploadDocument } from '../../api/patients'
import { Permissions } from '../../auth/permissions'
import { PatientAppointments } from '../../components/appointments/PatientAppointments'
import { hasAnyRole, type Role } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { FormField, inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import type { MedicalHistory, PatientDetail, PatientDocument } from '../../types/patient'
import { ageFrom, formatDate, formatDateTime, formatFileSize } from '../../utils/format'
import { firstError } from '../../utils/formErrors'

// Section 7 Patient Screen: details, "View History" and documents for one patient.
export default function PatientDetailPage() {
  const { id } = useParams()
  const patientId = Number(id)
  const { user } = useAuth()
  const can = (allowed: readonly Role[]) => hasAnyRole(user?.roles, allowed)

  const [patient, setPatient] = useState<PatientDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPatient(patientId)
      .then(setPatient)
      .catch((err: unknown) => setError(err instanceof ApiError && err.status === 404 ? 'Patient not found.' : 'Could not load patient.'))
  }, [patientId])

  if (error) return <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>
  if (!patient) return <p role="status">Loading...</p>

  const details: [string, string | null][] = [
    ['Date of birth', `${formatDate(patient.dateOfBirth)} (${ageFrom(patient.dateOfBirth)} years)`],
    ['Gender', patient.gender],
    ['NIC', patient.nationalId],
    ['Phone', patient.phone],
    ['Email', patient.email],
    ['Address', patient.address],
    ['Blood group', patient.bloodGroup],
    ['Allergies', patient.allergies],
    ['Emergency contact', [patient.emergencyContactName, patient.emergencyContactPhone].filter(Boolean).join(', ') || null],
    ['Registered', formatDateTime(patient.createdAt)],
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/patients" className="text-sm text-blue-700 hover:underline">
            &larr; All patients
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            {patient.firstName} {patient.lastName}
          </h1>
          <p className="font-mono text-sm text-slate-600">{patient.patientNumber}</p>
        </div>
        <div className="flex gap-2">
          {can(Permissions.admitPatients) && (
            <Link to={`/admissions/new?patientId=${patient.id}`} className={secondaryButtonClass}>
              Admit
            </Link>
          )}
          {can(Permissions.bookAppointments) && (
            <Link to={`/appointments/new?patientId=${patient.id}`} className={primaryButtonClass}>
              Book appointment
            </Link>
          )}
          {can(Permissions.editPatients) && (
            <Link to={`/patients/${patient.id}/edit`} className={secondaryButtonClass}>
              Edit patient
            </Link>
          )}
        </div>
      </div>

      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200" aria-labelledby="details-heading">
        <h2 id="details-heading" className="font-semibold text-slate-900">Details</h2>
        <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {details.map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-slate-500">{label}</dt>
              <dd className="text-slate-900">{value ?? '-'}</dd>
            </div>
          ))}
        </dl>
      </section>

      {can(Permissions.viewAppointments) && <PatientAppointments patientId={patient.id} />}
      {can(Permissions.viewMedicalHistory) && <HistorySection patientId={patient.id} />}
      {can(Permissions.viewPatientDocuments) && (
        <DocumentsSection patientId={patient.id} canUpload={can(Permissions.uploadPatientDocuments)} />
      )}
    </div>
  )
}

function HistorySection({ patientId }: { patientId: number }) {
  const [history, setHistory] = useState<MedicalHistory | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getMedicalHistory(patientId).then(setHistory).catch(() => setError('Could not load medical history.'))
  }, [patientId])

  const isEmpty = history && !history.visits.length && !history.labResults.length && !history.admissions.length

  return (
    <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200" aria-labelledby="history-heading">
      <h2 id="history-heading" className="font-semibold text-slate-900">Medical history</h2>
      {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
      {!history && !error && <p className="mt-2 text-sm text-slate-500" role="status">Loading...</p>}
      {isEmpty && <p className="mt-2 text-sm text-slate-500">No visits, lab results or admissions yet.</p>}

      {history && history.visits.length > 0 && (
        <ul className="mt-3 space-y-3">
          {history.visits.map((v) => (
            <li key={v.id} className="rounded-lg border border-slate-200 p-3">
              <p className="font-medium text-slate-900">
                <Link to={`/medical-records/${v.id}`} className="text-blue-700 hover:underline">
                  {formatDateTime(v.visitDate)}
                </Link>{' '}
                &middot; Dr {v.doctorName}
              </p>
              {v.chiefComplaint && <p className="text-sm text-slate-700">Complaint: {v.chiefComplaint}</p>}
              {v.diagnoses.length > 0 && <p className="text-sm text-slate-700">Diagnosis: {v.diagnoses.join('; ')}</p>}
              {v.treatments.length > 0 && <p className="text-sm text-slate-700">Treatment: {v.treatments.join('; ')}</p>}
              {v.prescriptions.length > 0 && <p className="text-sm text-slate-700">Prescribed: {v.prescriptions.join('; ')}</p>}
            </li>
          ))}
        </ul>
      )}

      {history && history.labResults.length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-semibold text-slate-900">Laboratory results</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {history.labResults.map((l) => (
              <li key={l.id}>
                <Link to={`/laboratory/requests/${l.id}`} className="text-blue-700 hover:underline">
                  {formatDateTime(l.requestedAt)}
                </Link>
                : {l.testName} - {l.resultValue ?? l.status}
                {l.unit && ` ${l.unit}`}
                {l.referenceRange && ` (normal ${l.referenceRange})`}
                {l.isAbnormal && <span className="ml-1 font-medium text-red-700">abnormal</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      {history && history.admissions.length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-semibold text-slate-900">Admissions</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {history.admissions.map((a) => (
              <li key={a.id}>
                <Link to={`/admissions/${a.id}`} className="text-blue-700 hover:underline">
                  {a.admissionNumber}
                </Link>
                : {a.ward}, bed {a.bed}, {formatDateTime(a.admittedAt)}
                {a.dischargedAt ? ` to ${formatDateTime(a.dischargedAt)}` : ' (currently admitted)'}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function DocumentsSection({ patientId, canUpload }: { patientId: number; canUpload: boolean }) {
  const [documents, setDocuments] = useState<PatientDocument[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [inputKey, setInputKey] = useState(0) // changing the key clears the file input

  const load = useCallback(() => {
    listDocuments(patientId).then(setDocuments).catch(() => setError('Could not load documents.'))
  }, [patientId])

  useEffect(load, [load])

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) return
    setIsUploading(true)
    setError(null)
    try {
      await uploadDocument(patientId, file, description)
      setFile(null)
      setDescription('')
      setInputKey((k) => k + 1)
      load()
    } catch (err) {
      const message =
        firstError(err, 'Upload failed.')
      setError(message)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200" aria-labelledby="documents-heading">
      <h2 id="documents-heading" className="font-semibold text-slate-900">Documents</h2>
      {error && <p className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}

      {documents.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No documents uploaded.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {documents.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <div>
                <a href={documentDownloadUrl(patientId, d.id)} className="font-medium text-blue-700 hover:underline">
                  {d.fileName}
                </a>
                {d.description && <span className="text-slate-600"> - {d.description}</span>}
              </div>
              <span className="text-slate-500">
                {formatFileSize(d.sizeBytes)} &middot; {formatDateTime(d.uploadedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canUpload && (
        <form onSubmit={handleUpload} className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <FormField id="document-file" label="File (PDF, JPG or PNG, max 5 MB)" required>
            <input
              key={inputKey}
              id="document-file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2"
            />
          </FormField>
          <FormField id="document-description" label="Description">
            <input
              id="document-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              className={inputClass}
            />
          </FormField>
          <button type="submit" className={primaryButtonClass} disabled={!file || isUploading}>
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
        </form>
      )}
    </section>
  )
}
