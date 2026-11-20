using Hms.Api.Data;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Hms.Api.Services;

// Business logic for PDF 3.6 Laboratory Management.
// A request moves Requested -> SampleCollected -> Completed. A doctor can cancel it while it is still Requested.
public class LabService(AppDbContext db)
{
    private const int MaxRangeDays = 62;

    // ---------- Test catalogue ----------

    public Task<List<LabTestResponse>> ListTestsAsync(bool includeInactive) =>
        db.LabTests.AsNoTracking()
            .Where(t => includeInactive || t.IsActive)
            .OrderBy(t => t.Name)
            .Select(t => new LabTestResponse(t.Id, t.Code, t.Name, t.Price, t.Unit, t.ReferenceRange, t.IsActive))
            .ToListAsync();

    public async Task<ServiceResult<int>> SaveTestAsync(int? id, LabTestRequest request)
    {
        var test = id is null ? new LabTest() : await db.LabTests.FindAsync(id.Value);
        if (test is null) return ServiceResult<int>.NotFound();

        var code = request.Code.Trim().ToUpperInvariant();
        if (await db.LabTests.AnyAsync(t => t.Code == code && t.Id != id))
        {
            return Invalid("Code", "Another test already uses this code.");
        }

        test.Code = code;
        test.Name = request.Name.Trim();
        test.Price = request.Price;
        test.Unit = Normalize(request.Unit);
        test.ReferenceRange = Normalize(request.ReferenceRange);
        test.IsActive = request.IsActive;
        if (id is null) db.LabTests.Add(test);
        await db.SaveChangesAsync();
        return ServiceResult<int>.Ok(test.Id);
    }

    // ---------- Reading requests ----------

    // The lab queue and history. Without a patient, a date range (hospital days) keeps the list small.
    // Open requests (Requested, SampleCollected) are always shown, whatever their date, so nothing is forgotten.
    public async Task<ServiceResult<List<LabRequestResponse>>> ListAsync(
        LabRequestStatus? status, DateOnly? fromDate, DateOnly? toDate, int? patientId, int? medicalRecordId)
    {
        var query = db.LabRequests.AsNoTracking();
        if (patientId is not null) query = query.Where(r => r.PatientId == patientId);
        if (medicalRecordId is not null) query = query.Where(r => r.MedicalRecordId == medicalRecordId);
        if (status is not null) query = query.Where(r => r.Status == status);

        var isOpenQueue = status is LabRequestStatus.Requested or LabRequestStatus.SampleCollected;
        if (patientId is null && medicalRecordId is null && !isOpenQueue)
        {
            var to = toDate ?? HospitalTime.Today;
            var from = fromDate ?? to.AddDays(-6);
            if (to < from || to.DayNumber - from.DayNumber > MaxRangeDays)
            {
                return ServiceResult<List<LabRequestResponse>>.Invalid(new()
                {
                    ["ToDate"] = [$"The end date must be on or after the start date, and at most {MaxRangeDays} days later."]
                });
            }
            var fromUtc = HospitalTime.ToUtc(from, TimeOnly.MinValue);
            var toUtc = HospitalTime.ToUtc(to.AddDays(1), TimeOnly.MinValue);
            query = query.Where(r => r.RequestedAt >= fromUtc && r.RequestedAt < toUtc);
        }

        var list = await Project(query.OrderByDescending(r => r.RequestedAt).Take(500)).ToListAsync();
        return ServiceResult<List<LabRequestResponse>>.Ok(list);
    }

    public Task<LabRequestResponse?> GetAsync(int id) =>
        Project(db.LabRequests.AsNoTracking().Where(r => r.Id == id)).FirstOrDefaultAsync();

    public Task<int> CountOpenAsync() =>
        db.LabRequests.CountAsync(r => r.Status == LabRequestStatus.Requested || r.Status == LabRequestStatus.SampleCollected);

    public Task<int?> DoctorIdForUserAsync(string? userId) =>
        db.Doctors.Where(d => d.Employee.UserId == userId).Select(d => (int?)d.Id).FirstOrDefaultAsync();

    // ---------- FR-LAB-01 Test requests (doctor) ----------

    public async Task<ServiceResult<List<int>>> CreateAsync(CreateLabRequests request, int? myDoctorId)
    {
        var errors = new Dictionary<string, string[]>();
        if (myDoctorId is null)
        {
            return ServiceResult<List<int>>.Invalid(new() { ["DoctorId"] = ["Only a doctor with a doctor profile can request tests."] });
        }
        if (!await db.Patients.AnyAsync(p => p.Id == request.PatientId))
        {
            errors["PatientId"] = ["Choose a patient."];
        }
        if (request.MedicalRecordId is not null)
        {
            var record = await db.MedicalRecords.AsNoTracking().FirstOrDefaultAsync(m => m.Id == request.MedicalRecordId);
            if (record is null || record.PatientId != request.PatientId)
            {
                errors["MedicalRecordId"] = ["The visit does not belong to this patient."];
            }
            else if (record.DoctorId != myDoctorId)
            {
                errors["MedicalRecordId"] = ["Only the doctor who wrote this visit can order tests on it."];
            }
        }

        var testIds = request.LabTestIds.Distinct().ToList();
        var activeTests = await db.LabTests.CountAsync(t => testIds.Contains(t.Id) && t.IsActive);
        if (activeTests != testIds.Count)
        {
            errors["LabTestIds"] = ["Choose tests from the catalogue."];
        }
        if (errors.Count > 0) return ServiceResult<List<int>>.Invalid(errors);

        // All tests are saved together, or none.
        await using var transaction = await db.Database.BeginTransactionAsync();
        var created = new List<LabRequest>();
        foreach (var testId in testIds)
        {
            var next = await db.Database.SqlQuery<long>($"SELECT nextval('\"LabRequestNumbers\"') AS \"Value\"").SingleAsync();
            created.Add(new LabRequest
            {
                RequestNumber = $"LAB-{next:D6}",
                PatientId = request.PatientId!.Value,
                LabTestId = testId,
                RequestedByDoctorId = myDoctorId.Value,
                MedicalRecordId = request.MedicalRecordId,
                Status = LabRequestStatus.Requested,
                RequestedAt = DateTime.UtcNow,
            });
        }
        db.LabRequests.AddRange(created);
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return ServiceResult<List<int>>.Ok(created.Select(c => c.Id).ToList());
    }

