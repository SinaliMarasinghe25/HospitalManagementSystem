using Hms.Api.Data;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Services;

public class DepartmentService(AppDbContext db)
{
    public Task<List<DepartmentResponse>> ListAsync(bool includeInactive) =>
        db.Departments.AsNoTracking()
            .Where(d => includeInactive || d.IsActive)
            .OrderBy(d => d.Name)
            .Select(d => new DepartmentResponse(d.Id, d.Name, d.Description, d.IsActive,
                d.Employees.Count(e => e.IsActive && e.Doctor != null),
                d.Employees.Count(e => e.IsActive)))
            .ToListAsync();

    public async Task<ServiceResult<DepartmentResponse>> SaveAsync(int? id, DepartmentRequest request)
    {
        var name = request.Name.Trim();
        if (await db.Departments.AnyAsync(d => d.Name.ToLower() == name.ToLower() && d.Id != id))
        {
            return ServiceResult<DepartmentResponse>.Invalid(new() { ["Name"] = ["A department with this name already exists."] });
        }

        Department? department;
        if (id is null)
        {
            department = new Department();
            db.Departments.Add(department);
        }
        else
        {
            department = await db.Departments.FindAsync(id);
            if (department is null)
            {
                return ServiceResult<DepartmentResponse>.NotFound();
            }
        }

        department.Name = name;
        department.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        department.IsActive = request.IsActive;
        await db.SaveChangesAsync();

        var doctorCount = await db.Doctors.CountAsync(d => d.Employee.DepartmentId == department.Id && d.Employee.IsActive);
        var staffCount = await db.Employees.CountAsync(e => e.DepartmentId == department.Id && e.IsActive);
        return ServiceResult<DepartmentResponse>.Ok(new DepartmentResponse(
            department.Id, department.Name, department.Description, department.IsActive, doctorCount, staffCount));
    }
}
