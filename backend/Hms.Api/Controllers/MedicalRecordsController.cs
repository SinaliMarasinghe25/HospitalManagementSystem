using Hms.Api.Authorization;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Hms.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Hms.Api.Controllers;

// PDF 3.5 Electronic Medical Records.
// Reading: Admin, Doctor, Nurse (ViewMedicalHistory). Writing: the patient's own doctor only.
// Receptionists and other roles get 403, so diagnoses never reach them (ROLE-04).
[ApiController]
[Route("api/medical-records")]
[Authorize(Policy = Policies.ViewMedicalHistory)]
public class MedicalRecordsController(MedicalRecordService records, DoctorService doctors, AuditService audit, UserManager<AppUser> userManager)
    : ControllerBase
{
    // GET /api/medical-records?fromDate=2026-11-13&toDate=2026-11-19&patientId=1&doctorId=1&page=2
    // One page at a time (page 1 if left out, 20 rows unless pageSize says otherwise, at most 100).
    [HttpGet]
    public async Task<ActionResult<PagedResult<MedicalRecordSummary>>> List(
        DateOnly? fromDate, DateOnly? toDate, int? patientId, int? doctorId,
        int page = 1, int pageSize = Paging.DefaultPageSize)
    {
        var result = await records.ListAsync(fromDate, toDate, patientId, doctorId, page, pageSize);
        return result.Succeeded ? result.Value! : this.ValidationErrors(result.Errors);
    }

    // GET /api/medical-records/7   (also used by the printable medical report, FR-EMR-04)
    [HttpGet("{id:int}")]
    public async Task<ActionResult<MedicalRecordDetail>> Get(int id)
    {
        var record = await records.GetAsync(id, await MyDoctorIdAsync());
        if (record is null)
        {
            return NotFound();
        }

        // Assumption A18: every read of a medical record is logged with who read it.
        await Audit(AuditAction.View, id, null);
        return record;
    }

    // POST /api/medical-records   (doctor writes the visit: complaint, notes, diagnoses, treatments)
    [HttpPost]
    [Authorize(Policy = Policies.EditMedicalRecords)]
    public async Task<ActionResult<MedicalRecordDetail>> Create(MedicalRecordRequest request)
    {
        var myDoctorId = await MyDoctorIdAsync();
        var result = await records.CreateAsync(request, myDoctorId);
        if (!result.Succeeded)
        {
            return this.ValidationErrors(result.Errors);
        }

        await Audit(AuditAction.Create, result.Value, request);
        var created = await records.GetAsync(result.Value, myDoctorId);
        return CreatedAtAction(nameof(Get), new { id = result.Value }, created);
    }

    // PUT /api/medical-records/7
    [HttpPut("{id:int}")]
    [Authorize(Policy = Policies.EditMedicalRecords)]
    public async Task<ActionResult<MedicalRecordDetail>> Update(int id, MedicalRecordRequest request)
    {
        var myDoctorId = await MyDoctorIdAsync();
        var result = await records.UpdateAsync(id, request, myDoctorId);
        if (result.IsNotFound) return NotFound();
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);

        await Audit(AuditAction.Update, id, request with { AppointmentId = null });
        return (await records.GetAsync(id, myDoctorId))!;
    }

    // POST /api/medical-records/7/prescriptions
    [HttpPost("{id:int}/prescriptions")]
    [Authorize(Policy = Policies.EditMedicalRecords)]
    public async Task<ActionResult<PrescriptionResponse>> Prescribe(int id, PrescriptionRequest request)
    {
        var result = await records.AddPrescriptionAsync(id, request, await MyDoctorIdAsync());
        if (result.IsNotFound) return NotFound();
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);

        await audit.LogChangeAsync(AuditAction.Create, "Prescription", result.Value!.Id, request);
        return result.Value;
    }

    private async Task<int?> MyDoctorIdAsync() =>
        User.IsInRole(Roles.Doctor) ? await doctors.DoctorIdForUserAsync(userManager.GetUserId(User)) : null;

    private Task Audit(AuditAction action, int recordId, object? changes) =>
        audit.LogChangeAsync(action, "MedicalRecord", recordId, changes);
}
