using System.Reflection;
using System.Security.Claims;
using Hms.Api.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection;

namespace Hms.Api.Tests.Unit;

// FR-UM-05 / NFR-SEC-03: the role table from the project plan (section 4), written out a second time here.
// Every permission is checked for all 7 roles: the roles listed must be allowed, every other role refused.
// If someone changes Policies.cs by mistake, these tests fail and say which role and permission changed.
public class RolePermissionTests
{
    private const string A = Roles.Administrator, D = Roles.Doctor, N = Roles.Nurse, R = Roles.Receptionist,
        L = Roles.LaboratoryStaff, P = Roles.Pharmacist, C = Roles.Accountant;

    // Permission -> the roles that have it. Everyone else must get 403.
    private static readonly Dictionary<string, string[]> RoleTable = new()
    {
        [Policies.ViewPatients] = [A, D, N, R],
        [Policies.EditPatients] = [A, R],
        [Policies.ViewMedicalHistory] = [A, D, N],
        [Policies.ViewPatientDocuments] = [A, D, N, R],
        [Policies.UploadPatientDocuments] = [A, D, R],
        [Policies.ViewDoctors] = [A, D, N, R],
        [Policies.ManageDoctors] = [A],
        [Policies.ViewAppointments] = [A, D, N, R],
        [Policies.BookAppointments] = [A, R],
        [Policies.UpdateAppointmentStatus] = [A, D, R],
        [Policies.EditMedicalRecords] = [D],
        [Policies.ViewPrescriptions] = [A, D, N, P],
        [Policies.ViewAdmissions] = [A, D, N, R],
        [Policies.AdmitPatients] = [A, D, R],
        [Policies.TransferPatients] = [A, D, N],
        [Policies.RecordVitals] = [A, D, N],
        [Policies.DischargePatients] = [A, D],
        [Policies.ManageWards] = [A],
        [Policies.ViewLabRequests] = [A, D, N, L],
        [Policies.RequestLabTests] = [D],
        [Policies.ProcessLabRequests] = [L],
        [Policies.ManageLabTests] = [A],
        [Policies.ViewPharmacyStock] = [A, D, P, C],
        [Policies.ManagePharmacyStock] = [P],
        [Policies.DispenseMedicines] = [P],
        [Policies.EditMedicinePrices] = [A, P, C],
        [Policies.ViewInvoiceBalances] = [A, R, C],
        [Policies.ViewInvoiceDetails] = [A, C],
        [Policies.ManageBilling] = [C],
        [Policies.ViewRevenue] = [A, C],
        [Policies.ManageStaff] = [A],
        [Policies.ViewPatientReport] = [A, D, N],
        [Policies.ViewAppointmentReport] = [A, D, R],
        [Policies.ViewPharmacyReport] = [A, P],
        [Policies.ViewLabReport] = [A, D, L],
        [Policies.ViewAuditLog] = [A],
    };

    // Every (permission, role) pair: 36 permissions x 7 roles.
    public static TheoryData<string, string, bool> AllPairs()
    {
        var data = new TheoryData<string, string, bool>();
        foreach (var (policy, allowed) in RoleTable)
        {
            foreach (var role in Roles.All)
            {
                data.Add(policy, role, allowed.Contains(role));
            }
        }
        return data;
    }

    [Theory]
    [MemberData(nameof(AllPairs))]
    public async Task Each_role_gets_exactly_the_permissions_in_the_role_table(string policy, string role, bool expected)
    {
        var allowed = await IsAllowedAsync(policy, role);
        Assert.True(allowed == expected,
            $"{role} should {(expected ? "" : "NOT ")}have permission {policy}, but {(allowed ? "has" : "does not have")} it.");
    }

    [Fact]
    public void Every_permission_in_Policies_cs_is_in_the_role_table()
    {
        // A new permission must be added to the table above, so it gets tested too.
        var defined = typeof(Policies).GetFields(BindingFlags.Public | BindingFlags.Static)
            .Where(f => f.IsLiteral && f.FieldType == typeof(string))
            .Select(f => (string)f.GetRawConstantValue()!);
        Assert.Empty(defined.Except(RoleTable.Keys));
    }

    [Fact]
    public async Task A_user_without_any_role_has_no_permission()
    {
        foreach (var policy in RoleTable.Keys)
        {
            Assert.False(await IsAllowedAsync(policy, role: null), $"A user without roles got {policy}.");
        }
    }

    private static async Task<bool> IsAllowedAsync(string policy, string? role)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddAuthorizationBuilder().AddHmsPolicies();
        using var provider = services.BuildServiceProvider();

        var claims = new List<Claim> { new(ClaimTypes.Name, "someone") };
        if (role is not null) claims.Add(new Claim(ClaimTypes.Role, role));
        var user = new ClaimsPrincipal(new ClaimsIdentity(claims, authenticationType: "Test"));

        var result = await provider.GetRequiredService<IAuthorizationService>().AuthorizeAsync(user, policy);
        return result.Succeeded;
    }
}
