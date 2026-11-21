// These match Hms.Api/Dtos/DashboardDtos.cs.
import type { Appointment } from './appointment'
import type { RevenueSummary } from './billing'
import type { PharmacyAlertCounts } from './pharmacy'

export type DashboardTile = 'patients' | 'appointments' | 'lab' | 'pharmacy' | 'revenue'

// A tile the user may not see is not in `tiles`, and its number is null.
export type DashboardSummary = {
  today: string // the hospital's date, e.g. "2026-11-21"
  generatedAt: string // UTC moment the numbers were counted
  tiles: DashboardTile[]
  totalPatients: number | null
  appointments: { count: number; items: Appointment[] } | null
  openLabRequests: number | null
  pharmacyAlerts: PharmacyAlertCounts | null
  revenue: RevenueSummary | null
}
