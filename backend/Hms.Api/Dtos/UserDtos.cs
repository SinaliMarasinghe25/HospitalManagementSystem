using System.ComponentModel.DataAnnotations;

namespace Hms.Api.Dtos;

// Login accounts (Users page). New logins are created from a person's staff record (see StaffDtos.cs).

public record UserResponse(
    string Id,
    string UserName,
    string? Email,
    bool IsActive,
    bool IsLockedOut,
    IReadOnlyList<string> Roles,
    bool MustChangePassword,      // still has the temporary password an administrator set
    int? EmployeeId,              // the staff record this login belongs to, if any
    string? EmployeeName,
    bool IsDoctor);               // linked to a doctor: the Doctor role is kept automatically

public record UpdateUserRolesRequest([Required, MinLength(1)] List<string> Roles);

public record ResetPasswordRequest([Required, MinLength(8), MaxLength(128)] string NewPassword);

public record UpdateUserStatusRequest(bool IsActive);
