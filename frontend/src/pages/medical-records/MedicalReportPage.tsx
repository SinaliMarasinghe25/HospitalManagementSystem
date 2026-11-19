import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router'
import { getMedicalRecord } from '../../api/medicalRecords'
import type { MedicalRecord } from '../../types/medicalRecord'
import { ageFrom, formatDate, formatDateTime } from '../../utils/format'

// FR-EMR-04 Medical report: a clean A4 page without the menu, printed with the browser's
// Print dialog (which can also "Save as PDF"). No PDF library is needed for this.
export default function MedicalReportPage() {
  const { id } = useParams()
  const [record, setRecord] = useState<MedicalRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [printedAt] = useState(() => new Date().toISOString())

  useEffect(() => {
    getMedicalRecord(Number(id)).then(setRecord).catch(() => setError('Could not load the medical record.'))
  }, [id])

  if (error) return <p className="p-8 text-red-700">{error}</p>
  if (!record) return <p className="p-8 text-slate-500">Loading...</p>

  const activePrescriptions = record.prescriptions.filter((p) => p.status !== 'Cancelled')

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end gap-2 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          Print / Save as PDF
        </button>
      </div>

      <article className="mx-auto max-w-[210mm] bg-white p-[15mm] text-sm text-black shadow print:max-w-none print:p-0 print:shadow-none">
        <header className="border-b-2 border-slate-800 pb-3">
          <h1 className="text-xl font-bold">Hospital Management System</h1>
          <p className="text-xs text-slate-600">Medical report &middot; Demonstration system with fictitious data</p>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1">
          <Row label="Patient">{record.patientName}</Row>
          <Row label="Patient no.">{record.patientNumber}</Row>
          <Row label="Date of birth">
            {formatDate(record.dateOfBirth)} (age {ageFrom(record.dateOfBirth)})
          </Row>
          <Row label="Gender">{record.gender}</Row>
          <Row label="Blood group">{record.bloodGroup ?? '-'}</Row>
          <Row label="Allergies">{record.allergies ?? 'None recorded'}</Row>
          <Row label="Visit date">{formatDateTime(record.visitDate)}</Row>
          <Row label="Report no.">MR-{String(record.id).padStart(6, '0')}</Row>
        </section>

        <Section title="Chief complaint">{record.chiefComplaint ?? '-'}</Section>
        <Section title="Examination and notes">
          <p className="whitespace-pre-line">{record.clinicalNotes ?? '-'}</p>
        </Section>
        <Section title="Diagnosis">
          {record.diagnoses.length === 0 ? '-' : (
            <ol className="list-decimal pl-5">
              {record.diagnoses.map((d, i) => (
                <li key={i}>
                  {d.description}
                  {d.code && ` (ICD-10 ${d.code})`}
                  {d.isPrimary && ' - main diagnosis'}
                </li>
              ))}
            </ol>
          )}
        </Section>
        <Section title="Treatment">
          {record.treatments.length === 0 ? '-' : (
            <ul className="list-disc pl-5">
              {record.treatments.map((t, i) => (
                <li key={i}>{t.description}</li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Medicines prescribed">
          {activePrescriptions.length === 0 ? '-' : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-400">
                  <th className="py-1 pr-2">Medicine</th>
                  <th className="py-1 pr-2">Dose</th>
                  <th className="py-1 pr-2">How often</th>
                  <th className="py-1 pr-2">Days</th>
                  <th className="py-1">Instructions</th>
                </tr>
              </thead>
              <tbody>
                {activePrescriptions.flatMap((p) =>
                  p.items.map((i) => (
                    <tr key={i.id} className="border-b border-slate-200">
                      <td className="py-1 pr-2">
                        {i.medicineName} {i.strength}
                      </td>
                      <td className="py-1 pr-2">{i.dosage}</td>
                      <td className="py-1 pr-2">{i.frequency}</td>
                      <td className="py-1 pr-2">{i.durationDays}</td>
                      <td className="py-1">{i.instructions ?? '-'}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          )}
        </Section>

        <footer className="mt-12 flex items-end justify-between">
          <p className="text-xs text-slate-600">Printed {formatDateTime(printedAt)}</p>
          <div className="text-center">
            <div className="mb-1 w-56 border-b border-slate-800" />
            <p>Dr {record.doctorName}</p>
            <p className="text-xs text-slate-600">
              {record.departmentName} &middot; Reg. no. {record.licenseNumber}
            </p>
          </div>
        </footer>
      </article>
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p>
      <span className="font-semibold">{label}: </span>
      {children}
    </p>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4 break-inside-avoid">
      <h2 className="mb-1 border-b border-slate-300 font-semibold uppercase tracking-wide text-slate-700">{title}</h2>
      <div>{children}</div>
    </section>
  )
}
