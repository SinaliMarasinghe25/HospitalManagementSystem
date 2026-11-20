using Hms.Api.Data;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Hms.Api.Services;

// Inpatient management (assumption A1): admit to a bed, transfer, vital signs and notes, discharge.
// Two rules are also enforced by the database (Step 8 partial unique indexes):
//   a bed holds one patient at a time, and a patient has only one active admission.
public class AdmissionService(AppDbContext db)
{
    private const int MaxRangeDays = 62;

    // ---------- Reading ----------

    // Current inpatients, or discharges in a date range (hospital days, inclusive).
    public async Task<ServiceResult<List<AdmissionSummary>>> ListAsync(
        AdmissionStatus? status, DateOnly? fromDate, DateOnly? toDate, int? wardId, int? patientId)
    {
        var query = db.Admissions.AsNoTracking();
        if (patientId is not null)
        {
            query = query.Where(a => a.PatientId == patientId);
        }
        else if (status == AdmissionStatus.Discharged)
        {
            var to = toDate ?? HospitalTime.Today;
            var from = fromDate ?? to.AddDays(-6);
            if (to < from || to.DayNumber - from.DayNumber > MaxRangeDays)
            {
                return ServiceResult<List<AdmissionSummary>>.Invalid(new()
                {
                    ["ToDate"] = [$"The end date must be on or after the start date, and at most {MaxRangeDays} days later."]
                });
            }
            var fromUtc = HospitalTime.ToUtc(from, TimeOnly.MinValue);
            var toUtc = HospitalTime.ToUtc(to.AddDays(1), TimeOnly.MinValue);
            query = query.Where(a => a.DischargedAt >= fromUtc && a.DischargedAt < toUtc);
        }
        else
        {
            query = query.Where(a => a.DischargedAt == null);
        }
        if (wardId is not null) query = query.Where(a => a.Bed.WardId == wardId);

        var list = await query
            .OrderByDescending(a => a.AdmittedAt)
            .Select(a => new AdmissionSummary(
                a.Id, a.AdmissionNumber, a.PatientId, a.Patient.PatientNumber,
                a.Patient.FirstName + " " + a.Patient.LastName, a.Bed.Ward.Name, a.Bed.BedNumber,
                a.AdmittingDoctor.Employee.FirstName + " " + a.AdmittingDoctor.Employee.LastName,
                a.AdmittedAt, a.DischargedAt, a.Status))
            .ToListAsync();
        return ServiceResult<List<AdmissionSummary>>.Ok(list);
    }

    public async Task<AdmissionDetail?> GetAsync(int id, bool includeClinical)
    {
        var a = await db.Admissions.AsNoTracking()
            .Include(x => x.Patient)
            .Include(x => x.Bed).ThenInclude(b => b.Ward)
            .Include(x => x.AdmittingDoctor).ThenInclude(d => d.Employee)
            .Include(x => x.BedTransfers).ThenInclude(t => t.FromBed).ThenInclude(b => b.Ward)
            .Include(x => x.BedTransfers).ThenInclude(t => t.ToBed).ThenInclude(b => b.Ward)
            .AsSplitQuery()
            .FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return null;

        return new AdmissionDetail(
            a.Id, a.AdmissionNumber, a.PatientId, a.Patient.PatientNumber,
            $"{a.Patient.FirstName} {a.Patient.LastName}", a.Patient.DateOfBirth, a.Patient.Gender,
            includeClinical ? a.Patient.Allergies : null,
            a.Bed.WardId, a.Bed.Ward.Name, a.BedId, a.Bed.BedNumber, a.Bed.Ward.DailyCharge,
            a.AdmittingDoctorId, $"{a.AdmittingDoctor.Employee.FirstName} {a.AdmittingDoctor.Employee.LastName}",
            a.AdmittedAt, a.DischargedAt, a.Status, a.AdmissionReason,
            includeClinical ? a.DischargeSummary : null,
            DaysBetween(a.AdmittedAt, a.DischargedAt ?? DateTime.UtcNow),
            a.BedTransfers.OrderBy(t => t.TransferredAt).Select(t => new BedTransferResponse(
                t.TransferredAt, t.FromBed.Ward.Name, t.FromBed.BedNumber, t.ToBed.Ward.Name, t.ToBed.BedNumber, t.Reason))
                .ToList());
    }

