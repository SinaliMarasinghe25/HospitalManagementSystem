using Hms.Api.Authorization;
using Hms.Api.Data;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Hms.Api.Services;

// Business logic for PDF 3.9 Staff Management: daily attendance and leave.
// Adding and editing people (employees, doctors, logins) is in EmployeeService.
//
// Assumption A23 (proposed): leave is counted in calendar days, both ends included.
//   There is no holiday calendar in the PDF, so weekends and public holidays are not skipped.
// Assumption A24 (proposed): leave can start up to 30 days in the past (sick leave is often
//   recorded afterwards), must end within a year from today, and one request covers at most 180 days.
public class StaffService(AppDbContext db, NotificationService notifications)
{
    public const int LeavePastDays = 30;
    public const int LeaveFutureDays = 365;
    public const int LeaveMaxDays = 180;
    public const int AttendanceMaxRangeDays = 92;

    // Leave that blocks a new request for the same days. Rejected and cancelled requests do not.
    private static readonly LeaveStatus[] ActiveLeave = [LeaveStatus.Pending, LeaveStatus.Approved];

    // ---------- Attendance ----------

    // The daily sheet: every active employee hired by that date, plus anyone (even inactive now)
    // who already has a row for that day, so old records stay visible.
    public async Task<AttendanceSheet> GetAttendanceSheetAsync(DateOnly date)
    {
        var rows = await db.Employees.AsNoTracking()
            .Where(e => e.HireDate <= date)
            .Where(e => e.IsActive || e.AttendanceRecords.Any(a => a.Date == date))
            .OrderBy(e => e.Department.Name).ThenBy(e => e.LastName).ThenBy(e => e.FirstName)
            .Select(e => new
            {
                e.Id,
                e.EmployeeNumber,
                FullName = e.FirstName + " " + e.LastName,
                e.JobTitle,
                DepartmentName = e.Department.Name,
                Record = e.AttendanceRecords.Where(a => a.Date == date)
                    .Select(a => new
                    {
                        a.Status,
                        a.CheckIn,
                        a.CheckOut,
                        RecordedBy = db.Users.Where(u => u.Id == a.RecordedByUserId).Select(u => u.UserName).FirstOrDefault(),
                    })
                    .FirstOrDefault(),
                Leave = e.LeaveRequests
                    .Where(l => l.Status == LeaveStatus.Approved && l.StartDate <= date && l.EndDate >= date)
                    .Select(l => (LeaveType?)l.LeaveType)
                    .FirstOrDefault(),
            })
            .ToListAsync();

        return new AttendanceSheet(date, rows.Select(r => new AttendanceSheetRow(
            r.Id, r.EmployeeNumber, r.FullName, r.JobTitle, r.DepartmentName,
            r.Record?.Status, r.Record?.CheckIn, r.Record?.CheckOut, r.Leave, r.Record?.RecordedBy)).ToList());
    }

