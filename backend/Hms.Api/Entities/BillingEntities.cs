using System.ComponentModel.DataAnnotations;

namespace Hms.Api.Entities;

// ---------- Billing (PDF section 6: Billing, Payments) ----------

// A charge is created the moment something billable happens.
// Exactly one of the four source columns is set (enforced by a CHECK constraint).
public class Charge
{
    public int Id { get; set; }

    public int PatientId { get; set; }
    public Patient Patient { get; set; } = null!;

    public ChargeType ChargeType { get; set; }

    [MaxLength(300)]
    public string Description { get; set; } = string.Empty;

    public int Quantity { get; set; } = 1;

    // Copied from the price list at the time of the charge,
    // so later price changes never alter old bills.
    public decimal UnitPrice { get; set; }

    public decimal Amount { get; set; }

    public int? AppointmentId { get; set; }
    public Appointment? Appointment { get; set; }

    public int? LabRequestId { get; set; }
    public LabRequest? LabRequest { get; set; }

    public int? StockMovementId { get; set; }
    public StockMovement? StockMovement { get; set; }

    public int? AdmissionId { get; set; }
    public Admission? Admission { get; set; }

    // Null = not on an invoice yet.
    public int? InvoiceId { get; set; }
    public Invoice? Invoice { get; set; }

    public DateTime CreatedAt { get; set; }
}

public class Invoice
{
    public int Id { get; set; }

    [MaxLength(30)]
    public string InvoiceNumber { get; set; } = string.Empty;

    public int PatientId { get; set; }
    public Patient Patient { get; set; } = null!;

    public DateTime? IssuedAt { get; set; }

    public InvoiceStatus Status { get; set; } = InvoiceStatus.Draft;

    public decimal Subtotal { get; set; }
    public decimal Discount { get; set; }
    public decimal Total { get; set; }
    public decimal AmountPaid { get; set; }

    public string? CreatedByUserId { get; set; }

    public List<Charge> Charges { get; set; } = [];
    public List<Payment> Payments { get; set; } = [];
}

public class Payment
{
    public int Id { get; set; }

    [MaxLength(30)]
    public string ReceiptNumber { get; set; } = string.Empty;

    public int InvoiceId { get; set; }
    public Invoice Invoice { get; set; } = null!;

    public decimal Amount { get; set; }

    public PaymentMethod Method { get; set; }

    [MaxLength(100)]
    public string? ReferenceNumber { get; set; }

    public DateTime PaidAt { get; set; }

    public string? ReceivedByUserId { get; set; }
}

// ---------- Audit (PDF sections 4 and 10: Audit Logs, Audit Trail) ----------
// No foreign keys on purpose: audit rows must survive whatever happens elsewhere.
public class AuditLog
{
    public long Id { get; set; }

    public DateTime Timestamp { get; set; }

    [MaxLength(450)]
    public string? UserId { get; set; }

    [MaxLength(256)]
    public string? UserName { get; set; }

    public AuditAction Action { get; set; }

    [MaxLength(100)]
    public string? EntityName { get; set; }

    [MaxLength(100)]
    public string? EntityId { get; set; }

    // Old and new values as JSON. Never contains passwords.
    public string? Changes { get; set; }

    [MaxLength(45)]
    public string? IpAddress { get; set; }
}
