using Hms.Api.Data;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Hms.Api.Services;

// Business logic for PDF 3.7 Pharmacy Management.
//
// Stock is kept per batch (each batch has its own expiry date). Every change to a batch's quantity
// also writes a StockMovement row, so the stock level can always be explained.
//
// Assumption A22 (proposed): a batch counts as expired ON its expiry date, so it can be dispensed
// only while ExpiryDate is after today (hospital time). Assumption A12: near expiry = within 90 days;
// low stock = usable stock below the medicine's reorder level.
public class PharmacyService(AppDbContext db, MedicalRecordService records)
{
    public const int NearExpiryDays = 90;

    // ---------- FR-PH-01 Medicine inventory ----------

    public async Task<List<MedicineStockResponse>> ListMedicinesAsync(string? search, bool includeInactive, bool showCost)
    {
        var query = db.Medicines.AsNoTracking().Where(m => includeInactive || m.IsActive);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = SearchText.Contains(search);
            query = query.Where(m => EF.Functions.ILike(m.Name, pattern, "\\") ||
                                     (m.GenericName != null && EF.Functions.ILike(m.GenericName, pattern, "\\")));
        }
        var list = await StockQuery(query.OrderBy(m => m.Name).ThenBy(m => m.Strength)).ToListAsync();
        return list.Select(m => Finish(m, showCost)).ToList();
    }

    public async Task<MedicineDetail?> GetMedicineAsync(int id, bool showCost)
    {
        var medicine = await StockQuery(db.Medicines.AsNoTracking().Where(m => m.Id == id)).FirstOrDefaultAsync();
        if (medicine is null) return null;

        var today = HospitalTime.Today;
        var batches = await db.MedicineBatches.AsNoTracking()
            .Where(b => b.MedicineId == id)
            // Empty batches are history: keep them off the list after they run out.
            .Where(b => b.QuantityOnHand > 0)
            .OrderBy(b => b.ExpiryDate).ThenBy(b => b.Id)
            .ToListAsync();

        var movements = await db.StockMovements.AsNoTracking()
            .Where(s => s.MedicineBatch.MedicineId == id)
            .OrderByDescending(s => s.CreatedAt).ThenByDescending(s => s.Id)
            .Take(50)
            .Select(s => new StockMovementResponse(
                s.Id, s.MedicineBatch.BatchNumber, s.MovementType, s.Quantity, s.Reason,
                s.PrescriptionItem == null ? null : s.PrescriptionItem.PrescriptionId,
                s.PrescriptionItem == null ? null : s.PrescriptionItem.Prescription.MedicalRecord.Patient.PatientNumber,
                db.Users.Where(u => u.Id == s.CreatedByUserId).Select(u => u.UserName).FirstOrDefault(),
                s.CreatedAt))
            .ToListAsync();

        return new MedicineDetail(
            Finish(medicine, showCost),
            batches.Select(b => new BatchResponse(
                b.Id, b.BatchNumber, b.ExpiryDate, b.QuantityOnHand, showCost ? b.CostPrice : null, b.ReceivedAt,
                ExpiryState(b.ExpiryDate, today))).ToList(),
            movements);
    }

    public async Task<ServiceResult<int>> SaveMedicineAsync(int? id, MedicineRequest request)
    {
        var medicine = id is null ? new Medicine() : await db.Medicines.FindAsync(id.Value);
        if (medicine is null) return ServiceResult<int>.NotFound();

        var name = request.Name.Trim();
        var form = request.Form.Trim();
        var strength = request.Strength.Trim();
        if (await db.Medicines.AnyAsync(m => m.Name == name && m.Form == form && m.Strength == strength && m.Id != id))
        {
            return Invalid("Name", "This medicine (same name, form and strength) is already in the list.");
        }

        medicine.Name = name;
        medicine.GenericName = Normalize(request.GenericName);
        medicine.Form = form;
        medicine.Strength = strength;
        medicine.UnitPrice = request.UnitPrice;
        medicine.ReorderLevel = request.ReorderLevel;
        medicine.IsActive = request.IsActive;
        if (id is null) db.Medicines.Add(medicine);
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return Invalid("Name", "This medicine was just added by someone else.");
        }
        return ServiceResult<int>.Ok(medicine.Id);
    }

    public async Task<ServiceResult<int>> SetPriceAsync(int id, decimal unitPrice)
    {
        var medicine = await db.Medicines.FindAsync(id);
        if (medicine is null) return ServiceResult<int>.NotFound();
        // Charges already made keep their old price (Charge.UnitPrice is a copy).
        medicine.UnitPrice = unitPrice;
        await db.SaveChangesAsync();
        return ServiceResult<int>.Ok(id);
    }

    // ---------- FR-PH-03 Stock management ----------

    // Stock in: receive a delivery. A new batch number makes a new batch.
    // The same batch number again (a second box of the same batch) adds to it, if the expiry date matches.
    public async Task<ServiceResult<int>> StockInAsync(int medicineId, StockInRequest request, string? userId)
    {
        if (!await db.Medicines.AnyAsync(m => m.Id == medicineId)) return ServiceResult<int>.NotFound();
        var expiry = request.ExpiryDate!.Value;
        if (expiry <= HospitalTime.Today)
        {
            return Invalid("ExpiryDate", "This batch has already expired. Expired stock cannot be received.");
        }

        var batchNumber = request.BatchNumber.Trim().ToUpperInvariant();
        await using var transaction = await db.Database.BeginTransactionAsync();
        await LockBatchesAsync([medicineId]);

        var batch = await db.MedicineBatches.FirstOrDefaultAsync(b => b.MedicineId == medicineId && b.BatchNumber == batchNumber);
        if (batch is not null && batch.ExpiryDate != expiry)
        {
            return Invalid("BatchNumber",
                $"Batch {batchNumber} is already recorded with expiry {batch.ExpiryDate:yyyy-MM-dd}. Check the box label.");
        }
        if (batch is null)
        {
            batch = new MedicineBatch
            {
                MedicineId = medicineId,
                BatchNumber = batchNumber,
                ExpiryDate = expiry,
                CostPrice = request.CostPrice,
                ReceivedAt = DateTime.UtcNow,
            };
            db.MedicineBatches.Add(batch);
        }
        batch.QuantityOnHand += request.Quantity;
        db.StockMovements.Add(new StockMovement
        {
            MedicineBatch = batch,
            MovementType = StockMovementType.StockIn,
            Quantity = request.Quantity,
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow,
        });
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return Invalid("BatchNumber", "This batch was just recorded by someone else. Open the medicine again and check.");
        }
        await transaction.CommitAsync();
        return ServiceResult<int>.Ok(batch.Id);
    }

    // A counting correction. Stock can never go below zero (also enforced by a CHECK constraint).
    public async Task<ServiceResult<int>> AdjustAsync(int batchId, StockAdjustmentRequest request, string? userId)
    {
        if (request.QuantityChange == 0)
        {
            return Invalid("QuantityChange", "Enter how many units to add (positive) or remove (negative).");
        }
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            return Invalid("Reason", "Enter the reason for the correction.");
        }

        await using var transaction = await db.Database.BeginTransactionAsync();
        var batch = await LockBatchAsync(batchId);
        if (batch is null) return ServiceResult<int>.NotFound();
        if (batch.QuantityOnHand + request.QuantityChange < 0)
        {
            return Invalid("QuantityChange", $"Only {batch.QuantityOnHand} units are in this batch, so stock would go below zero.");
        }

        batch.QuantityOnHand += request.QuantityChange;
        db.StockMovements.Add(new StockMovement
        {
            MedicineBatchId = batch.Id,
            MovementType = StockMovementType.Adjustment,
            Quantity = request.QuantityChange,
            Reason = request.Reason.Trim(),
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return ServiceResult<int>.Ok(batch.MedicineId);
    }

    // Removes all units of an expired batch from stock (they go for disposal).
    public async Task<ServiceResult<int>> WriteOffExpiredAsync(int batchId, string? userId)
    {
        await using var transaction = await db.Database.BeginTransactionAsync();
        var batch = await LockBatchAsync(batchId);
        if (batch is null) return ServiceResult<int>.NotFound();
        if (batch.ExpiryDate > HospitalTime.Today)
        {
            return Invalid("BatchId", "This batch has not expired yet. Use a stock correction instead.");
        }
        if (batch.QuantityOnHand == 0)
        {
            return Invalid("BatchId", "This batch is already empty.");
        }

        db.StockMovements.Add(new StockMovement
        {
            MedicineBatchId = batch.Id,
            MovementType = StockMovementType.Expired,
            Quantity = -batch.QuantityOnHand,
            Reason = $"Expired on {batch.ExpiryDate:yyyy-MM-dd}",
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow,
        });
        batch.QuantityOnHand = 0;
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return ServiceResult<int>.Ok(batch.MedicineId);
    }

    // ---------- FR-PH-04 Expiry monitoring and alerts (UI-DSH-05) ----------

    public async Task<PharmacyAlerts> GetAlertsAsync(bool showCost)
    {
        var today = HospitalTime.Today;
        var soon = today.AddDays(NearExpiryDays);

        var stock = await StockQuery(db.Medicines.AsNoTracking().Where(m => m.IsActive)).ToListAsync();
        var lowStock = stock.Select(m => Finish(m, showCost)).Where(m => m.IsLowStock)
            .OrderBy(m => m.UsableStock).ThenBy(m => m.Name).ToList();

        var batches = db.MedicineBatches.AsNoTracking().Where(b => b.QuantityOnHand > 0);
        var nearExpiry = await AlertBatches(batches.Where(b => b.ExpiryDate > today && b.ExpiryDate <= soon)).ToListAsync();
        var expired = await AlertBatches(batches.Where(b => b.ExpiryDate <= today)).ToListAsync();
        return new PharmacyAlerts(NearExpiryDays, lowStock, nearExpiry, expired);
    }

    public async Task<PharmacyAlertCounts> CountAlertsAsync()
    {
        var alerts = await GetAlertsAsync(showCost: false);
        return new PharmacyAlertCounts(alerts.LowStock.Count, alerts.NearExpiry.Count, alerts.Expired.Count);
    }

    // ---------- FR-PH-02 Prescription processing ----------

    public async Task<DispenseView?> GetDispenseViewAsync(int prescriptionId)
    {
        var prescription = await records.GetPrescriptionAsync(prescriptionId);
        if (prescription is null) return null;

        var today = HospitalTime.Today;
        var medicineIds = prescription.Items.Select(i => i.MedicineId).Distinct().ToList();
        var stock = await db.Medicines.AsNoTracking()
            .Where(m => medicineIds.Contains(m.Id))
            .Select(m => new DispenseStock(
                m.Id, m.Batches.Where(b => b.ExpiryDate > today).Sum(b => b.QuantityOnHand), m.UnitPrice))
            .ToListAsync();

        var history = await db.Charges.AsNoTracking()
            .Where(c => c.StockMovement != null && c.StockMovement.PrescriptionItem != null &&
                        c.StockMovement.PrescriptionItem.PrescriptionId == prescriptionId)
            .OrderBy(c => c.StockMovement!.CreatedAt).ThenBy(c => c.Id)
            .Select(c => new DispensedBatch(
                c.StockMovement!.PrescriptionItemId!.Value,
                c.StockMovement.MedicineBatch.Medicine.Name + " " + c.StockMovement.MedicineBatch.Medicine.Strength,
                c.StockMovement.MedicineBatch.BatchNumber,
                c.StockMovement.MedicineBatch.ExpiryDate,
                c.Quantity, c.UnitPrice, c.Amount,
                db.Users.Where(u => u.Id == c.StockMovement.CreatedByUserId).Select(u => u.UserName).FirstOrDefault(),
                c.StockMovement.CreatedAt))
            .ToListAsync();

        return new DispenseView(prescription, stock, history);
    }

    // Dispenses some or all of a prescription in ONE database transaction:
    // stock goes down (oldest expiry first, never an expired batch), each batch used gets a StockMovement,
    // each movement gets a pharmacy Charge for the bill (FR-BL-03), and the prescription status is updated.
    // If anything fails, nothing is saved, so stock, charges and the prescription can never disagree.
    public async Task<ServiceResult<int>> DispenseAsync(int prescriptionId, DispenseRequest request, string? userId)
    {
        await using var transaction = await db.Database.BeginTransactionAsync();

        // Row locks: a second pharmacist dispensing the same prescription, or the same medicine,
        // waits here until this transaction finishes, then sees the new numbers.
        await db.Database.ExecuteSqlAsync($"SELECT 1 FROM \"Prescriptions\" WHERE \"Id\" = {prescriptionId} FOR UPDATE");
        var prescription = await db.Prescriptions
            .Include(p => p.Items).ThenInclude(i => i.Medicine)
            .Include(p => p.MedicalRecord)
            .FirstOrDefaultAsync(p => p.Id == prescriptionId);
        if (prescription is null) return ServiceResult<int>.NotFound();
        if (prescription.Status is not (PrescriptionStatus.Pending or PrescriptionStatus.PartiallyDispensed))
        {
            return Invalid("Status", $"This prescription is {prescription.Status}, so nothing more can be dispensed.");
        }

        var lines = request.Items.Where(l => l.Quantity > 0).ToList();
        if (lines.Count == 0)
        {
            return Invalid("Items", "Enter a quantity for at least one medicine.");
        }
        if (lines.Select(l => l.PrescriptionItemId).Distinct().Count() != lines.Count)
        {
            return Invalid("Items", "Each medicine can appear only once.");
        }

        var errors = new List<string>();
        var items = new List<(PrescriptionItem Item, int Quantity)>();
        foreach (var line in lines)
        {
            var item = prescription.Items.FirstOrDefault(i => i.Id == line.PrescriptionItemId);
            if (item is null)
            {
                errors.Add("A medicine is not on this prescription.");
                continue;
            }
            var remaining = item.Quantity - item.QuantityDispensed;
            if (line.Quantity > remaining)
            {
                errors.Add($"{item.Medicine.Name}: only {remaining} more can be dispensed.");
                continue;
            }
            items.Add((item, line.Quantity));
        }
        if (errors.Count > 0) return ServiceResult<int>.Invalid(new() { ["Items"] = errors.ToArray() });

        var today = HospitalTime.Today;
        await LockBatchesAsync(items.Select(i => i.Item.MedicineId).Distinct().ToArray());
        var medicineIds = items.Select(i => i.Item.MedicineId).ToList();
        var batches = await db.MedicineBatches
            .Where(b => medicineIds.Contains(b.MedicineId) && b.ExpiryDate > today && b.QuantityOnHand > 0)
            .OrderBy(b => b.ExpiryDate).ThenBy(b => b.Id)
            .ToListAsync();

        foreach (var (item, quantity) in items)
        {
            var usable = batches.Where(b => b.MedicineId == item.MedicineId).ToList();
            var available = usable.Sum(b => b.QuantityOnHand);
            if (available < quantity)
            {
                errors.Add($"{item.Medicine.Name}: only {available} in stock (not expired).");
                continue;
            }

            var left = quantity;
            foreach (var batch in usable)
            {
                if (left == 0) break;
                var take = Math.Min(left, batch.QuantityOnHand);
                if (take == 0) continue;
                batch.QuantityOnHand -= take;
                left -= take;

                var movement = new StockMovement
                {
                    MedicineBatch = batch,
                    MovementType = StockMovementType.Dispense,
                    Quantity = -take,
                    PrescriptionItemId = item.Id,
                    CreatedByUserId = userId,
                    CreatedAt = DateTime.UtcNow,
                };
                db.StockMovements.Add(movement);
                db.Charges.Add(new Charge
                {
                    PatientId = prescription.MedicalRecord.PatientId,
                    ChargeType = ChargeType.Pharmacy,
                    Description = $"{item.Medicine.Name} {item.Medicine.Strength} {item.Medicine.Form}",
                    Quantity = take,
                    // Copied now, so a later price change never alters this bill.
                    UnitPrice = item.Medicine.UnitPrice,
                    Amount = item.Medicine.UnitPrice * take,
                    StockMovement = movement,
                    CreatedAt = DateTime.UtcNow,
                });
            }
            item.QuantityDispensed += quantity;
        }
        if (errors.Count > 0) return ServiceResult<int>.Invalid(new() { ["Items"] = errors.ToArray() });

        prescription.Status = prescription.Items.All(i => i.QuantityDispensed == i.Quantity)
            ? PrescriptionStatus.Dispensed
            : PrescriptionStatus.PartiallyDispensed;

        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return ServiceResult<int>.Ok(prescriptionId);
    }

    // ---------- Helpers ----------

    // Locks every batch of these medicines until the transaction ends. Always in Id order, so two
    // transactions that need the same batches cannot block each other forever (a deadlock).
    private Task LockBatchesAsync(int[] medicineIds) =>
        db.Database.ExecuteSqlAsync(
            $"SELECT 1 FROM \"MedicineBatches\" WHERE \"MedicineId\" = ANY({medicineIds}) ORDER BY \"Id\" FOR UPDATE");

    private async Task<MedicineBatch?> LockBatchAsync(int batchId)
    {
        await db.Database.ExecuteSqlAsync($"SELECT 1 FROM \"MedicineBatches\" WHERE \"Id\" = {batchId} FOR UPDATE");
        return await db.MedicineBatches.FirstOrDefaultAsync(b => b.Id == batchId);
    }

    private static IQueryable<MedicineStockResponse> StockQuery(IQueryable<Medicine> query)
    {
        var today = HospitalTime.Today;
        return query.Select(m => new MedicineStockResponse(
            m.Id, m.Name, m.GenericName, m.Form, m.Strength, m.UnitPrice, m.ReorderLevel, m.IsActive,
            m.Batches.Where(b => b.ExpiryDate > today).Sum(b => b.QuantityOnHand),
            m.Batches.Where(b => b.ExpiryDate <= today).Sum(b => b.QuantityOnHand),
            m.Batches.Where(b => b.ExpiryDate > today && b.QuantityOnHand > 0).Min(b => (DateOnly?)b.ExpiryDate),
            false,
            m.Batches.Where(b => b.ExpiryDate > today).Sum(b => b.QuantityOnHand * b.CostPrice)));
    }

    private static MedicineStockResponse Finish(MedicineStockResponse m, bool showCost) => m with
    {
        IsLowStock = m.IsActive && m.UsableStock < m.ReorderLevel,
        StockValue = showCost ? m.StockValue : null,
    };

    private static IQueryable<AlertBatch> AlertBatches(IQueryable<MedicineBatch> query) =>
        query.OrderBy(b => b.ExpiryDate).ThenBy(b => b.Medicine.Name)
            .Select(b => new AlertBatch(b.Id, b.MedicineId, b.Medicine.Name, b.Medicine.Strength, b.Medicine.Form,
                b.BatchNumber, b.ExpiryDate, b.QuantityOnHand));

    private static string ExpiryState(DateOnly expiry, DateOnly today) =>
        expiry <= today ? "Expired" : expiry <= today.AddDays(NearExpiryDays) ? "NearExpiry" : "Ok";

    private static ServiceResult<int> Invalid(string field, string message) =>
        ServiceResult<int>.Invalid(new() { [field] = [message] });

    private static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
