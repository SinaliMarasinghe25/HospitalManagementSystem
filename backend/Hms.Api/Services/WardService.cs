using Hms.Api.Data;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Services;

// Wards and beds (assumption A1). The administrator sets them up; everyone with access sees the bed board.
public class WardService(AppDbContext db)
{
    // The bed board: every ward, its beds, and who is in each bed now.
    public async Task<List<WardResponse>> ListAsync()
    {
        var wards = await db.Wards.AsNoTracking().Include(w => w.Beds).OrderBy(w => w.Name).ToListAsync();
        var occupied = await db.Admissions.AsNoTracking()
            .Where(a => a.DischargedAt == null)
            .Select(a => new { a.BedId, a.Id, Name = a.Patient.FirstName + " " + a.Patient.LastName, a.Patient.PatientNumber })
            .ToDictionaryAsync(a => a.BedId);

        return wards.Select(w =>
        {
            var beds = w.Beds.OrderBy(b => b.BedNumber).Select(b =>
            {
                var who = occupied.GetValueOrDefault(b.Id);
                return new BedResponse(b.Id, b.BedNumber, b.IsActive, who?.Id, who?.Name, who?.PatientNumber);
            }).ToList();
            return new WardResponse(w.Id, w.Name, w.WardType, w.DailyCharge, beds.Count(b => b.IsActive),
                beds.Count(b => b.IsActive && b.AdmissionId is null), beds);
        }).ToList();
    }

    public async Task<ServiceResult<int>> CreateAsync(WardRequest request)
    {
        var errors = await ValidateAsync(request, null);
        if (errors.Count > 0) return ServiceResult<int>.Invalid(errors);

        var ward = new Ward();
        Apply(ward, request);
        db.Wards.Add(ward);
        await db.SaveChangesAsync();
        return ServiceResult<int>.Ok(ward.Id);
    }

    public async Task<ServiceResult<int>> UpdateAsync(int id, WardRequest request)
    {
        var ward = await db.Wards.FindAsync(id);
        if (ward is null) return ServiceResult<int>.NotFound();

        var errors = await ValidateAsync(request, id);
        if (errors.Count > 0) return ServiceResult<int>.Invalid(errors);

        Apply(ward, request);
        await db.SaveChangesAsync();
        return ServiceResult<int>.Ok(id);
    }

    // Adds Count beds called Prefix + the next numbers, e.g. A-01 ... A-05, after any that exist.
    public async Task<ServiceResult<int>> AddBedsAsync(int wardId, AddBedsRequest request)
    {
        var ward = await db.Wards.Include(w => w.Beds).FirstOrDefaultAsync(w => w.Id == wardId);
        if (ward is null) return ServiceResult<int>.NotFound();

        var existing = ward.Beds.Select(b => b.BedNumber).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var prefix = request.Prefix.Trim().ToUpperInvariant();
        var number = 1;
        for (var added = 0; added < request.Count; number++)
        {
            var name = $"{prefix}{number:D2}";
            if (existing.Contains(name)) continue;
            ward.Beds.Add(new Bed { BedNumber = name, IsActive = true });
            added++;
        }
        await db.SaveChangesAsync();
        return ServiceResult<int>.Ok(wardId);
    }

    // A bed can be taken out of use (e.g. broken), but not while a patient is in it.
    public async Task<ServiceResult<int>> SetBedStatusAsync(int bedId, bool isActive)
    {
        var bed = await db.Beds.FindAsync(bedId);
        if (bed is null) return ServiceResult<int>.NotFound();

        if (!isActive && await db.Admissions.AnyAsync(a => a.BedId == bedId && a.DischargedAt == null))
        {
            return ServiceResult<int>.Invalid(new() { ["IsActive"] = ["A patient is in this bed. Transfer or discharge them first."] });
        }
        bed.IsActive = isActive;
        await db.SaveChangesAsync();
        return ServiceResult<int>.Ok(bed.WardId);
    }

    private async Task<Dictionary<string, string[]>> ValidateAsync(WardRequest request, int? id)
    {
        var errors = new Dictionary<string, string[]>();
        var name = request.Name.Trim();
        if (await db.Wards.AnyAsync(w => w.Name.ToLower() == name.ToLower() && w.Id != id))
        {
            errors["Name"] = ["A ward with this name already exists."];
        }
        return errors;
    }

    private static void Apply(Ward ward, WardRequest request)
    {
        ward.Name = request.Name.Trim();
        ward.WardType = request.WardType.Trim();
        ward.DailyCharge = request.DailyCharge;
    }
}
