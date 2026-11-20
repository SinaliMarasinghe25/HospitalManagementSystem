using Hms.Api.Data;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Hms.Api.Services;

// Who is asking, worked out by the controller from the login cookie.
// SeesAll: Admin, Nurse, Receptionist see every appointment. A doctor sees only their own (MyDoctorId).
public record AppointmentAccess(bool SeesAll, int? MyDoctorId, bool IsAdmin, bool IsFrontDesk);

// Business logic for PDF 3.4 Appointment Management.
public class AppointmentService(AppDbContext db)
{
    // Appointments in these states no longer hold their time slot.
    private static readonly AppointmentStatus[] FreedStatuses = [AppointmentStatus.Cancelled, AppointmentStatus.Rescheduled];

    private const int MaxRangeDays = 62;

    // ---------- Reading ----------

    // Dates are hospital-local days, both inclusive (e.g. a week: Monday to Sunday).
    public async Task<ServiceResult<List<AppointmentResponse>>> ListAsync(
        AppointmentAccess access, DateOnly? fromDate, DateOnly? toDate, int? doctorId, int? patientId,
        AppointmentStatus? status)
    {
        var query = Visible(access);

        // Without a patient filter, a date range is required so the list stays small.
        if (fromDate is not null || toDate is not null || patientId is null)
        {
            var from = fromDate ?? HospitalTime.Today;
            var to = toDate ?? from;
            if (to < from || to.DayNumber - from.DayNumber > MaxRangeDays)
            {
                return ServiceResult<List<AppointmentResponse>>.Invalid(new()
                {
                    ["ToDate"] = [$"The end date must be on or after the start date, and at most {MaxRangeDays} days later."]
                });
            }
            var fromUtc = HospitalTime.ToUtc(from, TimeOnly.MinValue);
            var toUtc = HospitalTime.ToUtc(to.AddDays(1), TimeOnly.MinValue);
            query = query.Where(a => a.StartTime >= fromUtc && a.StartTime < toUtc);
        }

        if (doctorId is not null) query = query.Where(a => a.DoctorId == doctorId);
        if (patientId is not null) query = query.Where(a => a.PatientId == patientId);
        if (status is not null) query = query.Where(a => a.Status == status);

        var list = await Project(query.OrderBy(a => a.StartTime).ThenBy(a => a.Id)).ToListAsync();
        return ServiceResult<List<AppointmentResponse>>.Ok(list);
    }

    public Task<AppointmentResponse?> GetAsync(AppointmentAccess access, int id) =>
        Project(Visible(access).Where(a => a.Id == id)).FirstOrDefaultAsync();

    // The doctor profile linked to a login account, or null if the user is not a doctor.
    public Task<int?> DoctorIdForUserAsync(string? userId) =>
        db.Doctors.Where(d => d.Employee.UserId == userId).Select(d => (int?)d.Id).FirstOrDefaultAsync();

    // UI-APT-01: every slot of the doctor's working hours on one day, marked free or not.
    public async Task<ServiceResult<List<SlotResponse>>> GetSlotsAsync(int doctorId, DateOnly date, int? ignoreAppointmentId)
    {
        var doctor = await db.Doctors.AsNoTracking()
            .Include(d => d.Schedules)
            .Include(d => d.Employee)
            .FirstOrDefaultAsync(d => d.Id == doctorId);
        if (doctor is null)
        {
            return ServiceResult<List<SlotResponse>>.NotFound();
        }

        var slots = new List<SlotResponse>();
        if (!doctor.Employee.IsActive)
        {
            return ServiceResult<List<SlotResponse>>.Ok(slots);
        }

        var dayStartUtc = HospitalTime.ToUtc(date, TimeOnly.MinValue);
        var dayEndUtc = HospitalTime.ToUtc(date.AddDays(1), TimeOnly.MinValue);
        var taken = await db.Appointments.AsNoTracking()
            .Where(a => a.DoctorId == doctorId && !FreedStatuses.Contains(a.Status) && a.Id != ignoreAppointmentId)
            .Where(a => a.StartTime < dayEndUtc && a.EndTime > dayStartUtc)
            .Select(a => new { a.StartTime, a.EndTime })
            .ToListAsync();

        var now = DateTime.UtcNow;
        foreach (var block in doctor.Schedules.Where(s => s.DayOfWeek == date.DayOfWeek).OrderBy(s => s.StartTime))
        {
            foreach (var (start, end) in SlotsIn(block, date, doctor.SlotMinutes))
            {
                var free = start > now && !taken.Any(t => t.StartTime < end && t.EndTime > start);
                slots.Add(new SlotResponse(start, end, free));
            }
        }
        return ServiceResult<List<SlotResponse>>.Ok(slots);
    }