    // Saves (adds or corrects) the entries sent for one day. Employees not in the list are left as they are.
    public async Task<ServiceResult<int>> SaveAttendanceAsync(AttendanceSaveRequest request, string? userId)
    {
        var date = request.Date!.Value;
        var errors = new List<string>();

        if (date > HospitalTime.Today)
        {
            return Invalid<int>("Date", "Attendance cannot be recorded for a future date.");
        }
        if (request.Entries.Select(e => e.EmployeeId).Distinct().Count() != request.Entries.Count)
        {
            return Invalid<int>("Entries", "An employee appears more than once.");
        }

        var ids = request.Entries.Select(e => e.EmployeeId!.Value).ToList();
        var employees = await db.Employees
            .Where(e => ids.Contains(e.Id))
            .Select(e => new
            {
                e.Id,
                Name = e.FirstName + " " + e.LastName,
                e.HireDate,
                e.IsActive,
                HasRecord = e.AttendanceRecords.Any(a => a.Date == date),
            })
            .ToDictionaryAsync(e => e.Id);

        foreach (var entry in request.Entries)
        {
            if (!employees.TryGetValue(entry.EmployeeId!.Value, out var employee))
            {
                errors.Add($"Employee {entry.EmployeeId} was not found.");
                continue;
            }
            if (employee.HireDate > date)
            {
                errors.Add($"{employee.Name}: hired on {employee.HireDate:yyyy-MM-dd}, after this date.");
            }
            if (!employee.IsActive && !employee.HasRecord)
            {
                errors.Add($"{employee.Name}: this employee is inactive.");
            }

            var hasTimes = entry.CheckIn is not null || entry.CheckOut is not null;
            if (hasTimes && entry.Status is not (AttendanceStatus.Present or AttendanceStatus.Late))
            {
                errors.Add($"{employee.Name}: check-in and check-out times are only for Present or Late.");
            }
            if (entry.CheckOut is not null && entry.CheckIn is null)
            {
                errors.Add($"{employee.Name}: enter the check-in time before the check-out time.");
            }
            if (entry.CheckIn is not null && entry.CheckOut is not null && entry.CheckOut <= entry.CheckIn)
            {
                errors.Add($"{employee.Name}: check-out must be after check-in.");
            }
        }

        if (errors.Count > 0)
        {
            return ServiceResult<int>.Invalid(new() { ["Entries"] = errors.ToArray() });
        }

        var existing = await db.Attendance
            .Where(a => a.Date == date && ids.Contains(a.EmployeeId))
            .ToDictionaryAsync(a => a.EmployeeId);

        foreach (var entry in request.Entries)
        {
            if (!existing.TryGetValue(entry.EmployeeId!.Value, out var record))
            {
                record = new AttendanceRecord { EmployeeId = entry.EmployeeId.Value, Date = date };
                db.Attendance.Add(record);
            }
            record.Status = entry.Status!.Value;
            record.CheckIn = entry.CheckIn;
            record.CheckOut = entry.CheckOut;
            record.RecordedByUserId = userId;
        }

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Someone else saved the same day at the same moment. The unique index (employee, date)
            // kept one row per employee per day, so reload and save again.
            return Invalid<int>("Entries", "Someone else saved attendance for this day at the same time. Reload and try again.");
        }
        return ServiceResult<int>.Ok(request.Entries.Count);
    }

    public async Task<ServiceResult<EmployeeAttendance>> GetEmployeeAttendanceAsync(int id, DateOnly? fromDate, DateOnly? toDate)
    {
        if (!await db.Employees.AnyAsync(e => e.Id == id)) return ServiceResult<EmployeeAttendance>.NotFound();

        var to = toDate ?? HospitalTime.Today;
        var from = fromDate ?? to.AddDays(-29);
        if (from > to)
        {
            return Invalid<EmployeeAttendance>("FromDate", "The start date must be on or before the end date.");
        }
        if (to.DayNumber - from.DayNumber + 1 > AttendanceMaxRangeDays)
        {
            return Invalid<EmployeeAttendance>("FromDate", $"Choose at most {AttendanceMaxRangeDays} days.");
        }

        var records = await db.Attendance.AsNoTracking()
            .Where(a => a.EmployeeId == id && a.Date >= from && a.Date <= to)
            .OrderByDescending(a => a.Date)
            .Select(a => new AttendanceRecordResponse(a.Date, a.Status, a.CheckIn, a.CheckOut,
                db.Users.Where(u => u.Id == a.RecordedByUserId).Select(u => u.UserName).FirstOrDefault()))
            .ToListAsync();

        var counts = Enum.GetValues<AttendanceStatus>()
            .ToDictionary(s => s, s => records.Count(r => r.Status == s));
        return ServiceResult<EmployeeAttendance>.Ok(new EmployeeAttendance(id, from, to, counts, records));
    }

    // ---------- Leave ----------

    public Task<List<LeaveResponse>> ListLeaveAsync(LeaveStatus? status) =>
        ListLeaveAsync(db.LeaveRequests.Where(l => status == null || l.Status == status), take: 200);

    // The latest leave of one employee, for the employee page.
    public Task<List<LeaveResponse>> ListLeaveForEmployeeAsync(int employeeId) =>
        ListLeaveAsync(db.LeaveRequests.Where(l => l.EmployeeId == employeeId), take: 50);

    public async Task<LeaveResponse?> GetLeaveAsync(int id) =>
        (await ListLeaveAsync(db.LeaveRequests.Where(l => l.Id == id), take: 1)).FirstOrDefault();

    public async Task<MyLeave> GetMyLeaveAsync(string userId)
    {
        var employee = await db.Employees.AsNoTracking()
            .Where(e => e.UserId == userId)
            .Select(e => new { e.Id, Name = e.FirstName + " " + e.LastName })
            .FirstOrDefaultAsync();
        if (employee is null) return new MyLeave(false, null, []);

        var requests = await ListLeaveAsync(db.LeaveRequests.Where(l => l.EmployeeId == employee.Id), take: 100);
        return new MyLeave(true, employee.Name, requests);
    }

    // The employee asks for their own leave.
    public async Task<ServiceResult<int>> RequestOwnLeaveAsync(string userId, LeaveCreateRequest request)
    {
        var employeeId = await db.Employees.Where(e => e.UserId == userId).Select(e => (int?)e.Id).FirstOrDefaultAsync();
        if (employeeId is null)
        {
            return Invalid<int>("Employee", "Your login is not linked to an employee record. Ask an administrator to link it.");
        }
        return await CreateLeaveAsync(employeeId.Value, request.LeaveType!.Value, request.StartDate!.Value,
            request.EndDate!.Value, request.Reason, userId);
    }

    // An administrator records leave for an employee. It still starts as Pending and is approved separately,
    // so every approval is a clear, audited decision.
    public Task<ServiceResult<int>> RequestLeaveForAsync(LeaveCreateForEmployeeRequest request, string? userId) =>
        CreateLeaveAsync(request.EmployeeId!.Value, request.LeaveType!.Value, request.StartDate!.Value,
            request.EndDate!.Value, request.Reason, userId);

    private async Task<ServiceResult<int>> CreateLeaveAsync(
        int employeeId, LeaveType type, DateOnly start, DateOnly end, string? reason, string? userId)
    {
        var errors = new Dictionary<string, string[]>();
        var today = HospitalTime.Today;

        if (!Enum.IsDefined(type)) errors["LeaveType"] = ["Choose a leave type."];
        if (end < start)
        {
            errors["EndDate"] = ["The end date must be on or after the start date."];
        }
        else if (end.DayNumber - start.DayNumber + 1 > LeaveMaxDays)
        {
            errors["EndDate"] = [$"One request can cover at most {LeaveMaxDays} days."];
        }
        if (start < today.AddDays(-LeavePastDays))
        {
            errors["StartDate"] = [$"Leave can start at most {LeavePastDays} days ago."];
        }
        if (end > today.AddDays(LeaveFutureDays))
        {
            errors["EndDate"] = ["Leave must end within a year from today."];
        }
        if (errors.Count > 0) return ServiceResult<int>.Invalid(errors);

        await using var transaction = await db.Database.BeginTransactionAsync();

        // Lock the employee row: two requests for the same person wait for each other,
        // so the overlap check below cannot be beaten by sending both at once.
        await db.Database.ExecuteSqlAsync($"SELECT 1 FROM \"Employees\" WHERE \"Id\" = {employeeId} FOR UPDATE");
        var employee = await db.Employees.FirstOrDefaultAsync(e => e.Id == employeeId);
        if (employee is null) return Invalid<int>("EmployeeId", "Employee not found.");
        if (!employee.IsActive) return Invalid<int>("EmployeeId", "This employee is inactive.");
        if (start < employee.HireDate)
        {
            return Invalid<int>("StartDate", $"Leave cannot start before the hire date ({employee.HireDate:yyyy-MM-dd}).");
        }

        var overlap = await FindOverlapAsync(employeeId, start, end, exceptId: null, ActiveLeave);
        if (overlap is not null)
        {
            return Invalid<int>("StartDate",
                $"These dates overlap {overlap.Status.ToString().ToLowerInvariant()} leave from {overlap.StartDate:yyyy-MM-dd} to {overlap.EndDate:yyyy-MM-dd}.");
        }

        var leave = new LeaveRequest
        {
            EmployeeId = employeeId,
            LeaveType = type,
            StartDate = start,
            EndDate = end,
            Reason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim(),
            Status = LeaveStatus.Pending,
            RequestedByUserId = userId,
            CreatedAt = DateTime.UtcNow,
        };
        db.LeaveRequests.Add(leave);
        await db.SaveChangesAsync();
        await transaction.CommitAsync();

        await notifications.SendToRoleAsync(Roles.Administrator, "Leave request to review",
            $"{employee.FirstName} {employee.LastName}: {type} leave, {DescribeDays(start, end)}.", "/staff?tab=leave");
        return ServiceResult<int>.Ok(leave.Id);
    }

    public async Task<ServiceResult<int>> ReviewLeaveAsync(int id, bool approve, string? note, string? userId)
    {
        note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        if (!approve && note is null)
        {
            return Invalid<int>("Note", "Give a reason for rejecting the request.");
        }

        var employeeId = await db.LeaveRequests.Where(l => l.Id == id).Select(l => (int?)l.EmployeeId).FirstOrDefaultAsync();
        if (employeeId is null) return ServiceResult<int>.NotFound();

        await using var transaction = await db.Database.BeginTransactionAsync();
        await db.Database.ExecuteSqlAsync($"SELECT 1 FROM \"Employees\" WHERE \"Id\" = {employeeId} FOR UPDATE");

        // Read again after the lock, so two administrators cannot both review the same request.
        var leave = await db.LeaveRequests.FirstAsync(l => l.Id == id);
        if (leave.Status != LeaveStatus.Pending)
        {
            return Invalid<int>("Status", $"This request is already {leave.Status.ToString().ToLowerInvariant()}.");
        }

        if (approve)
        {
            var overlap = await FindOverlapAsync(leave.EmployeeId, leave.StartDate, leave.EndDate, id, [LeaveStatus.Approved]);
            if (overlap is not null)
            {
                return Invalid<int>("Status",
                    $"Already approved leave from {overlap.StartDate:yyyy-MM-dd} to {overlap.EndDate:yyyy-MM-dd} overlaps these dates.");
            }
        }

        leave.Status = approve ? LeaveStatus.Approved : LeaveStatus.Rejected;
        leave.ReviewNote = note;
        leave.ReviewedByUserId = userId;
        leave.ReviewedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        await transaction.CommitAsync();

        var employeeUserId = await db.Employees.Where(e => e.Id == leave.EmployeeId).Select(e => e.UserId).FirstAsync();
        await notifications.SendToUserAsync(employeeUserId, approve ? "Leave approved" : "Leave rejected",
            $"Your {leave.LeaveType} leave, {DescribeDays(leave.StartDate, leave.EndDate)}" +
            (note is null ? "." : $". Note: {note}"), "/staff?tab=mine");
        return ServiceResult<int>.Ok(id);
    }

    // An employee withdraws their own request before it has been reviewed.
    public async Task<ServiceResult<int>> CancelOwnLeaveAsync(int id, string userId)
    {
        var leave = await db.LeaveRequests.FirstOrDefaultAsync(l => l.Id == id && l.Employee.UserId == userId);
        // Someone else's request looks the same as a missing one, so ids cannot be probed.
        if (leave is null) return ServiceResult<int>.NotFound();

        if (leave.Status != LeaveStatus.Pending)
        {
            return Invalid<int>("Status", "Only a pending request can be withdrawn.");
        }

        leave.Status = LeaveStatus.Cancelled;
        await db.SaveChangesAsync();
        return ServiceResult<int>.Ok(id);
    }

    // Two date ranges overlap when each one starts on or before the other one ends.
    private Task<LeaveRequest?> FindOverlapAsync(int employeeId, DateOnly start, DateOnly end, int? exceptId, LeaveStatus[] statuses) =>
        db.LeaveRequests.AsNoTracking()
            .Where(l => l.EmployeeId == employeeId && l.Id != exceptId && statuses.Contains(l.Status))
            .Where(l => l.StartDate <= end && start <= l.EndDate)
            .OrderBy(l => l.StartDate)
            .FirstOrDefaultAsync();

    private async Task<List<LeaveResponse>> ListLeaveAsync(IQueryable<LeaveRequest> query, int take)
    {
        var rows = await query.AsNoTracking()
            .OrderByDescending(l => l.StartDate).ThenByDescending(l => l.Id)
            .Take(take)
            .Select(l => new LeaveResponse(l.Id, l.EmployeeId, l.Employee.EmployeeNumber,
                l.Employee.FirstName + " " + l.Employee.LastName, l.Employee.Department.Name,
                l.LeaveType, l.StartDate, l.EndDate, 0, l.Reason, l.Status, l.CreatedAt,
                db.Users.Where(u => u.Id == l.RequestedByUserId).Select(u => u.UserName).FirstOrDefault(),
                db.Users.Where(u => u.Id == l.ReviewedByUserId).Select(u => u.UserName).FirstOrDefault(),
                l.ReviewedAt, l.ReviewNote))
            .ToListAsync();
        return rows.Select(l => l with { Days = l.EndDate.DayNumber - l.StartDate.DayNumber + 1 }).ToList();
    }

    private static ServiceResult<T> Invalid<T>(string field, string message) =>
        ServiceResult<T>.Invalid(new() { [field] = [message] });

    private static string DescribeDays(DateOnly start, DateOnly end) =>
        start == end ? $"{start:yyyy-MM-dd}" : $"{start:yyyy-MM-dd} to {end:yyyy-MM-dd}";
}
