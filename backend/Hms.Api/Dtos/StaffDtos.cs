using System.ComponentModel.DataAnnotations;
using Hms.Api.Entities;

namespace Hms.Api.Dtos;

// PDF 3.9 Staff Management.

// ---------- FR-ST-01 Employee registration, FR-ST-03 Department assignment, FR-DM-01/02 doctors ----------
// One form for every member of staff. A doctor is an employee with a doctor profile (Doctor below);
// their weekly schedule is set on the Doctors page.
public record EmployeeRequest
{
    [Required, MaxLength(100)] public string FirstName { get; init; } = string.Empty;
    [Required, MaxLength(100)] public string LastName { get; init; } = string.Empty;
    [Required, MaxLength(100)] public string JobTitle { get; init; } = string.Empty;   // "Staff Nurse"
    [Required, RegularExpression(@"^\+?[0-9 \-]{7,20}$", ErrorMessage = "Enter a valid phone number.")]
    public string Phone { get; init; } = string.Empty;
    [EmailAddress, MaxLength(256)] public string? Email { get; init; }
    [Required] public DateOnly? HireDate { get; init; }
    [Required] public int? DepartmentId { get; init; }
    public bool IsActive { get; init; } = true;

    // Set for doctors. A doctor profile can be added to an existing employee, but never removed,
    // because appointments and medical records point to it (make the employee inactive instead).
    public DoctorProfileRequest? Doctor { get; init; }

    // Only used when adding an employee: optionally create their login account at the same time.
    // Leave UserName empty for staff who do not use the system.
    [MinLength(3), MaxLength(50), RegularExpression("^[a-zA-Z0-9._-]+$",
        ErrorMessage = "Use only letters, numbers, dot, dash or underscore.")]
    public string? UserName { get; init; }
    [MinLength(8), MaxLength(128)] public string? Password { get; init; }
    public List<string>? Roles { get; init; }
}

public record DoctorProfileRequest(
    [Required, MaxLength(100)] string Specialization,             // "Cardiologist"
    [Required, MaxLength(50)] string LicenseNumber,               // SLMC registration number
    [Range(0, 1_000_000)] decimal ConsultationFee,                // charged when an appointment is completed
    [Range(5, 120)] int SlotMinutes = 15);                        // appointment length

public record DoctorProfile(int Id, string Specialization, string LicenseNumber, decimal ConsultationFee, int SlotMinutes);

// Create a new login account for an existing employee and link it in one step.
public record NewEmployeeLoginRequest(
    [Required, MinLength(3), MaxLength(50), RegularExpression("^[a-zA-Z0-9._-]+$",
        ErrorMessage = "Use only letters, numbers, dot, dash or underscore.")] string UserName,
    [Required, MinLength(8), MaxLength(128)] string Password,
    [Required, MinLength(1)] List<string> Roles);

// Link an existing login account (one made before logins were created from the staff record) to an employee,
// or unlink it with null. The link is what lets a member of staff see and request their own leave.
public record EmployeeLoginRequest(string? UserId);

public record EmployeeSummary(
    int Id,
    string EmployeeNumber,
    string FullName,
    string JobTitle,
    int DepartmentId,
    string DepartmentName,
    string? Phone,
    bool IsActive,
    int? DoctorId,          // set when this employee has a doctor profile
    string? UserName);      // the linked login, if any

public record EmployeeDetail(
    int Id,
    string EmployeeNumber,
    string FirstName,
    string LastName,
    string JobTitle,
    string? Phone,
    string? Email,
    DateOnly HireDate,
    int DepartmentId,
    string DepartmentName,
    bool IsActive,
    DoctorProfile? Doctor,
    string? UserId,
    string? UserName,
    IReadOnlyList<LeaveResponse> Leave);

// A login account that is not linked to any employee yet.
public record UnlinkedUser(string Id, string UserName, IReadOnlyList<string> Roles);

// ---------- FR-ST-02 Attendance (assumption A14: manual entry by Admin) ----------
// One row of the daily attendance sheet: every active employee, with what was recorded that day.
public record AttendanceSheetRow(
    int EmployeeId,
    string EmployeeNumber,
    string FullName,
    string JobTitle,
    string DepartmentName,
    AttendanceStatus? Status,     // null = nothing recorded yet
    TimeOnly? CheckIn,
    TimeOnly? CheckOut,
    LeaveType? ApprovedLeave,     // set when approved leave covers this day
    string? RecordedBy);

public record AttendanceSheet(DateOnly Date, IReadOnlyList<AttendanceSheetRow> Rows);

public record AttendanceEntry(
    [Required] int? EmployeeId,
    [Required] AttendanceStatus? Status,
    TimeOnly? CheckIn,
    TimeOnly? CheckOut);

public record AttendanceSaveRequest(
    [Required] DateOnly? Date,
    [Required, MinLength(1)] List<AttendanceEntry> Entries);

public record AttendanceRecordResponse(
    DateOnly Date,
    AttendanceStatus Status,
    TimeOnly? CheckIn,
    TimeOnly? CheckOut,
    string? RecordedBy);

// One employee's attendance over a date range, with a count per status.
public record EmployeeAttendance(
    int EmployeeId,
    DateOnly FromDate,
    DateOnly ToDate,
    IReadOnlyDictionary<AttendanceStatus, int> Counts,
    IReadOnlyList<AttendanceRecordResponse> Records);

// ---------- FR-ST-04 Leave records ----------
public record LeaveCreateRequest(
    [Required] LeaveType? LeaveType,
    [Required] DateOnly? StartDate,
    [Required] DateOnly? EndDate,
    [MaxLength(500)] string? Reason);

// An administrator recording leave for an employee (for example, staff without a login).
public record LeaveCreateForEmployeeRequest(
    [Required] int? EmployeeId,
    [Required] LeaveType? LeaveType,
    [Required] DateOnly? StartDate,
    [Required] DateOnly? EndDate,
    [MaxLength(500)] string? Reason);

public record LeaveReviewRequest([MaxLength(500)] string? Note);

public record LeaveResponse(
    int Id,
    int EmployeeId,
    string EmployeeNumber,
    string EmployeeName,
    string DepartmentName,
    LeaveType LeaveType,
    DateOnly StartDate,
    DateOnly EndDate,
    int Days,                     // calendar days, both ends included (assumption A23)
    string? Reason,
    LeaveStatus Status,
    DateTime CreatedAt,
    string? RequestedBy,
    string? ReviewedBy,
    DateTime? ReviewedAt,
    string? ReviewNote);

// "My leave": the signed-in user's own requests. Linked = false when the login has no employee record.
public record MyLeave(bool Linked, string? EmployeeName, IReadOnlyList<LeaveResponse> Requests);
