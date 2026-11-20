using Hms.Api.Authorization;
using Hms.Api.Data;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Hms.Api.Services;

// People: FR-ST-01 employee registration, FR-ST-03 department, FR-DM-01/02 doctors, and their login accounts.
// This is the ONE place where a person is added or changed:
//   employee (everyone)  +  optional doctor profile (doctors)  +  optional login (anyone who uses the system).
// The Doctors page only reads doctors and sets their weekly schedule; the Users page only changes accounts.
public class EmployeeService(AppDbContext db, UserAccountService accounts, StaffService staff, UserManager<AppUser> userManager)
{
    // ---------- Reading ----------

    public Task<List<EmployeeSummary>> ListAsync(string? search, int? departmentId, bool includeInactive)
    {
        var query = db.Employees.AsNoTracking()
            .Where(e => includeInactive || e.IsActive)
            .Where(e => departmentId == null || e.DepartmentId == departmentId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = SearchText.Contains(search);
            query = query.Where(e =>
                EF.Functions.ILike(e.FirstName + " " + e.LastName, pattern, "\\") ||
                EF.Functions.ILike(e.EmployeeNumber, pattern, "\\") ||
                EF.Functions.ILike(e.JobTitle, pattern, "\\"));
        }

        return query
            .OrderBy(e => e.LastName).ThenBy(e => e.FirstName)
            .Select(e => new EmployeeSummary(e.Id, e.EmployeeNumber, e.FirstName + " " + e.LastName, e.JobTitle,
                e.DepartmentId, e.Department.Name, e.Phone, e.IsActive,
                e.Doctor == null ? null : e.Doctor.Id,
                e.User == null ? null : e.User.UserName))
            .ToListAsync();
    }

    // One employee with their doctor profile, login and latest leave (the employee page).
    public async Task<EmployeeDetail?> GetAsync(int id)
    {
        var e = await db.Employees.AsNoTracking()
            .Include(x => x.Department)
            .Include(x => x.Doctor)
            .Include(x => x.User)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (e is null) return null;

        var leave = await staff.ListLeaveForEmployeeAsync(id);
        var doctor = e.Doctor is null ? null
            : new DoctorProfile(e.Doctor.Id, e.Doctor.Specialization, e.Doctor.LicenseNumber, e.Doctor.ConsultationFee, e.Doctor.SlotMinutes);
        return new EmployeeDetail(e.Id, e.EmployeeNumber, e.FirstName, e.LastName, e.JobTitle, e.Phone, e.Email,
            e.HireDate, e.DepartmentId, e.Department.Name, e.IsActive, doctor, e.UserId, e.User?.UserName, leave);
    }

    // ---------- Adding and editing ----------

    public async Task<ServiceResult<int>> CreateAsync(EmployeeRequest request)
    {
        var errors = await ValidateAsync(request, null);
        var wantsLogin = !string.IsNullOrWhiteSpace(request.UserName);
        if (wantsLogin)
        {
            if (string.IsNullOrWhiteSpace(request.Password))
            {
                errors["Password"] = ["Enter a temporary password for the login account."];
            }
            // Check the roles now, so every mistake on the form is shown together. A doctor's login always
            // gets the Doctor role (assumption A25), so it is added before the check.
            var isDoctor = request.Doctor is not null;
            var roles = (request.Roles ?? []).ToList();
            if (isDoctor) roles = roles.Append(Roles.Doctor).Distinct().ToList();
            var roleError = UserAccountService.CheckRoles(roles, isDoctor);
            if (roleError is not null) errors["Roles"] = [roleError];
        }
        if (errors.Count > 0) return ServiceResult<int>.Invalid(errors);

        // A transaction: employee, doctor profile and login are saved together or not at all.
        await using var transaction = await db.Database.BeginTransactionAsync();

        AppUser? user = null;
        if (wantsLogin)
        {
            var created = await accounts.CreateAsync(request.UserName!, request.Email, request.Password!,
                request.Roles ?? [], isDoctor: request.Doctor is not null);
            if (!created.Succeeded) return ServiceResult<int>.Invalid(created.Errors);
            user = created.Value;
        }

        // EMP-0001, EMP-0002... for everyone, doctors included.
        var next = await db.Database
            .SqlQuery<long>($"SELECT nextval('\"EmployeeNumbers\"') AS \"Value\"")
            .SingleAsync();

        var employee = new Employee { EmployeeNumber = $"EMP-{next:D4}", UserId = user?.Id };
        Apply(employee, request);
        db.Employees.Add(employee);
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return ServiceResult<int>.Ok(employee.Id);
    }

