import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { RequireRole } from './auth/RequireRole'
import { AppLayout } from './components/layout/AppLayout'
import { navItems } from './navigation'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import DoctorDetailPage from './pages/doctors/DoctorDetailPage'
import DoctorListPage from './pages/doctors/DoctorListPage'
import PatientDetailPage from './pages/patients/PatientDetailPage'
import PatientFormPage from './pages/patients/PatientFormPage'
import PatientListPage from './pages/patients/PatientListPage'
import { Permissions } from './auth/permissions'
import AppointmentDetailPage from './pages/appointments/AppointmentDetailPage'
import AppointmentFormPage from './pages/appointments/AppointmentFormPage'
import AppointmentsPage from './pages/appointments/AppointmentsPage'
import AdmissionDetailPage from './pages/admissions/AdmissionDetailPage'
import AdmissionsPage from './pages/admissions/AdmissionsPage'
import AdmitPage from './pages/admissions/AdmitPage'
import DischargeSummaryPage from './pages/admissions/DischargeSummaryPage'
import WardsPage from './pages/admissions/WardsPage'
import LabPage from './pages/lab/LabPage'
import LabReportPage from './pages/lab/LabReportPage'
import LabRequestPage from './pages/lab/LabRequestPage'
import LabTestsPage from './pages/lab/LabTestsPage'
import ConsultationFormPage from './pages/medical-records/ConsultationFormPage'
import MedicalRecordPage from './pages/medical-records/MedicalRecordPage'
import MedicalRecordsPage from './pages/medical-records/MedicalRecordsPage'
import MedicalReportPage from './pages/medical-records/MedicalReportPage'
import DispensePage from './pages/pharmacy/DispensePage'
import MedicineFormPage from './pages/pharmacy/MedicineFormPage'
import MedicinePage from './pages/pharmacy/MedicinePage'
import PharmacyPage from './pages/pharmacy/PharmacyPage'
import BillingPage from './pages/billing/BillingPage'
import GenerateBillPage from './pages/billing/GenerateBillPage'
import InvoicePage from './pages/billing/InvoicePage'
import { InvoicePrintPage, ReceiptPage } from './pages/billing/InvoicePrintPage'
import EmployeeFormPage from './pages/staff/EmployeeFormPage'
import EmployeePage from './pages/staff/EmployeePage'
import StaffPage from './pages/staff/StaffPage'
import ReportsPage from './pages/reports/ReportsPage'
import AuditLogPage from './pages/audit/AuditLogPage'