    // Assumption (proposed): each started 24 hours counts as one bed-day, minimum one day.
    public static int DaysBetween(DateTime from, DateTime to) =>
        Math.Max(1, (int)Math.Ceiling((to - from).TotalHours / 24));

    // ---------- Admit ----------

    public async Task<ServiceResult<int>> AdmitAsync(AdmitRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        if (!await db.Patients.AnyAsync(p => p.Id == request.PatientId))
        {
            errors["PatientId"] = ["Choose a patient."];
        }
        else if (await db.Admissions.AnyAsync(a => a.PatientId == request.PatientId && a.DischargedAt == null))
        {
            errors["PatientId"] = ["This patient is already admitted. Open the current admission instead."];
        }
        if (!await db.Doctors.AnyAsync(d => d.Id == request.AdmittingDoctorId && d.Employee.IsActive))
        {
            errors["AdmittingDoctorId"] = ["Choose an active doctor."];
        }
        var bedError = await CheckBedFreeAsync(request.BedId!.Value);
        if (bedError is not null)
        {
            errors["BedId"] = [bedError];
        }
        if (errors.Count > 0)
        {
            return ServiceResult<int>.Invalid(errors);
        }

        var next = await db.Database
            .SqlQuery<long>($"SELECT nextval('\"AdmissionNumbers\"') AS \"Value\"")
            .SingleAsync();
        var admission = new Admission
        {
            AdmissionNumber = $"ADM-{next:D6}",
            PatientId = request.PatientId!.Value,
            BedId = request.BedId.Value,
            AdmittingDoctorId = request.AdmittingDoctorId!.Value,
            AdmittedAt = DateTime.UtcNow,
            Status = AdmissionStatus.Admitted,
            AdmissionReason = request.AdmissionReason.Trim(),
        };
        db.Admissions.Add(admission);

        // If two people pick the same bed at the same moment, the database index refuses the second one.
        if (!await TrySaveAsync())
        {
            return ServiceResult<int>.Invalid(new() { ["BedId"] = ["This bed was just taken, or the patient was just admitted. Refresh and try again."] });
        }
        return ServiceResult<int>.Ok(admission.Id);
    }

    // ---------- Transfer ----------

    public async Task<ServiceResult<int>> TransferAsync(int id, TransferRequest request, string? userId)
    {
        var admission = await db.Admissions.FirstOrDefaultAsync(a => a.Id == id);
        if (admission is null) return ServiceResult<int>.NotFound();
        if (admission.DischargedAt is not null)
        {
            return Invalid("Status", "This patient has already been discharged.");
        }
        if (admission.BedId == request.ToBedId)
        {
            return Invalid("ToBedId", "The patient is already in this bed.");
        }
        var bedError = await CheckBedFreeAsync(request.ToBedId!.Value);
        if (bedError is not null)
        {
            return Invalid("ToBedId", bedError);
        }

        db.BedTransfers.Add(new BedTransfer
        {
            AdmissionId = id,
            FromBedId = admission.BedId,
            ToBedId = request.ToBedId.Value,
            TransferredAt = DateTime.UtcNow,
            Reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim(),
            TransferredByUserId = userId,
        });
        admission.BedId = request.ToBedId.Value;

        if (!await TrySaveAsync())
        {
            return Invalid("ToBedId", "This bed was just taken. Choose another bed.");
        }
        return ServiceResult<int>.Ok(id);
    }