    public async Task<ServiceResult<int>> UpdateAsync(int id, EmployeeRequest request)
    {
        var employee = await db.Employees.Include(e => e.Doctor).Include(e => e.User)
            .FirstOrDefaultAsync(e => e.Id == id);
        if (employee is null) return ServiceResult<int>.NotFound();

        var errors = await ValidateAsync(request, employee);
        if (employee.Doctor is not null && request.Doctor is null)
        {
            errors["Doctor"] = ["A doctor profile cannot be removed, because appointments and records use it. Untick Active instead."];
        }
        if (errors.Count > 0) return ServiceResult<int>.Invalid(errors);

        var becomesDoctor = employee.Doctor is null && request.Doctor is not null;
        await using var transaction = await db.Database.BeginTransactionAsync();
        Apply(employee, request);
        await db.SaveChangesAsync();

        // A new doctor with a login gets the Doctor role, so the doctor screens work for them straight away.
        if (becomesDoctor && employee.User is not null)
        {
            await accounts.SyncDoctorRoleAsync(employee.User, isDoctor: true);
        }
        await transaction.CommitAsync();
        return ServiceResult<int>.Ok(id);
    }

    private async Task<Dictionary<string, string[]>> ValidateAsync(EmployeeRequest request, Employee? existing)
    {
        var errors = new Dictionary<string, string[]>();

        // An employee may stay in a department that was later deactivated, but new moves need an active one.
        var departmentOk = await db.Departments.AnyAsync(d =>
            d.Id == request.DepartmentId && (d.IsActive || (existing != null && existing.DepartmentId == d.Id)));
        if (!departmentOk)
        {
            errors["DepartmentId"] = ["Choose an active department."];
        }

        if (request.HireDate > HospitalTime.Today)
        {
            errors["HireDate"] = ["Hire date cannot be in the future."];
        }
        else if (existing is not null)
        {
            // Attendance before the hire date would make no sense.
            var firstAttendance = await db.Attendance.Where(a => a.EmployeeId == existing.Id)
                .OrderBy(a => a.Date).Select(a => (DateOnly?)a.Date).FirstOrDefaultAsync();
            if (firstAttendance is not null && request.HireDate > firstAttendance)
            {
                errors["HireDate"] = [$"Attendance is already recorded from {firstAttendance:yyyy-MM-dd}. The hire date must be on or before it."];
            }
        }

        if (request.Doctor is not null)
        {
            var licence = request.Doctor.LicenseNumber.Trim().ToUpperInvariant();
            var ownDoctorId = existing?.Doctor?.Id;
            if (await db.Doctors.AnyAsync(d => d.LicenseNumber == licence && d.Id != ownDoctorId))
            {
                errors["Doctor.LicenseNumber"] = ["Another doctor already has this registration number."];
            }
        }

        return errors;
    }

    private static void Apply(Employee employee, EmployeeRequest request)
    {
        employee.FirstName = request.FirstName.Trim();
        employee.LastName = request.LastName.Trim();
        employee.JobTitle = request.JobTitle.Trim();
        employee.Phone = request.Phone.Trim();
        employee.Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim();
        employee.HireDate = request.HireDate!.Value;
        employee.DepartmentId = request.DepartmentId!.Value;
        employee.IsActive = request.IsActive;

        if (request.Doctor is not null)
        {
            employee.Doctor ??= new Doctor();
            employee.Doctor.Specialization = request.Doctor.Specialization.Trim();
            employee.Doctor.LicenseNumber = request.Doctor.LicenseNumber.Trim().ToUpperInvariant();
            employee.Doctor.ConsultationFee = request.Doctor.ConsultationFee;
            employee.Doctor.SlotMinutes = request.Doctor.SlotMinutes;
        }
    }

    // ---------- Login account ----------