// The page for each menu item in navigation.ts.
const pages: Record<string, ReactNode> = {
  '/': <DashboardPage />,
  '/patients': <PatientListPage />,
  '/doctors': <DoctorListPage />,
  '/appointments': <AppointmentsPage />,
  '/medical-records': <MedicalRecordsPage />,
  '/admissions': <AdmissionsPage />,
  '/laboratory': <LabPage />,
  '/pharmacy': <PharmacyPage />,
  '/billing': <BillingPage />,
  '/staff': <StaffPage />,
  '/reports': <ReportsPage />,
  '/audit-log': <AuditLogPage />,
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* Forgot password: open to everyone, because the person cannot log in. */}
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePasswordPage />
          </ProtectedRoute>
        }
      />

      {/* Every page inside here needs a login and shares the same layout. */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {navItems.map((item) => (
          <Route
            key={item.path}
            path={item.path}
            element={
              <RequireRole roles={item.roles}>
                {pages[item.path]}
              </RequireRole>
            }
          />
        ))}

        {/* Logins are a tab of the Staff page now; old bookmarks to /users still work. */}
        <Route path="/users" element={<Navigate to="/staff?tab=logins" replace />} />

        {/* Patient pages that are not in the menu */}
        <Route
          path="/patients/new"
          element={<RequireRole roles={Permissions.editPatients}><PatientFormPage /></RequireRole>}
        />
        <Route
          path="/patients/:id"
          element={<RequireRole roles={Permissions.viewPatients}><PatientDetailPage /></RequireRole>}
        />
        <Route
          path="/patients/:id/edit"
          element={<RequireRole roles={Permissions.editPatients}><PatientFormPage /></RequireRole>}
        />

        {/* Doctor pages that are not in the menu */}
        <Route
          path="/doctors/:id"
          element={<RequireRole roles={Permissions.viewDoctors}><DoctorDetailPage /></RequireRole>}
        />

        {/* Appointment pages that are not in the menu */}
        <Route
          path="/appointments/new"
          element={<RequireRole roles={Permissions.bookAppointments}><AppointmentFormPage /></RequireRole>}
        />
        <Route
          path="/appointments/:id"
          element={<RequireRole roles={Permissions.viewAppointments}><AppointmentDetailPage /></RequireRole>}
        />
        <Route
          path="/appointments/:id/reschedule"
          element={<RequireRole roles={Permissions.bookAppointments}><AppointmentFormPage /></RequireRole>}
        />

        {/* Medical record pages that are not in the menu */}
        <Route
          path="/appointments/:appointmentId/consultation"
          element={<RequireRole roles={Permissions.editMedicalRecords}><ConsultationFormPage /></RequireRole>}
        />
        <Route
          path="/medical-records/:id"
          element={<RequireRole roles={Permissions.viewMedicalHistory}><MedicalRecordPage /></RequireRole>}
        />
        <Route
          path="/medical-records/:id/edit"
          element={<RequireRole roles={Permissions.editMedicalRecords}><ConsultationFormPage /></RequireRole>}
        />

        {/* Inpatient pages that are not in the menu */}
        <Route
          path="/admissions/new"
          element={<RequireRole roles={Permissions.admitPatients}><AdmitPage /></RequireRole>}
        />
        <Route
          path="/admissions/wards"
          element={<RequireRole roles={Permissions.manageWards}><WardsPage /></RequireRole>}
        />
        <Route
          path="/admissions/:id"
          element={<RequireRole roles={Permissions.viewAdmissions}><AdmissionDetailPage /></RequireRole>}
        />

        {/* Laboratory pages that are not in the menu */}
        <Route
          path="/laboratory/tests"
          element={<RequireRole roles={Permissions.manageLabTests}><LabTestsPage /></RequireRole>}
        />
        <Route
          path="/laboratory/requests/:id"
          element={<RequireRole roles={Permissions.viewLabRequests}><LabRequestPage /></RequireRole>}
        />

        {/* Pharmacy pages that are not in the menu */}
        <Route
          path="/pharmacy/medicines/new"
          element={<RequireRole roles={Permissions.managePharmacyStock}><MedicineFormPage /></RequireRole>}
        />
        <Route
          path="/pharmacy/medicines/:id"
          element={<RequireRole roles={Permissions.viewPharmacyStock}><MedicinePage /></RequireRole>}
        />
        <Route
          path="/pharmacy/medicines/:id/edit"
          element={<RequireRole roles={Permissions.managePharmacyStock}><MedicineFormPage /></RequireRole>}
        />
        <Route
          path="/pharmacy/prescriptions/:id"
          element={<RequireRole roles={Permissions.pharmacyQueue}><DispensePage /></RequireRole>}
        />

        {/* Billing pages that are not in the menu */}
        <Route
          path="/billing/patients/:patientId"
          element={<RequireRole roles={Permissions.viewInvoiceDetails}><GenerateBillPage /></RequireRole>}
        />
        <Route
          path="/billing/invoices/:id"
          element={<RequireRole roles={Permissions.viewInvoiceDetails}><InvoicePage /></RequireRole>}
        />

        {/* Staff pages that are not in the menu (the Staff menu item itself is open to every role, for "My leave") */}
        <Route
          path="/staff/employees/new"
          element={<RequireRole roles={Permissions.manageStaff}><EmployeeFormPage /></RequireRole>}
        />
        <Route
          path="/staff/employees/:id"
          element={<RequireRole roles={Permissions.manageStaff}><EmployeePage /></RequireRole>}
        />
        <Route
          path="/staff/employees/:id/edit"
          element={<RequireRole roles={Permissions.manageStaff}><EmployeeFormPage /></RequireRole>}
        />
      </Route>

      {/* The printable pages have no menu or header, so they are outside AppLayout. */}
      <Route
        path="/laboratory/requests/:id/report"
        element={
          <ProtectedRoute>
            <RequireRole roles={Permissions.viewLabRequests}>
              <LabReportPage />
            </RequireRole>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admissions/:id/summary"
        element={
          <ProtectedRoute>
            <RequireRole roles={Permissions.viewMedicalHistory}>
              <DischargeSummaryPage />
            </RequireRole>
          </ProtectedRoute>
        }
      />
      <Route
        path="/medical-records/:id/report"
        element={
          <ProtectedRoute>
            <RequireRole roles={Permissions.viewMedicalHistory}>
              <MedicalReportPage />
            </RequireRole>
          </ProtectedRoute>
        }
      />

      <Route
        path="/billing/invoices/:id/print"
        element={
          <ProtectedRoute>
            <RequireRole roles={Permissions.viewInvoiceDetails}>
              <InvoicePrintPage />
            </RequireRole>
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing/payments/:id/receipt"
        element={
          <ProtectedRoute>
            <RequireRole roles={Permissions.viewInvoiceDetails}>
              <ReceiptPage />
            </RequireRole>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
