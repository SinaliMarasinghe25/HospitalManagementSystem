using Hms.Api.Data;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Services;

// Business logic for PDF 3.3 Doctor Management.
// A doctor is stored as an Employee (name, department) plus a Doctor profile (licence, fee, schedule).
// Doctors are added and edited on the Staff page (EmployeeService). Here they are listed and given a weekly schedule.
public class DoctorService(AppDbContext db)
{
    public Task<List<DoctorSummary>> ListAsync(int? departmentId, string? search, bool includeInactive)
    {
        var query = db.Doctors.AsNoTracking()
            .Where(d => includeInactive || d.Employee.IsActive)
            .Where(d => departmentId == null || d.Employee.DepartmentId == departmentId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = SearchText.Contains(search);
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

    // The doctor profile linked to a login account, or null when the user is not a doctor.
    // Doctor screens use it to show "my" appointments, visits and lab requests.
    public Task<int?> DoctorIdForUserAsync(string? userId) =>
        db.Doctors.Where(d => d.Employee.UserId == userId).Select(d => (int?)d.Id).FirstOrDefaultAsync();

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

    private static DoctorDetail ToDetail(Doctor d) => new(
        d.Id, d.EmployeeId, d.Employee.EmployeeNumber, d.Employee.FirstName, d.Employee.LastName,
        d.Employee.Phone, d.Employee.Email, d.Employee.HireDate, d.Employee.DepartmentId,
        d.Employee.Department.Name, d.Specialization, d.LicenseNumber, d.ConsultationFee, d.SlotMinutes,
        d.Employee.IsActive, d.Employee.User?.UserName,
        d.Schedules.OrderBy(s => s.DayOfWeek).ThenBy(s => s.StartTime)
            .Select(s => new ScheduleItem(s.DayOfWeek, s.StartTime, s.EndTime)).ToList());
}
