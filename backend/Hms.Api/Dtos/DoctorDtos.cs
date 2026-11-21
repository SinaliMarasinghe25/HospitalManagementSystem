using System.ComponentModel.DataAnnotations;

namespace Hms.Api.Dtos;

// ---------- Departments ----------
public record DepartmentRequest(
    [Required, MaxLength(100)] string Name,
    [MaxLength(500)] string? Description,
    bool IsActive = true,
    bool IsClinical = true);   // clinical staff choose from these; "Administration" is the only built-in non-clinical one

// StaffCount: active employees in the department (doctors included). DoctorCount: active doctors among them.
// IsDefault: the common non-clinical department ("Administration") given automatically to non-clinical staff.
public record DepartmentResponse(
    int Id, string Name, string? Description, bool IsActive, bool IsClinical, bool IsDefault, int DoctorCount, int StaffCount);

// ---------- Doctors ----------
// Doctors are added and edited on the Staff page (EmployeeRequest with a doctor profile, see StaffDtos.cs).
// This file keeps what the Doctors page reads, and the weekly schedule.
public record DoctorSummary(
    int Id,
    string EmployeeNumber,
    string FullName,
    string Specialization,
    int DepartmentId,
    string DepartmentName,
    decimal ConsultationFee,
    bool IsActive);

public record DoctorDetail(
    int Id,
    int EmployeeId,
    string EmployeeNumber,
    string FirstName,
    string LastName,
    string? Phone,
    string? Email,
    DateOnly HireDate,
    int DepartmentId,
    string DepartmentName,
    string Specialization,
    string LicenseNumber,
    decimal ConsultationFee,
    int SlotMinutes,
    bool IsActive,
    string? UserName,
    IReadOnlyList<ScheduleItem> Schedule);

// ---------- Schedules (PDF 3.3 "Schedule Management") ----------
public record ScheduleItem(
    DayOfWeek DayOfWeek,
    [Required] TimeOnly? StartTime,
    [Required] TimeOnly? EndTime);

public record ScheduleRequest([Required] List<ScheduleItem> Items);
