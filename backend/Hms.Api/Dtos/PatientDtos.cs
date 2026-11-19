using System.ComponentModel.DataAnnotations;
using Hms.Api.Entities;

namespace Hms.Api.Dtos;

// Used for both "register" and "update". Validation runs automatically before the controller
// method is called; invalid data gets a 400 response listing every problem.
public record PatientRequest
{
    [Required, MaxLength(100)]
    public string FirstName { get; init; } = string.Empty;

    [Required, MaxLength(100)]
    public string LastName { get; init; } = string.Empty;

    [Required]
    public DateOnly? DateOfBirth { get; init; }

    [Required]
    public Gender? Gender { get; init; }

    // Sri Lankan NIC: old format 9 digits + V/X, new format 12 digits. Optional.
    [RegularExpression("^([0-9]{9}[vVxX]|[0-9]{12})$", ErrorMessage = "Enter a valid NIC (e.g. 851234567V or 198512345678).")]
    public string? NationalId { get; init; }

    [Required, RegularExpression(@"^\+?[0-9 \-]{7,20}$", ErrorMessage = "Enter a valid phone number.")]
    public string Phone { get; init; } = string.Empty;

    [EmailAddress, MaxLength(256)]
    public string? Email { get; init; }

    [MaxLength(300)]
    public string? Address { get; init; }

    [RegularExpression("^(A|B|AB|O)[+-]$", ErrorMessage = "Blood group must be A+, A-, B+, B-, AB+, AB-, O+ or O-.")]
    public string? BloodGroup { get; init; }

    [MaxLength(500)]
    public string? Allergies { get; init; }

    [MaxLength(200)]
    public string? EmergencyContactName { get; init; }

    [RegularExpression(@"^\+?[0-9 \-]{7,20}$", ErrorMessage = "Enter a valid phone number.")]
    public string? EmergencyContactPhone { get; init; }
}

// Short version for search results.
public record PatientSummary(
    int Id,
    string PatientNumber,
    string FirstName,
    string LastName,
    DateOnly DateOfBirth,
    Gender Gender,
    string Phone,
    string? NationalId);

public record PatientDetail(
    int Id,
    string PatientNumber,
    string FirstName,
    string LastName,
    DateOnly DateOfBirth,
    Gender Gender,
    string? NationalId,
    string Phone,
    string? Email,
    string? Address,
    string? BloodGroup,
    string? Allergies,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount);

public record PatientDocumentResponse(
    int Id,
    string FileName,
    string ContentType,
    long SizeBytes,
    string? Description,
    DateTime UploadedAt);

// PDF 3.2 "View Medical History": everything clinical about one patient, newest first.
public record MedicalHistoryResponse(
    IReadOnlyList<VisitHistoryItem> Visits,
    IReadOnlyList<LabResultHistoryItem> LabResults,
    IReadOnlyList<AdmissionHistoryItem> Admissions);

public record VisitHistoryItem(
    int Id,
    DateTime VisitDate,
    string DoctorName,
    string? ChiefComplaint,
    IReadOnlyList<string> Diagnoses,
    IReadOnlyList<string> Treatments,
    IReadOnlyList<string> Prescriptions);

public record LabResultHistoryItem(
    int Id,
    string TestName,
    LabRequestStatus Status,
    DateTime RequestedAt,
    string? ResultValue,
    string? Unit,
    string? ReferenceRange,
    bool? IsAbnormal);

public record AdmissionHistoryItem(
    int Id,
    string AdmissionNumber,
    string Ward,
    string Bed,
    DateTime AdmittedAt,
    DateTime? DischargedAt,
    string? AdmissionReason);
