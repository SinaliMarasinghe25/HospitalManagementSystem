using System.Text.Json;
using Hms.Api.Authorization;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Hms.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Hms.Api.Controllers;

// PDF section 6: Departments. Everyone who works with doctors can read the list; only Admin changes it.
[ApiController]
[Route("api/departments")]
[Authorize(Policy = Policies.ViewDoctors)]
public class DepartmentsController(DepartmentService departments, AuditService audit, UserManager<AppUser> userManager)
    : ControllerBase
{
    // GET /api/departments?includeInactive=true
    [HttpGet]
    public Task<List<DepartmentResponse>> List(bool includeInactive = false) => departments.ListAsync(includeInactive);

    // POST /api/departments
    [HttpPost]
    [Authorize(Policy = Policies.ManageDoctors)]
    public Task<ActionResult<DepartmentResponse>> Create(DepartmentRequest request) => Save(null, request);

    // PUT /api/departments/3
    [HttpPut("{id:int}")]
    [Authorize(Policy = Policies.ManageDoctors)]
    public Task<ActionResult<DepartmentResponse>> Update(int id, DepartmentRequest request) => Save(id, request);

    private async Task<ActionResult<DepartmentResponse>> Save(int? id, DepartmentRequest request)
    {
        var result = await departments.SaveAsync(id, request);
        if (result.IsNotFound)
        {
            return NotFound();
        }
        if (!result.Succeeded)
        {
            return this.ValidationErrors(result.Errors);
        }

        await audit.LogAsync(id is null ? AuditAction.Create : AuditAction.Update, userManager.GetUserId(User),
            User.Identity?.Name, "Department", result.Value!.Id.ToString(), JsonSerializer.Serialize(request));
        return result.Value!;
    }
}
