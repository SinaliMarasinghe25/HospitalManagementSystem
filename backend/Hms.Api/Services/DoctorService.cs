using Hms.Api.Authorization;
using Hms.Api.Data;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Services;

// Business logic for PDF 3.3 Doctor Management.
// A doctor is stored as an Employee (name, department) plus a Doctor profile (licence, fee, schedule).
public class DoctorService(AppDbContext db, UserManager<AppUser> userManager)
{
    public Task<List<DoctorSummary>> ListAsync(int? departmentId, string? search, bool includeInactive)
    {
        var query = db.Doctors.AsNoTracking()
            .Where(d => includeInactive || d.Employee.IsActive)
            .Where(d => departmentId == null || d.Employee.DepartmentId == departmentId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_")}%";
            query = query.Where(d =>
                EF.Functions.ILike(d.Employee.FirstName + " " + d.Employee.LastName, pattern, "\\") ||
                EF.Functions.ILike(d.Specialization, pattern, "\\"));
        }

        return query
            .OrderBy(d => d.Employee.LastName).ThenBy(d => d.Employee.FirstName)
            .Select(d => new DoctorSummary(d.Id, d.Employee.EmployeeNumber,
                d.Employee.FirstName + " " + d.Employee.LastName, d.Specialization,
                d.Employee.DepartmentId, d.Employee.Department.Name, d.ConsultationFee, d.Employee.IsActive))
            .ToListAsync();
    }

    public async Task<DoctorDetail?> GetAsync(int id)
    {
        var doctor = await db.Doctors.AsNoTracking()
            .Include(d => d.Employee).ThenInclude(e => e.Department)
            .Include(d => d.Employee).ThenInclude(e => e.User)
            .Include(d => d.Schedules)
            .FirstOrDefaultAsync(d => d.Id == id);
        return doctor is null ? null : ToDetail(doctor);
    }

    public async Task<ServiceResult<DoctorDetail>> CreateAsync(DoctorRequest request)
    {
        var errors = await ValidateAsync(request, existingDoctorId: null);
        var wantsLogin = !string.IsNullOrWhiteSpace(request.UserName);
        if (wantsLogin && string.IsNullOrWhiteSpace(request.Password))
        {
            errors["Password"] = ["Enter a password for the login account."];
        }
        if (wantsLogin && await userManager.FindByNameAsync(request.UserName!) is not null)
        {
            errors["UserName"] = ["This username is already taken."];
        }
        if (errors.Count > 0)
        {
            return ServiceResult<DoctorDetail>.Invalid(errors);
        }

        // A transaction: the login account, employee and doctor are saved together or not at all.
        await using var transaction = await db.Database.BeginTransactionAsync();

        AppUser? user = null;
        if (wantsLogin)
        {
            user = new AppUser { UserName = request.UserName!.Trim(), Email = Normalize(request.Email) };
            var created = await userManager.CreateAsync(user, request.Password!);
            if (!created.Succeeded)
            {
                return ServiceResult<DoctorDetail>.Invalid(new()
                {
                    ["Password"] = created.Errors.Select(e => e.Description).ToArray()
                });
            }
            await userManager.AddToRoleAsync(user, Roles.Doctor);
        }

        var next = await db.Database
            .SqlQuery<long>($"SELECT nextval('\"EmployeeNumbers\"') AS \"Value\"")
            .SingleAsync();

        var doctor = new Doctor
        {
            Employee = new Employee
            {
                EmployeeNumber = $"EMP-{next:D4}",
                JobTitle = "Doctor",
                UserId = user?.Id,
            }
        };
        Apply(doctor, request);
        db.Doctors.Add(doctor);
        await db.SaveChangesAsync();
        await transaction.CommitAsync();

        return ServiceResult<DoctorDetail>.Ok((await GetAsync(doctor.Id))!);
    }

    public async Task<ServiceResult<DoctorDetail>> UpdateAsync(int id, DoctorRequest request)
    {
        var doctor = await db.Doctors.Include(d => d.Employee).FirstOrDefaultAsync(d => d.Id == id);
        if (doctor is null)
        {
            return ServiceResult<DoctorDetail>.NotFound();
        }

        var errors = await ValidateAsync(request, existingDoctorId: id);
        if (errors.Count > 0)
        {
            return ServiceResult<DoctorDetail>.Invalid(errors);
        }

        Apply(doctor, request);
        await db.SaveChangesAsync();
        return ServiceResult<DoctorDetail>.Ok((await GetAsync(id))!);
    }

