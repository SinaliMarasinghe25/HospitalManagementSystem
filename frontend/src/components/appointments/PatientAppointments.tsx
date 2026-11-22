import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { listAppointments } from '../../api/appointments'
import type { Appointment } from '../../types/appointment'
import { formatDateTime } from '../../utils/format'
import { StatusBadge } from './StatusBadge'

// The patient's appointments, newest first, on the patient page.
export function PatientAppointments({ patientId }: { patientId: number }) {
  const [items, setItems] = useState<Appointment[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    listAppointments({ patientId: String(patientId) })
      .then((data) => setItems([...data].reverse()))
      .catch(() => setError(true))
  }, [patientId])

  return (
    <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70" aria-labelledby="appointments-heading">
      <h2 id="appointments-heading" className="font-semibold text-slate-900">Appointments</h2>
      {error && <p className="mt-2 text-sm text-red-700">Could not load appointments.</p>}
      {items && items.length === 0 && <p className="mt-2 text-sm text-slate-500">No appointments yet.</p>}
      {items && items.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100">
          {items.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <Link to={`/appointments/${a.id}`} className="text-brand-700 hover:underline">
                {formatDateTime(a.startTime)}
              </Link>
              <span className="text-slate-700">Dr {a.doctorName}</span>
              <StatusBadge status={a.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
