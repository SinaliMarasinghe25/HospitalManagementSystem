using Hms.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Data;

// A starter list of departments, so the Add employee form is never empty (PDF section 6).
// Missing ones are added on startup; existing ones are never changed, so the administrator's edits stay.
// Assumption A26 (proposed): clinical staff (doctors, nurses, laboratory staff, pharmacists...) choose a clinical
// department. Everyone else (accountants, receptionists, managers...) is placed in "Administration" automatically.
public static class DepartmentSeeder
{
    public const string DefaultName = "Administration";

    private static readonly (string Name, bool IsClinical, string Description)[] Defaults =
    [
        (DefaultName, false, "Office and support staff: accounts, reception, management (assigned automatically)"),
        ("General Medicine", true, "General physicians"),
        ("Surgery", true, "Surgeons and theatre staff"),
        ("Paediatrics", true, "Children's care"),
        ("Cardiology", true, "Heart care"),
        ("Emergency", true, "Emergency and accident care"),
        ("Nursing", true, "Nursing staff who are not tied to one medical department"),
        ("Laboratory", true, "Laboratory testing"),
        ("Pharmacy", true, "Pharmacy and dispensing"),
    ];

    // Office department names from before this step. They stay non-clinical in the one-time upgrade below.
    private static readonly string[] OfficeNames = ["administration", "finance", "front office", "accounts", "reception", "office"];

    public static async Task SeedAsync(AppDbContext db, ILogger logger)
    {
        var existing = await db.Departments.ToListAsync();

        // One-time upgrade of a database made before departments had the clinical flag: when no department
        // is clinical yet, every existing department becomes clinical except office ones (Finance, Front Office...).
        // The administrator can change the flag later on Staff → Departments.
        if (existing.Count > 0 && !existing.Any(d => d.IsClinical))
        {
            foreach (var department in existing.Where(d => !OfficeNames.Contains(d.Name.Trim().ToLowerInvariant())))
            {
                department.IsClinical = true;
            }
        }

        var names = existing.Select(d => d.Name.ToLowerInvariant()).ToHashSet();
        var added = 0;
        foreach (var (name, isClinical, description) in Defaults)
        {
            if (names.Contains(name.ToLowerInvariant())) continue;
            db.Departments.Add(new Department { Name = name, IsClinical = isClinical, Description = description, IsActive = true });
            added++;
        }

        // The default department must exist and be usable.
        var defaultDepartment = existing.FirstOrDefault(d => d.Name.Equals(DefaultName, StringComparison.OrdinalIgnoreCase));
        if (defaultDepartment is not null)
        {
            defaultDepartment.IsActive = true;
            defaultDepartment.IsClinical = false;
        }

        await db.SaveChangesAsync();
        if (added > 0) logger.LogInformation("Added {Count} starter departments", added);
    }
}
