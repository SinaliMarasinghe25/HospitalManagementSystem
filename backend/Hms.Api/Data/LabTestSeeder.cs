using Hms.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Data;

// A starter test catalogue so doctors can request tests straight away (FR-LAB-01).
// Added only when the LabTests table is empty. Prices are demo values; reference ranges are
// common adult ranges for demonstration only. The administrator can edit or add tests on the Laboratory page.
public static class LabTestSeeder
{
    public static async Task SeedAsync(AppDbContext db, ILogger logger)
    {
        if (await db.LabTests.AnyAsync())
        {
            return;
        }

        LabTest T(string code, string name, decimal price, string? unit, string? range) => new()
        {
            Code = code, Name = name, Price = price, Unit = unit, ReferenceRange = range, IsActive = true,
        };

        db.LabTests.AddRange(
            T("FBC-HB", "Haemoglobin", 450m, "g/dL", "12.0 - 16.0"),
            T("FBC-WBC", "White blood cell count", 450m, "x10^9/L", "4.0 - 11.0"),
            T("FBC-PLT", "Platelet count", 450m, "x10^9/L", "150 - 400"),
            T("FBS", "Fasting blood sugar", 300m, "mg/dL", "70 - 100"),
            T("HBA1C", "HbA1c", 2200m, "%", "4.0 - 5.6"),
            T("SCR", "Serum creatinine", 650m, "mg/dL", "0.6 - 1.2"),
            T("CHOL", "Total cholesterol", 800m, "mg/dL", "< 200"),
            T("CRP", "C-reactive protein", 1500m, "mg/L", "< 5"),
            T("UFR", "Urine full report", 400m, null, null),
            T("NS1", "Dengue NS1 antigen", 2500m, null, "Negative"));
        await db.SaveChangesAsync();
        logger.LogInformation("Added the starter lab test catalogue");
    }
}
