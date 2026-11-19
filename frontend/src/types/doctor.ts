// These match Hms.Api/Dtos/DoctorDtos.cs.

export type Department = {
  id: number
  name: string
  description: string | null
  isActive: boolean
  doctorCount: number
}

export type DayOfWeek = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday'

export const daysOfWeek: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export type ScheduleItem = {
  dayOfWeek: DayOfWeek
  startTime: string // "08:00" or "08:00:00"
  endTime: string
}

export type DoctorSummary = {
  id: number
  employeeNumber: string
  fullName: string
  specialization: string
  departmentId: number
  departmentName: string
  consultationFee: number
  isActive: boolean
}

export type DoctorDetail = {
  id: number
  employeeId: number
  employeeNumber: string
  firstName: string
  lastName: string
  phone: string | null
  email: string | null
  hireDate: string
  departmentId: number
  departmentName: string
  specialization: string
  licenseNumber: string
  consultationFee: number
  slotMinutes: number
  isActive: boolean
  userName: string | null
  schedule: ScheduleItem[]
}

// Form values are strings, as typed in the inputs.
export type DoctorForm = {
  firstName: string
  lastName: string
  phone: string
  email: string
  hireDate: string
  departmentId: string
  specialization: string
  licenseNumber: string
  consultationFee: string
  slotMinutes: string
  isActive: boolean
  userName: string
  password: string
}