    // ---------- Booking (FR-AP-01) ----------

    public async Task<ServiceResult<AppointmentResponse>> BookAsync(AppointmentRequest request, string? userId)
    {
        var start = HospitalTime.NormalizeToUtc(request.StartTime!.Value);

        // A transaction plus a lock per doctor: two receptionists booking the same doctor at the same
        // moment are handled one after the other, so both cannot pass the overlap check.
        await using var transaction = await db.Database.BeginTransactionAsync();
        await LockDoctorAsync(request.DoctorId!.Value);

        var errors = new Dictionary<string, string[]>();
        if (!await db.Patients.AnyAsync(p => p.Id == request.PatientId))
        {
            errors["PatientId"] = ["Choose a patient."];
        }
        var (end, timeErrors) = await CheckTimeAsync(request.DoctorId.Value, request.PatientId!.Value, start, ignoreId: null);
        foreach (var (key, value) in timeErrors) errors[key] = value;
        if (errors.Count > 0)
        {
            return ServiceResult<AppointmentResponse>.Invalid(errors);
        }

        var appointment = new Appointment
        {
            PatientId = request.PatientId.Value,
            DoctorId = request.DoctorId.Value,
            StartTime = start,
            EndTime = end,
            Status = AppointmentStatus.Scheduled,
            Reason = Normalize(request.Reason),
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow,
        };
        db.Appointments.Add(appointment);

        if (!await TrySaveAsync())
        {
            return SlotJustTaken();
        }
        await transaction.CommitAsync();
        return ServiceResult<AppointmentResponse>.Ok(await LoadAsync(appointment.Id));
    }

    // ---------- Reschedule (FR-AP-03) ----------
    // The old appointment is kept with status "Rescheduled" and a new one points back to it,
    // so the history shows both.
    public async Task<ServiceResult<AppointmentResponse>> RescheduleAsync(int id, RescheduleRequest request, string? userId)
    {
        var old = await db.Appointments.FirstOrDefaultAsync(a => a.Id == id);
        if (old is null)
        {
            return ServiceResult<AppointmentResponse>.NotFound();
        }
        if (old.Status != AppointmentStatus.Scheduled)
        {
            return Invalid("Status", $"Only a scheduled appointment can be rescheduled. This one is {old.Status}.");
        }

        var doctorId = request.DoctorId ?? old.DoctorId;
        var start = HospitalTime.NormalizeToUtc(request.StartTime!.Value);

        await using var transaction = await db.Database.BeginTransactionAsync();
        await LockDoctorAsync(doctorId);

        // ignoreId: the old appointment's own slot does not block the new time (e.g. moving 15 minutes later).
        var (end, errors) = await CheckTimeAsync(doctorId, old.PatientId, start, ignoreId: old.Id);
        if (errors.Count > 0)
        {
            return ServiceResult<AppointmentResponse>.Invalid(errors);
        }

        old.Status = AppointmentStatus.Rescheduled;
        await db.SaveChangesAsync(); // frees the old slot in the database first

        var replacement = new Appointment
        {
            PatientId = old.PatientId,
            DoctorId = doctorId,
            StartTime = start,
            EndTime = end,
            Status = AppointmentStatus.Scheduled,
            Reason = old.Reason,
            RescheduledFromId = old.Id,
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow,
        };
        db.Appointments.Add(replacement);

        if (!await TrySaveAsync())
        {
            return SlotJustTaken(); // the transaction is not committed, so the old appointment stays Scheduled
        }
        await transaction.CommitAsync();
        return ServiceResult<AppointmentResponse>.Ok(await LoadAsync(replacement.Id));
    }

