using System.ComponentModel.DataAnnotations;
using Hms.Api.Entities;

namespace Hms.Api.Dtos;

// Inpatient management (PDF 1.2 scope; assumption A1: admit, assign ward and bed, transfer, vitals and notes, discharge).

// ---------- Wards and beds ----------
public record WardRequest(
    [Required, MaxLength(100)] string Name,
    [Required, MaxLength(50)] string WardType,       // e.g. General, ICU, Maternity, Paediatric
    [Range(0, 1_000_000)] decimal DailyCharge);      // bed charge per day (FR-BL-04)

// Adds beds named with the prefix and the next free numbers, e.g. "A-01", "A-02".
public record AddBedsRequest(
    [Required, MaxLength(10), RegularExpression("^[A-Za-z0-9-]*$", ErrorMessage = "Use letters, numbers or a dash.")]
    string Prefix,
    [Range(1, 50)] int Count);

public record BedStatusRequest(bool IsActive);

public record BedResponse(
    int Id,
    string BedNumber,
    bool IsActive,
    // Filled when someone is in the bed.
    int? AdmissionId,
    string? PatientName,
    string? PatientNumber);

public record WardResponse(
    int Id,
    string Name,
    string WardType,
    decimal DailyCharge,
    int TotalBeds,
    int FreeBeds,
    IReadOnlyList<BedResponse> Beds);

// ---------- Admissions ----------
public record AdmitRequest(
    [Required] int? PatientId,
    [Required] int? BedId,
    [Required] int? AdmittingDoctorId,
    [Required, MaxLength(500)] string AdmissionReason);

public record TransferRequest(
    [Required] int? ToBedId,
    [MaxLength(300)] string? Reason);

public record DischargeRequest(
    [Required, MaxLength(10000)] string DischargeSummary);

public record AdmissionSummary(
    int Id,
    string AdmissionNumber,
    int PatientId,
    string PatientNumber,
    string PatientName,
    string WardName,
    string BedNumber,
    string DoctorName,
    DateTime AdmittedAt,
    DateTime? DischargedAt,
    AdmissionStatus Status);

public record BedTransferResponse(
    DateTime TransferredAt,
    string FromWard,
    string FromBed,
    string ToWard,
    string ToBed,
    string? Reason);

public record AdmissionDetail(
    int Id,
    string AdmissionNumber,
    int PatientId,
    string PatientNumber,
    string PatientName,
    DateOnly DateOfBirth,
    Gender Gender,
    string? Allergies,
    int WardId,
    string WardName,
    int BedId,
    string BedNumber,
    decimal DailyCharge,
    int AdmittingDoctorId,
    string DoctorName,
    DateTime AdmittedAt,
    DateTime? DischargedAt,
    AdmissionStatus Status,
    string? AdmissionReason,
    // Clinical: only sent to Admin, Doctor and Nurse. Null for other roles.
    string? DischargeSummary,
    // Days charged so far (or in total, after discharge). Assumption: every started day counts, minimum 1.
    int DaysCharged,
    IReadOnlyList<BedTransferResponse> Transfers);

// ---------- Vital signs and nursing notes (assumption A3) ----------
// Every value is optional, but at least one value or a note is required.
public record VitalSignRequest(
    [Range(30, 45)] decimal? TemperatureC,
    [Range(20, 250)] int? PulseBpm,
    [Range(50, 260)] int? SystolicBp,
    [Range(20, 160)] int? DiastolicBp,
    [Range(4, 60)] int? RespiratoryRate,
    [Range(50, 100)] int? OxygenSaturation,
    [MaxLength(500)] string? Notes);

public record VitalSignResponse(
    int Id,
    DateTime RecordedAt,
    decimal? TemperatureC,
    int? PulseBpm,
    int? SystolicBp,
    int? DiastolicBp,
    int? RespiratoryRate,
    int? OxygenSaturation,
    string? Notes,
    string? RecordedBy);
