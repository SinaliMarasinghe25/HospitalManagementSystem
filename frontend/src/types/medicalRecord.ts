// These match Hms.Api/Dtos/MedicalRecordDtos.cs.
import type { Gender } from './patient'

export type DiagnosisItem = { code: string | null; description: string; isPrimary: boolean }

export type TreatmentItem = { description: string; performedAt: string | null }

export type PrescriptionStatus = 'Pending' | 'PartiallyDispensed' | 'Dispensed' | 'Cancelled'

export type PrescriptionItem = {
  id: number
  medicineId: number
  medicineName: string
  strength: string
  form: string
  dosage: string
  frequency: string
  durationDays: number
  quantity: number
  quantityDispensed: number
  instructions: string | null
}

export type Prescription = {
  id: number
  medicalRecordId: number
  patientId: number
  patientNumber: string
  patientName: string
  doctorName: string
  prescribedAt: string
  status: PrescriptionStatus
  items: PrescriptionItem[]
}

export type MedicalRecordSummary = {
  id: number
  visitDate: string
  patientId: number
  patientNumber: string
  patientName: string
  doctorName: string
  chiefComplaint: string | null
  primaryDiagnosis: string | null
}

export type MedicalRecord = {
  id: number
  appointmentId: number | null
  visitDate: string
  createdAt: string
  patientId: number
  patientNumber: string
  patientName: string
  dateOfBirth: string
  gender: Gender
  bloodGroup: string | null
  allergies: string | null
  doctorId: number
  doctorName: string
  departmentName: string
  licenseNumber: string
  chiefComplaint: string | null
  clinicalNotes: string | null
  diagnoses: DiagnosisItem[]
  treatments: TreatmentItem[]
  prescriptions: Prescription[]
  canEdit: boolean
}

export type MedicalRecordRequest = {
  appointmentId?: number
  chiefComplaint: string
  clinicalNotes: string
  diagnoses: DiagnosisItem[]
  treatments: TreatmentItem[]
}

export type Medicine = { id: number; name: string; genericName: string | null; form: string; strength: string }

// One line of the prescription form; numbers are kept as typed text until saving.
export type PrescriptionLine = {
  medicineId: string
  dosage: string
  frequency: string
  durationDays: string
  quantity: string
  instructions: string
}
