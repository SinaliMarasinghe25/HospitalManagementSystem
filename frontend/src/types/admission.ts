// These match Hms.Api/Dtos/InpatientDtos.cs.
import type { Gender } from './patient'

export type Bed = {
  id: number
  bedNumber: string
  isActive: boolean
  admissionId: number | null
  patientName: string | null
  patientNumber: string | null
}

export type Ward = {
  id: number
  name: string
  wardType: string
  dailyCharge: number
  totalBeds: number
  freeBeds: number
  beds: Bed[]
}

export type AdmissionStatus = 'Admitted' | 'Discharged'

export type AdmissionSummary = {
  id: number
  admissionNumber: string
  patientId: number
  patientNumber: string
  patientName: string
  wardName: string
  bedNumber: string
  doctorName: string
  admittedAt: string
  dischargedAt: string | null
  status: AdmissionStatus
}

export type BedTransfer = {
  transferredAt: string
  fromWard: string
  fromBed: string
  toWard: string
  toBed: string
  reason: string | null
}

export type AdmissionDetail = {
  id: number
  admissionNumber: string
  patientId: number
  patientNumber: string
  patientName: string
  dateOfBirth: string
  gender: Gender
  allergies: string | null
  wardId: number
  wardName: string
  bedId: number
  bedNumber: string
  dailyCharge: number
  admittingDoctorId: number
  doctorName: string
  admittedAt: string
  dischargedAt: string | null
  status: AdmissionStatus
  admissionReason: string | null
  dischargeSummary: string | null // only sent to clinical roles
  daysCharged: number
  transfers: BedTransfer[]
}

export type VitalSign = {
  id: number
  recordedAt: string
  temperatureC: number | null
  pulseBpm: number | null
  systolicBp: number | null
  diastolicBp: number | null
  respiratoryRate: number | null
  oxygenSaturation: number | null
  notes: string | null
  recordedBy: string | null
}

// Form values as typed (text), converted to numbers when sent.
export type VitalSignForm = {
  temperatureC: string
  pulseBpm: string
  systolicBp: string
  diastolicBp: string
  respiratoryRate: string
  oxygenSaturation: string
  notes: string
}
