using System.ComponentModel.DataAnnotations;
using Hms.Api.Entities;

namespace Hms.Api.Dtos;

// PDF 3.5 Electronic Medical Records (EMR).

// ---------- Visit notes, diagnoses and treatments (FR-EMR-01, FR-EMR-03) ----------
public record DiagnosisItem(
    // Optional ICD-10 code, e.g. "J06.9" (assumption: codes are typed, no code list is loaded).
    [MaxLength(10), RegularExpression(@"^[A-Za-z][0-9]{2}(\.[0-9A-Za-z]{1,4})?$",
        ErrorMessage = "Use an ICD-10 code like J06.9, or leave it empty.")]
    string? Code,
    [Required, MaxLength(500)] string Description,
    bool IsPrimary);

public record TreatmentItem(
    [Required, MaxLength(1000)] string Description,
    DateTime? PerformedAt);

// AppointmentId is only read when the record is created; a record stays linked to its visit.
public record MedicalRecordRequest
{
    public int? AppointmentId { get; init; }
    [MaxLength(500)] public string? ChiefComplaint { get; init; }
    [MaxLength(10000)] public string? ClinicalNotes { get; init; }
    [Required] public List<DiagnosisItem> Diagnoses { get; init; } = [];
    [Required] public List<TreatmentItem> Treatments { get; init; } = [];
}

// ---------- Prescriptions (FR-EMR-02) ----------
public record PrescriptionItemRequest(
    [Required] int? MedicineId,
    [Required, MaxLength(50)] string Dosage,       // "1 tablet"
    [Required, MaxLength(50)] string Frequency,    // "3 times a day"
    [Range(1, 365)] int DurationDays,
    [Range(1, 10000)] int Quantity,
    [MaxLength(300)] string? Instructions);        // "After meals"

public record PrescriptionRequest([Required, MinLength(1)] List<PrescriptionItemRequest> Items);

public record PrescriptionItemResponse(
    int Id,
    int MedicineId,
    string MedicineName,
    string Strength,
    string Form,
    string Dosage,
    string Frequency,
    int DurationDays,
    int Quantity,
    int QuantityDispensed,
    string? Instructions);

public record PrescriptionResponse(
    int Id,
    int MedicalRecordId,
    int PatientId,
    string PatientNumber,
    string PatientName,
    string DoctorName,
    DateTime PrescribedAt,
    PrescriptionStatus Status,
    IReadOnlyList<PrescriptionItemResponse> Items);

// ---------- Reading ----------
public record MedicalRecordSummary(
    int Id,
    DateTime VisitDate,
    int PatientId,
    string PatientNumber,
    string PatientName,
    string DoctorName,
    string? ChiefComplaint,
    string? PrimaryDiagnosis);

public record MedicalRecordDetail(
    int Id,
    int? AppointmentId,
    DateTime VisitDate,
    DateTime CreatedAt,
    // Patient facts a doctor needs next to the notes (and on the printed report).
    int PatientId,
    string PatientNumber,
    string PatientName,
    DateOnly DateOfBirth,
    Gender Gender,
    string? BloodGroup,
    string? Allergies,
    int DoctorId,
    string DoctorName,
    string DepartmentName,
    string LicenseNumber,
    string? ChiefComplaint,
    string? ClinicalNotes,
    IReadOnlyList<DiagnosisItem> Diagnoses,
    IReadOnlyList<TreatmentItem> Treatments,
    IReadOnlyList<PrescriptionResponse> Prescriptions,
    // True only for the doctor who wrote the record, so the page knows whether to show Edit.
    bool CanEdit);

public record MedicineOption(int Id, string Name, string? GenericName, string Form, string Strength);
