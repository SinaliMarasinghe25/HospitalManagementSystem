using Hms.Api.Authorization;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Hms.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Hms.Api.Controllers;

// PDF 3.4 Appointment Management.
// View: Admin, Doctor (own only), Nurse, Receptionist. Book, cancel, reschedule: Admin, Receptionist.
// Status: Admin, Receptionist, Doctor (own); the service checks which steps each may take.
[ApiController]
[Route("api/appointments")]
[Authorize(Policy = Policies.ViewAppointments)]
public class AppointmentsController(AppointmentService appointments, DoctorService doctors, AuditService audit, UserManager<AppUser> userManager)
    : ControllerBase
{
    // GET /api/appointments?fromDate=2026-11-16&toDate=2026-11-22&doctorId=1&status=Scheduled
    [HttpGet]
    public async Task<ActionResult<List<AppointmentResponse>>> List(
        DateOnly? fromDate, DateOnly? toDate, int? doctorId, int? patientId, AppointmentStatus? status)
    {
        var result = await appointments.ListAsync(await AccessAsync(), fromDate, toDate, doctorId, patientId, status);
        return result.Succeeded ? result.Value! : this.ValidationErrors(result.Errors);
    }

    // GET /api/appointments/5
    [HttpGet("{id:int}")]
    public async Task<ActionResult<AppointmentResponse>> Get(int id)
    {
        var appointment = await appointments.GetAsync(await AccessAsync(), id);
        return appointment is null ? NotFound() : appointment;
    }

    // GET /api/appointments/slots?doctorId=1&date=2026-11-20
    [HttpGet("slots")]
    [Authorize(Policy = Policies.BookAppointments)]
    public async Task<ActionResult<List<SlotResponse>>> Slots(int doctorId, DateOnly date, int? ignoreAppointmentId)
    {
        var result = await appointments.GetSlotsAsync(doctorId, date, ignoreAppointmentId);
        return result.IsNotFound ? NotFound() : result.Value!;
    }

    // POST /api/appointments   (Book Appointment)
    [HttpPost]
    [Authorize(Policy = Policies.BookAppointments)]
    public async Task<ActionResult<AppointmentResponse>> Book(AppointmentRequest request)
    {
        var result = await appointments.BookAsync(request, userManager.GetUserId(User));
        if (!result.Succeeded)
        {
            return this.ValidationErrors(result.Errors);
        }

        // Log the stored UTC time, not the text that was sent.
        await Audit(AuditAction.Create, result.Value!.Id,
            new { request.PatientId, request.DoctorId, result.Value.StartTime, request.Reason });
        return CreatedAtAction(nameof(Get), new { id = result.Value.Id }, result.Value);
    }

    // POST /api/appointments/5/reschedule
    [HttpPost("{id:int}/reschedule")]
    [Authorize(Policy = Policies.BookAppointments)]
    public async Task<ActionResult<AppointmentResponse>> Reschedule(int id, RescheduleRequest request)
    {
        var result = await appointments.RescheduleAsync(id, request, userManager.GetUserId(User));
        if (result.IsNotFound) return NotFound();
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);

        await Audit(AuditAction.Update, id, new { Status = AppointmentStatus.Rescheduled, NewAppointmentId = result.Value!.Id });
        await Audit(AuditAction.Create, result.Value.Id, new { RescheduledFromId = id, result.Value.StartTime, result.Value.DoctorId });
        return result.Value;
    }

    // POST /api/appointments/5/cancel
    [HttpPost("{id:int}/cancel")]
    [Authorize(Policy = Policies.BookAppointments)]
    public async Task<ActionResult<AppointmentResponse>> Cancel(int id, CancelAppointmentRequest request)
    {
        var result = await appointments.CancelAsync(id, request.Reason);
        if (result.IsNotFound) return NotFound();
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);

        await Audit(AuditAction.Update, id, new { Status = AppointmentStatus.Cancelled, request.Reason });
        return result.Value!;
    }

    // PUT /api/appointments/5/status   body: { "status": "CheckedIn" }
    [HttpPut("{id:int}/status")]
    [Authorize(Policy = Policies.UpdateAppointmentStatus)]
    public async Task<ActionResult<AppointmentResponse>> UpdateStatus(int id, AppointmentStatusRequest request)
    {
        var result = await appointments.UpdateStatusAsync(await AccessAsync(), id, request.Status!.Value);
        if (result.IsNotFound) return NotFound();
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);

        await Audit(AuditAction.Update, id, new { request.Status });
        return result.Value!;
    }

    private async Task<AppointmentAccess> AccessAsync()
    {
        var isAdmin = User.IsInRole(Roles.Administrator);
        var isReception = User.IsInRole(Roles.Receptionist);
        var seesAll = isAdmin || isReception || User.IsInRole(Roles.Nurse);
        var myDoctorId = User.IsInRole(Roles.Doctor)
            ? await doctors.DoctorIdForUserAsync(userManager.GetUserId(User))
            : null;
        return new AppointmentAccess(seesAll, myDoctorId, isAdmin, isAdmin || isReception);
    }

    // Enums are written as text ("Cancelled"), so the audit log is readable.
    private Task Audit(AuditAction action, int appointmentId, object changes) =>
        audit.LogChangeAsync(action, "Appointment", appointmentId, changes);
}
