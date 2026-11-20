// These match Hms.Api/Dtos/UserDtos.cs.
import type { Role } from '../auth/roles'

export type UserAccount = {
  id: string
  userName: string
  email: string | null
  isActive: boolean
  isLockedOut: boolean
  roles: Role[]
  // Still has the temporary password an administrator set.
  mustChangePassword: boolean
  // The staff record this login is linked to, if any.
  employeeId: number | null
  employeeName: string | null
  // Linked to an employee with a doctor profile: the Doctor role is kept automatically.
  isDoctor: boolean
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
