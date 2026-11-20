using System.ComponentModel.DataAnnotations;
using Hms.Api.Entities;

namespace Hms.Api.Dtos;

// PDF 3.4 Appointment Management and section 7 Appointment Screen.

// "Book Appointment". StartTime must be one of the free slots from GET /api/appointments/slots.
// The end time is not sent: it is always start + the doctor's slot length.
public record AppointmentRequest(
    [Required] int? PatientId,
    [Required] int? DoctorId,
    [Required] DateTime? StartTime,
    [MaxLength(500)] string? Reason);

// "Reschedule Appointment". DoctorId is optional: leave it out to keep the same doctor.
public record RescheduleRequest(
    [Required] DateTime? StartTime,
    int? DoctorId);

// "Cancel Appointment". A reason is required so the history explains what happened.
public record CancelAppointmentRequest(
    [Required, MaxLength(500)] string Reason);

// "Appointment Status Tracking": CheckedIn, Completed or NoShow.
public record AppointmentStatusRequest(
    [Required] AppointmentStatus? Status);

public record AppointmentResponse(
    int Id,
    int PatientId,
    string PatientNumber,
    string PatientName,
    int DoctorId,
    string DoctorName,
    string DepartmentName,
    DateTime StartTime,
    DateTime EndTime,
    AppointmentStatus Status,
    string? Reason,
    string? CancellationReason,
    int? RescheduledFromId,
    int? RescheduledToId,
    DateTime CreatedAt,
    // The visit's medical record, once the doctor has written it (Step 16). Only clinical roles can open it.
    int? MedicalRecordId);

// One bookable time on a doctor's day. Taken or past slots are shown as not available.
public record SlotResponse(DateTime StartTime, DateTime EndTime, bool IsAvailable);
