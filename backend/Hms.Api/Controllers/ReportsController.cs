using Hms.Api.Authorization;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Hms.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Hms.Api.Controllers;

// PDF 3.10 Reports (FR-RP-01 to 06), following the Reports row of the role table:
// Admin all; Doctor patient, appointment (own only) and laboratory; Nurse patient; Receptionist appointment;
// Laboratory Staff laboratory; Pharmacist pharmacy; Accountant revenue. Every other combination gets 403.
// Dates are hospital days, both inclusive; without dates a report covers the current month so far.
[ApiController]
[Route("api/reports")]
public class ReportsController(ReportService reports, DoctorService doctors, UserManager<AppUser> userManager)
    : ControllerBase
{
    // GET /api/reports/patients?fromDate=2026-11-01&toDate=2026-11-30
    [HttpGet("patients")]
    [Authorize(Policy = Policies.ViewPatientReport)]
    public async Task<ActionResult<PatientReport>> Patients(DateOnly? fromDate, DateOnly? toDate) =>
        ToResponse(await reports.GetPatientReportAsync(fromDate, toDate));

    // GET /api/reports/appointments?fromDate=...&toDate=...&doctorId=1&status=Completed
    [HttpGet("appointments")]
    [Authorize(Policy = Policies.ViewAppointmentReport)]
    public async Task<ActionResult<AppointmentReport>> Appointments(
        DateOnly? fromDate, DateOnly? toDate, int? doctorId, AppointmentStatus? status)
    {
        // A doctor (who is not also an administrator or receptionist) sees only their own appointments.
        int? onlyDoctorId = null;
        if (!User.IsInRole(Roles.Administrator) && !User.IsInRole(Roles.Receptionist))
        {
            onlyDoctorId = await doctors.DoctorIdForUserAsync(userManager.GetUserId(User)) ?? 0;
        }
        return ToResponse(await reports.GetAppointmentReportAsync(fromDate, toDate, doctorId, status, onlyDoctorId));
    }

    // GET /api/reports/revenue?fromDate=...&toDate=...
    [HttpGet("revenue")]
    [Authorize(Policy = Policies.ViewRevenue)]
    public async Task<ActionResult<RevenueReport>> Revenue(DateOnly? fromDate, DateOnly? toDate) =>
        ToResponse(await reports.GetRevenueReportAsync(fromDate, toDate));

    // GET /api/reports/pharmacy?fromDate=...&toDate=...   (the dates are for "dispensed"; stock is as of now)
    [HttpGet("pharmacy")]
    [Authorize(Policy = Policies.ViewPharmacyReport)]
    public async Task<ActionResult<PharmacyReport>> Pharmacy(DateOnly? fromDate, DateOnly? toDate) =>
        ToResponse(await reports.GetPharmacyReportAsync(fromDate, toDate));

    // GET /api/reports/laboratory?fromDate=...&toDate=...&labTestId=2&status=Completed
    [HttpGet("laboratory")]
    [Authorize(Policy = Policies.ViewLabReport)]
    public async Task<ActionResult<LabReport>> Laboratory(
        DateOnly? fromDate, DateOnly? toDate, int? labTestId, LabRequestStatus? status) =>
        ToResponse(await reports.GetLabReportAsync(fromDate, toDate, labTestId, status));

    // GET /api/reports/staff?year=2026&month=11&departmentId=3
    [HttpGet("staff")]
    [Authorize(Policy = Policies.ManageStaff)]
    public async Task<ActionResult<StaffReport>> Staff(int? year, int? month, int? departmentId) =>
        ToResponse(await reports.GetStaffReportAsync(year, month, departmentId));

    private ActionResult<T> ToResponse<T>(ServiceResult<T> result) =>
        result.Succeeded ? result.Value! : this.ValidationErrors(result.Errors);
}
