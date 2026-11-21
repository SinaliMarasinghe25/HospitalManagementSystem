import { AllRoles, Roles, type Role } from './auth/roles'

const { Administrator, Doctor, Nurse, Receptionist, LaboratoryStaff, Pharmacist, Accountant } = Roles

export type NavItem = {
  label: string
  path: string
  roles: readonly Role[]
  // PDF requirement this module delivers, shown on the placeholder page.
  pdfRef: string
}

// One entry per module. "roles" follows the permission table in the project plan (section 4).
// The sidebar shows only the items the logged-in user's roles allow.
export const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', roles: AllRoles, pdfRef: 'Section 7, Dashboard' },
  { label: 'Patients', path: '/patients', roles: [Administrator, Doctor, Nurse, Receptionist], pdfRef: 'Section 3.2, Patient Management' },
  { label: 'Doctors', path: '/doctors', roles: [Administrator, Doctor, Nurse, Receptionist], pdfRef: 'Section 3.3, Doctor Management' },
  { label: 'Appointments', path: '/appointments', roles: [Administrator, Doctor, Nurse, Receptionist], pdfRef: 'Section 3.4, Appointment Management' },
  { label: 'Medical Records', path: '/medical-records', roles: [Administrator, Doctor, Nurse], pdfRef: 'Section 3.5, Electronic Medical Records' },
  { label: 'Admissions', path: '/admissions', roles: [Administrator, Doctor, Nurse, Receptionist], pdfRef: 'Section 1.2, Inpatient and Outpatient Management' },
  { label: 'Laboratory', path: '/laboratory', roles: [Administrator, Doctor, Nurse, LaboratoryStaff], pdfRef: 'Section 3.6, Laboratory Management' },
  { label: 'Pharmacy', path: '/pharmacy', roles: [Administrator, Doctor, Pharmacist, Accountant], pdfRef: 'Section 3.7, Pharmacy Management' },
  { label: 'Billing', path: '/billing', roles: [Administrator, Receptionist, Accountant], pdfRef: 'Section 3.8, Billing System' },
  { label: 'Staff', path: '/staff', roles: AllRoles, pdfRef: 'Section 3.9, Staff Management' },
  { label: 'Reports', path: '/reports', roles: AllRoles, pdfRef: 'Section 3.10, Reports' },
  { label: 'Audit Log', path: '/audit-log', roles: [Administrator], pdfRef: 'Section 4, Audit Logs' },
]
