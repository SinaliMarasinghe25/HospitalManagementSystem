using System.ComponentModel.DataAnnotations;

namespace Hms.Api.Dtos;

// ---------- Departments ----------
public record DepartmentRequest(
    [Required, MaxLength(100)] string Name,
    [MaxLength(500)] string? Description,
    bool IsActive = true);

public record DepartmentResponse(int Id, string Name, string? Description, bool IsActive, int DoctorCount);

// ---------- Doctors ----------
// PDF 3.3 "Add Doctor" / "Update Doctor Details" / "Department Assignment".
public record DoctorRequest
{
    [Required, MaxLength(100)] public string FirstName { get; init; } = string.Empty;
    [Required, MaxLength(100)] public string LastName { get; init; } = string.Empty;
    [Required, RegularExpression(@"^\+?[0-9 \-]{7,20}$", ErrorMessage = "Enter a valid phone number.")]
    public string Phone { get; init; } = string.Empty;
    [EmailAddress, MaxLength(256)] public string? Email { get; init; }
    [Required] public DateOnly? HireDate { get; init; }
    [Required] public int? DepartmentId { get; init; }
    [Required, MaxLength(100)] public string Specialization { get; init; } = string.Empty;
    [Required, MaxLength(50)] public string LicenseNumber { get; init; } = string.Empty;
    [Range(0, 1_000_000)] public decimal ConsultationFee { get; init; }
    [Range(5, 120)] public int SlotMinutes { get; init; } = 15;
    public bool IsActive { get; init; } = true;

    // Only used when adding a doctor: optionally create their login account with the Doctor role.
    [MinLength(3), MaxLength(50), RegularExpression("^[a-zA-Z0-9._-]+$",
        ErrorMessage = "Use only letters, numbers, dot, dash or underscore.")]
    public string? UserName { get; init; }
    [MinLength(8), MaxLength(128)] public string? Password { get; init; }
}

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
