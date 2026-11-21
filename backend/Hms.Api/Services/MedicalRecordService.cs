using Hms.Api.Authorization;
using Hms.Api.Data;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Services;

// Business logic for PDF 3.5 Electronic Medical Records.
// A medical record is one visit: the doctor's notes, diagnoses, treatments and prescriptions.
// Only the doctor who saw the patient writes or changes it. Admins, nurses and other doctors read it.
public class MedicalRecordService(AppDbContext db, NotificationService notifications)
{
    private const int MaxRangeDays = 62;

    // ---------- Reading ----------

    // Newest first, one page at a time.
    public async Task<ServiceResult<PagedResult<MedicalRecordSummary>>> ListAsync(
        DateOnly? fromDate, DateOnly? toDate, int? patientId, int? doctorId, int page, int pageSize)
    {
        var query = db.MedicalRecords.AsNoTracking();
        if (patientId is null || fromDate is not null || toDate is not null)
        {
            var to = toDate ?? HospitalTime.Today;
            var from = fromDate ?? to.AddDays(-6);
            if (to < from || to.DayNumber - from.DayNumber > MaxRangeDays)
            {
                return ServiceResult<PagedResult<MedicalRecordSummary>>.Invalid(new()
                {
                    ["ToDate"] = [$"The end date must be on or after the start date, and at most {MaxRangeDays} days later."]
                });
            }
            var fromUtc = HospitalTime.ToUtc(from, TimeOnly.MinValue);
            var toUtc = HospitalTime.ToUtc(to.AddDays(1), TimeOnly.MinValue);
            query = query.Where(m => m.VisitDate >= fromUtc && m.VisitDate < toUtc);
        }
        if (patientId is not null) query = query.Where(m => m.PatientId == patientId);
        if (doctorId is not null) query = query.Where(m => m.DoctorId == doctorId);

        var result = await query
            .OrderByDescending(m => m.VisitDate).ThenByDescending(m => m.Id)
            .Select(m => new MedicalRecordSummary(
                m.Id, m.VisitDate, m.PatientId, m.Patient.PatientNumber,
                m.Patient.FirstName + " " + m.Patient.LastName,
                m.Doctor.Employee.FirstName + " " + m.Doctor.Employee.LastName,
                m.ChiefComplaint,
                m.Diagnoses.Where(d => d.IsPrimary).Select(d => d.Description).FirstOrDefault()))
            .ToPagedResultAsync(page, pageSize);
        return ServiceResult<PagedResult<MedicalRecordSummary>>.Ok(result);
    }

    public async Task<MedicalRecordDetail?> GetAsync(int id, int? myDoctorId)
    {
        var m = await db.MedicalRecords.AsNoTracking()
            .Include(r => r.Patient)
            .Include(r => r.Doctor).ThenInclude(d => d.Employee).ThenInclude(e => e.Department)
            .Include(r => r.Diagnoses)
            .Include(r => r.Treatments)
            .Include(r => r.Prescriptions).ThenInclude(p => p.Items).ThenInclude(i => i.Medicine)
            .AsSplitQuery() // several lists: separate SQL queries instead of one very wide join
            .FirstOrDefaultAsync(r => r.Id == id);
        if (m is null)
        {
            return null;
        }

        var doctorName = $"{m.Doctor.Employee.FirstName} {m.Doctor.Employee.LastName}";
        var patientName = $"{m.Patient.FirstName} {m.Patient.LastName}";
        return new MedicalRecordDetail(
            m.Id, m.AppointmentId, m.VisitDate, m.CreatedAt,
            m.PatientId, m.Patient.PatientNumber, patientName, m.Patient.DateOfBirth, m.Patient.Gender,
            m.Patient.BloodGroup, m.Patient.Allergies,
            m.DoctorId, doctorName, m.Doctor.Employee.Department.Name, m.Doctor.LicenseNumber,
            m.ChiefComplaint, m.ClinicalNotes,
            m.Diagnoses.OrderByDescending(d => d.IsPrimary).ThenBy(d => d.Id)
                .Select(d => new DiagnosisItem(d.Code, d.Description, d.IsPrimary)).ToList(),
            m.Treatments.OrderBy(t => t.Id).Select(t => new TreatmentItem(t.Description, t.PerformedAt)).ToList(),
            m.Prescriptions.OrderBy(p => p.PrescribedAt)
                .Select(p => ToResponse(p, m.Patient, doctorName)).ToList(),
            CanEdit: myDoctorId is not null && myDoctorId == m.DoctorId);
    }

