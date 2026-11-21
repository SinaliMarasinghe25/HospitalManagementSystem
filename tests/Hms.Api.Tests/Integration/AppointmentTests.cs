using Hms.Api.Authorization;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Hms.Api.Services;
using Hms.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Tests.Integration;

// PDF 3.4: FR-AP-01 booking without double bookings, FR-AP-04 status steps, FR-BL-01 consultation charge.
[Collection(ApiCollection.Name)]
public class AppointmentTests(HmsApiFactory api)
{
    // 10:00 hospital time, a week from today: always in the future and inside the test doctor's 08:00-16:00 schedule.
    private static DateTime NextWeekAt(int hour, int minute = 0) =>
        HospitalTime.ToUtc(HospitalTime.Today.AddDays(7), new TimeOnly(hour, minute));

    [Fact]
    public async Task Booking_a_free_slot_works_and_the_same_slot_cannot_be_booked_twice()
    {
        var doctor = await api.AddDoctorAsync();
        var patient1 = await api.AddPatientAsync();
        var patient2 = await api.AddPatientAsync();
        var reception = await api.LoginAsAsync(Roles.Receptionist);
        var start = NextWeekAt(10);

        var first = await reception.PostJsonAsync("/api/appointments",
            new { patientId = patient1.Id, doctorId = doctor.Id, startTime = start, reason = "Check-up" });
        var booked = await first.ReadAsAsync<AppointmentResponse>(HttpStatusCode.Created);
        Assert.Equal(AppointmentStatus.Scheduled, booked.Status);
        Assert.Equal(start.AddMinutes(15), booked.EndTime);

        var second = await reception.PostJsonAsync("/api/appointments",
            new { patientId = patient2.Id, doctorId = doctor.Id, startTime = start });

        Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
        Assert.Contains("already has an appointment", await second.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Times_outside_the_schedule_or_in_the_past_are_refused()
    {
        var doctor = await api.AddDoctorAsync();
        var patient = await api.AddPatientAsync();
        var reception = await api.LoginAsAsync(Roles.Receptionist);

        var tooLate = await reception.PostJsonAsync("/api/appointments",
            new { patientId = patient.Id, doctorId = doctor.Id, startTime = NextWeekAt(20) });
        var notOnASlot = await reception.PostJsonAsync("/api/appointments",
            new { patientId = patient.Id, doctorId = doctor.Id, startTime = NextWeekAt(10, 7) });
        var inThePast = await reception.PostJsonAsync("/api/appointments",
            new { patientId = patient.Id, doctorId = doctor.Id, startTime = DateTime.UtcNow.AddDays(-1) });

        Assert.Equal(HttpStatusCode.BadRequest, tooLate.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, notOnASlot.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, inThePast.StatusCode);
    }

    [Fact]
    public async Task A_cancelled_slot_can_be_booked_again()
    {
        var doctor = await api.AddDoctorAsync();
        var patient = await api.AddPatientAsync();
        var reception = await api.LoginAsAsync(Roles.Receptionist);
        var start = NextWeekAt(11);
        var booked = await (await reception.PostJsonAsync("/api/appointments",
            new { patientId = patient.Id, doctorId = doctor.Id, startTime = start })).ReadAsAsync<AppointmentResponse>(HttpStatusCode.Created);

        var cancelled = await (await reception.PostJsonAsync($"/api/appointments/{booked.Id}/cancel",
            new { reason = "Patient is travelling" })).ReadAsAsync<AppointmentResponse>();
        Assert.Equal(AppointmentStatus.Cancelled, cancelled.Status);

        var again = await reception.PostJsonAsync("/api/appointments",
            new { patientId = patient.Id, doctorId = doctor.Id, startTime = start });
        await again.ShouldBeAsync(HttpStatusCode.Created);
    }

    [Fact]
    public async Task A_scheduled_appointment_cannot_jump_straight_to_completed()
    {
        var doctor = await api.AddDoctorAsync();
        var patient = await api.AddPatientAsync();
        var appointment = await api.AddAppointmentAsync(patient.Id, doctor.Id, NextWeekAt(9), AppointmentStatus.Scheduled);
        var admin = await api.LoginAsAsync(Roles.Administrator);

        var response = await admin.PutJsonAsync($"/api/appointments/{appointment.Id}/status", new { status = "Completed" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Completing_a_visit_adds_the_doctors_fee_to_the_patients_bill()
    {
        var doctorUser = await api.CreateUserAsync([Roles.Doctor]);
        var doctor = await api.AddDoctorAsync(fee: 3500m, userId: doctorUser.Id);
        var patient = await api.AddPatientAsync();
        var appointment = await api.AddAppointmentAsync(patient.Id, doctor.Id,
            DateTime.UtcNow.AddMinutes(-30), AppointmentStatus.CheckedIn);
        var doctorClient = await api.LoginAsync(doctorUser.UserName!);

        var response = await doctorClient.PutJsonAsync($"/api/appointments/{appointment.Id}/status", new { status = "Completed" });

        var completed = await response.ReadAsAsync<AppointmentResponse>();
        Assert.Equal(AppointmentStatus.Completed, completed.Status);
        await using var db = api.CreateDbContext();
        var charge = await db.Charges.SingleAsync(c => c.AppointmentId == appointment.Id);
        Assert.Equal(ChargeType.Consultation, charge.ChargeType);
        Assert.Equal(3500m, charge.Amount);
        Assert.Equal(patient.Id, charge.PatientId);
        Assert.Null(charge.InvoiceId);
    }

    [Fact]
    public async Task Another_doctor_cannot_complete_someone_elses_appointment()
    {
        var doctor = await api.AddDoctorAsync();
        var otherDoctorUser = await api.CreateUserAsync([Roles.Doctor]);
        await api.AddDoctorAsync(userId: otherDoctorUser.Id);
        var patient = await api.AddPatientAsync();
        var appointment = await api.AddAppointmentAsync(patient.Id, doctor.Id,
            DateTime.UtcNow.AddMinutes(-30), AppointmentStatus.CheckedIn);
        var otherDoctor = await api.LoginAsync(otherDoctorUser.UserName!);

        var response = await otherDoctor.PutJsonAsync($"/api/appointments/{appointment.Id}/status", new { status = "Completed" });

        // A doctor only sees their own appointments, so for them this one does not exist.
        Assert.True(response.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.BadRequest,
            $"Expected 404 or 400 but got {(int)response.StatusCode}");
        await using var db = api.CreateDbContext();
        Assert.False(await db.Charges.AnyAsync(c => c.AppointmentId == appointment.Id));
    }
}
