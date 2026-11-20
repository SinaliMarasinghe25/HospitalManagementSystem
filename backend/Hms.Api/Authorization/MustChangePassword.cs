using System.Security.Claims;
using Hms.Api.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace Hms.Api.Authorization;

// After an administrator sets someone's password (new account or reset), that person must choose their own
// password before they can use the system. Only they then know it.

// Puts a claim in the sign-in cookie when the user still has a temporary password,
// so the check below needs no database query on every request.
public class HmsClaimsPrincipalFactory(
    UserManager<AppUser> userManager,
    RoleManager<IdentityRole> roleManager,
    IOptions<IdentityOptions> options)
    : UserClaimsPrincipalFactory<AppUser, IdentityRole>(userManager, roleManager, options)
{
    public const string MustChangePasswordClaim = "hms:must_change_password";

    protected override async Task<ClaimsIdentity> GenerateClaimsAsync(AppUser user)
    {
        var identity = await base.GenerateClaimsAsync(user);
        if (user.MustChangePassword)
        {
            identity.AddClaim(new Claim(MustChangePasswordClaim, "true"));
        }
        return identity;
    }
}

public static class MustChangePasswordMiddleware
{
    // The only API calls allowed while the password is temporary.
    private static readonly string[] Allowed = ["/api/auth/me", "/api/auth/change-password", "/api/auth/logout", "/api/auth/login"];

    public static IApplicationBuilder UseMustChangePassword(this IApplicationBuilder app) =>
        app.Use(async (context, next) =>
        {
            var path = context.Request.Path.Value ?? string.Empty;
            if (path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase) &&
                context.User.HasClaim(HmsClaimsPrincipalFactory.MustChangePasswordClaim, "true") &&
                !Allowed.Contains(path.TrimEnd('/').ToLowerInvariant()))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new
                {
                    title = "Change your temporary password first.",
                    status = StatusCodes.Status403Forbidden,
                });
                return;
            }
            await next();
        });
}
