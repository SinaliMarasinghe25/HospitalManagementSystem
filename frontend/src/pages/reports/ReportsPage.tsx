import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { Permissions } from '../../auth/permissions'
import { hasAnyRole, type Role } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { Tabs } from '../../components/ui/Tabs'
import AppointmentReportView from './AppointmentReportView'
import LabReportView from './LabReportView'
import PatientReportView from './PatientReportView'
import PharmacyReportView from './PharmacyReportView'
import RevenueReportView from './RevenueReportView'
import StaffReportView from './StaffReportView'

type Tab = 'patients' | 'appointments' | 'revenue' | 'pharmacy' | 'laboratory' | 'staff'

// The six reports of PDF 3.10 (FR-RP-01 to 06). Each role sees only the tabs the role table allows.
const reports: { tab: Tab; label: string; roles: readonly Role[]; view: ReactNode }[] = [
  { tab: 'patients', label: 'Patients', roles: Permissions.viewPatientReport, view: <PatientReportView /> },
  { tab: 'appointments', label: 'Appointments', roles: Permissions.viewAppointmentReport, view: <AppointmentReportView /> },
  { tab: 'revenue', label: 'Revenue', roles: Permissions.viewRevenue, view: <RevenueReportView /> },
  { tab: 'pharmacy', label: 'Pharmacy', roles: Permissions.viewPharmacyReport, view: <PharmacyReportView /> },
  { tab: 'laboratory', label: 'Laboratory', roles: Permissions.viewLabReport, view: <LabReportView /> },
  { tab: 'staff', label: 'Staff', roles: Permissions.manageStaff, view: <StaffReportView /> },
]

const tabLabels = Object.fromEntries(reports.map((r) => [r.tab, r.label])) as Record<Tab, string>

export default function ReportsPage() {
  const { user } = useAuth()
  const mine = reports.filter((r) => hasAnyRole(user?.roles, r.roles))
  const [params, setParams] = useSearchParams()
  const current = mine.find((r) => r.tab === params.get('tab')) ?? mine[0]

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <h1 className="text-xl font-semibold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-600">
          Choose a report and a period. Every table can be downloaded as a CSV file, and the whole report can be printed
          or saved as a PDF.
        </p>
      </div>
      {mine.length === 0 ? (
        <p className="text-slate-600">Your role has no reports.</p>
      ) : (
        <>
          <div className="print:hidden">
            <Tabs
              label="Reports"
              tabs={mine.map((r) => r.tab)}
              labels={tabLabels}
              value={current.tab}
              onChange={(t) => setParams({ tab: t })}
            />
          </div>
          {/* key: switching tabs starts the chosen report fresh */}
          <div key={current.tab}>{current.view}</div>
        </>
      )}
    </div>
  )
}
