using Hms.Api.Data;
using Hms.Api.Entities;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace Hms.Api.Tests.Infrastructure;

// Starts the real API in memory (no browser, no port) against a brand-new, empty PostgreSQL database.
//
// Where the database comes from:
//   1. The environment variable HMS_TEST_DATABASE, if it is set (a full connection string), or
//   2. the API's own User Secret ConnectionStrings:HmsDatabase (the one you set in step 8).
// Either way, only the server, user name and password are used. The tests always make their OWN database,
// named hms_test_<random>, run every migration on it, and delete it at the end.
// Your real "hms" database is never read or changed.
public class HmsApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string AdminUserName = "testadmin";
    public const string Password = "Test#Pass123";

    public string ConnectionString { get; } = BuildTestConnectionString();

    private static string BuildTestConnectionString()
    {
        var config = new ConfigurationBuilder()
            .AddUserSecrets(typeof(Program).Assembly, optional: true)
            .AddEnvironmentVariables()
            .Build();

        var baseConnection = config["HMS_TEST_DATABASE"] ?? config.GetConnectionString("HmsDatabase")
            ?? throw new InvalidOperationException(
                "No database for the tests. Set the API's User Secret ConnectionStrings:HmsDatabase (step 8) " +
                "or the environment variable HMS_TEST_DATABASE.");

        var builder = new NpgsqlConnectionStringBuilder(baseConnection)
        {
            Database = $"hms_test_{Guid.NewGuid():N}"[..20],
        };
        return builder.ConnectionString;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // "Testing", not "Development": the API then does not read your User Secrets,
        // so only the settings below are used (test database, test admin).
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:HmsDatabase", ConnectionString);
        builder.UseSetting("Seed:AdminUserName", AdminUserName);
        builder.UseSetting("Seed:AdminPassword", Password);
        builder.UseSetting("Logging:LogLevel:Default", "Warning");
        builder.UseSetting("Logging:LogLevel:Microsoft.EntityFrameworkCore", "Warning");
    }

    // Runs once, before the first test: create the database and its tables with the real migrations.
    public async ValueTask InitializeAsync()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(ConnectionString).Options;
        await using var db = new AppDbContext(options);
        await db.Database.MigrateAsync();

        // Starts the API, which seeds the roles, the test admin and the starter data.
        _ = Server;
    }

    // Runs once, after the last test: delete the test database.
    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(ConnectionString).Options;
        await using var db = new AppDbContext(options);
        NpgsqlConnection.ClearAllPools();
        await db.Database.EnsureDeletedAsync();
        GC.SuppressFinalize(this);
    }

    // An HttpClient that keeps the sign-in cookie, like a browser.
    // https:// because the cookie is "Secure" and is only sent over HTTPS.
    public HttpClient CreateBrowserClient() => CreateClient(new WebApplicationFactoryClientOptions
    {
        BaseAddress = new Uri("https://localhost"),
        AllowAutoRedirect = false,
        HandleCookies = true,
    });

    // A fresh database context, to put test data in or check what the API saved.
    public AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(ConnectionString).Options;
        return new AppDbContext(options);
    }

    // Makes a login with the given roles. Each call makes a new, unique user name.
    public async Task<AppUser> CreateUserAsync(string[] roles, bool mustChangePassword = false, string? userName = null)
    {
        using var scope = Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var user = new AppUser
        {
            UserName = userName ?? $"user_{Guid.NewGuid():N}"[..20],
            MustChangePassword = mustChangePassword,
        };
        var created = await users.CreateAsync(user, Password);
        if (!created.Succeeded)
        {
            throw new InvalidOperationException(string.Join("; ", created.Errors.Select(e => e.Description)));
        }
        if (roles.Length > 0) await users.AddToRolesAsync(user, roles);
        return user;
    }

    // A signed-in client for a new user with these roles.
    public async Task<HttpClient> LoginAsAsync(params string[] roles)
    {
        var user = await CreateUserAsync(roles);
        return await LoginAsync(user.UserName!);
    }

    public async Task<HttpClient> LoginAsync(string userName, string password = Password)
    {
        var client = CreateBrowserClient();
        var response = await client.PostAsJsonAsync("/api/auth/login", new { userName, password });
        response.EnsureSuccessStatusCode();
        return client;
    }
}

// One shared API and database for all integration tests (starting them takes a few seconds).
// Tests in this collection run one after another, and each test makes its own users, patients and charges,
// so tests never depend on each other.
[CollectionDefinition(Name)]
public class ApiCollection : ICollectionFixture<HmsApiFactory>
{
    public const string Name = "API";
}