    // Creates a new login for an employee who has none, and links it, in one transaction.
    public async Task<ServiceResult<string>> CreateLoginAsync(int id, NewEmployeeLoginRequest request)
    {
        await using var transaction = await db.Database.BeginTransactionAsync();

        // Lock the employee row, so two administrators cannot both give this person a login.
        await db.Database.ExecuteSqlAsync($"SELECT 1 FROM \"Employees\" WHERE \"Id\" = {id} FOR UPDATE");
        var employee = await db.Employees.Include(e => e.Doctor).FirstOrDefaultAsync(e => e.Id == id);
        if (employee is null) return ServiceResult<string>.NotFound();
        if (employee.UserId is not null)
        {
            return Invalid<string>("UserName", "This employee already has a login account. Unlink it first.");
        }

        var created = await accounts.CreateAsync(request.UserName, employee.Email, request.Password, request.Roles,
            isDoctor: employee.Doctor is not null);
        if (!created.Succeeded) return ServiceResult<string>.Invalid(created.Errors);

        employee.UserId = created.Value!.Id;
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return ServiceResult<string>.Ok(created.Value.Id);
    }

    // Links an existing login to the employee, or unlinks it (userId null). The Doctor role follows the link.
    public async Task<ServiceResult<int>> SetLoginAsync(int id, string? userId)
    {
        var employee = await db.Employees.Include(e => e.Doctor).Include(e => e.User)
            .FirstOrDefaultAsync(e => e.Id == id);
        if (employee is null) return ServiceResult<int>.NotFound();

        userId = string.IsNullOrWhiteSpace(userId) ? null : userId;
        var isDoctor = employee.Doctor is not null;
        AppUser? newUser = null;
        if (userId is not null)
        {
            newUser = await userManager.FindByIdAsync(userId);
            if (newUser is null) return Invalid<int>("UserId", "This login account does not exist.");
            if (await db.Employees.AnyAsync(e => e.UserId == userId && e.Id != id))
            {
                return Invalid<int>("UserId", "This login account is already linked to another employee.");
            }
            if (!isDoctor && await userManager.IsInRoleAsync(newUser, Roles.Doctor))
            {
                return Invalid<int>("UserId",
                    "This login has the Doctor role, but this employee has no doctor profile. Link it to the doctor instead.");
            }
        }

        var oldUser = employee.User;
        await using var transaction = await db.Database.BeginTransactionAsync();
        employee.UserId = userId;
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Two administrators linked the same login at the same moment; the unique index kept only one.
            return Invalid<int>("UserId", "This login account is already linked to another employee.");
        }

        if (isDoctor && oldUser is not null && oldUser.Id != userId)
        {
            // No longer this doctor's login, so it loses the Doctor role. A login left with no role at all
            // could sign in but do nothing, so it is also deactivated until an administrator gives it a role.
            await accounts.SyncDoctorRoleAsync(oldUser, isDoctor: false);
            if ((await userManager.GetRolesAsync(oldUser)).Count == 0)
            {
                await accounts.SetActiveAsync(oldUser.Id, false, currentUserId: null);
            }
        }
        if (isDoctor && newUser is not null)
        {
            await accounts.SyncDoctorRoleAsync(newUser, isDoctor: true);
        }
        await transaction.CommitAsync();
        return ServiceResult<int>.Ok(id);
    }

    // Login accounts that no employee uses yet, for the "Link an existing login" list.
    public async Task<List<UnlinkedUser>> ListUnlinkedUsersAsync()
    {
        var users = await db.Users.AsNoTracking()
            .Where(u => !db.Employees.Any(e => e.UserId == u.Id))
            .OrderBy(u => u.UserName)
            .Select(u => new
            {
                u.Id,
                u.UserName,
                Roles = db.UserRoles.Where(ur => ur.UserId == u.Id)
                    .Join(db.Roles, ur => ur.RoleId, r => r.Id, (ur, r) => r.Name!)
                    .ToList(),
            })
            .ToListAsync();
        return users.Select(u => new UnlinkedUser(u.Id, u.UserName ?? "", u.Roles)).ToList();
    }

    private static ServiceResult<T> Invalid<T>(string field, string message) =>
        ServiceResult<T>.Invalid(new() { [field] = [message] });
}
