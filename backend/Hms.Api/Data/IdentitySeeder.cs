using Hms.Api.Authorization;
using Hms.Api.Entities;
using Microsoft.AspNetCore.Identity;

namespace Hms.Api.Data;

// Creates the 7 roles and the first Administrator account when the app starts.
// Without a first admin, nobody could log in to create the other users.
public static class IdentitySeeder
{
    public static async Task SeedAsync(IServiceProvider services, IConfiguration configuration, ILogger logger)
    {
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
        var userManager = services.GetRequiredService<UserManager<AppUser>>();

        foreach (var role in Roles.All)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole(role));
                logger.LogInformation("Created role {Role}", role);
            }
        }

        var adminUserName = configuration["Seed:AdminUserName"] ?? "admin";
        if (await userManager.FindByNameAsync(adminUserName) is not null)
        {
            return;
        }

        // The password comes from User Secrets (development) or an environment variable (production).
        var adminPassword = configuration["Seed:AdminPassword"];
        if (string.IsNullOrWhiteSpace(adminPassword))
        {
            logger.LogWarning("Seed:AdminPassword is not set, so no admin account was created.");
            return;
        }

        var admin = new AppUser { UserName = adminUserName, Email = configuration["Seed:AdminEmail"] };
        var result = await userManager.CreateAsync(admin, adminPassword);
        if (!result.Succeeded)
        {
            logger.LogError("Could not create admin: {Errors}",
                string.Join("; ", result.Errors.Select(e => e.Description)));
            return;
        }

        await userManager.AddToRoleAsync(admin, Roles.Administrator);
        logger.LogInformation("Created admin account {UserName}", adminUserName);
    }
}
