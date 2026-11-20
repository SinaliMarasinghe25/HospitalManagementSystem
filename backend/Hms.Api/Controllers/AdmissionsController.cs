using Hms.Api.Authorization;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Hms.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Hms.Api.Controllers;

// Inpatient management (assumption A1), following the role table:
// view Admin/Doctor/Nurse/Receptionist; admit Admin/Doctor/Receptionist; transfer and vitals Admin/Doctor/Nurse;
// discharge Admin/Doctor. Vital signs and the discharge summary are clinical, so Receptionists never receive them.
[ApiController]
[Route("api/admissions")]
[Authorize(Policy = Policies.ViewAdmissions)]
public class AdmissionsController(AdmissionService admissions, AuditService audit, UserManager<AppUser> userManager)
    : ControllerBase
{
    // GET /api/admissions                      current inpatients
    // GET /api/admissions?status=Discharged&fromDate=2026-11-13&toDate=2026-11-19
    [HttpGet]
    public async Task<ActionResult<List<AdmissionSummary>>> List(
        AdmissionStatus? status, DateOnly? fromDate, DateOnly? toDate, int? wardId, int? patientId)
    {
        var result = await admissions.ListAsync(status, fromDate, toDate, wardId, patientId);
        return result.Succeeded ? result.Value! : this.ValidationErrors(result.Errors);
    }

    // GET /api/admissions/3
    [HttpGet("{id:int}")]
    public async Task<ActionResult<AdmissionDetail>> Get(int id)
    {
        var clinical = IsClinical();
        var admission = await admissions.GetAsync(id, clinical);
        if (admission is null) return NotFound();
        if (clinical) await Audit(AuditAction.View, id, null);
        return admission;
    }

    // POST /api/admissions   (admit a patient to a free bed)
    [HttpPost]
    [Authorize(Policy = Policies.AdmitPatients)]
    public async Task<ActionResult<AdmissionDetail>> Admit(AdmitRequest request)
    {
        var result = await admissions.AdmitAsync(request);
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);

        await Audit(AuditAction.Create, result.Value, request);
        return CreatedAtAction(nameof(Get), new { id = result.Value }, await admissions.GetAsync(result.Value, IsClinical()));
    }

    // POST /api/admissions/3/transfer
    [HttpPost("{id:int}/transfer")]
    [Authorize(Policy = Policies.TransferPatients)]
    public async Task<ActionResult<AdmissionDetail>> Transfer(int id, TransferRequest request)
    {
        var result = await admissions.TransferAsync(id, request, userManager.GetUserId(User));
        if (result.IsNotFound) return NotFound();
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);

        await Audit(AuditAction.Update, id, new { Action = "Transfer", request.ToBedId, request.Reason });
        return (await admissions.GetAsync(id, IsClinical()))!;
    }

    // POST /api/admissions/3/discharge
    [HttpPost("{id:int}/discharge")]
    [Authorize(Policy = Policies.DischargePatients)]
    public async Task<ActionResult<AdmissionDetail>> Discharge(int id, DischargeRequest request)
    {
        var result = await admissions.DischargeAsync(id, request.DischargeSummary);
        if (result.IsNotFound) return NotFound();
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);

        await Audit(AuditAction.Update, id, new { Action = "Discharge" });
        return (await admissions.GetAsync(id, IsClinical()))!;
    }

    // GET /api/admissions/3/vitals   (clinical roles only)
    [HttpGet("{id:int}/vitals")]
    [Authorize(Policy = Policies.ViewMedicalHistory)]
    public async Task<ActionResult<List<VitalSignResponse>>> Vitals(int id)
    {
        var list = await admissions.ListVitalsAsync(id);
        return list is null ? NotFound() : list;
    }

    // POST /api/admissions/3/vitals
    [HttpPost("{id:int}/vitals")]
    [Authorize(Policy = Policies.RecordVitals)]
    public async Task<ActionResult> AddVitals(int id, VitalSignRequest request)
    {
        var result = await admissions.AddVitalsAsync(id, request, userManager.GetUserId(User));
        if (result.IsNotFound) return NotFound();
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);

        await audit.LogChangeAsync(AuditAction.Create, "VitalSign", result.Value, new { AdmissionId = id });
        return StatusCode(StatusCodes.Status201Created, new { id = result.Value });
    }

    private bool IsClinical() =>
        User.IsInRole(Roles.Administrator) || User.IsInRole(Roles.Doctor) || User.IsInRole(Roles.Nurse);

    private Task Audit(AuditAction action, int id, object? changes) =>
        audit.LogChangeAsync(action, "Admission", id, changes);
}
