using System.ComponentModel.DataAnnotations;
using Hms.Api.Entities;

namespace Hms.Api.Dtos;

// PDF 3.6 Laboratory Management.

// ---------- Test catalogue ----------
public record LabTestRequest(
    [Required, MaxLength(20), RegularExpression("^[A-Za-z0-9-]+$", ErrorMessage = "Use letters, numbers or a dash.")]
    string Code,
    [Required, MaxLength(150)] string Name,
    [Range(0, 1_000_000)] decimal Price,
    [MaxLength(30)] string? Unit,
    [MaxLength(100)] string? ReferenceRange,
    bool IsActive = true);

public record LabTestResponse(int Id, string Code, string Name, decimal Price, string? Unit, string? ReferenceRange, bool IsActive);

// ---------- Requests (FR-LAB-01) ----------
// One request per test, so each test has its own sample, status and result.
public record CreateLabRequests(
    [Required] int? PatientId,
    int? MedicalRecordId,                     // set when ordered from a visit
    [Required, MinLength(1)] List<int> LabTestIds);

// FR-LAB-02 Sample collection. The sample ID is the label on the tube.
public record CollectSampleRequest(
    [Required, MaxLength(30), RegularExpression("^[A-Za-z0-9-]+$", ErrorMessage = "Use letters, numbers or a dash.")]
    string SampleId);

// FR-LAB-03 Result entry.
public record LabResultRequest(
    [Required, MaxLength(200)] string ResultValue,
    [MaxLength(2000)] string? ResultNotes,
    bool IsAbnormal);

public record LabRequestResponse(
    int Id,
    string RequestNumber,
    int PatientId,
    string PatientNumber,
    string PatientName,
    DateOnly DateOfBirth,
    Gender Gender,
    int LabTestId,
    string TestCode,
    string TestName,
    string? Unit,
    string? ReferenceRange,
    int RequestedByDoctorId,
    string DoctorName,
    int? MedicalRecordId,
    LabRequestStatus Status,
    DateTime RequestedAt,
    string? SampleId,
    DateTime? SampleCollectedAt,
    string? CollectedBy,
    string? ResultValue,
    string? ResultNotes,
    bool? IsAbnormal,
    DateTime? ResultEnteredAt,
    string? ResultEnteredBy);
