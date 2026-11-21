using Hms.Api.Data;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Services;

// PDF 3.10 Reports (FR-RP-01 to 06). Read-only: nothing here changes data.
//
// Dates are hospital days (assumption A11), both inclusive. Totals and "how many of each" tables are worked out
// over the whole period. The detail lists stop at MaxDetailRows rows, so a year of data cannot freeze the browser;
// the report then says the list is cut short, and the totals stay complete.
public class ReportService(AppDbContext db, BillingService billing, PharmacyService pharmacy)
{
    public const int MaxRangeDays = 366;
    public const int MaxDetailRows = 2000;

    // ---------- FR-RP-01 Patient reports ----------

    public async Task<ServiceResult<PatientReport>> GetPatientReportAsync(DateOnly? fromDate, DateOnly? toDate)
    {
        if (!TryPeriod(fromDate, toDate, out var period, out var errors)) return ServiceResult<PatientReport>.Invalid(errors);
        var (fromUtc, toUtc) = HospitalTime.DaysToUtc(period.From, period.To);
        var query = db.Patients.AsNoTracking().Where(p => p.CreatedAt >= fromUtc && p.CreatedAt < toUtc);

        // Three small columns per patient are enough for every summary table.
        var facts = await query.Select(p => new { p.CreatedAt, p.Gender, p.DateOfBirth }).ToListAsync();

        var byDay = facts.GroupBy(p => HospitalDay(p.CreatedAt)).OrderBy(g => g.Key)
            .Select(g => new CountRow(g.Key.ToString("yyyy-MM-dd"), g.Count())).ToList();
        var byGender = Enum.GetValues<Gender>()
            .Select(g => new CountRow(g.ToString(), facts.Count(p => p.Gender == g))).ToList();
        var today = HospitalTime.Today;
        var byAgeGroup = AgeGroups
            .Select(group => new CountRow(group.Label,
                facts.Count(p => AgeOn(p.DateOfBirth, today) is var age && age >= group.Min && age <= group.Max)))
            .ToList();

        var patients = await query.OrderBy(p => p.CreatedAt).ThenBy(p => p.Id).Take(MaxDetailRows)
            .Select(p => new PatientReportRow(p.Id, p.PatientNumber, p.FirstName + " " + p.LastName, p.Gender,
                p.DateOfBirth, p.Phone, p.CreatedAt))
            .ToListAsync();

        return ServiceResult<PatientReport>.Ok(new PatientReport(period, facts.Count, byDay, byGender, byAgeGroup,
            patients, facts.Count > patients.Count));
    }

    // ---------- FR-RP-02 Appointment reports ----------

    // onlyDoctorId: a doctor sees only their own appointments (role table: Doctor "Own").
    public async Task<ServiceResult<AppointmentReport>> GetAppointmentReportAsync(
        DateOnly? fromDate, DateOnly? toDate, int? doctorId, AppointmentStatus? status, int? onlyDoctorId)
    {
        if (!TryPeriod(fromDate, toDate, out var period, out var errors)) return ServiceResult<AppointmentReport>.Invalid(errors);
        var (fromUtc, toUtc) = HospitalTime.DaysToUtc(period.From, period.To);
        var query = db.Appointments.AsNoTracking().Where(a => a.StartTime >= fromUtc && a.StartTime < toUtc);
        if (onlyDoctorId is not null) query = query.Where(a => a.DoctorId == onlyDoctorId);
        if (doctorId is not null) query = query.Where(a => a.DoctorId == doctorId);
        if (status is not null) query = query.Where(a => a.Status == status);

        var statusCounts = await query.GroupBy(a => a.Status)
            .Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count);
        var byStatus = Enum.GetValues<AppointmentStatus>()
            .Select(s => new CountRow(s.ToString(), statusCounts.GetValueOrDefault(s))).ToList();

        var byDoctor = await query
            .GroupBy(a => new { a.DoctorId, a.Doctor.Employee.FirstName, a.Doctor.Employee.LastName, a.Doctor.Specialization })
            .Select(g => new DoctorAppointmentRow(
                g.Key.DoctorId,
                g.Key.FirstName + " " + g.Key.LastName,
                g.Key.Specialization,
                g.Count(),
                g.Count(a => a.Status == AppointmentStatus.Completed),
                g.Count(a => a.Status == AppointmentStatus.Cancelled),
                g.Count(a => a.Status == AppointmentStatus.NoShow),
                g.Count(a => a.Status == AppointmentStatus.Scheduled || a.Status == AppointmentStatus.CheckedIn)))
            .ToListAsync();
        // Sorted here: EF Core cannot sort on the properties of a record made inside GroupBy.
        byDoctor = [.. byDoctor.OrderByDescending(r => r.Total).ThenBy(r => r.DoctorName)];

