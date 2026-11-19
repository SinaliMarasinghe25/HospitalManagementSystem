import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router'
import { getAdmission } from '../../api/admissions'
import type { AdmissionDetail } from '../../types/admission'
import { ageFrom, formatDate, formatDateTime } from '../../utils/format'

// FR-EMR-04 "a printable medical report for a visit or admission": the discharge summary.
// Same idea as the visit report: a clean page printed with the browser's Print dialog.
export default function DischargeSummaryPage() {
  const { id } = useParams()
  const [admission, setAdmission] = useState<AdmissionDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [printedAt] = useState(() => new Date().toISOString())

  useEffect(() => {
    getAdmission(Number(id)).then(setAdmission).catch(() => setError('Could not load the admission.'))
  }, [id])

  if (error) return <p className="p-8 text-red-700">{error}</p>
  if (!admission) return <p className="p-8 text-slate-500">Loading...</p>
  if (!admission.dischargeSummary) return <p className="p-8 text-slate-600">This patient has not been discharged yet.</p>

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end print:hidden">
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
          <p className="text-xs text-slate-600">Discharge summary &middot; Demonstration system with fictitious data</p>
        </header>
        <section className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1">
          <Row label="Patient">{admission.patientName}</Row>
          <Row label="Patient no.">{admission.patientNumber}</Row>
          <Row label="Date of birth">
            {formatDate(admission.dateOfBirth)} (age {ageFrom(admission.dateOfBirth)})
          </Row>
          <Row label="Gender">{admission.gender}</Row>
          <Row label="Admission no.">{admission.admissionNumber}</Row>
          <Row label="Ward and bed">
            {admission.wardName}, {admission.bedNumber}
          </Row>
          <Row label="Admitted">{formatDateTime(admission.admittedAt)}</Row>
          <Row label="Discharged">{admission.dischargedAt && formatDateTime(admission.dischargedAt)}</Row>
          <Row label="Allergies">{admission.allergies ?? 'None recorded'}</Row>
        </section>
        <Section title="Reason for admission">{admission.admissionReason ?? '-'}</Section>
        {admission.transfers.length > 0 && (
          <Section title="Bed transfers">
            <ul className="list-disc pl-5">
              {admission.transfers.map((t, i) => (
                <li key={i}>
                  {formatDateTime(t.transferredAt)}: {t.fromWard} {t.fromBed} to {t.toWard} {t.toBed}
                  {t.reason && ` (${t.reason})`}
                </li>
              ))}
            </ul>
          </Section>
        )}
        <Section title="Discharge summary">
          <p className="whitespace-pre-line">{admission.dischargeSummary}</p>
        </Section>
        <footer className="mt-12 flex items-end justify-between">
          <p className="text-xs text-slate-600">Printed {formatDateTime(printedAt)}</p>
          <div className="text-center">
            <div className="mb-1 w-56 border-b border-slate-800" />
            <p>Dr {admission.doctorName}</p>
            <p className="text-xs text-slate-600">Admitting doctor</p>
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
