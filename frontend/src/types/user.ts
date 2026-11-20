// These match Hms.Api/Dtos/UserDtos.cs.
import type { Role } from '../auth/roles'

export type UserAccount = {
  id: string
  userName: string
  email: string | null
  isActive: boolean
  isLockedOut: boolean
  roles: Role[]
}

export const roleLabels: Record<Role, string> = {
  Administrator: 'Administrator',
  Doctor: 'Doctor',
  Nurse: 'Nurse',
  Receptionist: 'Receptionist',
  LaboratoryStaff: 'Laboratory staff',
  Pharmacist: 'Pharmacist',
  Accountant: 'Accountant',
}
