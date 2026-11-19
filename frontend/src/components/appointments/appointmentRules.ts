import { Permissions } from '../../auth/permissions'
import { hasAnyRole, Roles } from '../../auth/roles'
import type { Appointment, AppointmentStatus } from '../../types/appointment'
import { hospitalDateOf, todayInHospital } from '../../utils/format'

export const statusLabels: Record<AppointmentStatus, string> = {
  Scheduled: 'Scheduled',
  CheckedIn: 'Checked in',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
  NoShow: 'No-show',
  Rescheduled: 'Rescheduled',
}

export type StatusAction = { status: AppointmentStatus; label: string }

// Mirrors AppointmentService.UpdateStatusAsync, so only buttons the API would accept are shown.
// The API still checks everything; this only hides buttons that would fail.
export function statusActions(appointment: Appointment, roles: string[] | undefined): StatusAction[] {
  const frontDesk = hasAnyRole(roles, Permissions.bookAppointments)
  const isAdmin = hasAnyRole(roles, [Roles.Administrator])
  // A doctor only ever sees their own appointments, so "is a doctor" means "own doctor" here.
  const isDoctor = hasAnyRole(roles, [Roles.Doctor])
  const actions: StatusAction[] = []

  if (appointment.status === 'Scheduled' && (frontDesk || isDoctor)) {
    if (hospitalDateOf(appointment.startTime) === todayInHospital()) {
      actions.push({ status: 'CheckedIn', label: 'Check in' })
    }
    if (new Date(appointment.startTime).getTime() < Date.now()) {
      actions.push({ status: 'NoShow', label: 'Mark no-show' })
    }
  }
  if (appointment.status === 'CheckedIn' && (isAdmin || isDoctor)) {
    actions.push({ status: 'Completed', label: 'Complete' })
  }
  return actions
}

// Cancel and reschedule: front desk only, and only while the appointment is still Scheduled.
export function canChangeBooking(appointment: Appointment, roles: string[] | undefined) {
  return appointment.status === 'Scheduled' && hasAnyRole(roles, Permissions.bookAppointments)
}
