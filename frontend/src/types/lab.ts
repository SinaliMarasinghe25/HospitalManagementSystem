// These match Hms.Api/Dtos/LabDtos.cs.
import type { Gender } from './patient'

export type LabTest = {
  id: number
  code: string
  name: string
  price: number
  unit: string | null
  referenceRange: string | null
  isActive: boolean
}

export type LabRequestStatus = 'Requested' | 'SampleCollected' | 'Completed' | 'Cancelled'

export const labStatusLabels: Record<LabRequestStatus, string> = {
  Requested: 'Waiting for sample',
  SampleCollected: 'Sample collected',
  Completed: 'Result ready',
  Cancelled: 'Cancelled',
}

export type LabRequest = {
  id: number
  requestNumber: string
  patientId: number
  patientNumber: string
  patientName: string
  dateOfBirth: string
  gender: Gender
  labTestId: number
  testCode: string
  testName: string
  unit: string | null
  referenceRange: string | null
  requestedByDoctorId: number
  doctorName: string
  medicalRecordId: number | null
  status: LabRequestStatus
  requestedAt: string
  sampleId: string | null
  sampleCollectedAt: string | null
  collectedBy: string | null
  resultValue: string | null
  resultNotes: string | null
  isAbnormal: boolean | null
  resultEnteredAt: string | null
  resultEnteredBy: string | null
}