        var appointments = await query.OrderBy(a => a.StartTime).ThenBy(a => a.Id).Take(MaxDetailRows)
            .Select(a => new AppointmentReportRow(a.Id, a.StartTime, a.Patient.PatientNumber,
                a.Patient.FirstName + " " + a.Patient.LastName,
                a.Doctor.Employee.FirstName + " " + a.Doctor.Employee.LastName, a.Status))
            .ToListAsync();

        var total = statusCounts.Values.Sum();
        return ServiceResult<AppointmentReport>.Ok(new AppointmentReport(period, total, byStatus, byDoctor, appointments,
            total > appointments.Count));
    }

    // ---------- FR-RP-03 Revenue reports ----------

    public async Task<ServiceResult<RevenueReport>> GetRevenueReportAsync(DateOnly? fromDate, DateOnly? toDate)
    {
        if (!TryPeriod(fromDate, toDate, out var period, out var errors)) return ServiceResult<RevenueReport>.Invalid(errors);
        var (fromUtc, toUtc) = HospitalTime.DaysToUtc(period.From, period.To);

        // Billed: invoices issued in the period. A cancelled invoice was never owed, so it is left out.
        var invoices = db.Invoices.AsNoTracking()
            .Where(i => i.IssuedAt >= fromUtc && i.IssuedAt < toUtc && i.Status != InvoiceStatus.Cancelled);
        var sourceTotals = await db.Charges.AsNoTracking()
            .Where(c => c.InvoiceId != null && invoices.Any(i => i.Id == c.InvoiceId))
            .GroupBy(c => c.ChargeType)
            .Select(g => new { g.Key, Count = g.Count(), Amount = g.Sum(c => c.Amount) })
            .ToDictionaryAsync(x => x.Key);
        var bySource = Enum.GetValues<ChargeType>()
            .Select(t => sourceTotals.TryGetValue(t, out var x)
                ? new RevenueSourceRow(t, x.Count, x.Amount)
                : new RevenueSourceRow(t, 0, 0m))
            .ToList();
        var invoiceFacts = await invoices.Select(i => new { IssuedAt = i.IssuedAt!.Value, i.Subtotal, i.Discount, i.Total })
            .ToListAsync();

        // Collected: every payment received in the period.
        var payments = db.Payments.AsNoTracking().Where(p => p.PaidAt >= fromUtc && p.PaidAt < toUtc);
        var methodTotals = await payments.GroupBy(p => p.Method)
            .Select(g => new { g.Key, Count = g.Count(), Amount = g.Sum(p => p.Amount) })
            .ToDictionaryAsync(x => x.Key);
        var byMethod = Enum.GetValues<PaymentMethod>()
            .Select(m => methodTotals.TryGetValue(m, out var x)
                ? new PaymentMethodRow(m, x.Count, x.Amount)
                : new PaymentMethodRow(m, 0, 0m))
            .ToList();
        var paymentFacts = await payments.Select(p => new { p.PaidAt, p.Amount }).ToListAsync();

        var billedByDay = invoiceFacts.GroupBy(i => HospitalDay(i.IssuedAt)).ToDictionary(g => g.Key, g => g.Sum(i => i.Total));
        var collectedByDay = paymentFacts.GroupBy(p => HospitalDay(p.PaidAt)).ToDictionary(g => g.Key, g => g.Sum(p => p.Amount));
        var byDay = billedByDay.Keys.Union(collectedByDay.Keys).Order()
            .Select(d => new DailyRevenueRow(d, billedByDay.GetValueOrDefault(d), collectedByDay.GetValueOrDefault(d)))
            .ToList();

        var paymentRows = await payments.OrderBy(p => p.PaidAt).ThenBy(p => p.Id).Take(MaxDetailRows)
            .Select(p => new RevenuePaymentRow(p.Id, p.ReceiptNumber, p.PaidAt, p.InvoiceId, p.Invoice.InvoiceNumber,
                p.Invoice.Patient.PatientNumber, p.Invoice.Patient.FirstName + " " + p.Invoice.Patient.LastName,
                p.Method, p.Amount))
            .ToListAsync();

        return ServiceResult<RevenueReport>.Ok(new RevenueReport(
            period,
            bySource,
            invoiceFacts.Sum(i => i.Subtotal),
            invoiceFacts.Sum(i => i.Discount),
            invoiceFacts.Sum(i => i.Total),
            invoiceFacts.Count,
            byMethod,
            paymentFacts.Sum(p => p.Amount),
            byDay,
            await billing.GetOutstandingAsync(),
            paymentRows,
            paymentFacts.Count > paymentRows.Count));
    }

    // ---------- FR-RP-04 Pharmacy reports ----------

    // Stock, low stock and expiry show today's position. "Dispensed" covers the chosen period.
    // Only the administrator and the pharmacist open this report, and both may see cost prices.
    public async Task<ServiceResult<PharmacyReport>> GetPharmacyReportAsync(DateOnly? fromDate, DateOnly? toDate)
    {
        if (!TryPeriod(fromDate, toDate, out var period, out var errors)) return ServiceResult<PharmacyReport>.Invalid(errors);
        var (fromUtc, toUtc) = HospitalTime.DaysToUtc(period.From, period.To);

        var stock = await pharmacy.ListMedicinesAsync(search: null, includeInactive: false, showCost: true);
        var alerts = await pharmacy.GetAlertsAsync(showCost: true);

        // Every dispense writes one pharmacy charge with the quantity taken from one batch (PharmacyService.DispenseAsync),
        // so the charges give both the quantity and the amount billed.
        var dispensed = await db.Charges.AsNoTracking()
            .Where(c => c.StockMovement != null && c.StockMovement.MovementType == StockMovementType.Dispense &&
                        c.StockMovement.CreatedAt >= fromUtc && c.StockMovement.CreatedAt < toUtc)
            .GroupBy(c => new
            {
                c.StockMovement!.MedicineBatch.MedicineId, c.StockMovement.MedicineBatch.Medicine.Name,
                c.StockMovement.MedicineBatch.Medicine.Strength, c.StockMovement.MedicineBatch.Medicine.Form,
            })
            .Select(g => new DispensedRow(
                g.Key.MedicineId, g.Key.Name, g.Key.Strength, g.Key.Form, g.Sum(c => c.Quantity), g.Sum(c => c.Amount)))
            .ToListAsync();
        dispensed = [.. dispensed.OrderByDescending(r => r.Quantity).ThenBy(r => r.Name)];

        return ServiceResult<PharmacyReport>.Ok(new PharmacyReport(
            period,
            alerts.NearExpiryDays,
            stock,
            stock.Sum(m => m.StockValue ?? 0m),
            alerts.LowStock,
            alerts.NearExpiry,
            alerts.Expired,
            dispensed,
            dispensed.Sum(d => d.Quantity),
            dispensed.Sum(d => d.Amount)));
    }

    // ---------- FR-RP-05 Laboratory reports ----------

    public async Task<ServiceResult<LabReport>> GetLabReportAsync(
        DateOnly? fromDate, DateOnly? toDate, int? labTestId, LabRequestStatus? status)
    {
        if (!TryPeriod(fromDate, toDate, out var period, out var errors)) return ServiceResult<LabReport>.Invalid(errors);
        var (fromUtc, toUtc) = HospitalTime.DaysToUtc(period.From, period.To);
        var query = db.LabRequests.AsNoTracking().Where(r => r.RequestedAt >= fromUtc && r.RequestedAt < toUtc);
        if (labTestId is not null) query = query.Where(r => r.LabTestId == labTestId);
        if (status is not null) query = query.Where(r => r.Status == status);

        var statusCounts = await query.GroupBy(r => r.Status)
            .Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count);
        var byStatus = Enum.GetValues<LabRequestStatus>()
            .Select(s => new CountRow(s.ToString(), statusCounts.GetValueOrDefault(s))).ToList();

        var byTest = await query
            .GroupBy(r => new { r.LabTestId, r.LabTest.Code, r.LabTest.Name })
            .Select(g => new LabTestCountRow(
                g.Key.LabTestId, g.Key.Code, g.Key.Name,
                g.Count(),
                g.Count(r => r.Status == LabRequestStatus.Requested || r.Status == LabRequestStatus.SampleCollected),
                g.Count(r => r.Status == LabRequestStatus.Completed),
                g.Count(r => r.Status == LabRequestStatus.Completed && r.IsAbnormal == true),
                g.Count(r => r.Status == LabRequestStatus.Cancelled)))
            .ToListAsync();
        byTest = [.. byTest.OrderByDescending(r => r.Total).ThenBy(r => r.Name)];

        var requests = await query.OrderBy(r => r.RequestedAt).ThenBy(r => r.Id).Take(MaxDetailRows)
            .Select(r => new LabReportRow(r.Id, r.RequestNumber, r.RequestedAt, r.Patient.PatientNumber,
                r.Patient.FirstName + " " + r.Patient.LastName, r.LabTest.Name,
                r.RequestedByDoctor.Employee.FirstName + " " + r.RequestedByDoctor.Employee.LastName,
                r.Status, r.IsAbnormal))
            .ToListAsync();

        var total = statusCounts.Values.Sum();
        return ServiceResult<LabReport>.Ok(new LabReport(period, total, byStatus, byTest, requests, total > requests.Count));
    }

    // ---------- FR-RP-06 Staff reports ----------

    // One month. Lists every employee who was active and hired by the end of the month,
    // plus anyone (even inactive now) with attendance in that month, so old months stay complete.
    public async Task<ServiceResult<StaffReport>> GetStaffReportAsync(int? year, int? month, int? departmentId)
    {
        var today = HospitalTime.Today;
        var y = year ?? today.Year;
        var m = month ?? today.Month;
        if (y is < 2000 or > 2100 || m is < 1 or > 12)
        {
            return ServiceResult<StaffReport>.Invalid(new() { ["Month"] = ["Choose a valid month."] });
        }
        var first = new DateOnly(y, m, 1);
        var last = first.AddMonths(1).AddDays(-1);

        var employees = db.Employees.AsNoTracking()
            .Where(e => e.HireDate <= last)
            .Where(e => e.IsActive || e.AttendanceRecords.Any(a => a.Date >= first && a.Date <= last));
        if (departmentId is not null) employees = employees.Where(e => e.DepartmentId == departmentId);

        var rows = await employees
            .OrderBy(e => e.Department.Name).ThenBy(e => e.LastName).ThenBy(e => e.FirstName)
            .Select(e => new
            {
                e.Id,
                e.EmployeeNumber,
                FullName = e.FirstName + " " + e.LastName,
                e.JobTitle,
                DepartmentName = e.Department.Name,
                Statuses = e.AttendanceRecords.Where(a => a.Date >= first && a.Date <= last).Select(a => a.Status).ToList(),
            })
            .ToListAsync();

        // Leave requests that overlap the month (all statuses, so pending and rejected requests are visible too).
        var leave = await db.LeaveRequests.AsNoTracking()
            .Where(l => l.StartDate <= last && l.EndDate >= first)
            .Where(l => employees.Any(e => e.Id == l.EmployeeId))
            .OrderBy(l => l.StartDate).ThenBy(l => l.Employee.LastName).ThenBy(l => l.Id)
            .Select(l => new StaffLeaveRow(l.Id, l.EmployeeId, l.Employee.EmployeeNumber,
                l.Employee.FirstName + " " + l.Employee.LastName, l.LeaveType, l.StartDate, l.EndDate, 0, l.Status))
            .ToListAsync();
        leave = leave.Select(l => l with { DaysInMonth = DaysInside(l.StartDate, l.EndDate, first, last) }).ToList();

        var result = rows.Select(r =>
        {
            var mine = leave.Where(l => l.EmployeeId == r.Id).ToList();
            return new StaffMonthRow(r.Id, r.EmployeeNumber, r.FullName, r.JobTitle, r.DepartmentName,
                r.Statuses.Count(s => s == AttendanceStatus.Present),
                r.Statuses.Count(s => s == AttendanceStatus.Late),
                r.Statuses.Count(s => s == AttendanceStatus.Absent),
                r.Statuses.Count(s => s == AttendanceStatus.OnLeave),
                r.Statuses.Count,
                mine.Where(l => l.Status == LeaveStatus.Approved).Sum(l => l.DaysInMonth),
                mine.Count(l => l.Status == LeaveStatus.Pending));
        }).ToList();

        return ServiceResult<StaffReport>.Ok(new StaffReport(y, m, last.Day, result, leave));
    }

    // ---------- Helpers ----------

    // Without dates: the current month so far.
    private static bool TryPeriod(DateOnly? fromDate, DateOnly? toDate, out ReportPeriod period,
        out Dictionary<string, string[]> errors)
    {
        var to = toDate ?? HospitalTime.Today;
        var from = fromDate ?? new DateOnly(to.Year, to.Month, 1);
        period = new ReportPeriod(from, to);
        errors = [];
        if (to < from || to.DayNumber - from.DayNumber + 1 > MaxRangeDays)
        {
            errors["ToDate"] = [$"The end date must be on or after the start date, and the period at most {MaxRangeDays} days."];
        }
        return errors.Count == 0;
    }

    private static DateOnly HospitalDay(DateTime utc) => DateOnly.FromDateTime(HospitalTime.ToLocal(utc));

    private static int AgeOn(DateOnly birth, DateOnly day)
    {
        var age = day.Year - birth.Year;
        return birth > day.AddYears(-age) ? age - 1 : age;
    }

    private static int DaysInside(DateOnly start, DateOnly end, DateOnly first, DateOnly last) =>
        Math.Min(end.DayNumber, last.DayNumber) - Math.Max(start.DayNumber, first.DayNumber) + 1;

    private static readonly (string Label, int Min, int Max)[] AgeGroups =
    [
        ("0-12", 0, 12), ("13-17", 13, 17), ("18-39", 18, 39), ("40-64", 40, 64), ("65+", 65, int.MaxValue),
    ];
}