    // ---------- Cancel (FR-AP-02) ----------
    public async Task<ServiceResult<AppointmentResponse>> CancelAsync(int id, string reason)
    {
        var appointment = await db.Appointments.FirstOrDefaultAsync(a => a.Id == id);
        if (appointment is null)
        {
            return ServiceResult<AppointmentResponse>.NotFound();
        }
        if (appointment.Status != AppointmentStatus.Scheduled)
        {
            return Invalid("Status", $"Only a scheduled appointment can be cancelled. This one is {appointment.Status}.");
        }

        appointment.Status = AppointmentStatus.Cancelled;
        appointment.CancellationReason = reason.Trim();
        await db.SaveChangesAsync();
        return ServiceResult<AppointmentResponse>.Ok(await LoadAsync(id));
    }

    // ---------- Status tracking (FR-AP-04) ----------
    // Allowed steps:
    //   Scheduled -> CheckedIn   (on the day; front desk or the appointment's own doctor)
    //   Scheduled -> NoShow      (after the start time; front desk or own doctor)
    //   CheckedIn -> Completed   (the appointment's own doctor, or an administrator)
    // Cancelled and Rescheduled have their own endpoints. Completed, NoShow, Cancelled and Rescheduled are final.
    public async Task<ServiceResult<AppointmentResponse>> UpdateStatusAsync(
        AppointmentAccess access, int id, AppointmentStatus next)
    {
        var appointment = await Visible(access, tracking: true).FirstOrDefaultAsync(a => a.Id == id);
        if (appointment is null)
        {
            return ServiceResult<AppointmentResponse>.NotFound();
        }

        var isOwnDoctor = access.MyDoctorId == appointment.DoctorId;
        var current = appointment.Status;
        var localStart = HospitalTime.ToLocal(appointment.StartTime);

        string? problem = (current, next) switch
        {
            (AppointmentStatus.Scheduled, AppointmentStatus.CheckedIn) =>
                !(access.IsFrontDesk || isOwnDoctor) ? "Only reception, an administrator or the patient's doctor can check a patient in."
                : DateOnly.FromDateTime(localStart) != HospitalTime.Today ? "A patient can only be checked in on the day of the appointment."
                : null,
            (AppointmentStatus.Scheduled, AppointmentStatus.NoShow) =>
                !(access.IsFrontDesk || isOwnDoctor) ? "Only reception, an administrator or the patient's doctor can mark a no-show."
                : appointment.StartTime > DateTime.UtcNow ? "A no-show can only be recorded after the appointment time."
                : null,
            (AppointmentStatus.CheckedIn, AppointmentStatus.Completed) =>
                !(access.IsAdmin || isOwnDoctor) ? "Only the patient's doctor or an administrator can complete an appointment."
                : null,
            _ => $"An appointment cannot move from {current} to {next}.",
        };
        if (problem is not null)
        {
            return Invalid("Status", problem);
        }

        appointment.Status = next;
        await db.SaveChangesAsync();
        return ServiceResult<AppointmentResponse>.Ok(await LoadAsync(id));
    }

    // ---------- Rules shared by booking and rescheduling ----------

