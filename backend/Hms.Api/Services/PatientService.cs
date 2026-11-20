using Hms.Api.Data;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Services;

// Business logic for PDF 3.2 Patient Management. The controller handles HTTP;
// this class handles the rules and the database.
public class PatientService(AppDbContext db)
{
    public async Task<PagedResult<PatientSummary>> SearchAsync(string? search, int page, int pageSize)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var query = db.Patients.AsNoTracking();

        // Every word typed must match a name, the patient number, phone or NIC.
        // "kamal pere" finds Kamal Perera. ILIKE is PostgreSQL's case-insensitive LIKE.
        // EF Core sends the words as parameters, so this is safe from SQL injection.
        var words = (search ?? string.Empty).Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var word in words.Take(5))
        {
            var pattern = $"%{EscapeLike(word)}%";
            query = query.Where(p =>
                EF.Functions.ILike(p.FirstName, pattern, "\\") ||
                EF.Functions.ILike(p.LastName, pattern, "\\") ||
                EF.Functions.ILike(p.PatientNumber, pattern, "\\") ||
                EF.Functions.ILike(p.Phone, pattern, "\\") ||
                (p.NationalId != null && EF.Functions.ILike(p.NationalId, pattern, "\\")));
        }

        var total = await query.CountAsync();
        var items = await query
            .OrderBy(p => p.LastName).ThenBy(p => p.FirstName).ThenBy(p => p.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new PatientSummary(p.Id, p.PatientNumber, p.FirstName, p.LastName,
                p.DateOfBirth, p.Gender, p.Phone, p.NationalId))
            .ToListAsync();

        return new PagedResult<PatientSummary>(items, page, pageSize, total);
    }

    public async Task<PatientDetail?> GetAsync(int id) =>
        await db.Patients.AsNoTracking()
            .Where(p => p.Id == id)
            .Select(p => ToDetail(p))
            .FirstOrDefaultAsync();

    public async Task<ServiceResult<PatientDetail>> CreateAsync(PatientRequest request)
    {
        var errors = await ValidateAsync(request, existingId: null);
        if (errors.Count > 0)
        {
            return ServiceResult<PatientDetail>.Invalid(errors);
        }

        var patient = new Patient { CreatedAt = DateTime.UtcNow };
        Apply(patient, request);

        // P-000001, P-000002... from a PostgreSQL sequence, which never gives the same number twice,
        // even when two receptionists register patients at the same moment.
        var next = await db.Database
            .SqlQuery<long>($"SELECT nextval('\"PatientNumbers\"') AS \"Value\"")
            .SingleAsync();
        patient.PatientNumber = $"P-{next:D6}";

        db.Patients.Add(patient);
        await db.SaveChangesAsync();
        return ServiceResult<PatientDetail>.Ok(ToDetail(patient));
    }

    public async Task<ServiceResult<PatientDetail>> UpdateAsync(int id, PatientRequest request)
    {
        var patient = await db.Patients.FindAsync(id);
        if (patient is null)
        {
            return ServiceResult<PatientDetail>.NotFound();
        }

        var errors = await ValidateAsync(request, existingId: id);
        if (errors.Count > 0)
        {
            return ServiceResult<PatientDetail>.Invalid(errors);
        }

        Apply(patient, request);
        patient.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return ServiceResult<PatientDetail>.Ok(ToDetail(patient));
    }

    public async Task<MedicalHistoryResponse?> GetHistoryAsync(int patientId)
    {
        if (!await db.Patients.AnyAsync(p => p.Id == patientId))
        {
            return null;
        }

        var visits = await db.MedicalRecords.AsNoTracking()
            .Where(m => m.PatientId == patientId)
            .OrderByDescending(m => m.VisitDate)
            .Select(m => new VisitHistoryItem(
                m.Id,
                m.VisitDate,
                m.Doctor.Employee.FirstName + " " + m.Doctor.Employee.LastName,
                m.ChiefComplaint,
                m.Diagnoses.Select(d => d.Code == null ? d.Description : d.Code + " " + d.Description).ToList(),
                m.Treatments.Select(t => t.Description).ToList(),
                // Cancelled prescriptions were never given to the patient, so they are left out.
                m.Prescriptions.Where(p => p.Status != PrescriptionStatus.Cancelled).SelectMany(p => p.Items)
                    .Select(i => i.Medicine.Name + " " + i.Medicine.Strength + ", " + i.Dosage + ", " + i.Frequency + ", " + i.DurationDays + " days")
                    .ToList()))
            .ToListAsync();

        var labResults = await db.LabRequests.AsNoTracking()
            .Where(l => l.PatientId == patientId && l.Status != LabRequestStatus.Cancelled)
            .OrderByDescending(l => l.RequestedAt)
            .Select(l => new LabResultHistoryItem(l.Id, l.LabTest.Name, l.Status, l.RequestedAt,
                l.ResultValue, l.LabTest.Unit, l.LabTest.ReferenceRange, l.IsAbnormal))
            .ToListAsync();

        var admissions = await db.Admissions.AsNoTracking()
            .Where(a => a.PatientId == patientId)
            .OrderByDescending(a => a.AdmittedAt)
            .Select(a => new AdmissionHistoryItem(a.Id, a.AdmissionNumber, a.Bed.Ward.Name, a.Bed.BedNumber,
                a.AdmittedAt, a.DischargedAt, a.AdmissionReason))
            .ToListAsync();

        return new MedicalHistoryResponse(visits, labResults, admissions);
    }

    private async Task<Dictionary<string, string[]>> ValidateAsync(PatientRequest request, int? existingId)
    {
        var errors = new Dictionary<string, string[]>();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        if (request.DateOfBirth > today)
        {
            errors[nameof(request.DateOfBirth)] = ["Date of birth cannot be in the future."];
        }
        else if (request.DateOfBirth < today.AddYears(-130))
        {
            errors[nameof(request.DateOfBirth)] = ["Date of birth is too far in the past."];
        }

        var nic = Normalize(request.NationalId)?.ToUpperInvariant();
        if (nic is not null && await db.Patients.AnyAsync(p => p.NationalId == nic && p.Id != existingId))
        {
            errors[nameof(request.NationalId)] = ["Another patient already has this NIC."];
        }

        return errors;
    }

    private static void Apply(Patient patient, PatientRequest request)
    {
        patient.FirstName = request.FirstName.Trim();
        patient.LastName = request.LastName.Trim();
        patient.DateOfBirth = request.DateOfBirth!.Value;
        patient.Gender = request.Gender!.Value;
        patient.NationalId = Normalize(request.NationalId)?.ToUpperInvariant();
        patient.Phone = request.Phone.Trim();
        patient.Email = Normalize(request.Email);
        patient.Address = Normalize(request.Address);
        patient.BloodGroup = Normalize(request.BloodGroup);
        patient.Allergies = Normalize(request.Allergies);
        patient.EmergencyContactName = Normalize(request.EmergencyContactName);
        patient.EmergencyContactPhone = Normalize(request.EmergencyContactPhone);
    }

    // Empty text boxes are stored as NULL, not as "".
    private static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string EscapeLike(string value) =>
        value.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");

    private static PatientDetail ToDetail(Patient p) => new(
        p.Id, p.PatientNumber, p.FirstName, p.LastName, p.DateOfBirth, p.Gender, p.NationalId,
        p.Phone, p.Email, p.Address, p.BloodGroup, p.Allergies, p.EmergencyContactName,
        p.EmergencyContactPhone, p.CreatedAt, p.UpdatedAt);
}
