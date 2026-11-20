using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;
using Hms.Api.Data;
using Hms.Api.Entities;

namespace Hms.Api.Services;

// Writes one row to AuditLogs (PDF sections 4 and 10: Audit Logs, Audit Trail).
public class AuditService(AppDbContext db, IHttpContextAccessor httpContextAccessor)
{
    // Enums are written as names ("Cancelled"), not numbers, so the log is readable on its own.
    private static readonly JsonSerializerOptions Json = new() { Converters = { new JsonStringEnumConverter() } };

    // Logs a change made by the signed-in user. Every controller uses this one method, so the user,
    // time, IP address and JSON format are the same everywhere. Never pass passwords in "changes".
    public Task LogChangeAsync(AuditAction action, string entityName, object entityId, object? changes = null)
    {
        var user = httpContextAccessor.HttpContext?.User;
        return LogAsync(action, user?.FindFirstValue(ClaimTypes.NameIdentifier), user?.Identity?.Name,
            entityName, entityId.ToString(), changes is null ? null : JsonSerializer.Serialize(changes, Json));
    }

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