    // Checks a start time and returns the end time, or errors keyed "StartTime"/"DoctorId".
    private async Task<(DateTime End, Dictionary<string, string[]> Errors)> CheckTimeAsync(
        int doctorId, int patientId, DateTime start, int? ignoreId)
    {
        var errors = new Dictionary<string, string[]>();
        var doctor = await db.Doctors.AsNoTracking()
            .Include(d => d.Schedules)
            .Include(d => d.Employee)
            .FirstOrDefaultAsync(d => d.Id == doctorId);
        if (doctor is null || !doctor.Employee.IsActive)
        {
            errors["DoctorId"] = ["Choose an active doctor."];
            return (start, errors);
        }

        var end = start.AddMinutes(doctor.SlotMinutes);

        // Assumption A13: no bookings in the past.
        if (start <= DateTime.UtcNow)
        {
            errors["StartTime"] = ["The appointment time must be in the future."];
            return (end, errors);
        }

        // The time must be exactly one of the doctor's slots in their weekly schedule.
        var local = HospitalTime.ToLocal(start);
        var date = DateOnly.FromDateTime(local);
        var isSlot = doctor.Schedules
            .Where(s => s.DayOfWeek == date.DayOfWeek)
            .SelectMany(s => SlotsIn(s, date, doctor.SlotMinutes))
            .Any(slot => slot.Start == start);
        if (!isSlot)
        {
            errors["StartTime"] = ["This time is outside the doctor's schedule. Choose one of the free slots."];
            return (end, errors);
        }

        // No overlap with the doctor's other active appointments (GOAL-02: no double bookings).
        var doctorBusy = await db.Appointments.AnyAsync(a =>
            a.DoctorId == doctorId && a.Id != ignoreId && !FreedStatuses.Contains(a.Status) &&
            a.StartTime < end && a.EndTime > start);
        if (doctorBusy)
        {
            errors["StartTime"] = ["The doctor already has an appointment at this time."];
            return (end, errors);
        }

        // Proposed rule: a patient cannot be in two appointments at the same time, with any doctor.
        var patientBusy = await db.Appointments.AnyAsync(a =>
            a.PatientId == patientId && a.Id != ignoreId && !FreedStatuses.Contains(a.Status) &&
            a.StartTime < end && a.EndTime > start);
        if (patientBusy)
        {
            errors["StartTime"] = ["This patient already has another appointment at this time."];
        }

        return (end, errors);
    }

    // Splits one schedule block (e.g. 08:00-12:00) into slots of SlotMinutes, as UTC times.
    private static IEnumerable<(DateTime Start, DateTime End)> SlotsIn(DoctorSchedule block, DateOnly date, int slotMinutes)
    {
        var length = TimeSpan.FromMinutes(slotMinutes);
        for (var t = block.StartTime.ToTimeSpan(); t + length <= block.EndTime.ToTimeSpan(); t += length)
        {
            var start = HospitalTime.ToUtc(date, TimeOnly.FromTimeSpan(t));
            yield return (start, start + length);
        }
    }

    // Transaction-level lock in PostgreSQL, released automatically at commit or rollback.
    private Task LockDoctorAsync(int doctorId) =>
        db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock({(long)doctorId})");

    // The unique index on (DoctorId, StartTime) is the last safety net. 23505 = unique violation.
    private async Task<bool> TrySaveAsync()
    {
        try
        {
            await db.SaveChangesAsync();
            return true;
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return false;
        }
    }

    // ---------- Helpers ----------

    private IQueryable<Appointment> Visible(AppointmentAccess access, bool tracking = false)
    {
        var query = tracking ? db.Appointments : db.Appointments.AsNoTracking();
        // A doctor's own list only (ROLE-02). A doctor login without a doctor profile sees nothing.
        return access.SeesAll ? query : query.Where(a => a.DoctorId == access.MyDoctorId);
    }

    private IQueryable<AppointmentResponse> Project(IQueryable<Appointment> query) =>
        query.Select(a => new AppointmentResponse(
            a.Id,
            a.PatientId,
            a.Patient.PatientNumber,
            a.Patient.FirstName + " " + a.Patient.LastName,
            a.DoctorId,
            a.Doctor.Employee.FirstName + " " + a.Doctor.Employee.LastName,
            a.Doctor.Employee.Department.Name,
            a.StartTime,
            a.EndTime,
            a.Status,
            a.Reason,
            a.CancellationReason,
            a.RescheduledFromId,
            db.Appointments.Where(n => n.RescheduledFromId == a.Id).Select(n => (int?)n.Id).FirstOrDefault(),
            a.CreatedAt,
            db.MedicalRecords.Where(m => m.AppointmentId == a.Id).Select(m => (int?)m.Id).FirstOrDefault()));

    private async Task<AppointmentResponse> LoadAsync(int id) =>
        await Project(db.Appointments.AsNoTracking().Where(a => a.Id == id)).SingleAsync();

    private static ServiceResult<AppointmentResponse> Invalid(string field, string message) =>
        ServiceResult<AppointmentResponse>.Invalid(new() { [field] = [message] });

    private static ServiceResult<AppointmentResponse> SlotJustTaken() =>
        Invalid("StartTime", "This time was just booked by someone else. Choose another slot.");

    private static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
