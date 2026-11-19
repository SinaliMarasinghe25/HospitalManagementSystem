using Hms.Api.Authorization;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Hms.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Controllers;

// PDF 3.1: User Roles and Access Control. Only Administrators can manage accounts.
[ApiController]
[Route("api/users")]
[Authorize(Roles = Roles.Administrator)]
public class UsersController(UserManager<AppUser> userManager, AuditService audit) : ControllerBase
{
    // GET /api/users
    [HttpGet]
    public async Task<ActionResult<List<UserResponse>>> GetAll()
    {
        var users = await userManager.Users.OrderBy(u => u.UserName).ToListAsync();
        var result = new List<UserResponse>();
        foreach (var user in users)
        {
            result.Add(await ToResponse(user));
        }
        return result;
    }

    // POST /api/users
    [HttpPost]
    public async Task<ActionResult<UserResponse>> Create(CreateUserRequest request)
    {
        var invalidRoles = request.Roles.Except(Roles.All).ToList();
        if (invalidRoles.Count > 0)
        {
            return Problem(statusCode: 400, title: $"Unknown role(s): {string.Join(", ", invalidRoles)}");
        }

        var user = new AppUser { UserName = request.UserName, Email = request.Email };

        // Identity hashes the password. We never store or log the plain text.
        var result = await userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            return IdentityErrors(result);
        }

        await userManager.AddToRolesAsync(user, request.Roles.Distinct());
        await AuditAsync(AuditAction.Create, user, $"{{\"roles\":\"{string.Join(",", request.Roles)}\"}}");
        return CreatedAtAction(nameof(GetAll), await ToResponse(user));
    }

    // PUT /api/users/{id}/roles
    [HttpPut("{id}/roles")]
    public async Task<ActionResult<UserResponse>> UpdateRoles(string id, UpdateUserRolesRequest request)
    {
        var invalidRoles = request.Roles.Except(Roles.All).ToList();
        if (invalidRoles.Count > 0)
        {
            return Problem(statusCode: 400, title: $"Unknown role(s): {string.Join(", ", invalidRoles)}");
        }

        var user = await userManager.FindByIdAsync(id);
        if (user is null)
        {
            return NotFound();
        }

        var current = await userManager.GetRolesAsync(user);
        await userManager.RemoveFromRolesAsync(user, current.Except(request.Roles));
        await userManager.AddToRolesAsync(user, request.Roles.Distinct().Except(current));

        // Changing the security stamp signs the user out everywhere, so new roles apply at once.
        await userManager.UpdateSecurityStampAsync(user);
        await AuditAsync(AuditAction.Update, user, $"{{\"roles\":\"{string.Join(",", request.Roles)}\"}}");
        return await ToResponse(user);
    }

    // POST /api/users/{id}/reset-password
    [HttpPost("{id}/reset-password")]
    public async Task<IActionResult> ResetPassword(string id, ResetPasswordRequest request)
    {
        var user = await userManager.FindByIdAsync(id);
        if (user is null)
        {
            return NotFound();
        }

        var token = await userManager.GeneratePasswordResetTokenAsync(user);
        var result = await userManager.ResetPasswordAsync(user, token, request.NewPassword);
        if (!result.Succeeded)
        {
            return IdentityErrors(result);
        }

        await userManager.SetLockoutEndDateAsync(user, null);
        await AuditAsync(AuditAction.Update, user, "{\"field\":\"Password\",\"by\":\"Administrator\"}");
        return NoContent();
    }

    // PUT /api/users/{id}/status   - deactivate instead of deleting (hospital records must keep who did what)
    [HttpPut("{id}/status")]
    public async Task<ActionResult<UserResponse>> UpdateStatus(string id, UpdateUserStatusRequest request)
    {
        var user = await userManager.FindByIdAsync(id);
        if (user is null)
        {
            return NotFound();
        }

        if (!request.IsActive && user.Id == userManager.GetUserId(User))
        {
            return Problem(statusCode: 400, title: "You cannot deactivate your own account.");
        }

        user.IsActive = request.IsActive;
        await userManager.UpdateAsync(user);
        await userManager.UpdateSecurityStampAsync(user);
        await AuditAsync(AuditAction.Update, user, $"{{\"isActive\":{request.IsActive.ToString().ToLowerInvariant()}}}");
        return await ToResponse(user);
    }

    private async Task<UserResponse> ToResponse(AppUser user) =>
        new(user.Id, user.UserName!, user.Email, user.IsActive,
            await userManager.IsLockedOutAsync(user),
            (await userManager.GetRolesAsync(user)).ToList());

    private Task AuditAsync(AuditAction action, AppUser target, string changes) =>
        audit.LogAsync(action, userManager.GetUserId(User), User.Identity?.Name, "User", target.Id, changes);

    private ActionResult IdentityErrors(IdentityResult result)
    {
        foreach (var error in result.Errors)
        {
            ModelState.AddModelError(error.Code, error.Description);
        }
        return ValidationProblem(ModelState);
    }
}
