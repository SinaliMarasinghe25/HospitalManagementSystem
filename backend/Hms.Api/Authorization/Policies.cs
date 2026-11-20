using Microsoft.AspNetCore.Authorization;

namespace Hms.Api.Authorization;

// Named permissions, from the role table in the project plan (section 4).
// Controllers say [Authorize(Policy = Policies.EditPatients)] instead of listing roles everywhere,
// so a permission change is made in one place.
public static class Policies
{
    public const string ViewPatients = nameof(ViewPatients);
    public const string EditPatients = nameof(EditPatients);
    public const string ViewMedicalHistory = nameof(ViewMedicalHistory);
    public const string ViewPatientDocuments = nameof(ViewPatientDocuments);
    public const string UploadPatientDocuments = nameof(UploadPatientDocuments);
    public const string ViewDoctors = nameof(ViewDoctors);
    public const string ManageDoctors = nameof(ManageDoctors);

    public static AuthorizationBuilder AddHmsPolicies(this AuthorizationBuilder builder) => builder
        .AddPolicy(ViewPatients, p => p.RequireRole(Roles.Administrator, Roles.Doctor, Roles.Nurse, Roles.Receptionist))
        .AddPolicy(EditPatients, p => p.RequireRole(Roles.Administrator, Roles.Receptionist))
        .AddPolicy(ViewMedicalHistory, p => p.RequireRole(Roles.Administrator, Roles.Doctor, Roles.Nurse))
        .AddPolicy(ViewPatientDocuments, p => p.RequireRole(Roles.Administrator, Roles.Doctor, Roles.Nurse, Roles.Receptionist))
        .AddPolicy(UploadPatientDocuments, p => p.RequireRole(Roles.Administrator, Roles.Doctor, Roles.Receptionist))
        .AddPolicy(ViewDoctors, p => p.RequireRole(Roles.Administrator, Roles.Doctor, Roles.Nurse, Roles.Receptionist))
        .AddPolicy(ManageDoctors, p => p.RequireRole(Roles.Administrator));
}
