using System.Text.Json.Serialization;
using Hms.Api.Authorization;
using Hms.Api.Data;
using Hms.Api.Entities;
using Hms.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// ---------- Database ----------
// The connection string comes from User Secrets (development) or an environment variable (production).
// It is never written in appsettings.json, so the password never reaches GitHub.
var connectionString = builder.Configuration.GetConnectionString("HmsDatabase")
    ?? throw new InvalidOperationException("Connection string 'HmsDatabase' is not configured.");

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
});

// Re-check every minute that the user's security stamp is unchanged,
// so a deactivated user or changed roles take effect quickly.
builder.Services.Configure<SecurityStampValidatorOptions>(options =>
    options.ValidationInterval = TimeSpan.FromMinutes(1));

// ---------- Authorization ----------
// Secure by default: every endpoint needs a logged-in user unless it says [AllowAnonymous].
builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build())
    .AddHmsPolicies();   // named permissions, see Authorization/Policies.cs

// ---------- Our services ----------
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<AuditService>();
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

// Errors are returned as safe JSON (ProblemDetails) without stack traces.
builder.Services.AddProblemDetails();

// Enums travel as text in JSON ("Female"), matching how they are stored in the database.
builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

// ---------- Create roles, the first admin and the starter data ----------
using (var scope = app.Services.CreateScope())
{
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    await IdentitySeeder.SeedAsync(scope.ServiceProvider, app.Configuration, logger);
    await MedicineSeeder.SeedAsync(scope.ServiceProvider.GetRequiredService<AppDbContext>(), logger);
    await LabTestSeeder.SeedAsync(scope.ServiceProvider.GetRequiredService<AppDbContext>(), logger);
    await DepartmentSeeder.SeedAsync(scope.ServiceProvider.GetRequiredService<AppDbContext>(), logger);
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

app.UseAuthentication();   // 1. Who are you? (reads the cookie)
app.UseMustChangePassword(); // 1b. A temporary password must be replaced before anything else.
app.UseAuthorization();    // 2. Are you allowed? (checks roles and policies)

app.MapControllers();

app.Run();
