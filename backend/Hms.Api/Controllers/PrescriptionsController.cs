using Hms.Api.Authorization;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Hms.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Hms.Api.Controllers;

// Prescriptions (FR-EMR-02). Admin, Doctor, Nurse and Pharmacist can read them;
// the pharmacy dispenses them through PharmacyController (FR-PH-02).
[ApiController]
[Route("api/prescriptions")]
[Authorize(Policy = Policies.ViewPrescriptions)]
public class PrescriptionsController(MedicalRecordService records, AuditService audit, UserManager<AppUser> userManager)
    : ControllerBase
{
    // GET /api/prescriptions?status=Dispensed     GET /api/prescriptions?open=true   (the pharmacy queue)
    [HttpGet]
    public Task<List<PrescriptionResponse>> List(PrescriptionStatus? status, int? patientId, bool open = false) =>
        records.ListPrescriptionsAsync(status, patientId, open);

    // GET /api/prescriptions/3
    [HttpGet("{id:int}")]
    public async Task<ActionResult<PrescriptionResponse>> Get(int id)
    {
        var prescription = await records.GetPrescriptionAsync(id);
        return prescription is null ? NotFound() : prescription;
    }

    // POST /api/prescriptions/3/cancel   (prescribing doctor, before dispensing starts)
    [HttpPost("{id:int}/cancel")]
    [Authorize(Policy = Policies.EditMedicalRecords)]
    public async Task<ActionResult<PrescriptionResponse>> Cancel(int id)
    {
        var userId = userManager.GetUserId(User);
        var result = await records.CancelPrescriptionAsync(id, await records.DoctorIdForUserAsync(userId));
        if (result.IsNotFound) return NotFound();
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);

        await audit.LogAsync(AuditAction.Update, userId, User.Identity?.Name, "Prescription", id.ToString(),
            """{"Status":"Cancelled"}""");
        return result.Value!;
    }
}

// The medicine list for the prescription form. Medicines are managed in PharmacyController.
[ApiController]
[Route("api/medicines")]
[Authorize(Policy = Policies.ViewPrescriptions)]
public class MedicinesController(MedicalRecordService records) : ControllerBase
{
    // GET /api/medicines?search=para
    [HttpGet]
    public Task<List<MedicineOption>> Search(string? search) => records.SearchMedicinesAsync(search);
}
