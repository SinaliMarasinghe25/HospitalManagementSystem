import type { PagedResult } from './paged'

// Matches AuditDtos.cs in the API.
export type AuditAction = 'Login' | 'LoginFailed' | 'Logout' | 'Create' | 'Update' | 'Delete' | 'View'

export const auditActionLabels: Record<AuditAction, string> = {
  Login: 'Logged in',
  LoginFailed: 'Failed login',
  Logout: 'Logged out',
  Create: 'Created',
  Update: 'Changed',
  Delete: 'Deleted',
  View: 'Viewed',
}

// Record types and changed fields are saved as code names: "MedicalRecord" -> "Medical record"
export function nameToWords(name: string) {
  const words = name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// "Patient 5", or just "Department" when no ID was saved.
export function recordLabel(entityName: string, entityId: string | null) {
  return entityId ? `${nameToWords(entityName)} ${entityId}` : nameToWords(entityName)
}

export type AuditLogEntry = {
  id: number
  timestamp: string
  userName: string | null
  action: AuditAction
  entityName: string | null
  entityId: string | null
  // The JSON saved with the entry, as text. Never contains a password.
  changes: string | null
  ipAddress: string | null
}

export type AuditLogPage = PagedResult<AuditLogEntry>

// The filters, as they appear in the address bar. Empty text means "any".
export type AuditLogFilter = {
  fromDate: string
  toDate: string
  user: string
  action: string
  entityName: string
  entityId: string
  page: string
}