    public async Task<ServiceResult<int>> CancelAsync(int id, int? myDoctorId)
    {
        var lab = await db.LabRequests.FirstOrDefaultAsync(r => r.Id == id);
        if (lab is null) return ServiceResult<int>.NotFound();
        if (lab.RequestedByDoctorId != myDoctorId)
        {
            return Invalid("Status", "Only the doctor who requested this test can cancel it.");
        }
        if (lab.Status != LabRequestStatus.Requested)
        {
            return Invalid("Status", $"Only a test that is still waiting for a sample can be cancelled. This one is {lab.Status}.");
        }
        lab.Status = LabRequestStatus.Cancelled;
        await db.SaveChangesAsync();
        return ServiceResult<int>.Ok(id);
    }

    // ---------- FR-LAB-02 Sample collection (lab staff) ----------

    public async Task<ServiceResult<int>> CollectSampleAsync(int id, string sampleId, string? userId)
    {
        var lab = await db.LabRequests.FirstOrDefaultAsync(r => r.Id == id);
        if (lab is null) return ServiceResult<int>.NotFound();
        if (lab.Status != LabRequestStatus.Requested)
        {
            return Invalid("Status", $"A sample can only be recorded for a test that is waiting for one. This one is {lab.Status}.");
        }

        var label = sampleId.Trim().ToUpperInvariant();
        if (await db.LabRequests.AnyAsync(r => r.SampleId == label))
        {
            return Invalid("SampleId", "This sample ID is already used. Each tube needs its own ID.");
        }

        lab.SampleId = label;
        lab.SampleCollectedAt = DateTime.UtcNow;
        lab.CollectedByUserId = userId;
        lab.Status = LabRequestStatus.SampleCollected;
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return Invalid("SampleId", "This sample ID was just used for another test.");
        }
        return ServiceResult<int>.Ok(id);
    }

    // ---------- FR-LAB-03 Result entry (lab staff) ----------
    // A result can be entered once the sample is collected, and corrected later; every change is in the audit log.
    public async Task<ServiceResult<bool>> EnterResultAsync(int id, LabResultRequest request, string? userId)
    {
        var lab = await db.LabRequests.FirstOrDefaultAsync(r => r.Id == id);
        if (lab is null) return ServiceResult<bool>.NotFound();
        if (lab.Status is not (LabRequestStatus.SampleCollected or LabRequestStatus.Completed))
        {
            return ServiceResult<bool>.Invalid(new()
            {
                ["Status"] = [$"Record the sample first. This test is {lab.Status}."]
            });
        }

        var isCorrection = lab.Status == LabRequestStatus.Completed;
        lab.ResultValue = request.ResultValue.Trim();
        lab.ResultNotes = Normalize(request.ResultNotes);
        lab.IsAbnormal = request.IsAbnormal;
        lab.ResultEnteredAt = DateTime.UtcNow;
        lab.ResultEnteredByUserId = userId;
        lab.Status = LabRequestStatus.Completed;
        await db.SaveChangesAsync();
        return ServiceResult<bool>.Ok(isCorrection);
    }

    // ---------- Helpers ----------

    private IQueryable<LabRequestResponse> Project(IQueryable<LabRequest> query) =>
        query.Select(r => new LabRequestResponse(
            r.Id, r.RequestNumber, r.PatientId, r.Patient.PatientNumber,
            r.Patient.FirstName + " " + r.Patient.LastName, r.Patient.DateOfBirth, r.Patient.Gender,
            r.LabTestId, r.LabTest.Code, r.LabTest.Name, r.LabTest.Unit, r.LabTest.ReferenceRange,
            r.RequestedByDoctorId,
            r.RequestedByDoctor.Employee.FirstName + " " + r.RequestedByDoctor.Employee.LastName,
            r.MedicalRecordId, r.Status, r.RequestedAt, r.SampleId, r.SampleCollectedAt,
            db.Users.Where(u => u.Id == r.CollectedByUserId).Select(u => u.UserName).FirstOrDefault(),
            r.ResultValue, r.ResultNotes, r.IsAbnormal, r.ResultEnteredAt,
            db.Users.Where(u => u.Id == r.ResultEnteredByUserId).Select(u => u.UserName).FirstOrDefault()));

    private static ServiceResult<int> Invalid(string field, string message) =>
        ServiceResult<int>.Invalid(new() { [field] = [message] });

    private static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
