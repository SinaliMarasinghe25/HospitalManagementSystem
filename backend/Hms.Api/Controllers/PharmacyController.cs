using Hms.Api.Authorization;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Hms.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Hms.Api.Controllers;

// PDF 3.7 Pharmacy Management, following the role table:
// stock view: Admin, Doctor (no cost prices), Pharmacist, Accountant; everything that changes stock: Pharmacist;
// medicine prices: Admin, Pharmacist, Accountant. Nurses, receptionists and lab staff get 403.
[ApiController]
[Route("api/pharmacy")]
[Authorize(Policy = Policies.ViewPharmacyStock)]
public class PharmacyController(PharmacyService pharmacy, AuditService audit, UserManager<AppUser> userManager) : ControllerBase
{
    // Doctors see stock levels only ("View (stock only)" in the role table), not what the hospital paid.
    private bool ShowCost =>
        User.IsInRole(Roles.Administrator) || User.IsInRole(Roles.Pharmacist) || User.IsInRole(Roles.Accountant);

    // ---------- FR-PH-01 Medicine inventory ----------

    // GET /api/pharmacy/medicines?search=para&includeInactive=true
    [HttpGet("medicines")]
    public Task<List<MedicineStockResponse>> Medicines(string? search, bool includeInactive = false) =>
        pharmacy.ListMedicinesAsync(search, includeInactive, ShowCost);

    // GET /api/pharmacy/medicines/3   (batches and the latest stock movements)
    [HttpGet("medicines/{id:int}")]
    public async Task<ActionResult<MedicineDetail>> Medicine(int id)
    {
        var medicine = await pharmacy.GetMedicineAsync(id, ShowCost);
        return medicine is null ? NotFound() : medicine;
    }

    // POST /api/pharmacy/medicines    PUT /api/pharmacy/medicines/3
    [HttpPost("medicines")]
    [Authorize(Policy = Policies.ManagePharmacyStock)]
    public Task<ActionResult> CreateMedicine(MedicineRequest request) => SaveMedicine(null, request);

    [HttpPut("medicines/{id:int}")]
    [Authorize(Policy = Policies.ManagePharmacyStock)]
    public Task<ActionResult> UpdateMedicine(int id, MedicineRequest request) => SaveMedicine(id, request);

    private async Task<ActionResult> SaveMedicine(int? id, MedicineRequest request)
    {
        var result = await pharmacy.SaveMedicineAsync(id, request);
        if (result.IsNotFound) return NotFound();
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);
        await audit.LogChangeAsync(id is null ? AuditAction.Create : AuditAction.Update, "Medicine", result.Value, request);
        return id is null ? StatusCode(StatusCodes.Status201Created, new { id = result.Value }) : NoContent();
    }

    // PUT /api/pharmacy/medicines/3/price
    [HttpPut("medicines/{id:int}/price")]
    [Authorize(Policy = Policies.EditMedicinePrices)]
    public async Task<ActionResult> SetPrice(int id, MedicinePriceRequest request)
    {
        var result = await pharmacy.SetPriceAsync(id, request.UnitPrice);
        if (result.IsNotFound) return NotFound();
        await audit.LogChangeAsync(AuditAction.Update, "Medicine", id, request);
        return NoContent();
    }

    // ---------- FR-PH-03 Stock management ----------

    // POST /api/pharmacy/medicines/3/stock-in
    [HttpPost("medicines/{id:int}/stock-in")]
    [Authorize(Policy = Policies.ManagePharmacyStock)]
    public async Task<ActionResult<MedicineDetail>> StockIn(int id, StockInRequest request)
    {
        var result = await pharmacy.StockInAsync(id, request, userManager.GetUserId(User));
        if (result.IsNotFound) return NotFound();
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);
        await audit.LogChangeAsync(AuditAction.Create, "StockIn", result.Value, new { MedicineId = id, request.BatchNumber, request.Quantity });
        return (await pharmacy.GetMedicineAsync(id, ShowCost))!;
    }

    // POST /api/pharmacy/batches/8/adjust
    [HttpPost("batches/{batchId:int}/adjust")]
    [Authorize(Policy = Policies.ManagePharmacyStock)]
    public async Task<ActionResult<MedicineDetail>> Adjust(int batchId, StockAdjustmentRequest request)
    {
        var result = await pharmacy.AdjustAsync(batchId, request, userManager.GetUserId(User));
        return await FinishBatch(result, batchId, request);
    }

    // POST /api/pharmacy/batches/8/write-off   (expired batches only)
    [HttpPost("batches/{batchId:int}/write-off")]
    [Authorize(Policy = Policies.ManagePharmacyStock)]
    public async Task<ActionResult<MedicineDetail>> WriteOff(int batchId)
    {
        var result = await pharmacy.WriteOffExpiredAsync(batchId, userManager.GetUserId(User));
        return await FinishBatch(result, batchId, new { MovementType = StockMovementType.Expired });
    }

    private async Task<ActionResult<MedicineDetail>> FinishBatch(ServiceResult<int> result, int batchId, object changes)
    {
        if (result.IsNotFound) return NotFound();
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);
        await audit.LogChangeAsync(AuditAction.Update, "MedicineBatch", batchId, changes);
        return (await pharmacy.GetMedicineAsync(result.Value, ShowCost))!;
    }

    // ---------- FR-PH-04 Expiry monitoring and alerts ----------

    // GET /api/pharmacy/alerts
    [HttpGet("alerts")]
    public Task<PharmacyAlerts> Alerts() => pharmacy.GetAlertsAsync(ShowCost);

    // ---------- FR-PH-02 Prescription processing ----------

    // GET /api/pharmacy/prescriptions/5   (the prescription, stock for each medicine, and what was handed over)
    [HttpGet("prescriptions/{id:int}")]
    [Authorize(Policy = Policies.ViewPrescriptions)]
    public async Task<ActionResult<DispenseView>> Prescription(int id)
    {
        var view = await pharmacy.GetDispenseViewAsync(id);
        return view is null ? NotFound() : view;
    }

    // POST /api/pharmacy/prescriptions/5/dispense
    [HttpPost("prescriptions/{id:int}/dispense")]
    [Authorize(Policy = Policies.DispenseMedicines)]
    public async Task<ActionResult<DispenseView>> Dispense(int id, DispenseRequest request)
    {
        var result = await pharmacy.DispenseAsync(id, request, userManager.GetUserId(User));
        if (result.IsNotFound) return NotFound();
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);

        var view = (await pharmacy.GetDispenseViewAsync(id))!;
        await audit.LogChangeAsync(AuditAction.Update, "Prescription", id, new { view.Prescription.Status, request.Items });
        return view;
    }
}
