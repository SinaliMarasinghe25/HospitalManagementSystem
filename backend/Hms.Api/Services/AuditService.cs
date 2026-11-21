using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;
using Hms.Api.Data;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Services;

// Writes and reads AuditLogs (PDF sections 4 and 10: Audit Logs, Audit Trail).
// Rows are only ever added: there is no code anywhere that changes or deletes one (assumption BR-04).
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

    // ---------- Reading (the Audit Log page, administrators only) ----------

    public const int MaxPageSize = 100;

    // Newest first. Filters are combined with AND; "user" and "entityId" match part of the text, any case.
    public async Task<ServiceResult<PagedResult<AuditLogEntry>>> SearchAsync(AuditLogQuery filter)
    {
        if (filter.FromDate is { } from && filter.ToDate is { } to && to < from)
        {
            return ServiceResult<PagedResult<AuditLogEntry>>.Invalid(
                new() { ["ToDate"] = ["The end date must be on or after the start date."] });
        }

        var page = Math.Max(filter.Page, 1);
        var pageSize = Math.Clamp(filter.PageSize, 1, MaxPageSize);
        var query = db.AuditLogs.AsNoTracking();

        if (filter.FromDate is { } fromDate)
        {
            var fromUtc = HospitalTime.DaysToUtc(fromDate, fromDate).FromUtc;
            query = query.Where(a => a.Timestamp >= fromUtc);
        }
        if (filter.ToDate is { } toDate)
        {
            var toUtc = HospitalTime.DaysToUtc(toDate, toDate).ToUtc;
            query = query.Where(a => a.Timestamp < toUtc);
        }
        if (!string.IsNullOrWhiteSpace(filter.User))
        {
            var pattern = SearchText.Contains(filter.User);
            query = query.Where(a => a.UserName != null && EF.Functions.ILike(a.UserName, pattern, "\\"));
        }
        if (filter.Action is { } action)
        {
            query = query.Where(a => a.Action == action);
        }
        if (!string.IsNullOrWhiteSpace(filter.EntityName))
        {
            query = query.Where(a => a.EntityName == filter.EntityName);
        }
        if (!string.IsNullOrWhiteSpace(filter.EntityId))
        {
            // Exact match, so "Patient 5" does not also show patients 15 and 50.
            var entityId = filter.EntityId.Trim();
            query = query.Where(a => a.EntityId == entityId);
        }

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(a => a.Timestamp).ThenByDescending(a => a.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new AuditLogEntry(a.Id, a.Timestamp, a.UserName, a.Action, a.EntityName, a.EntityId,
                a.Changes, a.IpAddress))
            .ToListAsync();

        return ServiceResult<PagedResult<AuditLogEntry>>.Ok(new PagedResult<AuditLogEntry>(items, page, pageSize, total));
    }

    // The kinds of record that appear in the log ("Appointment", "Patient", ...), for the page's filter list.
    public Task<List<string>> ListEntityNamesAsync() =>
        db.AuditLogs.AsNoTracking()
            .Where(a => a.EntityName != null)
            .Select(a => a.EntityName!)
            .Distinct()
            .OrderBy(name => name)
            .ToListAsync();
}
