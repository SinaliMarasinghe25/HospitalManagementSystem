using Hms.Api.Data;
using Hms.Api.Entities;

namespace Hms.Api.Services;

// Writes one row to AuditLogs (PDF sections 4 and 10: Audit Logs, Audit Trail).
public class AuditService(AppDbContext db, IHttpContextAccessor httpContextAccessor)
{
    public async Task LogAsync(
        AuditAction action,
        string? userId,
        string? userName,
        string? entityName = null,
        string? entityId = null,
        string? changesJson = null)
    {
        db.AuditLogs.Add(new AuditLog
        {
            Timestamp = DateTime.UtcNow,
            UserId = userId,
            UserName = userName,
            Action = action,
            EntityName = entityName,
            EntityId = entityId,
            Changes = changesJson,
            IpAddress = httpContextAccessor.HttpContext?.Connection.RemoteIpAddress?.ToString()
        });
        await db.SaveChangesAsync();
    }
}
