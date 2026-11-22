import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { listAppointments } from '../../api/appointments'
import { ApiError } from '../../api/client'
import { listMedicalRecords } from '../../api/medicalRecords'
import { Permissions } from '../../auth/permissions'
import { hasAnyRole } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { StatusBadge } from '../../components/appointments/StatusBadge'
import { inputClass, primaryButtonClass } from '../../components/ui/FormField'
import { Pagination } from '../../components/ui/Pagination'
import type { Appointment } from '../../types/appointment'
import type { MedicalRecordSummary } from '../../types/medicalRecord'
import type { PagedResult } from '../../types/paged'
import { addDays, formatClock, formatDateTime, todayInHospital } from '../../utils/format'

// PDF 3.5 Electronic Medical Records, the menu page.
// Top: today's checked-in patients (a doctor sees their own). Below: recent records by date.
export default function MedicalRecordsPage() {
  const { user } = useAuth()
  const canWrite = hasAnyRole(user?.roles, Permissions.editMedicalRecords)

  const [waiting, setWaiting] = useState<Appointment[] | null>(null)
  const [records, setRecords] = useState<PagedResult<MedicalRecordSummary> | null>(null)
  const [toDate, setToDate] = useState(() => todayInHospital())
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const today = todayInHospital()
    listAppointments({ fromDate: today, toDate: today })
      .then((list) => setWaiting(list.filter((a) => a.status === 'CheckedIn' || (a.status === 'Completed' && !a.medicalRecordId))))
      .catch(() => setWaiting([]))
  }, [])

  useEffect(() => {
    let ignore = false
    listMedicalRecords({ fromDate: addDays(toDate, -6), toDate, page: String(page) })
      .then((data) => !ignore && (setRecords(data), setError(null)))
      .catch((err: unknown) => !ignore && setError(err instanceof ApiError ? err.message : 'Could not load records.'))
    return () => {
      ignore = true
    }
  }, [toDate, page])

  return (
    <div className="space-y-6">
      <h1 className="text-[1.75rem] leading-tight font-medium text-slate-900">Medical Records</h1>

      <section className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/70" aria-labelledby="waiting-heading">
        <h2 id="waiting-heading" className="font-semibold text-slate-900">Patients waiting today</h2>
        {waiting && waiting.length === 0 && <p className="mt-2 text-sm text-slate-500">No checked-in patients right now.</p>}
        <ul className="mt-2 divide-y divide-slate-100">
          {waiting?.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <span className="w-12 font-medium text-slate-900">{formatClock(a.startTime)}</span>
              <span className="flex-1 text-slate-800">
                {a.patientName} <span className="text-slate-500">({a.patientNumber})</span>
                <span className="block text-xs text-slate-500">Dr {a.doctorName}</span>
              </span>
              <StatusBadge status={a.status} />
              {a.medicalRecordId ? (
                <Link to={`/medical-records/${a.medicalRecordId}`} className="text-brand-700 hover:underline">
                  Open record<span className="sr-only"> for {a.patientName}</span>
                </Link>
              ) : (
                canWrite && (
                  <Link to={`/appointments/${a.id}/consultation`} className={primaryButtonClass}>
                    Start consultation<span className="sr-only"> for {a.patientName}</span>
                  </Link>
                )
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3" aria-labelledby="recent-heading">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="recent-heading" className="font-semibold text-slate-900">Records from the 7 days up to</h2>
          <div>
            <label htmlFor="records-to" className="sr-only">
              Last day
            </label>
            <input
              id="records-to"
              type="date"
              value={toDate}
              onChange={(e) => {
                if (!e.target.value) return
                setToDate(e.target.value)
                setPage(1) // a new date range starts on page 1
              }}
              className={inputClass}
            />
          </div>
        </div>
        {error && (
          <p className="border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}
        <div className="overflow-x-auto rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/60 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Visit</th>
                <th scope="col" className="px-4 py-3 font-medium">Patient</th>
                <th scope="col" className="px-4 py-3 font-medium">Doctor</th>
                <th scope="col" className="px-4 py-3 font-medium">Complaint</th>
                <th scope="col" className="px-4 py-3 font-medium">Main diagnosis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records?.items.map((r) => (
                <tr key={r.id} className="hover:bg-brand-50/40">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link to={`/medical-records/${r.id}`} className="font-medium text-brand-700 hover:underline">
                      {formatDateTime(r.visitDate)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {r.patientName}
                    <span className="block text-xs text-slate-500">{r.patientNumber}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">Dr {r.doctorName}</td>
                  <td className="px-4 py-3 text-slate-700">{r.chiefComplaint ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{r.primaryDiagnosis ?? '-'}</td>
                </tr>
              ))}
              {records && records.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    No medical records in these 7 days.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {records && (
          <Pagination
            totalCount={records.totalCount}
            page={records.page}
            pageSize={records.pageSize}
            noun="record"
            onPageChange={setPage}
          />
        )}
      </section>
    </div>
  )
}
