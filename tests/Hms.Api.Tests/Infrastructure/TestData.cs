using Hms.Api.Data;
using Hms.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Tests.Infrastructure;

// Puts rows straight into the test database, for the parts of a test that are not being tested
// (for example: a billing test needs charges, but does not need to walk through a whole doctor visit).
public static class TestData
{
    private static int counter;

    private static string Unique() =>
        $"{DateTime.UtcNow:HHmmss}{Interlocked.Increment(ref counter):D4}{Random.Shared.Next(100, 999)}";

    public static async Task<Patient> AddPatientAsync(this HmsApiFactory api, string? lastName = null)
    {
        await using var db = api.CreateDbContext();
        var patient = new Patient
        {
            PatientNumber = $"T-{Unique()}",
            FirstName = "Test",
            LastName = lastName ?? $"Patient{Unique()}",
            DateOfBirth = new DateOnly(1990, 5, 17),
            Gender = Gender.Female,
            Phone = "0771234567",
            CreatedAt = DateTime.UtcNow,
        };
        db.Patients.Add(patient);
        await db.SaveChangesAsync();
        return patient;
    }

    // A doctor who works every day from 08:00 to 16:00 (hospital time), in 15-minute slots.
    // Pass a login (userId) to make this the doctor of that user.
    public static async Task<Doctor> AddDoctorAsync(this HmsApiFactory api, decimal fee = 2500m, string? userId = null)
    {
        await using var db = api.CreateDbContext();
        var department = await db.Departments.FirstAsync(d => d.IsClinical && d.IsActive);
        var employee = new Employee
        {
            EmployeeNumber = $"E-{Unique()}",
            FirstName = "Test",
            LastName = $"Doctor{Unique()}",
            JobTitle = "Doctor",
            HireDate = new DateOnly(2020, 1, 1),
            DepartmentId = department.Id,
            UserId = userId,
        };
        var doctor = new Doctor
        {
            Employee = employee,
            Specialization = "General Medicine",
            LicenseNumber = $"SLMC-{Unique()}",
            ConsultationFee = fee,
            SlotMinutes = 15,
            Schedules = Enum.GetValues<DayOfWeek>()
                .Select(day => new DoctorSchedule { DayOfWeek = day, StartTime = new TimeOnly(8, 0), EndTime = new TimeOnly(16, 0) })
                .ToList(),
        };
        db.Doctors.Add(doctor);
        await db.SaveChangesAsync();
        return doctor;
    }

    public static async Task<Appointment> AddAppointmentAsync(
        this HmsApiFactory api, int patientId, int doctorId, DateTime startUtc, AppointmentStatus status)
    {
        await using var db = api.CreateDbContext();
        var appointment = new Appointment
        {
            PatientId = patientId,
            DoctorId = doctorId,
            StartTime = startUtc,
            EndTime = startUtc.AddMinutes(15),
            Status = status,
            CreatedAt = DateTime.UtcNow,
        };
        db.Appointments.Add(appointment);
        await db.SaveChangesAsync();
        return appointment;
    }

    // Unbilled consultation charges for one patient, one per amount.
    // Every charge needs a source (a CHECK constraint), so each one gets its own completed appointment.
    public static async Task<List<int>> AddChargesAsync(this HmsApiFactory api, int patientId, params decimal[] amounts)
    {
        var doctor = await api.AddDoctorAsync();
        await using var db = api.CreateDbContext();
        var ids = new List<int>();
        var start = DateTime.UtcNow.Date.AddDays(-30).AddHours(3);
        foreach (var amount in amounts)
        {
            var appointment = new Appointment
            {
                PatientId = patientId,
                DoctorId = doctor.Id,
                StartTime = start,
                EndTime = start.AddMinutes(15),
                Status = AppointmentStatus.Completed,
                CreatedAt = DateTime.UtcNow,
            };
            start = start.AddMinutes(15);
            var charge = new Charge
            {
                PatientId = patientId,
                ChargeType = ChargeType.Consultation,
                Description = "Test consultation",
                Quantity = 1,
                UnitPrice = amount,
                Amount = amount,
                Appointment = appointment,
                CreatedAt = DateTime.UtcNow,
            };
            db.Charges.Add(charge);
            await db.SaveChangesAsync();
            ids.Add(charge.Id);
        }
        return ids;
    }
}
