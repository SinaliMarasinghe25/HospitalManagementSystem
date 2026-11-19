import { Roles, type Role } from './roles'

const { Administrator, Doctor, Nurse, Receptionist, Pharmacist } = Roles

// Mirrors Hms.Api/Authorization/Policies.cs, so buttons only appear when the API would allow the action.
export const Permissions = {
  viewPatients: [Administrator, Doctor, Nurse, Receptionist],
  editPatients: [Administrator, Receptionist],
  viewMedicalHistory: [Administrator, Doctor, Nurse],
  viewPatientDocuments: [Administrator, Doctor, Nurse, Receptionist],
  uploadPatientDocuments: [Administrator, Doctor, Receptionist],
  viewDoctors: [Administrator, Doctor, Nurse, Receptionist],
  manageDoctors: [Administrator],
  viewAppointments: [Administrator, Doctor, Nurse, Receptionist],
  bookAppointments: [Administrator, Receptionist],
  updateAppointmentStatus: [Administrator, Doctor, Receptionist],
  editMedicalRecords: [Doctor],
  viewPrescriptions: [Administrator, Doctor, Nurse, Pharmacist],
  viewAdmissions: [Administrator, Doctor, Nurse, Receptionist],
  admitPatients: [Administrator, Doctor, Receptionist],
  transferPatients: [Administrator, Doctor, Nurse],
  recordVitals: [Administrator, Doctor, Nurse],
  dischargePatients: [Administrator, Doctor],
  manageWards: [Administrator],
} satisfies Record<string, Role[]>
