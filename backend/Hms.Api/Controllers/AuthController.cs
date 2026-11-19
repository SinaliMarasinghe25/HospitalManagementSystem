using Hms.Api.Dtos;
using Hms.Api.Entities;
using Hms.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Hms.Api.Controllers;

// PDF 3.1 User Management: Login, Logout, Password Management.
[ApiController]
[Route("api/auth")]
public class AuthController(
    UserManager<AppUser> userManager,
    SignInManager<AppUser> signInManager,
    AuditService audit) : ControllerBase
{
    // POST /api/auth/login
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<CurrentUserResponse>> Login(LoginRequest request)
    {
        var user = await userManager.FindByNameAsync(request.UserName);

        // Same message for "no such user" and "wrong password",
        // so an attacker cannot find out which usernames exist.
        if (user is null || !user.IsActive)
        {
            await audit.LogAsync(AuditAction.LoginFailed, user?.Id, request.UserName);
            return Problem(statusCode: 401, title: "Invalid username or password.");
        }

        // lockoutOnFailure: true counts failed attempts and locks the account (see Program.cs).
        var result = await signInManager.PasswordSignInAsync(
            user, request.Password, isPersistent: false, lockoutOnFailure: true);

        if (result.IsLockedOut)
        {
            await audit.LogAsync(AuditAction.LoginFailed, user.Id, user.UserName);
            return Problem(statusCode: 401, title: "Account locked after too many failed attempts. Try again in 15 minutes.");
        }

        if (!result.Succeeded)
        {
            await audit.LogAsync(AuditAction.LoginFailed, user.Id, user.UserName);
            return Problem(statusCode: 401, title: "Invalid username or password.");
        }

        await audit.LogAsync(AuditAction.Login, user.Id, user.UserName);
        return await BuildCurrentUser(user);
    }

    // POST /api/auth/logout
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var user = await userManager.GetUserAsync(User);
        await signInManager.SignOutAsync();
        await audit.LogAsync(AuditAction.Logout, user?.Id, user?.UserName);
        return NoContent();
    }

    // GET /api/auth/me  - who am I? React will call this when the page loads.
    [HttpGet("me")]
    public async Task<ActionResult<CurrentUserResponse>> Me()
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }
        return await BuildCurrentUser(user);
    }

    // POST /api/auth/change-password
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        var result = await userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
        {
            foreach (var error in result.Errors)
            {
                ModelState.AddModelError(error.Code, error.Description);
            }
            return ValidationProblem(ModelState);
        }

        // Issue a fresh cookie, because changing the password changes the user's security stamp.
        await signInManager.RefreshSignInAsync(user);
        await audit.LogAsync(AuditAction.Update, user.Id, user.UserName, "User", user.Id, "{\"field\":\"Password\"}");
        return NoContent();
    }

    private async Task<CurrentUserResponse> BuildCurrentUser(AppUser user)
    {
        var roles = await userManager.GetRolesAsync(user);
        return new CurrentUserResponse(user.Id, user.UserName!, user.Email, roles.ToList());
    }
}
