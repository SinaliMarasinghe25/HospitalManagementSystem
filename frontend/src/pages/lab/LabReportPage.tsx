import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router'
import { getLabRequest } from '../../api/lab'
import type { LabRequest } from '../../types/lab'
import { ageFrom, formatDate, formatDateTime } from '../../utils/format'

// FR-LAB-04 Report generation: a printable lab report with patient, test, result and reference range.
export default function LabReportPage() {
  const { id } = useParams()
  const [lab, setLab] = useState<LabRequest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [printedAt] = useState(() => new Date().toISOString())

  useEffect(() => {
    getLabRequest(Number(id)).then(setLab).catch(() => setError('Could not load the lab request.'))
  }, [id])

  if (error) return <p className="p-8 text-red-700">{error}</p>
  if (!lab) return <p className="p-8 text-slate-500">Loading...</p>
  if (lab.status !== 'Completed') return <p className="p-8 text-slate-600">The result is not ready yet.</p>

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
        >
          Print / Save as PDF
        </button>
      </div>
      <article className="mx-auto max-w-[210mm] bg-white p-[15mm] text-sm text-black shadow print:max-w-none print:p-0 print:shadow-none">
        <header className="border-b-2 border-slate-800 pb-3">
          <h1 className="text-xl font-bold">Hospital Management System</h1>
          <p className="text-xs text-slate-600">Laboratory report &middot; Demonstration system with fictitious data</p>
        </header>
        <section className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1">
          <Row label="Patient">{lab.patientName}</Row>
          <Row label="Patient no.">{lab.patientNumber}</Row>
          <Row label="Date of birth">
            {formatDate(lab.dateOfBirth)} (age {ageFrom(lab.dateOfBirth)})
          </Row>
          <Row label="Gender">{lab.gender}</Row>
          <Row label="Request no.">{lab.requestNumber}</Row>
          <Row label="Requested by">Dr {lab.doctorName}</Row>
          <Row label="Sample ID">{lab.sampleId}</Row>
          <Row label="Collected">{lab.sampleCollectedAt && formatDateTime(lab.sampleCollectedAt)}</Row>
        </section>

        <table className="mt-6 w-full border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-slate-800">
              <th className="py-2 pr-3">Test</th>
              <th className="py-2 pr-3">Result</th>
              <th className="py-2 pr-3">Unit</th>
              <th className="py-2 pr-3">Reference range</th>
              <th className="py-2">Flag</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-300">
              <td className="py-2 pr-3">
                {lab.testName} ({lab.testCode})
              </td>
              <td className={`py-2 pr-3 ${lab.isAbnormal ? 'font-bold' : ''}`}>{lab.resultValue}</td>
              <td className="py-2 pr-3">{lab.unit ?? '-'}</td>
              <td className="py-2 pr-3">{lab.referenceRange ?? '-'}</td>
              <td className="py-2 font-bold">{lab.isAbnormal ? 'ABNORMAL' : ''}</td>
            </tr>
          </tbody>
        </table>
        {lab.resultNotes && (
          <p className="mt-3">
            <span className="font-semibold">Notes: </span>
            {lab.resultNotes}
          </p>
        )}

        <footer className="mt-12 flex items-end justify-between">
          <p className="text-xs text-slate-600">Printed {formatDateTime(printedAt)}</p>
          <div className="text-center">
            <div className="mb-1 w-56 border-b border-slate-800" />
            <p>Result entered by {lab.resultEnteredBy}</p>
            <p className="text-xs text-slate-600">{lab.resultEnteredAt && formatDateTime(lab.resultEnteredAt)}</p>
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
