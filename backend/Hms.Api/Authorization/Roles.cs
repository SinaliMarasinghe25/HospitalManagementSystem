namespace Hms.Api.Authorization;

// The seven user roles from PDF section 2.
// Constants avoid typos: Roles.Doctor is checked by the compiler, "Docter" is not.
public static class Roles
{
    public const string Administrator = "Administrator";
    public const string Doctor = "Doctor";
    public const string Nurse = "Nurse";
    public const string Receptionist = "Receptionist";
    public const string LaboratoryStaff = "LaboratoryStaff";
    public const string Pharmacist = "Pharmacist";
    public const string Accountant = "Accountant";

    public static readonly string[] All =
    [
        Administrator, Doctor, Nurse, Receptionist, LaboratoryStaff, Pharmacist, Accountant
    ];
}
