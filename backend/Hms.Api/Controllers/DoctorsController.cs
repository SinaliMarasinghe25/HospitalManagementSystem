using System.Text.Json;
using Hms.Api.Authorization;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Hms.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Hms.Api.Controllers;

// PDF 3.3 Doctor Management. Reading: Admin, Doctor, Nurse, Receptionist. Changing: Admin only.
[ApiController]
[Route("api/doctors")]
[Authorize(Policy = Policies.ViewDoctors)]
public class DoctorsController(DoctorService doctors, AuditService audit, UserManager<AppUser> userManager)
    : ControllerBase
{
    // GET /api/doctors?departmentId=2&search=card
    [HttpGet]
    public Task<List<DoctorSummary>> List(int? departmentId, string? search, bool includeInactive = false) =>
        doctors.ListAsync(departmentId, search, includeInactive);

    // GET /api/doctors/4
    [HttpGet("{id:int}")]
    public async Task<ActionResult<DoctorDetail>> Get(int id)
    {
        var doctor = await doctors.GetAsync(id);
        return doctor is null ? NotFound() : doctor;
    }

    // POST /api/doctors   (Add Doctor)
    [HttpPost]
    [Authorize(Policy = Policies.ManageDoctors)]
    public async Task<ActionResult<DoctorDetail>> Create(DoctorRequest request)
    {
        var result = await doctors.CreateAsync(request);
        if (!result.Succeeded)
        {
            return this.ValidationErrors(result.Errors);
        }

        // Never write the password into the audit log.
        await Audit(AuditAction.Create, result.Value!.Id, request with { Password = null });
        return CreatedAtAction(nameof(Get), new { id = result.Value.Id }, result.Value);
    }

    // PUT /api/doctors/4   (Update Doctor Details, Department Assignment)
    [HttpPut("{id:int}")]
    [Authorize(Policy = Policies.ManageDoctors)]
    public async Task<ActionResult<DoctorDetail>> Update(int id, DoctorRequest request)
    {
        var result = await doctors.UpdateAsync(id, request with { UserName = null, Password = null });
        if (result.IsNotFound)
        {
            return NotFound();
        }
        if (!result.Succeeded)
        {
            return this.ValidationErrors(result.Errors);
        }

        await Audit(AuditAction.Update, id, request with { Password = null });
        return result.Value!;
    }

    // PUT /api/doctors/4/schedule   (Schedule Management)
    [HttpPut("{id:int}/schedule")]
    [Authorize(Policy = Policies.ManageDoctors)]
    public async Task<ActionResult<DoctorDetail>> SetSchedule(int id, ScheduleRequest request)
    {
        var result = await doctors.SetScheduleAsync(id, request.Items);
        if (result.IsNotFound)
        {
            return NotFound();
        }
        if (!result.Succeeded)
        {
            return this.ValidationErrors(result.Errors);
        }

        await Audit(AuditAction.Update, id, request, "DoctorSchedule");
        return result.Value!;
    }

    private Task Audit(AuditAction action, int doctorId, object changes, string entity = "Doctor") =>
        audit.LogAsync(action, userManager.GetUserId(User), User.Identity?.Name, entity, doctorId.ToString(),
            JsonSerializer.Serialize(changes));
}
