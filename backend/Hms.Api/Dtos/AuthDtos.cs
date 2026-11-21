using System.ComponentModel.DataAnnotations;

namespace Hms.Api.Dtos;

// DTOs = the exact shape of data the API accepts and returns.
// They never contain the password hash or other internal fields.

public record LoginRequest(
    [Required, MaxLength(256)] string UserName,
    [Required, MaxLength(128)] string Password);

public record ChangePasswordRequest(
    [Required] string CurrentPassword,
    [Required, MinLength(8), MaxLength(128)] string NewPassword);

public record CurrentUserResponse(
    string Id,
    string UserName,
    string? Email,
    IReadOnlyList<string> Roles,
    bool MustChangePassword);

// "Forgot password" on the login page (assumption A28).
public record ForgotPasswordRequest([Required, MaxLength(256)] string UserName);
