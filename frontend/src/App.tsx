import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { RequireRole } from './auth/RequireRole'
import { AppLayout } from './components/layout/AppLayout'
import { navItems } from './navigation'
import ComingSoonPage from './pages/ComingSoonPage'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import DepartmentsPage from './pages/doctors/DepartmentsPage'
import DoctorDetailPage from './pages/doctors/DoctorDetailPage'
import DoctorFormPage from './pages/doctors/DoctorFormPage'
import DoctorListPage from './pages/doctors/DoctorListPage'
import PatientDetailPage from './pages/patients/PatientDetailPage'
import PatientFormPage from './pages/patients/PatientFormPage'
import PatientListPage from './pages/patients/PatientListPage'
import { Permissions } from './auth/permissions'
import AppointmentDetailPage from './pages/appointments/AppointmentDetailPage'
import AppointmentFormPage from './pages/appointments/AppointmentFormPage'
import AppointmentsPage from './pages/appointments/AppointmentsPage'
import ConsultationFormPage from './pages/medical-records/ConsultationFormPage'
import MedicalRecordPage from './pages/medical-records/MedicalRecordPage'
import MedicalRecordsPage from './pages/medical-records/MedicalRecordsPage'
import MedicalReportPage from './pages/medical-records/MedicalReportPage'

// Pages that are built so far. Every other menu item shows a "coming soon" page.
const builtPages: Record<string, ReactNode> = {
  '/': <DashboardPage />,
  '/patients': <PatientListPage />,
  '/doctors': <DoctorListPage />,
  '/appointments': <AppointmentsPage />,
  '/medical-records': <MedicalRecordsPage />,
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

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
                {builtPages[item.path] ?? <ComingSoonPage title={item.label} pdfRef={item.pdfRef} />}
              </RequireRole>
            }
          />
        ))}

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
          path="/doctors/new"
          element={<RequireRole roles={Permissions.manageDoctors}><DoctorFormPage /></RequireRole>}
        />
        <Route
          path="/doctors/departments"
          element={<RequireRole roles={Permissions.manageDoctors}><DepartmentsPage /></RequireRole>}
        />
        <Route
          path="/doctors/:id"
          element={<RequireRole roles={Permissions.viewDoctors}><DoctorDetailPage /></RequireRole>}
        />
        <Route
          path="/doctors/:id/edit"
          element={<RequireRole roles={Permissions.manageDoctors}><DoctorFormPage /></RequireRole>}
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
      </Route>

      {/* The printable report has no menu or header, so it is outside AppLayout. */}
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

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
