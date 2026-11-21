using Hms.Api.Authorization;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Hms.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Hms.Api.Controllers;

// PDF 3.2 Patient Management and section 7 Patient Screen.
[ApiController]
[Route("api/patients")]
[Authorize(Policy = Policies.ViewPatients)]
public class PatientsController(
    PatientService patients,
    PatientDocumentService documents,
    AuditService audit,
    UserManager<AppUser> userManager) : ControllerBase
{
    // GET /api/patients?search=perera&page=1&pageSize=20   (Search Patient)
    [HttpGet]
    public Task<PagedResult<PatientSummary>> Search(string? search, int page = 1, int pageSize = 20) =>
        patients.SearchAsync(search, page, pageSize);

    // GET /api/patients/5
    [HttpGet("{id:int}")]
    public async Task<ActionResult<PatientDetail>> Get(int id)
    {
        var patient = await patients.GetAsync(id);
        return patient is null ? NotFound() : patient;
    }

    // POST /api/patients   (Register Patient)
    [HttpPost]
    [Authorize(Policy = Policies.EditPatients)]
    public async Task<ActionResult<PatientDetail>> Create(PatientRequest request)
    {
        var result = await patients.CreateAsync(request);
        if (!result.Succeeded)
        {
            return ToError(result);
        }

        await Audit(AuditAction.Create, result.Value!.Id, request);
        return CreatedAtAction(nameof(Get), new { id = result.Value.Id }, result.Value);
    }

    // PUT /api/patients/5   (Update Patient Information)
    [HttpPut("{id:int}")]
    [Authorize(Policy = Policies.EditPatients)]
    public async Task<ActionResult<PatientDetail>> Update(int id, PatientRequest request)
    {
        var result = await patients.UpdateAsync(id, request);
        if (!result.Succeeded)
        {
            return ToError(result);
        }

        await Audit(AuditAction.Update, id, request);
        return result.Value!;
    }

    // GET /api/patients/5/history   (View Medical History) - clinical roles only, and every view is audited.
    [HttpGet("{id:int}/history")]
    [Authorize(Policy = Policies.ViewMedicalHistory)]
    public async Task<ActionResult<MedicalHistoryResponse>> History(int id)
    {
        var history = await patients.GetHistoryAsync(id);
        if (history is null)
        {
            return NotFound();
        }

        await Audit(AuditAction.View, id, null, "MedicalHistory");
        return history;
    }

    // GET /api/patients/5/documents
    [HttpGet("{id:int}/documents")]
    [Authorize(Policy = Policies.ViewPatientDocuments)]
    public Task<List<PatientDocumentResponse>> ListDocuments(int id) => documents.ListAsync(id);

    // POST /api/patients/5/documents   (Upload Documents) - sent as multipart/form-data
    [HttpPost("{id:int}/documents")]
    [Authorize(Policy = Policies.UploadPatientDocuments)]
    [RequestSizeLimit(PatientDocumentService.MaxFileBytes + 1024 * 1024)]
    public async Task<ActionResult<PatientDocumentResponse>> Upload(int id, IFormFile file, [FromForm] string? description)
    {
        var result = await documents.UploadAsync(id, file, description, userManager.GetUserId(User));
        if (!result.Succeeded)
        {
            return ToError(result);
        }

        await audit.LogChangeAsync(AuditAction.Create, "PatientDocument", result.Value!.Id, new { patientId = id, result.Value.FileName });
        return result.Value;
    }

    // GET /api/patients/5/documents/3   - download
    [HttpGet("{id:int}/documents/{documentId:int}")]
    [Authorize(Policy = Policies.ViewPatientDocuments)]
    public async Task<IActionResult> Download(int id, int documentId)
    {
        var opened = await documents.OpenAsync(id, documentId);
        if (opened is null)
        {
            return NotFound();
        }

        await audit.LogChangeAsync(AuditAction.View, "PatientDocument", documentId, new { patientId = id });
        return File(opened.Value.Content, opened.Value.Document.ContentType, opened.Value.Document.FileName);
    }

    private Task Audit(AuditAction action, int patientId, PatientRequest? request, string entity = "Patient") =>
        audit.LogChangeAsync(action, entity, patientId, request);

    private ActionResult ToError<T>(ServiceResult<T> result)
    {
        if (result.IsNotFound)
        {
            return NotFound();
        }
        foreach (var (field, messages) in result.Errors)
        {
            foreach (var message in messages)
            {
                ModelState.AddModelError(field, message);
            }
        }
        return ValidationProblem(ModelState);
    }
}
