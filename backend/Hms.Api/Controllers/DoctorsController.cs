using Hms.Api.Authorization;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Hms.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hms.Api.Controllers;

// PDF 3.3 Doctor Management. Reading: Admin, Doctor, Nurse, Receptionist. Schedule: Admin only.
// Adding a doctor or changing their details is done on the Staff page (POST/PUT /api/staff/employees).
[ApiController]
[Route("api/doctors")]
[Authorize(Policy = Policies.ViewDoctors)]
public class DoctorsController(DoctorService doctors, AuditService audit) : ControllerBase
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

        await audit.LogChangeAsync(AuditAction.Update, "DoctorSchedule", id, request);
        return result.Value!;
    }
}
