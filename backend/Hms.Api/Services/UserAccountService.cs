using Hms.Api.Authorization;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Services;

// Login accounts (PDF 3.1 User Management). All the rules about accounts and roles live here,
// so every screen of the Staff page applies the same rules.
//
// Rules:
// - A login is created from a person's staff record (EmployeeService), never on its own.
// - Identity hashes every password; the plain text is never stored or logged.
// - A password set by an administrator is temporary: the user must replace it at the next login.
// - Assumption A25 (proposed): the Doctor role belongs exactly to logins linked to an employee with a doctor
//   profile, because doctor screens find "my appointments" through that link. It is set automatically.
// - There is always at least one active Administrator, and nobody can remove their own Administrator role.
public class UserAccountService(UserManager<AppUser> userManager, NotificationService notifications)
{
    // ---------- Reading ----------

    public async Task<List<UserResponse>> ListAsync()
    {
        var users = await QueryWithEmployee().OrderBy(u => u.UserName).ToListAsync();
        var result = new List<UserResponse>();
        foreach (var user in users)
        {
            result.Add(await ToResponseAsync(user));
        }
        return result;
    }

    public async Task<UserResponse?> GetAsync(string id)
    {
        var user = await FindAsync(id);
        return user is null ? null : await ToResponseAsync(user);
    }

    // ---------- Creating (called by EmployeeService only) ----------

    public async Task<ServiceResult<AppUser>> CreateAsync(
        string userName, string? email, string password, IEnumerable<string> roles, bool isDoctor)
    {
        var roleList = WithDoctorRole(roles, isDoctor);
        var roleError = CheckRoles(roleList, isDoctor);
        if (roleError is not null) return Invalid<AppUser>("Roles", roleError);

        var user = new AppUser
        {
            UserName = userName.Trim(),
            Email = string.IsNullOrWhiteSpace(email) ? null : email.Trim(),
            MustChangePassword = true,
        };

        var result = await userManager.CreateAsync(user, password);
        if (!result.Succeeded) return ServiceResult<AppUser>.Invalid(ToFieldErrors(result));

        await userManager.AddToRolesAsync(user, roleList);
        return ServiceResult<AppUser>.Ok(user);
    }

    // ---------- Changing (Staff page, Logins tab) ----------

    public async Task<ServiceResult<UserResponse>> UpdateRolesAsync(string id, IEnumerable<string> roles, string? currentUserId)
    {
        var user = await FindAsync(id);
        if (user is null) return ServiceResult<UserResponse>.NotFound();

        var isDoctor = user.Employee?.Doctor is not null;
        var newRoles = WithDoctorRole(roles, isDoctor);
        var roleError = CheckRoles(newRoles, isDoctor);
        if (roleError is not null) return Invalid<UserResponse>("Roles", roleError);

        var current = await userManager.GetRolesAsync(user);
        if (current.Contains(Roles.Administrator) && !newRoles.Contains(Roles.Administrator))
        {
            var adminError = await CheckCanLoseAdminAsync(user, currentUserId);
            if (adminError is not null) return Invalid<UserResponse>("Roles", adminError);
        }

        await userManager.RemoveFromRolesAsync(user, current.Except(newRoles));
        await userManager.AddToRolesAsync(user, newRoles.Except(current));

        // A new security stamp signs the user out within a minute, so the new roles apply at once.
        await userManager.UpdateSecurityStampAsync(user);
        return ServiceResult<UserResponse>.Ok(await ToResponseAsync(user));
    }

    public async Task<ServiceResult<UserResponse>> SetActiveAsync(string id, bool isActive, string? currentUserId)
    {
        var user = await FindAsync(id);
        if (user is null) return ServiceResult<UserResponse>.NotFound();

        if (!isActive && await userManager.IsInRoleAsync(user, Roles.Administrator))
        {
            var adminError = await CheckCanLoseAdminAsync(user, currentUserId);
            if (adminError is not null) return Invalid<UserResponse>("IsActive", adminError);
        }

        user.IsActive = isActive;
        await userManager.UpdateAsync(user);
        await userManager.UpdateSecurityStampAsync(user);
        return ServiceResult<UserResponse>.Ok(await ToResponseAsync(user));
    }

