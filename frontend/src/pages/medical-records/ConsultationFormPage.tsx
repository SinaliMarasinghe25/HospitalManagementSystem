import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { getAppointment } from '../../api/appointments'
import { ApiError } from '../../api/client'
import { createMedicalRecord, getMedicalRecord, updateMedicalRecord } from '../../api/medicalRecords'
import { FormField, inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import type { DiagnosisItem, TreatmentItem } from '../../types/medicalRecord'
import { errorsByField } from '../../utils/formErrors'
import { formatDateTime } from '../../utils/format'

type Header = { patientName: string; patientNumber: string; visit: string; allergies?: string | null }

const emptyDiagnosis = (): DiagnosisItem => ({ code: '', description: '', isPrimary: false })
const emptyTreatment = (): TreatmentItem => ({ description: '', performedAt: null })

// The doctor's consultation screen (FR-EMR-01, FR-EMR-03). One page for both:
//   /appointments/:appointmentId/consultation   write the visit's medical record
//   /medical-records/:id/edit                    change it later
export default function ConsultationFormPage() {
  const { appointmentId, id } = useParams()
  const recordId = id ? Number(id) : null
  const navigate = useNavigate()

  const [header, setHeader] = useState<Header | null>(null)
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [clinicalNotes, setClinicalNotes] = useState('')
  const [diagnoses, setDiagnoses] = useState<DiagnosisItem[]>([emptyDiagnosis()])
  const [treatments, setTreatments] = useState<TreatmentItem[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (recordId) {
      getMedicalRecord(recordId)
        .then((r) => {
          setHeader({ patientName: r.patientName, patientNumber: r.patientNumber, visit: formatDateTime(r.visitDate), allergies: r.allergies })
          setChiefComplaint(r.chiefComplaint ?? '')
          setClinicalNotes(r.clinicalNotes ?? '')
          setDiagnoses(r.diagnoses.length ? r.diagnoses.map((d) => ({ ...d, code: d.code ?? '' })) : [emptyDiagnosis()])
          setTreatments(r.treatments)
        })
        .catch(() => setFormError('Could not load the medical record.'))
    } else if (appointmentId) {
      getAppointment(Number(appointmentId))
        .then((a) => {
          // This visit already has a record: open it for editing instead of making a second one.
          if (a.medicalRecordId) {
            navigate(`/medical-records/${a.medicalRecordId}/edit`, { replace: true })
            return
          }
          setHeader({ patientName: a.patientName, patientNumber: a.patientNumber, visit: formatDateTime(a.startTime) })
          setChiefComplaint(a.reason ?? '')
        })
        .catch(() => setFormError('Could not load the appointment.'))
    }
  }, [recordId, appointmentId, navigate])

  function updateDiagnosis(index: number, change: Partial<DiagnosisItem>) {
    setDiagnoses((list) =>
      list.map((d, i) => {
        if (i === index) return { ...d, ...change }
        // Only one diagnosis can be the main one.
        return change.isPrimary ? { ...d, isPrimary: false } : d
      }),
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    setFormError(null)
    const request = {
      appointmentId: appointmentId ? Number(appointmentId) : undefined,
      chiefComplaint,
      clinicalNotes,
      // Rows left empty are ignored.
      diagnoses: diagnoses.filter((d) => d.description.trim() !== ''),
      treatments: treatments.filter((t) => t.description.trim() !== ''),
    }
    try {
      const saved = recordId ? await updateMedicalRecord(recordId, request) : await createMedicalRecord(request)
      navigate(`/medical-records/${saved.id}`)
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(errorsByField(err.fieldErrors))
        setFormError(Object.values(err.fieldErrors)[0]?.[0] ?? err.message)
      } else {
        setFormError('Could not save the medical record.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">{recordId ? 'Edit medical record' : 'Consultation'}</h1>

      {header && (
        <div className="rounded-md bg-blue-50 p-3 text-sm text-slate-800 ring-1 ring-blue-100">
          <strong>{header.patientName}</strong> ({header.patientNumber}) &middot; Visit {header.visit}
          {header.allergies && <p className="mt-1 font-medium text-red-800">Allergies: {header.allergies}</p>}
        </div>
      )}

      {formError && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {formError}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <FormField id="chiefComplaint" label="Chief complaint" error={errors.chiefComplaint}>
          <input
            id="chiefComplaint"
            maxLength={500}
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            className={inputClass}
          />
        </FormField>

        <FormField id="clinicalNotes" label="Examination and notes" error={errors.clinicalNotes}>
          <textarea
            id="clinicalNotes"
            rows={5}
            maxLength={10000}
            value={clinicalNotes}
            onChange={(e) => setClinicalNotes(e.target.value)}
            className={inputClass}
          />
        </FormField>

        {/* Diagnoses (FR-EMR-01) */}
        <fieldset className="space-y-2">
          <legend className="text-base font-medium text-slate-900">Diagnoses</legend>
          {errors.diagnoses && <p className="text-sm text-red-700">{errors.diagnoses}</p>}
          {diagnoses.map((d, i) => (
            <div key={i} className="grid items-end gap-2 sm:grid-cols-[8rem_1fr_auto_auto]">
              <div>
                <label htmlFor={`dx-code-${i}`} className="block text-xs font-medium text-slate-600">
                  ICD-10 code
                </label>
                <input
                  id={`dx-code-${i}`}
                  maxLength={10}
                  placeholder="J06.9"
                  value={d.code ?? ''}
                  onChange={(e) => updateDiagnosis(i, { code: e.target.value })}
                  aria-invalid={!!errors[`diagnoses[${i}].Code`]}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor={`dx-desc-${i}`} className="block text-xs font-medium text-slate-600">
                  Diagnosis
                </label>
                <input
                  id={`dx-desc-${i}`}
                  maxLength={500}
                  value={d.description}
                  onChange={(e) => updateDiagnosis(i, { description: e.target.value })}
                  className={inputClass}
                />
              </div>
              <label className="flex items-center gap-1 pb-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="primary-diagnosis"
                  checked={d.isPrimary}
                  onChange={() => updateDiagnosis(i, { isPrimary: true })}
                />
                Main
              </label>
              <button
                type="button"
                onClick={() => setDiagnoses((list) => list.filter((_, j) => j !== i))}
                className="pb-2 text-sm text-red-700 hover:underline"
              >
                Remove<span className="sr-only"> diagnosis {i + 1}</span>
              </button>
              {errors[`diagnoses[${i}].Code`] && (
                <p className="text-sm text-red-700 sm:col-span-4">{errors[`diagnoses[${i}].Code`]}</p>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setDiagnoses((list) => [...list, emptyDiagnosis()])} className={secondaryButtonClass}>
            + Add diagnosis
          </button>
        </fieldset>

        {/* Treatments (FR-EMR-03) */}
        <fieldset className="space-y-2">
          <legend className="text-base font-medium text-slate-900">Treatments and procedures</legend>
          {treatments.map((t, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <label htmlFor={`tx-${i}`} className="block text-xs font-medium text-slate-600">
                  Treatment {i + 1}
                </label>
                <input
                  id={`tx-${i}`}
                  maxLength={1000}
                  value={t.description}
                  onChange={(e) =>
                    setTreatments((list) => list.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))
                  }
                  className={inputClass}
                />
              </div>
              <button
                type="button"
                onClick={() => setTreatments((list) => list.filter((_, j) => j !== i))}
                className="pb-2 text-sm text-red-700 hover:underline"
              >
                Remove<span className="sr-only"> treatment {i + 1}</span>
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setTreatments((list) => [...list, emptyTreatment()])} className={secondaryButtonClass}>
            + Add treatment
          </button>
        </fieldset>

        <p className="text-sm text-slate-500">Prescriptions are added on the record page after saving.</p>

        <div className="flex gap-2">
          <button type="submit" disabled={saving || !header} className={primaryButtonClass}>
            {saving ? 'Saving...' : 'Save medical record'}
          </button>
          <Link
            to={recordId ? `/medical-records/${recordId}` : appointmentId ? `/appointments/${appointmentId}` : '/medical-records'}
            className={secondaryButtonClass}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
