using Hms.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Data;

// Doctors need a medicine list to prescribe from (FR-EMR-02). Only when the Medicines table is empty,
// this adds a small starter list of common generic medicines. Prices are demo values, not real prices.
// The pharmacist changes or extends the list on the Pharmacy screens. Stock starts at zero:
// the pharmacist records deliveries with "Stock in".
public static class MedicineSeeder
{
    public static async Task SeedAsync(AppDbContext db, ILogger logger)
    {
        if (await db.Medicines.AnyAsync())
        {
            return;
        }

        Medicine M(string name, string form, string strength, decimal price, int reorder) => new()
        {
            Name = name, GenericName = name, Form = form, Strength = strength,
            UnitPrice = price, ReorderLevel = reorder, IsActive = true,
        };

        db.Medicines.AddRange(
            M("Paracetamol", "Tablet", "500 mg", 5.00m, 500),
            M("Amoxicillin", "Capsule", "500 mg", 18.00m, 200),
            M("Azithromycin", "Tablet", "500 mg", 65.00m, 50),
            M("Metformin", "Tablet", "500 mg", 8.00m, 300),
            M("Amlodipine", "Tablet", "5 mg", 10.00m, 200),
            M("Losartan", "Tablet", "50 mg", 15.00m, 200),
            M("Atorvastatin", "Tablet", "20 mg", 22.00m, 200),
            M("Omeprazole", "Capsule", "20 mg", 12.00m, 200),
            M("Cetirizine", "Tablet", "10 mg", 6.00m, 200),
            M("Salbutamol", "Inhaler", "100 mcg", 850.00m, 20),
            M("Oral Rehydration Salts", "Sachet", "20.5 g", 25.00m, 100),
            M("Ibuprofen", "Tablet", "400 mg", 9.00m, 300));
        await db.SaveChangesAsync();
        logger.LogInformation("Added the starter medicine list");
    }
}