    // ---------- Writing the visit (FR-EMR-01, FR-EMR-03) ----------

    public async Task<ServiceResult<int>> CreateAsync(MedicalRecordRequest request, int? myDoctorId)
    {
        if (request.AppointmentId is null)
        {
            return Invalid<int>("AppointmentId", "Choose the appointment this visit belongs to.");
        }

        var appointment = await db.Appointments.FirstOrDefaultAsync(a => a.Id == request.AppointmentId);
        if (appointment is null)
        {
            return Invalid<int>("AppointmentId", "The appointment does not exist.");
        }
        if (myDoctorId is null || appointment.DoctorId != myDoctorId)
        {
            return Invalid<int>("AppointmentId", "Only the appointment's own doctor can write its medical record.");
        }
        if (appointment.Status is not (AppointmentStatus.CheckedIn or AppointmentStatus.Completed))
        {
            return Invalid<int>("AppointmentId", "The patient must be checked in before a medical record is written.");
        }
        if (await db.MedicalRecords.AnyAsync(m => m.AppointmentId == appointment.Id))
        {
            return Invalid<int>("AppointmentId", "This appointment already has a medical record. Open it to make changes.");
        }

        var errors = Validate(request);
        if (errors.Count > 0)
        {
            return ServiceResult<int>.Invalid(errors);
        }

        var record = new MedicalRecord
        {
            PatientId = appointment.PatientId,
            DoctorId = appointment.DoctorId,
            AppointmentId = appointment.Id,
            VisitDate = appointment.StartTime,
            CreatedAt = DateTime.UtcNow,
        };
        Apply(record, request);
        db.MedicalRecords.Add(record);
        await db.SaveChangesAsync();
        return ServiceResult<int>.Ok(record.Id);
    }

    public async Task<ServiceResult<int>> UpdateAsync(int id, MedicalRecordRequest request, int? myDoctorId)
    {
        var record = await db.MedicalRecords
            .Include(m => m.Diagnoses)
            .Include(m => m.Treatments)
            .FirstOrDefaultAsync(m => m.Id == id);
        if (record is null)
        {
            return ServiceResult<int>.NotFound();
        }
        if (record.DoctorId != myDoctorId)
        {
            return Invalid<int>("DoctorId", "Only the doctor who wrote this record can change it.");
        }

        var errors = Validate(request);
        if (errors.Count > 0)
        {
            return ServiceResult<int>.Invalid(errors);
        }

        // The lists are replaced as a whole, the same way the form sends them.
        db.Diagnoses.RemoveRange(record.Diagnoses);
        db.Treatments.RemoveRange(record.Treatments);
        record.Diagnoses = [];
        record.Treatments = [];
        Apply(record, request);
        await db.SaveChangesAsync();
        return ServiceResult<int>.Ok(id);
    }

    // ---------- Prescriptions (FR-EMR-02) ----------

