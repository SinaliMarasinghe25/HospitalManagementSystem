using System.Text.Json;
using Hms.Api.Authorization;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Hms.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Hms.Api.Controllers;

// Wards and beds. Everyone who works with admissions sees the bed board; only Admin changes wards and beds.
[ApiController]
[Route("api/wards")]
[Authorize(Policy = Policies.ViewAdmissions)]
public class WardsController(WardService wards, AuditService audit, UserManager<AppUser> userManager) : ControllerBase
{
    // GET /api/wards   (bed board)
    [HttpGet]
    public Task<List<WardResponse>> List() => wards.ListAsync();

    // POST /api/wards
    [HttpPost]
    [Authorize(Policy = Policies.ManageWards)]
    public async Task<ActionResult> Create(WardRequest request)
    {
        var result = await wards.CreateAsync(request);
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);
        await Audit(AuditAction.Create, "Ward", result.Value, request);
        return StatusCode(StatusCodes.Status201Created, new { id = result.Value });
    }

    // PUT /api/wards/2
    [HttpPut("{id:int}")]
    [Authorize(Policy = Policies.ManageWards)]
    public async Task<ActionResult> Update(int id, WardRequest request)
    {
        var result = await wards.UpdateAsync(id, request);
        if (result.IsNotFound) return NotFound();
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);
        await Audit(AuditAction.Update, "Ward", id, request);
        return NoContent();
    }

    // POST /api/wards/2/beds   body: { "prefix": "A-", "count": 6 }
    [HttpPost("{id:int}/beds")]
    [Authorize(Policy = Policies.ManageWards)]
    public async Task<ActionResult> AddBeds(int id, AddBedsRequest request)
    {
        var result = await wards.AddBedsAsync(id, request);
        if (result.IsNotFound) return NotFound();
        await Audit(AuditAction.Create, "Bed", id, request);
        return NoContent();
    }

    // PUT /api/wards/beds/7/status   body: { "isActive": false }
    [HttpPut("beds/{bedId:int}/status")]
    [Authorize(Policy = Policies.ManageWards)]
    public async Task<ActionResult> SetBedStatus(int bedId, BedStatusRequest request)
    {
        var result = await wards.SetBedStatusAsync(bedId, request.IsActive);
        if (result.IsNotFound) return NotFound();
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);
        await Audit(AuditAction.Update, "Bed", bedId, request);
        return NoContent();
    }

    private Task Audit(AuditAction action, string entity, int id, object changes) =>
        audit.LogAsync(action, userManager.GetUserId(User), User.Identity?.Name, entity, id.ToString(),
            JsonSerializer.Serialize(changes));
}
