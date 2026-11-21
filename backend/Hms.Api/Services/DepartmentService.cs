using Hms.Api.Data;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Services;

// PDF section 6: Departments, managed on the Staff page. Deactivated, never deleted,
// because employees and history point to them.
public class DepartmentService(AppDbContext db)
{
    public Task<List<DepartmentResponse>> ListAsync(bool includeInactive) =>
        Query(db.Departments
                .Where(d => includeInactive || d.IsActive)
                .OrderByDescending(d => d.Name == DepartmentSeeder.DefaultName).ThenBy(d => d.Name))
            .ToListAsync();

    public async Task<ServiceResult<DepartmentResponse>> SaveAsync(int? id, DepartmentRequest request)
    {
        var name = request.Name.Trim();
        if (await db.Departments.AnyAsync(d => d.Name.ToLower() == name.ToLower() && d.Id != id))
        {
            return Invalid("Name", "A department with this name already exists.");
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
            if (department is null) return ServiceResult<DepartmentResponse>.NotFound();

            // The default department is where new non-clinical staff start, so it must stay as it is.
            if (IsDefaultName(department.Name) &&
                (!IsDefaultName(name) || !request.IsActive || request.IsClinical))
            {
                return Invalid("Name",
                    $"\"{DepartmentSeeder.DefaultName}\" is the default department for non-clinical staff. It stays active and non-clinical, and cannot be renamed.");
            }

            // Clinical staff are only ever placed in clinical departments (assumption A26).
            if (department.IsClinical && !request.IsClinical &&
                await db.Employees.AnyAsync(e => e.DepartmentId == department.Id && e.IsActive))
            {
                return Invalid("IsClinical", "Clinical staff work in this department, so it must stay clinical. Move them first.");
            }
        }

        department.Name = name;
        department.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        department.IsActive = request.IsActive;
        department.IsClinical = request.IsClinical;
        await db.SaveChangesAsync();

        return ServiceResult<DepartmentResponse>.Ok(await Query(db.Departments.Where(d => d.Id == department.Id)).FirstAsync());
    }

    private static bool IsDefaultName(string name) => name.Equals(DepartmentSeeder.DefaultName, StringComparison.OrdinalIgnoreCase);

    private static IQueryable<DepartmentResponse> Query(IQueryable<Department> departments) =>
        departments.AsNoTracking().Select(d => new DepartmentResponse(d.Id, d.Name, d.Description, d.IsActive, d.IsClinical,
            d.Name == DepartmentSeeder.DefaultName,
            d.Employees.Count(e => e.IsActive && e.Doctor != null),
            d.Employees.Count(e => e.IsActive)));

    private static ServiceResult<DepartmentResponse> Invalid(string field, string message) =>
        ServiceResult<DepartmentResponse>.Invalid(new() { [field] = [message] });
}
