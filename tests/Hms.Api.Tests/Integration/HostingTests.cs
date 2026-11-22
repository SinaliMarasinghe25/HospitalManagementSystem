using Hms.Api.Tests.Infrastructure;

namespace Hms.Api.Tests.Integration;

// Things the hosting platform relies on (step 29): the health check and the security headers.
[Collection(ApiCollection.Name)]
public class HostingTests(HmsApiFactory api)
{
    [Fact]
    public async Task Health_check_is_public_and_reports_healthy()
    {
        var client = api.CreateBrowserClient();   // not logged in

        var response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Responses_carry_the_security_headers()
    {
        var client = api.CreateBrowserClient();

        var response = await client.GetAsync("/health");

        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("DENY", response.Headers.GetValues("X-Frame-Options").Single());
        Assert.Contains("frame-ancestors 'none'", response.Headers.GetValues("Content-Security-Policy").Single());
    }
}
