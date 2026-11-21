using Hms.Api.Authorization;
using Hms.Api.Dtos;
using Hms.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hms.Api.Controllers;

// PDF section 4 "Audit Logs" and section 10 "Audit Trail" (NFR-SEC-04, BR-04).
// Read-only on purpose: there is no endpoint to change or delete an audit row.
// The rows themselves are written by AuditService from the other controllers.
[ApiController]
[Route("api/audit-log")]
[Authorize(Policy = Policies.ViewAuditLog)]
public class AuditLogController(AuditService audit) : ControllerBase
{
    // GET /api/audit-log?fromDate=2026-11-01&toDate=2026-11-21&user=admin&action=Update&entityName=Patient&entityId=5&page=1
    [HttpGet]
    public async Task<ActionResult<PagedResult<AuditLogEntry>>> Search([FromQuery] AuditLogQuery query)
    {
        var result = await audit.SearchAsync(query);
        return result.Succeeded ? result.Value! : this.ValidationErrors(result.Errors);
    }

    // GET /api/audit-log/entity-names   (the record types that appear in the log, for the filter list)
    [HttpGet("entity-names")]
    public Task<List<string>> EntityNames() => audit.ListEntityNamesAsync();
}
