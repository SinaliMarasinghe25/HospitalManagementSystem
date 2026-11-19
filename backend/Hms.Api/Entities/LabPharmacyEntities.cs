using System.ComponentModel.DataAnnotations;

namespace Hms.Api.Entities;

// ---------- Laboratory (PDF section 6: Laboratory Tests) ----------
// The catalogue of tests the lab offers, with prices.
public class LabTest
{
    public int Id { get; set; }

    [MaxLength(20)]
    public string Code { get; set; } = string.Empty;

    [MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    public decimal Price { get; set; }

    [MaxLength(30)]
    public string? Unit { get; set; }

    [MaxLength(100)]
    public string? ReferenceRange { get; set; }

    public bool IsActive { get; set; } = true;
}

// One test for one patient, moving through Requested -> SampleCollected -> Completed.
public class LabRequest
{
    public int Id { get; set; }

    [MaxLength(20)]
    public string RequestNumber { get; set; } = string.Empty;

    public int PatientId { get; set; }
    public Patient Patient { get; set; } = null!;

    public int LabTestId { get; set; }
    public LabTest LabTest { get; set; } = null!;

    public int RequestedByDoctorId { get; set; }
    public Doctor RequestedByDoctor { get; set; } = null!;

    public int? MedicalRecordId { get; set; }
    public MedicalRecord? MedicalRecord { get; set; }

    public LabRequestStatus Status { get; set; } = LabRequestStatus.Requested;

    public DateTime RequestedAt { get; set; }

    [MaxLength(30)]
    public string? SampleId { get; set; }

    public DateTime? SampleCollectedAt { get; set; }
    public string? CollectedByUserId { get; set; }

    [MaxLength(200)]
    public string? ResultValue { get; set; }

    public string? ResultNotes { get; set; }
    public bool? IsAbnormal { get; set; }
    public DateTime? ResultEnteredAt { get; set; }
    public string? ResultEnteredByUserId { get; set; }
}

// ---------- Pharmacy (PDF section 6: Pharmacy) ----------
public class Medicine
{
    public int Id { get; set; }

    [MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(150)]
    public string? GenericName { get; set; }

    [MaxLength(50)]
    public string Form { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Strength { get; set; } = string.Empty;

    public decimal UnitPrice { get; set; }

    // Show a low-stock alert when total stock falls below this.
    public int ReorderLevel { get; set; }

    public bool IsActive { get; set; } = true;

    public List<MedicineBatch> Batches { get; set; } = [];
}

// Stock is kept per batch, because every batch has its own expiry date.
public class MedicineBatch
{
    public int Id { get; set; }

    public int MedicineId { get; set; }
    public Medicine Medicine { get; set; } = null!;

    [MaxLength(50)]
    public string BatchNumber { get; set; } = string.Empty;

    public DateOnly ExpiryDate { get; set; }

    public int QuantityOnHand { get; set; }

    public decimal CostPrice { get; set; }

    public DateTime ReceivedAt { get; set; }
}

// Every stock change is a row here, so stock levels can always be explained.
public class StockMovement
{
    public int Id { get; set; }

    public int MedicineBatchId { get; set; }
    public MedicineBatch MedicineBatch { get; set; } = null!;

    public StockMovementType MovementType { get; set; }

    // Positive = stock in, negative = stock out.
    public int Quantity { get; set; }

    public int? PrescriptionItemId { get; set; }
    public PrescriptionItem? PrescriptionItem { get; set; }

    [MaxLength(300)]
    public string? Reason { get; set; }

    public string? CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
}