    // The administrator sets a temporary password. This also unlocks a locked account.
    public async Task<ServiceResult<UserResponse>> ResetPasswordAsync(string id, string newPassword)
    {
        var user = await FindAsync(id);
        if (user is null) return ServiceResult<UserResponse>.NotFound();

        var token = await userManager.GeneratePasswordResetTokenAsync(user);
        var result = await userManager.ResetPasswordAsync(user, token, newPassword);
        if (!result.Succeeded) return ServiceResult<UserResponse>.Invalid(ToFieldErrors(result));

        await userManager.SetLockoutEndDateAsync(user, null);
        user.MustChangePassword = true;
        await userManager.UpdateAsync(user);
        await userManager.UpdateSecurityStampAsync(user);
        return ServiceResult<UserResponse>.Ok(await ToResponseAsync(user));
    }

    // ---------- Forgot password (assumption A28, proposed) ----------

    // Someone on the login page says they forgot their password. The administrators get a notification
    // and reset it on Staff > Logins with a temporary password, which the person must change at the next login.
    // PDF section 12 makes email a future enhancement, so nothing is emailed.
    // The controller always gives the same answer, so nobody can find out which usernames exist.
    public async Task RequestPasswordResetAsync(string userName)
    {
        var user = await userManager.FindByNameAsync(userName.Trim());
        if (user is null || !user.IsActive) return;

        await notifications.SendToRoleAsync(Roles.Administrator, "Password reset requested",
            $"{user.UserName} used \"Forgot password\" on the login page. Check it is really them, " +
            "then set a temporary password on Staff > Logins.",
            "/staff?tab=logins");
    }

    // ---------- Shared with EmployeeService ----------

    // Gives or takes the Doctor role when a login is linked to, or unlinked from, a doctor.
    public async Task SyncDoctorRoleAsync(AppUser user, bool isDoctor)
    {
        var hasRole = await userManager.IsInRoleAsync(user, Roles.Doctor);
        if (hasRole == isDoctor) return;

        if (isDoctor) await userManager.AddToRoleAsync(user, Roles.Doctor);
        else await userManager.RemoveFromRoleAsync(user, Roles.Doctor);
        await userManager.UpdateSecurityStampAsync(user);
    }

    public static string? CheckRoles(IReadOnlyCollection<string> roles, bool isDoctor)
    {
        if (roles.Count == 0) return "Choose at least one role.";

        var unknown = roles.Except(Roles.All).ToList();
        if (unknown.Count > 0) return $"Unknown role(s): {string.Join(", ", unknown)}";

        if (!isDoctor && roles.Contains(Roles.Doctor))
        {
            return "The Doctor role is only for staff with a doctor profile. Add the doctor profile on the Staff page first.";
        }
        return null;
    }

    // Identity reports codes like "PasswordRequiresDigit" or "DuplicateUserName"; put each under its form field.
    public static Dictionary<string, string[]> ToFieldErrors(IdentityResult result) =>
        result.Errors
            .GroupBy(e => e.Code.StartsWith("Password") ? "Password"
                : e.Code.Contains("UserName") ? "UserName"
                : e.Code.Contains("Email") ? "Email"
                : "Account")
            .ToDictionary(g => g.Key, g => g.Select(e => e.Description).ToArray());

    // ---------- Private helpers ----------

    // Doctors always keep the Doctor role; everyone else never has it (the check above refuses it).
    private static List<string> WithDoctorRole(IEnumerable<string> roles, bool isDoctor) =>
        (isDoctor ? roles.Append(Roles.Doctor) : roles).Distinct().ToList();

    private async Task<string?> CheckCanLoseAdminAsync(AppUser user, string? currentUserId)
    {
        if (user.Id == currentUserId)
        {
            return "You cannot remove your own Administrator access. Ask another administrator to do it.";
        }

        var otherActiveAdmins = (await userManager.GetUsersInRoleAsync(Roles.Administrator))
            .Count(a => a.IsActive && a.Id != user.Id);
        return otherActiveAdmins == 0
            ? "This is the last active administrator. Give another account the Administrator role first."
            : null;
    }

    private IQueryable<AppUser> QueryWithEmployee() =>
        userManager.Users.Include(u => u.Employee).ThenInclude(e => e!.Doctor);

    private Task<AppUser?> FindAsync(string id) => QueryWithEmployee().FirstOrDefaultAsync(u => u.Id == id);

    private async Task<UserResponse> ToResponseAsync(AppUser user) =>
        new(user.Id, user.UserName!, user.Email, user.IsActive,
            await userManager.IsLockedOutAsync(user),
            (await userManager.GetRolesAsync(user)).ToList(),
            user.MustChangePassword,
            user.Employee?.Id,
            user.Employee is null ? null : $"{user.Employee.FirstName} {user.Employee.LastName}",
            user.Employee?.Doctor is not null);

    private static ServiceResult<T> Invalid<T>(string field, string message) =>
        ServiceResult<T>.Invalid(new() { [field] = [message] });
}
