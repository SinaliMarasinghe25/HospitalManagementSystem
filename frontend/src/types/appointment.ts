// These match Hms.Api/Dtos/AppointmentDtos.cs.

export type AppointmentStatus = 'Scheduled' | 'CheckedIn' | 'Completed' | 'Cancelled' | 'NoShow' | 'Rescheduled'

export const appointmentStatuses: AppointmentStatus[] = [
  'Scheduled',
  'CheckedIn',
  'Completed',
  'Cancelled',
  'NoShow',
  'Rescheduled',
]

export type Appointment = {
  id: number
  patientId: number
  patientNumber: string
  patientName: string
  doctorId: number
  doctorName: string
  departmentName: string
  startTime: string // UTC, e.g. "2026-11-23T04:45:00Z"
  endTime: string
  status: AppointmentStatus
  reason: string | null
  cancellationReason: string | null
  rescheduledFromId: number | null
  rescheduledToId: number | null
  createdAt: string
}

export type Slot = {
  startTime: string
  endTime: string
  isAvailable: boolean
}