    public async Task<ServiceResult<PrescriptionResponse>> AddPrescriptionAsync(
        int recordId, PrescriptionRequest request, int? myDoctorId)
    {
        var record = await db.MedicalRecords.Include(m => m.Patient).Include(m => m.Doctor).ThenInclude(d => d.Employee)
            .FirstOrDefaultAsync(m => m.Id == recordId);
        if (record is null)
        {
            return ServiceResult<PrescriptionResponse>.NotFound();
        }
        if (record.DoctorId != myDoctorId)
        {
            return Invalid<PrescriptionResponse>("DoctorId", "Only the doctor who wrote this record can prescribe on it.");
        }

        var medicineIds = request.Items.Select(i => i.MedicineId!.Value).Distinct().ToList();
        var medicines = await db.Medicines.Where(m => medicineIds.Contains(m.Id) && m.IsActive).ToDictionaryAsync(m => m.Id);
        var errors = new List<string>();
        if (medicines.Count != medicineIds.Count)
        {
            errors.Add("Choose medicines from the list.");
        }
        if (medicineIds.Count != request.Items.Count)
        {
            errors.Add("The same medicine is listed twice. Put it on one line.");
        }
        if (errors.Count > 0)
        {
            return ServiceResult<PrescriptionResponse>.Invalid(new() { ["Items"] = errors.ToArray() });
        }

        var prescription = new Prescription
        {
            MedicalRecordId = recordId,
            PrescribedAt = DateTime.UtcNow,
            Status = PrescriptionStatus.Pending,
            Items = request.Items.Select(i => new PrescriptionItem
            {
                MedicineId = i.MedicineId!.Value,
                Medicine = medicines[i.MedicineId.Value],
                Dosage = i.Dosage.Trim(),
                Frequency = i.Frequency.Trim(),
                DurationDays = i.DurationDays,
                Quantity = i.Quantity,
                Instructions = string.IsNullOrWhiteSpace(i.Instructions) ? null : i.Instructions.Trim(),
            }).ToList(),
        };
        db.Prescriptions.Add(prescription);
        await db.SaveChangesAsync();

        var doctorName = $"{record.Doctor.Employee.FirstName} {record.Doctor.Employee.LastName}";
        await notifications.SendToRoleAsync(Roles.Pharmacist, "New prescription",
            $"{record.Patient.FirstName} {record.Patient.LastName} ({record.Patient.PatientNumber}), " +
            $"{prescription.Items.Count} medicine(s), from Dr {doctorName}.",
            $"/pharmacy/prescriptions/{prescription.Id}");
        return ServiceResult<PrescriptionResponse>.Ok(ToResponse(prescription, record.Patient, doctorName));
    }

    // A doctor can withdraw a prescription the pharmacy has not started dispensing.
    public async Task<ServiceResult<PrescriptionResponse>> CancelPrescriptionAsync(int prescriptionId, int? myDoctorId)
    {
        var prescription = await LoadPrescriptions(tracking: true).FirstOrDefaultAsync(p => p.Id == prescriptionId);
        if (prescription is null)
        {
            return ServiceResult<PrescriptionResponse>.NotFound();
        }
        if (prescription.MedicalRecord.DoctorId != myDoctorId)
        {
            return Invalid<PrescriptionResponse>("Status", "Only the prescribing doctor can cancel this prescription.");
        }
        if (prescription.Status != PrescriptionStatus.Pending)
        {
            return Invalid<PrescriptionResponse>("Status",
                $"Only a pending prescription can be cancelled. This one is {prescription.Status}.");
        }

        prescription.Status = PrescriptionStatus.Cancelled;
        await db.SaveChangesAsync();
        return ServiceResult<PrescriptionResponse>.Ok(ToResponse(prescription));
    }

    // Newest first. With openOnly, the pharmacy's queue: Pending and PartiallyDispensed, oldest first,
    // so the patient who has waited longest is at the top.
    public async Task<PagedResult<PrescriptionResponse>> ListPrescriptionsAsync(
        PrescriptionStatus? status, int? patientId, bool openOnly, int page, int pageSize)
    {
        var query = LoadPrescriptions()
            .Where(p => status == null || p.Status == status)
            .Where(p => patientId == null || p.MedicalRecord.PatientId == patientId);
        query = openOnly
            ? query.Where(p => p.Status == PrescriptionStatus.Pending || p.Status == PrescriptionStatus.PartiallyDispensed)
                .OrderBy(p => p.PrescribedAt).ThenBy(p => p.Id)
            : query.OrderByDescending(p => p.PrescribedAt).ThenByDescending(p => p.Id);
        // Each prescription is loaded with its items, then turned into the response in C#.
        var prescriptions = await query.ToPagedResultAsync(page, pageSize);
        return prescriptions.Map(ToResponse);
    }