    // Replaces the doctor's whole weekly schedule with the list sent.
    public async Task<ServiceResult<DoctorDetail>> SetScheduleAsync(int id, List<ScheduleItem> items)
    {
        var doctor = await db.Doctors.Include(d => d.Schedules).FirstOrDefaultAsync(d => d.Id == id);
        if (doctor is null)
        {
            return ServiceResult<DoctorDetail>.NotFound();
        }

        var errors = new List<string>();
        if (items.Any(i => !Enum.IsDefined(i.DayOfWeek)))
        {
            errors.Add("Day of week must be Sunday to Saturday.");
        }
        foreach (var item in items.Where(i => i.EndTime <= i.StartTime))
        {
            errors.Add($"{item.DayOfWeek}: end time must be after start time.");
        }

        // Two blocks on the same day must not overlap (e.g. 08:00-12:00 and 11:00-14:00).
        foreach (var day in items.GroupBy(i => i.DayOfWeek))
        {
            var ordered = day.OrderBy(i => i.StartTime).ToList();
            for (var i = 1; i < ordered.Count; i++)
            {
                if (ordered[i].StartTime < ordered[i - 1].EndTime)
                {
                    errors.Add($"{day.Key}: time blocks overlap.");
                    break;
                }
            }
        }

        if (errors.Count > 0)
        {
            return ServiceResult<DoctorDetail>.Invalid(new() { ["Items"] = errors.ToArray() });
        }

        db.DoctorSchedules.RemoveRange(doctor.Schedules);
        foreach (var item in items)
        {
            db.DoctorSchedules.Add(new DoctorSchedule
            {
                DoctorId = id,
                DayOfWeek = item.DayOfWeek,
                StartTime = item.StartTime!.Value,
                EndTime = item.EndTime!.Value,
            });
        }
        await db.SaveChangesAsync();
        return ServiceResult<DoctorDetail>.Ok((await GetAsync(id))!);
    }

    private async Task<Dictionary<string, string[]>> ValidateAsync(DoctorRequest request, int? existingDoctorId)
    {
        var errors = new Dictionary<string, string[]>();

        if (!await db.Departments.AnyAsync(d => d.Id == request.DepartmentId && d.IsActive))
        {
            errors["DepartmentId"] = ["Choose an active department."];
        }

        var licence = request.LicenseNumber.Trim().ToUpperInvariant();
        if (await db.Doctors.AnyAsync(d => d.LicenseNumber == licence && d.Id != existingDoctorId))
        {
            errors["LicenseNumber"] = ["Another doctor already has this licence number."];
        }

        if (request.HireDate > DateOnly.FromDateTime(DateTime.UtcNow))
        {
            errors["HireDate"] = ["Hire date cannot be in the future."];
        }

        return errors;
    }

    private static void Apply(Doctor doctor, DoctorRequest request)
    {
        doctor.Employee.FirstName = request.FirstName.Trim();
        doctor.Employee.LastName = request.LastName.Trim();
        doctor.Employee.Phone = request.Phone.Trim();
        doctor.Employee.Email = Normalize(request.Email);
        doctor.Employee.HireDate = request.HireDate!.Value;
        doctor.Employee.DepartmentId = request.DepartmentId!.Value;
        doctor.Employee.IsActive = request.IsActive;
        doctor.Specialization = request.Specialization.Trim();
        doctor.LicenseNumber = request.LicenseNumber.Trim().ToUpperInvariant();
        doctor.ConsultationFee = request.ConsultationFee;
        doctor.SlotMinutes = request.SlotMinutes;
    }

    private static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static DoctorDetail ToDetail(Doctor d) => new(
        d.Id, d.EmployeeId, d.Employee.EmployeeNumber, d.Employee.FirstName, d.Employee.LastName,
        d.Employee.Phone, d.Employee.Email, d.Employee.HireDate, d.Employee.DepartmentId,
        d.Employee.Department.Name, d.Specialization, d.LicenseNumber, d.ConsultationFee, d.SlotMinutes,
        d.Employee.IsActive, d.Employee.User?.UserName,
        d.Schedules.OrderBy(s => s.DayOfWeek).ThenBy(s => s.StartTime)
            .Select(s => new ScheduleItem(s.DayOfWeek, s.StartTime, s.EndTime)).ToList());
}
