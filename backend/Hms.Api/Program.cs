using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Hms.Api.Authorization;
using Hms.Api.Controllers;
using Hms.Api.Data;
using Hms.Api.Entities;
using Hms.Api.Hosting;
using Hms.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// ---------- Database ----------
// The connection string comes from User Secrets (development) or an environment variable (production).
// It is never written in appsettings.json, so the password never reaches GitHub.
// A hosting company's postgresql://... URL works too (see Hosting/DatabaseUrl.cs).
var connectionString = DatabaseUrl.ToNpgsqlConnectionString(
    builder.Configuration.GetConnectionString("HmsDatabase")
    ?? throw new InvalidOperationException("Connection string 'HmsDatabase' is not configured."));

builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));

// ---------- Identity: users, roles, password hashing, lockout ----------
builder.Services
    .AddIdentity<AppUser, IdentityRole>(options =>
    {
        // Password policy
        options.Password.RequiredLength = 8;
        options.Password.RequireDigit = true;
        options.Password.RequireUppercase = true;
        options.Password.RequireLowercase = true;
        options.Password.RequireNonAlphanumeric = true;

        // Lock the account for 15 minutes after 5 wrong passwords (stops password guessing).
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
        options.Lockout.AllowedForNewUsers = true;

        options.User.RequireUniqueEmail = false;
    })
    .AddEntityFrameworkStores<AppDbContext>()
    .AddDefaultTokenProviders()
    // Adds the "must change password" claim to the sign-in cookie (see Authorization/MustChangePassword.cs).
    .AddClaimsPrincipalFactory<HmsClaimsPrincipalFactory>();

// ---------- The sign-in cookie ----------
builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.Name = "hms.auth";
    options.Cookie.HttpOnly = true;                           // JavaScript cannot read it (protects against XSS theft)
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;  // only sent over HTTPS
    options.Cookie.SameSite = SameSiteMode.Strict;            // not sent from other websites (protects against CSRF)

    // PDF section 4: Automatic Session Timeout. 20 minutes without activity ends the session.
    options.ExpireTimeSpan = TimeSpan.FromMinutes(20);
    options.SlidingExpiration = true;

    // An API must answer 401/403, not redirect to a login web page.
    options.Events.OnRedirectToLogin = context =>
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    };
    options.Events.OnRedirectToAccessDenied = context =>
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return Task.CompletedTask;
    };

    // The notification bell asks for its unread count every minute, and an open dashboard reloads its numbers
    // every 30 seconds. Those automatic questions must not count as "activity",
    // or an unattended screen would never reach the 20-minute timeout.
    options.Events.OnCheckSlidingExpiration = context =>
    {
        if (context.Request.Path.StartsWithSegments("/api/notifications/unread-count") ||
            context.Request.Path.StartsWithSegments("/api/dashboard"))
        {
            context.ShouldRenew = false;
        }
        return Task.CompletedTask;
    };
});

// ---------- Data protection keys (they encrypt the sign-in cookie) ----------
// In a container the keys would vanish on every restart and log everybody out.
// DataProtection:KeysPath (set in docker-compose.yml) keeps them in a folder that survives restarts.
var keysPath = builder.Configuration["DataProtection:KeysPath"];
if (!string.IsNullOrWhiteSpace(keysPath))
{
    builder.Services.AddDataProtection()
        .SetApplicationName("Hms")
        .PersistKeysToFileSystem(new DirectoryInfo(keysPath));
}

// ---------- Health check: GET /health answers "Healthy" when the API can reach the database ----------
builder.Services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database");

// Re-check every minute that the user's security stamp is unchanged,
// so a deactivated user or changed roles take effect quickly.
builder.Services.Configure<SecurityStampValidatorOptions>(options =>
    options.ValidationInterval = TimeSpan.FromMinutes(1));

// ---------- Authorization ----------
// Secure by default: every endpoint needs a logged-in user unless it says [AllowAnonymous].
builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build())
    .AddHmsPolicies();   // named permissions, see Authorization/Policies.cs

