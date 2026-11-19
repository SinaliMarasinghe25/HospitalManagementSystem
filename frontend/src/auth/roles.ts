// Must match Hms.Api/Authorization/Roles.cs exactly.
export const Roles = {
  Administrator: 'Administrator',
  Doctor: 'Doctor',
  Nurse: 'Nurse',
  Receptionist: 'Receptionist',
  LaboratoryStaff: 'LaboratoryStaff',
  Pharmacist: 'Pharmacist',
  Accountant: 'Accountant',
} as const

export type Role = (typeof Roles)[keyof typeof Roles]

export const AllRoles: Role[] = Object.values(Roles)

export function hasAnyRole(userRoles: string[] | undefined, allowed: readonly Role[]): boolean {
  return !!userRoles && userRoles.some((role) => (allowed as readonly string[]).includes(role))
}
