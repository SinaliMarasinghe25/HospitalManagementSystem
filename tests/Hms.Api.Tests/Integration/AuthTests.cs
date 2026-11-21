using Hms.Api.Authorization;
using Hms.Api.Dtos;
using Hms.Api.Tests.Infrastructure;

namespace Hms.Api.Tests.Integration;

// FR-UM-01 Login, FR-UM-02 Logout, NFR-SEC-01 lockout, temporary passwords, "forgot password" rate limit.
[Collection(ApiCollection.Name)]
public class AuthTests(HmsApiFactory api)
{
    [Fact]
    public async Task Login_with_the_right_password_returns_the_user_and_roles()
    {
        var user = await api.CreateUserAsync([Roles.Doctor, Roles.Nurse]);
        var client = api.CreateBrowserClient();

        var response = await client.PostJsonAsync("/api/auth/login", new { userName = user.UserName, password = HmsApiFactory.Password });

        var me = await response.ReadAsAsync<CurrentUserResponse>();
        Assert.Equal(user.UserName, me.UserName);
        Assert.Equal([Roles.Doctor, Roles.Nurse], me.Roles.Order());
        // The sign-in cookie is HttpOnly (JavaScript cannot read it), Secure and SameSite=Strict.
        var cookie = Assert.Single(response.Headers.GetValues("Set-Cookie"), c => c.StartsWith("hms.auth="));
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("secure", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=strict", cookie, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Wrong_password_and_unknown_user_get_the_same_message()
    {
        var user = await api.CreateUserAsync([Roles.Nurse]);
        var client = api.CreateBrowserClient();

        var wrongPassword = await client.PostJsonAsync("/api/auth/login", new { userName = user.UserName, password = "Wrong#Pass999" });
        var unknownUser = await client.PostJsonAsync("/api/auth/login", new { userName = "nobody_here", password = "Wrong#Pass999" });

        Assert.Equal(HttpStatusCode.Unauthorized, wrongPassword.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unknownUser.StatusCode);
        // An attacker must not be able to find out which user names exist.
        Assert.Equal(await TitleOf(wrongPassword), await TitleOf(unknownUser));
    }

    [Fact]
    public async Task Five_wrong_passwords_lock_the_account()
    {
        var user = await api.CreateUserAsync([Roles.Receptionist]);
        var client = api.CreateBrowserClient();

        for (var i = 0; i < 5; i++)
        {
            await client.PostJsonAsync("/api/auth/login", new { userName = user.UserName, password = "Wrong#Pass999" });
        }
        // Now even the right password is refused for 15 minutes.
        var response = await client.PostJsonAsync("/api/auth/login", new { userName = user.UserName, password = HmsApiFactory.Password });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Contains("locked", await TitleOf(response), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task A_deactivated_user_cannot_log_in()
    {
        var user = await api.CreateUserAsync([Roles.Nurse]);
        await using (var db = api.CreateDbContext())
        {
            var row = await db.Users.FindAsync(user.Id);
            row!.IsActive = false;
            await db.SaveChangesAsync();
        }

        var response = await api.CreateBrowserClient()
            .PostJsonAsync("/api/auth/login", new { userName = user.UserName, password = HmsApiFactory.Password });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Without_logging_in_every_api_call_gets_401()
    {
        var client = api.CreateBrowserClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/patients")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/dashboard")).StatusCode);
    }

    [Fact]
    public async Task After_logout_the_cookie_no_longer_works()
    {
        var client = await api.LoginAsAsync(Roles.Receptionist);
        (await client.GetAsync("/api/auth/me")).EnsureSuccessStatusCode();

        var logout = await client.PostAsync("/api/auth/logout", null);

        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task A_temporary_password_must_be_changed_before_anything_else()
    {
        var user = await api.CreateUserAsync([Roles.Receptionist], mustChangePassword: true);
        var client = await api.LoginAsync(user.UserName!);

        // Blocked everywhere except "who am I" and "change password".
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/patients")).StatusCode);
        var me = await (await client.GetAsync("/api/auth/me")).ReadAsAsync<CurrentUserResponse>();
        Assert.True(me.MustChangePassword);

        var change = await client.PostJsonAsync("/api/auth/change-password",
            new { currentPassword = HmsApiFactory.Password, newPassword = "MyOwn#Pass456" });

        Assert.Equal(HttpStatusCode.NoContent, change.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/patients")).StatusCode);
    }

    [Fact]
    public async Task A_weak_new_password_is_refused()
    {
        var client = await api.LoginAsAsync(Roles.Nurse);

        var response = await client.PostJsonAsync("/api/auth/change-password",
            new { currentPassword = HmsApiFactory.Password, newPassword = "password" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Forgot_password_allows_five_requests_then_says_wait()
    {
        var client = api.CreateBrowserClient();
        for (var i = 0; i < 5; i++)
        {
            var ok = await client.PostJsonAsync("/api/auth/forgot-password", new { userName = "nobody_here" });
            Assert.Equal(HttpStatusCode.NoContent, ok.StatusCode);
        }

        var sixth = await client.PostJsonAsync("/api/auth/forgot-password", new { userName = "nobody_here" });

        Assert.Equal(HttpStatusCode.TooManyRequests, sixth.StatusCode);
    }

    private static async Task<string> TitleOf(HttpResponseMessage response)
    {
        var problem = await response.Content.ReadFromJsonAsync<ProblemBody>();
        return problem?.Title ?? "";
    }

    private record ProblemBody(string? Title);
}