// ---------- Rate limit for "forgot password" ----------
// At most 5 requests per 15 minutes from one IP address, so nobody can flood the administrators with requests.
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy(AuthController.PasswordResetRateLimit, context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(15) }));
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            title = "Too many attempts. Wait 15 minutes, then try again.",
            status = StatusCodes.Status429TooManyRequests,
        }, cancellationToken);
    };
});

// ---------- Our services ----------
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<AuditService>();
builder.Services.AddScoped<NotificationService>();
builder.Services.AddScoped<PatientService>();
builder.Services.AddScoped<PatientDocumentService>();
builder.Services.AddScoped<DepartmentService>();
builder.Services.AddScoped<DoctorService>();
builder.Services.AddScoped<AppointmentService>();
builder.Services.AddScoped<MedicalRecordService>();
builder.Services.AddScoped<WardService>();
builder.Services.AddScoped<AdmissionService>();
builder.Services.AddScoped<LabService>();
builder.Services.AddScoped<PharmacyService>();
builder.Services.AddScoped<BillingService>();
builder.Services.AddScoped<StaffService>();
builder.Services.AddScoped<EmployeeService>();
builder.Services.AddScoped<UserAccountService>();
builder.Services.AddScoped<ReportService>();
builder.Services.AddScoped<DashboardService>();

// Errors are returned as safe JSON (ProblemDetails) without stack traces.
builder.Services.AddProblemDetails();

// Enums travel as text in JSON ("Female"), matching how they are stored in the database.
builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

// ---------- Create the tables (production), roles, the first admin and the starter data ----------
using (var scope = app.Services.CreateScope())
{
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    // On a server there is no "dotnet ef database update", so the API applies any new migrations itself
    // when Database:MigrateOnStartup is true (set in docker-compose.yml and render.yaml).
    // Locally it stays off: you run migrations by hand, as before.
    if (app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
    {
        logger.LogInformation("Applying database migrations...");
        await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync();
    }

    await IdentitySeeder.SeedAsync(scope.ServiceProvider, app.Configuration, logger);
    await MedicineSeeder.SeedAsync(scope.ServiceProvider.GetRequiredService<AppDbContext>(), logger);
    await LabTestSeeder.SeedAsync(scope.ServiceProvider.GetRequiredService<AppDbContext>(), logger);
    await DepartmentSeeder.SeedAsync(scope.ServiceProvider.GetRequiredService<AppDbContext>(), logger);

    // Demo data for a presentation: only when Seed:DemoData is true, and only once (see Data/DemoDataSeeder.cs).
    await DemoDataSeeder.SeedAsync(scope.ServiceProvider, app.Configuration, logger);
}

// ---------- HTTP request pipeline (order matters) ----------
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
}
else
{
    app.UseExceptionHandler();
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseSecurityHeaders();

// The built React app (only inside the Docker image, in wwwroot). The API and the web pages then come
// from ONE address, so the sign-in cookie works without CORS, exactly like the Vite proxy in development.
var serveFrontend = app.Environment.WebRootPath is not null
    && File.Exists(Path.Combine(app.Environment.WebRootPath, "index.html"));
if (serveFrontend)
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

app.UseRateLimiter();      // 0. Too many "forgot password" requests are refused here.
app.UseAuthentication();   // 1. Who are you? (reads the cookie)
app.UseMustChangePassword(); // 1b. A temporary password must be replaced before anything else.
app.UseAuthorization();    // 2. Are you allowed? (checks roles and policies)

app.MapControllers();
app.MapHealthChecks("/health").AllowAnonymous();

if (serveFrontend)
{
    // An unknown /api address is a real 404, never the web page.
    app.Map("/api/{**rest}", () => Results.NotFound()).AllowAnonymous();
    // Any other address (for example /patients/5 after a page refresh) gets the React app,
    // and React Router shows the right screen. Logging in is still checked by every API call.
    app.MapFallbackToFile("index.html").AllowAnonymous();
}

app.Run();
