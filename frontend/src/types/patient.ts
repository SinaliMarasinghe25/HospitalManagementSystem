// These match the DTOs in Hms.Api/Dtos/PatientDtos.cs.

export type Gender = 'Male' | 'Female' | 'Other'

export type PatientRequest = {
  firstName: string
  lastName: string
  dateOfBirth: string // "YYYY-MM-DD"
  gender: Gender | ''
  nationalId: string
  phone: string
  email: string
  address: string
  bloodGroup: string
  allergies: string
  emergencyContactName: string
  emergencyContactPhone: string
}

export type PatientSummary = {
  id: number
  patientNumber: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: Gender
  phone: string
  nationalId: string | null
}

export type PatientDetail = {
  id: number
  patientNumber: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: Gender
  nationalId: string | null
  phone: string
  email: string | null
  address: string | null
  bloodGroup: string | null
  allergies: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  createdAt: string
  updatedAt: string | null
}

export type PagedResult<T> = {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
}

export type PatientDocument = {
  id: number
  fileName: string
  contentType: string
  sizeBytes: number
  description: string | null
  uploadedAt: string
}

export type MedicalHistory = {
  visits: {
    id: number
    visitDate: string
    doctorName: string
    chiefComplaint: string | null
    diagnoses: string[]
    treatments: string[]
    prescriptions: string[]
  }[]
  labResults: {
    id: number
    testName: string
    status: string
    requestedAt: string
    resultValue: string | null
    unit: string | null
    referenceRange: string | null
    isAbnormal: boolean | null
  }[]
  admissions: {
    id: number
    admissionNumber: string
    ward: string
    bed: string
    admittedAt: string
    dischargedAt: string | null
    admissionReason: string | null
  }[]
}
