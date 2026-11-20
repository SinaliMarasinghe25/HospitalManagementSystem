using System.ComponentModel.DataAnnotations;
using Hms.Api.Entities;

namespace Hms.Api.Dtos;

// PDF 3.7 Pharmacy Management.

// ---------- FR-PH-01 Medicine inventory ----------
public record MedicineRequest(
    [Required, MaxLength(150)] string Name,
    [MaxLength(150)] string? GenericName,
    [Required, MaxLength(50)] string Form,        // "Tablet"
    [Required, MaxLength(50)] string Strength,    // "500 mg"
    [Range(0, 1_000_000)] decimal UnitPrice,      // selling price per unit, used for the pharmacy charge
    [Range(0, 1_000_000)] int ReorderLevel,       // low-stock alert below this (assumption A12)
    bool IsActive = true);

// Price only: the role table lets Admin and Accountant edit medicine prices too.
public record MedicinePriceRequest([Range(0, 1_000_000)] decimal UnitPrice);

// One row of the stock list. Expired units are counted apart, because they cannot be dispensed.
public record MedicineStockResponse(
    int Id,
    string Name,
    string? GenericName,
    string Form,
    string Strength,
    decimal UnitPrice,
    int ReorderLevel,
    bool IsActive,
    int UsableStock,
    int ExpiredStock,
    DateOnly? NextExpiry,
    bool IsLowStock,
    decimal? StockValue);          // cost value of usable stock; null for doctors ("stock only")

public record BatchResponse(
    int Id,
    string BatchNumber,
    DateOnly ExpiryDate,
    int QuantityOnHand,
    decimal? CostPrice,            // null for doctors
    DateTime ReceivedAt,
    string ExpiryState);           // "Expired", "NearExpiry" or "Ok"

public record StockMovementResponse(
    int Id,
    string BatchNumber,
    StockMovementType MovementType,
    int Quantity,
    string? Reason,
    int? PrescriptionId,
    string? PatientNumber,
    string? CreatedBy,
    DateTime CreatedAt);

public record MedicineDetail(
    MedicineStockResponse Medicine,
    IReadOnlyList<BatchResponse> Batches,
    IReadOnlyList<StockMovementResponse> Movements);   // newest 50

// ---------- FR-PH-03 Stock management ----------
public record StockInRequest(
    [Required, MaxLength(50), RegularExpression("^[A-Za-z0-9-/]+$", ErrorMessage = "Use letters, numbers, a dash or a slash.")]
    string BatchNumber,
    [Required] DateOnly? ExpiryDate,
    [Range(1, 1_000_000)] int Quantity,
    [Range(0, 1_000_000)] decimal CostPrice);

// A count correction (broken, lost, found). Positive adds, negative removes. A reason is required.
public record StockAdjustmentRequest(
    [Range(-1_000_000, 1_000_000)] int QuantityChange,
    [Required, MaxLength(300)] string Reason);

// ---------- FR-PH-04 Expiry monitoring and alerts ----------
public record AlertBatch(
    int BatchId,
    int MedicineId,
    string MedicineName,
    string Strength,
    string Form,
    string BatchNumber,
    DateOnly ExpiryDate,
    int QuantityOnHand);

public record PharmacyAlerts(
    int NearExpiryDays,
    IReadOnlyList<MedicineStockResponse> LowStock,
    IReadOnlyList<AlertBatch> NearExpiry,
    IReadOnlyList<AlertBatch> Expired);

public record PharmacyAlertCounts(int LowStock, int NearExpiry, int Expired);

// ---------- FR-PH-02 Prescription processing ----------
public record DispenseLine([Required] int? PrescriptionItemId, [Range(0, 10000)] int Quantity);

public record DispenseRequest([Required, MinLength(1)] List<DispenseLine> Items);

public record DispenseStock(int MedicineId, int UsableStock, decimal UnitPrice);

// What was handed over, batch by batch, with the price that was charged.
public record DispensedBatch(
    int PrescriptionItemId,
    string MedicineName,
    string BatchNumber,
    DateOnly ExpiryDate,
    int Quantity,
    decimal UnitPrice,
    decimal Amount,
    string? DispensedBy,
    DateTime DispensedAt);

public record DispenseView(
    PrescriptionResponse Prescription,
    IReadOnlyList<DispenseStock> Stock,
    IReadOnlyList<DispensedBatch> History);
