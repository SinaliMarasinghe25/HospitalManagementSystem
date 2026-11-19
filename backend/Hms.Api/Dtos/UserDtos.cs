using System.ComponentModel.DataAnnotations;

namespace Hms.Api.Dtos;

public record UserResponse(
    string Id,
    string UserName,
    string? Email,
    bool IsActive,
    bool IsLockedOut,
    IReadOnlyList<string> Roles);

public record CreateUserRequest(
    [Required, MinLength(3), MaxLength(50), RegularExpression("^[a-zA-Z0-9._-]+$",
        ErrorMessage = "Use only letters, numbers, dot, dash or underscore.")] string UserName,
    [EmailAddress, MaxLength(256)] string? Email,
    [Required, MinLength(8), MaxLength(128)] string Password,
    [Required, MinLength(1)] List<string> Roles);

public record UpdateUserRolesRequest([Required, MinLength(1)] List<string> Roles);

public record ResetPasswordRequest([Required, MinLength(8), MaxLength(128)] string NewPassword);

public record UpdateUserStatusRequest(bool IsActive);
