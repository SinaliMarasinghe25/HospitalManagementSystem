using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;

namespace Hms.Api.Entities;

// ---------- Users (PDF section 6: Users) ----------
// IdentityUser already has Id, UserName, Email, PasswordHash, LockoutEnd, AccessFailedCount...
// We only add what Identity does not have.
public class AppUser : IdentityUser
{
    public bool IsActive { get; set; } = true;

    // True after an administrator sets the password (new account or reset). The user must then choose
    // their own password before using anything else, so only they know it.
    public bool MustChangePassword { get; set; }

    public Employee? Employee { get; set; }
}

// ---------- Departments ----------
public class Department
{
    public int Id { get; set; }

    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;

    public List<Employee> Employees { get; set; } = [];
}

// ---------- Employees (PDF section 6: Employees) ----------
public class Employee
{
    public int Id { get; set; }

    [MaxLength(20)]
    public string EmployeeNumber { get; set; } = string.Empty;

    [MaxLength(100)]
    public string FirstName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string LastName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string JobTitle { get; set; } = string.Empty;

    [MaxLength(20)]
    public string? Phone { get; set; }

    [MaxLength(256)]
    public string? Email { get; set; }

    public DateOnly HireDate { get; set; }

    public bool IsActive { get; set; } = true;

    public int DepartmentId { get; set; }
    public Department Department { get; set; } = null!;

    // Null = this employee has no login account.
    public string? UserId { get; set; }
    public AppUser? User { get; set; }

    public Doctor? Doctor { get; set; }
    public List<AttendanceRecord> AttendanceRecords { get; set; } = [];
    public List<LeaveRequest> LeaveRequests { get; set; } = [];
}

// ---------- Doctors ----------
public class Doctor
{
    public int Id { get; set; }

    public int EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;

    [MaxLength(100)]
    public string Specialization { get; set; } = string.Empty;

    [MaxLength(50)]
    public string LicenseNumber { get; set; } = string.Empty;

    public decimal ConsultationFee { get; set; }

    public int SlotMinutes { get; set; } = 15;

    public List<DoctorSchedule> Schedules { get; set; } = [];
    public List<Appointment> Appointments { get; set; } = [];
}

public class DoctorSchedule
{
    public int Id { get; set; }

    public int DoctorId { get; set; }
    public Doctor Doctor { get; set; } = null!;

    public DayOfWeek DayOfWeek { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
}

// ---------- Attendance and leave (PDF 3.9) ----------
public class AttendanceRecord
{
    public int Id { get; set; }

    public int EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;

    public DateOnly Date { get; set; }
    public AttendanceStatus Status { get; set; }
    public TimeOnly? CheckIn { get; set; }
    public TimeOnly? CheckOut { get; set; }

    public string? RecordedByUserId { get; set; }
}

public class LeaveRequest
{
    public int Id { get; set; }

    public int EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;

    public LeaveType LeaveType { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }

    [MaxLength(500)]
    public string? Reason { get; set; }

    public LeaveStatus Status { get; set; } = LeaveStatus.Pending;

    // Who typed the request: the employee themselves, or an administrator on their behalf.
    public string? RequestedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }

    public string? ReviewedByUserId { get; set; }
    public DateTime? ReviewedAt { get; set; }

    // The administrator's note on approval or rejection (required when rejecting).
    [MaxLength(500)]
    public string? ReviewNote { get; set; }
}