    public async Task<PrescriptionResponse?> GetPrescriptionAsync(int id)
    {
        var prescription = await LoadPrescriptions().FirstOrDefaultAsync(p => p.Id == id);
        return prescription is null ? null : ToResponse(prescription);
    }

    public Task<List<MedicineOption>> SearchMedicinesAsync(string? search)
    {
        var query = db.Medicines.AsNoTracking().Where(m => m.IsActive);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = SearchText.Contains(search);
            query = query.Where(m => EF.Functions.ILike(m.Name, pattern, "\\") ||
                                     (m.GenericName != null && EF.Functions.ILike(m.GenericName, pattern, "\\")));
        }
        return query.OrderBy(m => m.Name).ThenBy(m => m.Strength).Take(50)
            .Select(m => new MedicineOption(m.Id, m.Name, m.GenericName, m.Form, m.Strength))
            .ToListAsync();
    }

    // ---------- Helpers ----------

    private static Dictionary<string, string[]> Validate(MedicalRecordRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        if (request.Diagnoses.Count(d => d.IsPrimary) > 1)
        {
            errors["Diagnoses"] = ["Mark only one diagnosis as the main (primary) diagnosis."];
        }
        if (string.IsNullOrWhiteSpace(request.ChiefComplaint) && request.Diagnoses.Count == 0 &&
            string.IsNullOrWhiteSpace(request.ClinicalNotes))
        {
            errors["ChiefComplaint"] = ["Enter at least the complaint, a diagnosis or notes."];
        }
        return errors;
    }

    private static void Apply(MedicalRecord record, MedicalRecordRequest request)
    {
        record.ChiefComplaint = Normalize(request.ChiefComplaint);
        record.ClinicalNotes = Normalize(request.ClinicalNotes);

        // If no diagnosis is marked primary, the first one is.
        var hasPrimary = request.Diagnoses.Any(d => d.IsPrimary);
        record.Diagnoses.AddRange(request.Diagnoses.Select((d, index) => new Diagnosis
        {
            Code = Normalize(d.Code)?.ToUpperInvariant(),
            Description = d.Description.Trim(),
            IsPrimary = d.IsPrimary || (!hasPrimary && index == 0),
        }));
        record.Treatments.AddRange(request.Treatments.Select(t => new Treatment
        {
            Description = t.Description.Trim(),
            PerformedAt = t.PerformedAt is null ? null : HospitalTime.NormalizeToUtc(t.PerformedAt.Value),
        }));
    }

    private IQueryable<Prescription> LoadPrescriptions(bool tracking = false)
    {
        var query = tracking ? db.Prescriptions : db.Prescriptions.AsNoTracking();
        return query
            .Include(p => p.Items).ThenInclude(i => i.Medicine)
            .Include(p => p.MedicalRecord).ThenInclude(m => m.Patient)
            .Include(p => p.MedicalRecord).ThenInclude(m => m.Doctor).ThenInclude(d => d.Employee)
            .AsSplitQuery();
    }

    private static PrescriptionResponse ToResponse(Prescription p) => ToResponse(p, p.MedicalRecord.Patient,
        $"{p.MedicalRecord.Doctor.Employee.FirstName} {p.MedicalRecord.Doctor.Employee.LastName}");

    private static PrescriptionResponse ToResponse(Prescription p, Patient patient, string doctorName) => new(
        p.Id, p.MedicalRecordId, patient.Id, patient.PatientNumber, $"{patient.FirstName} {patient.LastName}",
        doctorName, p.PrescribedAt, p.Status,
        p.Items.OrderBy(i => i.Id).Select(i => new PrescriptionItemResponse(
            i.Id, i.MedicineId, i.Medicine.Name, i.Medicine.Strength, i.Medicine.Form, i.Dosage, i.Frequency,
            i.DurationDays, i.Quantity, i.QuantityDispensed, i.Instructions)).ToList());

    private static ServiceResult<T> Invalid<T>(string field, string message) =>
        ServiceResult<T>.Invalid(new() { [field] = [message] });

    private static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
