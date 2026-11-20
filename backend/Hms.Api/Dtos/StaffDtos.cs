using System.ComponentModel.DataAnnotations;
using Hms.Api.Entities;

namespace Hms.Api.Dtos;

// PDF 3.9 Staff Management.

// ---------- FR-ST-01 Employee registration, FR-ST-03 Department assignment ----------
// Doctors are employees too, but they are added and edited on the Doctors page,
// because they also need a licence number, fee and schedule.
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
}

// Link a login account (created through Hms.Api.http) to an employee, or unlink it with null.
// The link is what lets a member of staff see and request their own leave.
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
    int? DoctorId,          // set when this employee is a doctor (edit on the Doctors page)
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
    int? DoctorId,
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
