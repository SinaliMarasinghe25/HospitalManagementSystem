import type { AuditLogFilter, AuditLogPage } from '../types/audit'
import { apiFetch, queryString } from './client'

// One function per endpoint in AuditLogController.cs.

export function searchAuditLog(filter: AuditLogFilter) {
  return apiFetch<AuditLogPage>(`/audit-log?${queryString(filter)}`)
}

export function listAuditEntityNames() {
  return apiFetch<string[]>('/audit-log/entity-names')
}
