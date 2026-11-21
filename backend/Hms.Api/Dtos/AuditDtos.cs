using Hms.Api.Entities;

namespace Hms.Api.Dtos;

// GET /api/audit-log?fromDate=2026-11-01&toDate=2026-11-21&user=admin&action=Update&entityName=Patient&entityId=5&page=1
// Every filter is optional. Dates are hospital days, both inclusive.
public record AuditLogQuery(
    DateOnly? FromDate,
    DateOnly? ToDate,
    string? User,
    AuditAction? Action,
    string? EntityName,
    string? EntityId,
    int Page = 1,
    int PageSize = 50);

// One row of the audit log. "Changes" is the JSON that was saved with it (never a password).
public record AuditLogEntry(
    long Id,
    DateTime Timestamp,
    string? UserName,
    AuditAction Action,
    string? EntityName,
    string? EntityId,
    string? Changes,
    string? IpAddress);
