using Hms.Api.Authorization;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Hms.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Hms.Api.Controllers;

// PDF 3.1 User Management (Administrator only): roles, password resets, activating and deactivating.
// New logins are made from the person's staff record (StaffController), so every login belongs to someone.
// Accounts are never deleted, because the audit log and clinical records must keep who did what.
[ApiController]
[Route("api/users")]
[Authorize(Roles = Roles.Administrator)]
public class UsersController(UserAccountService accounts, AuditService audit, UserManager<AppUser> userManager) : ControllerBase
{
    // GET /api/users
    [HttpGet]
    public Task<List<UserResponse>> GetAll() => accounts.ListAsync();

    // PUT /api/users/{id}/roles
    [HttpPut("{id}/roles")]
    public async Task<ActionResult<UserResponse>> UpdateRoles(string id, UpdateUserRolesRequest request)
    {
        var result = await accounts.UpdateRolesAsync(id, request.Roles, userManager.GetUserId(User));
        if (result.IsNotFound) return NotFound();
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);

        await audit.LogChangeAsync(AuditAction.Update, "User", id, new { result.Value!.Roles });
        return result.Value;
    }

    // POST /api/users/{id}/reset-password   (the user must change it at the next login)
    [HttpPost("{id}/reset-password")]
    public async Task<ActionResult<UserResponse>> ResetPassword(string id, ResetPasswordRequest request)
    {
        var result = await accounts.ResetPasswordAsync(id, request.NewPassword);
        if (result.IsNotFound) return NotFound();
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);

        // Only the fact is logged, never the password.
        await audit.LogChangeAsync(AuditAction.Update, "User", id, new { Field = "Password", By = "Administrator" });
        return result.Value!;
    }

    // PUT /api/users/{id}/status   (deactivate instead of deleting)
    [HttpPut("{id}/status")]
    public async Task<ActionResult<UserResponse>> UpdateStatus(string id, UpdateUserStatusRequest request)
    {
        var result = await accounts.SetActiveAsync(id, request.IsActive, userManager.GetUserId(User));
        if (result.IsNotFound) return NotFound();
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);

        await audit.LogChangeAsync(AuditAction.Update, "User", id, new { request.IsActive });
        return result.Value!;
    }
}
