import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { RequireRole } from './auth/RequireRole'
import { AppLayout } from './components/layout/AppLayout'
import { navItems } from './navigation'
import ComingSoonPage from './pages/ComingSoonPage'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import PatientDetailPage from './pages/patients/PatientDetailPage'
import PatientFormPage from './pages/patients/PatientFormPage'
import PatientListPage from './pages/patients/PatientListPage'
import { Permissions } from './auth/permissions'

// Pages that are built so far. Every other menu item shows a "coming soon" page.
const builtPages: Record<string, ReactNode> = {
  '/': <DashboardPage />,
  '/patients': <PatientListPage />,
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
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
