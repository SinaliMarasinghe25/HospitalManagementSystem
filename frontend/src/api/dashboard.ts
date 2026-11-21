import type { DashboardSummary } from '../types/dashboard'
import { apiFetch } from './client'

// Every dashboard number in one request. no-store: never show the browser's saved copy.
export function getDashboard() {
  return apiFetch<DashboardSummary>('/dashboard', { cache: 'no-store' })
}
