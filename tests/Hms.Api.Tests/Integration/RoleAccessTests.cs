using Hms.Api.Authorization;
using Hms.Api.Tests.Infrastructure;

namespace Hms.Api.Tests.Integration;

// FR-UM-05: "tests prove each role is refused outside its permissions".
// The unit tests check the whole role table. These check that the real endpoints use it:
// a real login, a real HTTP request, and the answer must be 200 OK or exactly 403 Forbidden.
[Collection(ApiCollection.Name)]
public class RoleAccessTests(HmsApiFactory api)
{
    private const string A = Roles.Administrator, D = Roles.Doctor, N = Roles.Nurse, R = Roles.Receptionist,
        L = Roles.LaboratoryStaff, P = Roles.Pharmacist, C = Roles.Accountant;

    // GET endpoint -> the roles that may open it.
    public static TheoryData<string, string, bool> Cases()
    {
        var table = new (string Url, string[] Allowed)[]
        {
            ("/api/patients", [A, D, N, R]),
            ("/api/billing/invoices?due=true", [A, R, C]),
            ("/api/billing/unbilled", [A, C]),               // line items: not for reception
            ("/api/audit-log", [A]),
            ("/api/users", [A]),
            ("/api/lab/requests?status=Requested", [A, D, N, L]),
            ("/api/pharmacy/medicines", [A, D, P, C]),
            ("/api/reports/revenue?fromDate=2026-11-01&toDate=2026-11-20", [A, C]),
        };
        var data = new TheoryData<string, string, bool>();
        foreach (var (url, allowed) in table)
        {
            foreach (var role in Roles.All) data.Add(url, role, allowed.Contains(role));
        }
        return data;
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public async Task Each_role_can_open_only_its_own_pages(string url, string role, bool allowed)
    {
        var client = await api.LoginAsAsync(role);

        var response = await client.GetAsync(url);

        if (allowed)
        {
            Assert.True(response.IsSuccessStatusCode,
                $"{role} should be able to open {url}, but got {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        }
        else
        {
            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }
    }

    [Theory]
    [InlineData(Roles.Doctor)]
    [InlineData(Roles.Nurse)]
    [InlineData(Roles.Accountant)]
    [InlineData(Roles.Pharmacist)]
    [InlineData(Roles.LaboratoryStaff)]
    public async Task Only_reception_and_admin_can_register_a_patient(string role)
    {
        var client = await api.LoginAsAsync(role);

        var response = await client.PostJsonAsync("/api/patients", NewPatient());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Reception_can_register_a_patient_and_gets_a_patient_number()
    {
        var client = await api.LoginAsAsync(Roles.Receptionist);

        var response = await client.PostJsonAsync("/api/patients", NewPatient());

        var patient = await response.ReadAsAsync<Hms.Api.Dtos.PatientDetail>(HttpStatusCode.Created);
        Assert.Matches("^P-[0-9]{6}$", patient.PatientNumber);
    }

    [Fact]
    public async Task Invalid_patient_data_gets_400_with_the_problems()
    {
        var client = await api.LoginAsAsync(Roles.Receptionist);

        var response = await client.PostJsonAsync("/api/patients", new
        {
            firstName = "",
            lastName = "Perera",
            dateOfBirth = "1990-01-01",
            gender = "Male",
            phone = "abc",
            nationalId = "12345",
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("FirstName", body);
        Assert.Contains("Phone", body);
        Assert.Contains("NationalId", body);
    }

    private static object NewPatient() => new
    {
        firstName = "Nimali",
        lastName = "Perera",
        dateOfBirth = "1990-04-12",
        gender = "Female",
        phone = "0771234567",
    };
}
