import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { admitPatient, listWards } from '../../api/admissions'
import { ApiError } from '../../api/client'
import { getPatient } from '../../api/patients'
import { DoctorPicker } from '../../components/appointments/DoctorPicker'
import { PatientSearch, type ChosenPatient } from '../../components/patients/PatientSearch'
import { FormField, inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/FormField'
import type { Ward } from '../../types/admission'
import { errorsByField } from '../../utils/formErrors'
import { formatMoney } from '../../utils/format'

// Admit a patient: choose the patient, a free bed, the admitting doctor and the reason.
// Opened from the menu, from a free bed on the bed board (?bedId=) or from a patient page (?patientId=).
export default function AdmitPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const [patient, setPatient] = useState<ChosenPatient | null>(null)
  const [wards, setWards] = useState<Ward[]>([])
  const [bedId, setBedId] = useState(params.get('bedId') ?? '')
  const [doctorId, setDoctorId] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    listWards().then(setWards).catch(() => setFormError('Could not load the wards.'))
    const patientId = params.get('patientId')
    if (patientId) {
      getPatient(Number(patientId))
        .then((p) => setPatient({ id: p.id, name: `${p.firstName} ${p.lastName}`, patientNumber: p.patientNumber }))
        .catch(() => setFormError('Could not load the patient.'))
    }
  }, [params])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const missing: Record<string, string> = {}
    if (!patient) missing.patientId = 'Choose a patient.'
    if (!bedId) missing.bedId = 'Choose a free bed.'
    if (!doctorId) missing.admittingDoctorId = 'Choose the admitting doctor.'
    if (!reason.trim()) missing.admissionReason = 'Enter the reason for admission.'
    setErrors(missing)
    setFormError(null)
    if (Object.keys(missing).length > 0 || !patient) return

    setSaving(true)
    try {
      const saved = await admitPatient({
        patientId: patient.id,
        bedId: Number(bedId),
        admittingDoctorId: Number(doctorId),
        admissionReason: reason.trim(),
      })
      navigate(`/admissions/${saved.id}`)
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(errorsByField(err.fieldErrors))
        setFormError(Object.values(err.fieldErrors)[0]?.[0] ?? err.message)
        listWards().then(setWards).catch(() => undefined) // the bed may have just been taken
      } else {
        setFormError('Could not admit the patient.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Admit patient</h1>

      {formError && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {formError}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <fieldset className="space-y-2">
          <legend className="text-base font-medium text-slate-900">1. Patient</legend>
          {patient ? (
            <div className="flex items-center justify-between rounded-md bg-blue-50 px-3 py-2 text-sm">
              <span>
                <strong>{patient.name}</strong> ({patient.patientNumber})
              </span>
              <button type="button" className="text-blue-700 hover:underline" onClick={() => setPatient(null)}>
                Change
              </button>
            </div>
          ) : (
            <PatientSearch onChoose={setPatient} error={errors.patientId} />
          )}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-base font-medium text-slate-900">2. Ward and bed</legend>
          <FormField id="bedId" label="Free bed" required error={errors.bedId}>
            <select
              id="bedId"
              value={bedId}
              onChange={(e) => setBedId(e.target.value)}
              aria-invalid={!!errors.bedId}
              className={inputClass}
            >
              <option value="">Choose a free bed</option>
              {/* Only free beds that are in use can be chosen, grouped by ward. */}
              {wards.map((w) => (
                <optgroup key={w.id} label={`${w.name} (${formatMoney(w.dailyCharge)} per day)`}>
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
          </FormField>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-base font-medium text-slate-900">3. Admitting doctor</legend>
          <DoctorPicker idPrefix="admit" doctorId={doctorId} onChange={setDoctorId} error={errors.admittingDoctorId} />
        </fieldset>

        <FormField id="admissionReason" label="Reason for admission" required error={errors.admissionReason}>
          <textarea
            id="admissionReason"
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={!!errors.admissionReason}
            className={inputClass}
          />
        </FormField>

        <div className="flex gap-2">
          <button type="submit" disabled={saving} className={primaryButtonClass}>
            {saving ? 'Saving...' : 'Admit patient'}
          </button>
          <Link to="/admissions" className={secondaryButtonClass}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
