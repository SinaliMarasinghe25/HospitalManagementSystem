using System.Security.Claims;
using Hms.Api.Authorization;
using Hms.Api.Data;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Services;

// The five dashboard tiles (PDF section 7, UI-DSH-01 to 05) and who sees which one.
public static class DashboardTiles
{
    public const string Patients = "patients";
    public const string Appointments = "appointments";
    public const string Lab = "lab";
    public const string Pharmacy = "pharmacy";
    public const string Revenue = "revenue";

    private static readonly string[] Order = [Patients, Appointments, Lab, Pharmacy, Revenue];

    // Project plan section 4, row "Dashboard tiles". One change from the plan (step 25):
    // Total Patients is shown to every role. It is one number with no names in it, and every role may already
    // look up a patient's name and ID (row "Patient demographics"), so it reveals nothing they could not see.
    // To go back to the plan exactly, remove Patients from Laboratory Staff, Pharmacist and Accountant below.
    private static readonly Dictionary<string, string[]> ByRole = new()
    {
        [Roles.Administrator] = [Patients, Appointments, Lab, Pharmacy, Revenue],
        [Roles.Doctor] = [Patients, Appointments, Lab],
        [Roles.Nurse] = [Patients, Appointments],
        [Roles.Receptionist] = [Patients, Appointments],
        [Roles.LaboratoryStaff] = [Patients, Lab],
        [Roles.Pharmacist] = [Patients, Pharmacy],
        [Roles.Accountant] = [Patients, Revenue],
    };

    // A user with several roles sees every tile of each role, once.
    public static List<string> For(ClaimsPrincipal user)
    {
        var allowed = ByRole.Where(r => user.IsInRole(r.Key)).SelectMany(r => r.Value).ToHashSet();
        return [.. Order.Where(allowed.Contains)];
    }
}

// Builds the whole dashboard in one call. Each number comes from the same service method that the module's own
// page uses (lab queue, pharmacy alerts, billing), so the dashboard can never disagree with those pages.
public class DashboardService(
    AppDbContext db,
    AppointmentService appointments,
    DoctorService doctors,
    LabService lab,
    PharmacyService pharmacy,
    BillingService billing)
{
    // Appointments in these states are not real visits today.
    private static readonly AppointmentStatus[] NotAVisit = [AppointmentStatus.Cancelled, AppointmentStatus.Rescheduled];

    public async Task<DashboardSummary> GetSummaryAsync(ClaimsPrincipal user, string? userId)
    {
        var tiles = DashboardTiles.For(user);
        var today = HospitalTime.Today;

        // One query after another: a DbContext can only run one query at a time.
        int? patients = tiles.Contains(DashboardTiles.Patients) ? await db.Patients.CountAsync() : null;
        var todayAppointments = tiles.Contains(DashboardTiles.Appointments) ? await TodayAppointmentsAsync(user, userId, today) : null;
        int? openLab = tiles.Contains(DashboardTiles.Lab) ? await lab.CountOpenAsync() : null;
        var alerts = tiles.Contains(DashboardTiles.Pharmacy) ? await pharmacy.CountAlertsAsync() : null;
        var revenue = tiles.Contains(DashboardTiles.Revenue) ? await billing.GetRevenueSummaryAsync() : null;

        return new DashboardSummary(today, DateTime.UtcNow, tiles, patients, todayAppointments, openLab, alerts, revenue);
    }

    private async Task<TodayAppointments> TodayAppointmentsAsync(ClaimsPrincipal user, string? userId, DateOnly today)
    {
        var access = await AppointmentAccessRules.ForAsync(user, userId, doctors);
        var result = await appointments.ListAsync(access, today, today, null, null, null);
        var visits = (result.Value ?? []).Where(a => !NotAVisit.Contains(a.Status)).ToList();
        return new TodayAppointments(visits.Count, visits);
    }
}
