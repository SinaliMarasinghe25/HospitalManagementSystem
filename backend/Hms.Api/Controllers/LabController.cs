using Hms.Api.Authorization;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Hms.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Hms.Api.Controllers;

// PDF 3.6 Laboratory Management, following the role table:
// view Admin/Doctor/Nurse/Lab Staff; request and cancel: Doctor; collect samples and enter results: Lab Staff;
// test catalogue and prices: Admin. Receptionists, pharmacists and accountants get 403.
[ApiController]
[Route("api/lab")]
[Authorize(Policy = Policies.ViewLabRequests)]
public class LabController(LabService lab, DoctorService doctors, AuditService audit, UserManager<AppUser> userManager) : ControllerBase
{
    // ---------- Test catalogue ----------

    // GET /api/lab/tests
    [HttpGet("tests")]
    public Task<List<LabTestResponse>> Tests(bool includeInactive = false) => lab.ListTestsAsync(includeInactive);

    // POST /api/lab/tests    PUT /api/lab/tests/3
    [HttpPost("tests")]
    [Authorize(Policy = Policies.ManageLabTests)]
    public Task<ActionResult> CreateTest(LabTestRequest request) => SaveTest(null, request);

    [HttpPut("tests/{id:int}")]
    [Authorize(Policy = Policies.ManageLabTests)]
    public Task<ActionResult> UpdateTest(int id, LabTestRequest request) => SaveTest(id, request);

    private async Task<ActionResult> SaveTest(int? id, LabTestRequest request)
    {
        var result = await lab.SaveTestAsync(id, request);
        if (result.IsNotFound) return NotFound();
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);
        await audit.LogChangeAsync(id is null ? AuditAction.Create : AuditAction.Update, "LabTest", result.Value, request);
        return id is null ? StatusCode(StatusCodes.Status201Created, new { id = result.Value }) : NoContent();
    }

    // ---------- Requests ----------

    // GET /api/lab/requests?status=Requested            (the lab queue)
    // GET /api/lab/requests?fromDate=...&toDate=...      (history)   ?patientId=  ?medicalRecordId=
    // One page at a time: add &page=2 (20 rows unless pageSize says otherwise, at most 100).
    [HttpGet("requests")]
    public async Task<ActionResult<PagedResult<LabRequestResponse>>> List(
        LabRequestStatus? status, DateOnly? fromDate, DateOnly? toDate, int? patientId, int? medicalRecordId,
        int page = 1, int pageSize = Paging.DefaultPageSize)
    {
        var result = await lab.ListAsync(status, fromDate, toDate, patientId, medicalRecordId, page, pageSize);
        return result.Succeeded ? result.Value! : this.ValidationErrors(result.Errors);
    }

    // GET /api/lab/requests/5   (also used by the printable lab report, FR-LAB-04)
    [HttpGet("requests/{id:int}")]
    public async Task<ActionResult<LabRequestResponse>> Get(int id)
    {
        var request = await lab.GetAsync(id);
        if (request is null) return NotFound();
        await audit.LogChangeAsync(AuditAction.View, "LabRequest", id, null);
        return request;
    }

    // POST /api/lab/requests   (doctor orders one or more tests)
    [HttpPost("requests")]
    [Authorize(Policy = Policies.RequestLabTests)]
    public async Task<ActionResult<List<int>>> Create(CreateLabRequests request)
    {
        var result = await lab.CreateAsync(request, await MyDoctorIdAsync());
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);
        foreach (var id in result.Value!)
        {
            await audit.LogChangeAsync(AuditAction.Create, "LabRequest", id, new { request.PatientId, request.MedicalRecordId });
        }
        return StatusCode(StatusCodes.Status201Created, result.Value);
    }

    // POST /api/lab/requests/5/cancel
    [HttpPost("requests/{id:int}/cancel")]
    [Authorize(Policy = Policies.RequestLabTests)]
    public async Task<ActionResult<LabRequestResponse>> Cancel(int id)
    {
        var result = await lab.CancelAsync(id, await MyDoctorIdAsync());
        return await Finish(result, id, new { Status = LabRequestStatus.Cancelled });
    }

    // POST /api/lab/requests/5/sample
    [HttpPost("requests/{id:int}/sample")]
    [Authorize(Policy = Policies.ProcessLabRequests)]
    public async Task<ActionResult<LabRequestResponse>> CollectSample(int id, CollectSampleRequest request)
    {
        var result = await lab.CollectSampleAsync(id, request.SampleId, userManager.GetUserId(User));
        return await Finish(result, id, new { Status = LabRequestStatus.SampleCollected, request.SampleId });
    }

    // PUT /api/lab/requests/5/result
    [HttpPut("requests/{id:int}/result")]
    [Authorize(Policy = Policies.ProcessLabRequests)]
    public async Task<ActionResult<LabRequestResponse>> EnterResult(int id, LabResultRequest request)
    {
        var result = await lab.EnterResultAsync(id, request, userManager.GetUserId(User));
        if (result.IsNotFound) return NotFound();
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);

        // Result values are clinical data: the audit log records that a result was entered or corrected, not the value.
        await audit.LogChangeAsync(AuditAction.Update, "LabRequest", id,
            new { Status = LabRequestStatus.Completed, Correction = result.Value });
        return (await lab.GetAsync(id))!;
    }

    private async Task<ActionResult<LabRequestResponse>> Finish(ServiceResult<int> result, int id, object changes)
    {
        if (result.IsNotFound) return NotFound();
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);
        await audit.LogChangeAsync(AuditAction.Update, "LabRequest", id, changes);
        return (await lab.GetAsync(id))!;
    }

    private async Task<int?> MyDoctorIdAsync() =>
        User.IsInRole(Roles.Doctor) ? await doctors.DoctorIdForUserAsync(userManager.GetUserId(User)) : null;
}