    // ---------- Discharge ----------
    // Frees the bed. The bed charge itself is added to the bill in the Billing step (FR-BL-04),
    // using DaysCharged and the ward's daily charge.
    public async Task<ServiceResult<int>> DischargeAsync(int id, string summary)
    {
        var admission = await db.Admissions.FirstOrDefaultAsync(a => a.Id == id);
        if (admission is null) return ServiceResult<int>.NotFound();
        if (admission.DischargedAt is not null)
        {
            return Invalid("Status", "This patient has already been discharged.");
        }

        admission.DischargedAt = DateTime.UtcNow;
        admission.Status = AdmissionStatus.Discharged;
        admission.DischargeSummary = summary.Trim();
        await db.SaveChangesAsync();
        return ServiceResult<int>.Ok(id);
    }

    // ---------- Vital signs and nursing notes ----------

    public async Task<List<VitalSignResponse>?> ListVitalsAsync(int admissionId)
    {
        if (!await db.Admissions.AnyAsync(a => a.Id == admissionId)) return null;

        return await db.VitalSigns.AsNoTracking()
            .Where(v => v.AdmissionId == admissionId)
            .OrderByDescending(v => v.RecordedAt)
            .Select(v => new VitalSignResponse(v.Id, v.RecordedAt, v.TemperatureC, v.PulseBpm, v.SystolicBp,
                v.DiastolicBp, v.RespiratoryRate, v.OxygenSaturation, v.Notes,
                db.Users.Where(u => u.Id == v.RecordedByUserId).Select(u => u.UserName).FirstOrDefault()))
            .ToListAsync();
    }

    public async Task<ServiceResult<int>> AddVitalsAsync(int admissionId, VitalSignRequest request, string? userId)
    {
        var admission = await db.Admissions.FirstOrDefaultAsync(a => a.Id == admissionId);
        if (admission is null) return ServiceResult<int>.NotFound();
        if (admission.DischargedAt is not null)
        {
            return Invalid("Status", "Vital signs can only be recorded while the patient is admitted.");
        }

        var errors = new Dictionary<string, string[]>();
        if (request is { TemperatureC: null, PulseBpm: null, SystolicBp: null, DiastolicBp: null,
                RespiratoryRate: null, OxygenSaturation: null } && string.IsNullOrWhiteSpace(request.Notes))
        {
            errors["Notes"] = ["Enter at least one reading or a note."];
        }
        if ((request.SystolicBp is null) != (request.DiastolicBp is null))
        {
            errors["SystolicBp"] = ["Enter both blood pressure numbers, e.g. 120 / 80."];
        }
        else if (request.SystolicBp <= request.DiastolicBp)
        {
            errors["SystolicBp"] = ["The first blood pressure number must be higher than the second."];
        }
        if (errors.Count > 0) return ServiceResult<int>.Invalid(errors);

        var vital = new VitalSign
        {
            AdmissionId = admissionId,
            RecordedAt = DateTime.UtcNow,
            TemperatureC = request.TemperatureC,
            PulseBpm = request.PulseBpm,
            SystolicBp = request.SystolicBp,
            DiastolicBp = request.DiastolicBp,
            RespiratoryRate = request.RespiratoryRate,
            OxygenSaturation = request.OxygenSaturation,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            RecordedByUserId = userId,
        };
        db.VitalSigns.Add(vital);
        await db.SaveChangesAsync();
        return ServiceResult<int>.Ok(vital.Id);
    }

    // ---------- Helpers ----------

    private async Task<string?> CheckBedFreeAsync(int bedId)
    {
        var bed = await db.Beds.AsNoTracking().FirstOrDefaultAsync(b => b.Id == bedId);
        if (bed is null || !bed.IsActive) return "Choose a bed that is in use.";
        if (await db.Admissions.AnyAsync(a => a.BedId == bedId && a.DischargedAt == null))
        {
            return "This bed already has a patient. Choose a free bed.";
        }
        return null;
    }

    private async Task<bool> TrySaveAsync()
    {
        try
        {
            await db.SaveChangesAsync();
            return true;
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return false;
        }
    }

    private static ServiceResult<int> Invalid(string field, string message) =>
        ServiceResult<int>.Invalid(new() { [field] = [message] });
}
