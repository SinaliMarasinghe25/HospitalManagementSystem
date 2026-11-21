using System.Security.Claims;
using Hms.Api.Authorization;

namespace Hms.Api.Services;

// Who may see which appointments (role table, Appointments row). Used by the appointments API and the dashboard,
// so "today's appointments" is always the same list in both places.
public static class AppointmentAccessRules
{
    public static async Task<AppointmentAccess> ForAsync(ClaimsPrincipal user, string? userId, DoctorService doctors)
    {
        var isAdmin = user.IsInRole(Roles.Administrator);
        var isReception = user.IsInRole(Roles.Receptionist);
        var seesAll = isAdmin || isReception || user.IsInRole(Roles.Nurse);
        var myDoctorId = user.IsInRole(Roles.Doctor) ? await doctors.DoctorIdForUserAsync(userId) : null;
        return new AppointmentAccess(seesAll, myDoctorId, isAdmin, isAdmin || isReception);
    }
}
