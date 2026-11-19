import type { AppointmentStatus } from '../../types/appointment'
import { statusLabels } from './appointmentRules'

// Colour plus text, so the status is never shown by colour alone.
const styles: Record<AppointmentStatus, string> = {
  Scheduled: 'bg-blue-50 text-blue-800 ring-blue-200',
  CheckedIn: 'bg-amber-50 text-amber-800 ring-amber-200',
  Completed: 'bg-green-50 text-green-800 ring-green-200',
  Cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
  NoShow: 'bg-red-50 text-red-800 ring-red-200',
  Rescheduled: 'bg-purple-50 text-purple-800 ring-purple-200',
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${styles[status]}`}>
      {statusLabels[status]}
    </span>
  )
}
