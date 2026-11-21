using System.ComponentModel.DataAnnotations;
using Hms.Api.Entities;

namespace Hms.Api.Dtos;

// PDF 3.8 Billing System.

// One billable item: a consultation, a lab test, dispensed medicine or bed-days.
public record ChargeResponse(
    int Id,
    ChargeType ChargeType,
    string Description,
    int Quantity,
    decimal UnitPrice,
    decimal Amount,
    DateTime CreatedAt);

// The "Ready to bill" list: patients who have charges that are not on an invoice yet.
public record UnbilledPatient(
    int PatientId,
    string PatientNumber,
    string PatientName,
    int ChargeCount,
    decimal Total,
    DateTime OldestChargeAt);

public record UnbilledCharges(
    int PatientId,
    string PatientNumber,
    string PatientName,
    IReadOnlyList<ChargeResponse> Charges);

// ---------- FR-BL-05 Invoice generation (UI-BIL-01) ----------
public record CreateInvoiceRequest(
    [Required] int? PatientId,
    [Required, MinLength(1)] List<int> ChargeIds,
    [Range(0, 100_000_000)] decimal Discount);

public record InvoiceSummary(
    int Id,
    string InvoiceNumber,
    int PatientId,
    string PatientNumber,
    string PatientName,
    DateTime IssuedAt,
    InvoiceStatus Status,
    decimal Total,
    decimal AmountPaid,
    decimal Balance);

// One page of invoices, plus the money still due on all the matching invoices (every page, not only this one).
public record InvoicePage(
    IReadOnlyList<InvoiceSummary> Items,
    int Page,
    int PageSize,
    int TotalCount,
    decimal TotalBalance);

public record PaymentResponse(
    int Id,
    string ReceiptNumber,
    decimal Amount,
    PaymentMethod Method,
    string? ReferenceNumber,
    DateTime PaidAt,
    string? ReceivedBy);

public record InvoiceDetail(
    int Id,
    string InvoiceNumber,
    int PatientId,
    string PatientNumber,
    string PatientName,
    string? PatientPhone,
    DateTime IssuedAt,
    string? IssuedBy,
    InvoiceStatus Status,
    IReadOnlyList<ChargeResponse> Lines,
    decimal Subtotal,
    decimal Discount,
    decimal Total,
    decimal AmountPaid,
    decimal Balance,
    IReadOnlyList<PaymentResponse> Payments);

// ---------- FR-BL-06 Payment recording (UI-BIL-02) ----------
public record PaymentRequest(
    [Range(0.01, 100_000_000)] decimal Amount,
    [Required] PaymentMethod? Method,
    [MaxLength(100)] string? ReferenceNumber);   // card slip or bank transfer reference

// The printed receipt (UI-BIL-03).
public record ReceiptResponse(
    PaymentResponse Payment,
    string InvoiceNumber,
    int InvoiceId,
    string PatientNumber,
    string PatientName,
    decimal InvoiceTotal,
    decimal PaidToDate,
    decimal BalanceAfter);

// Dashboard tile "Revenue Summary" (UI-DSH-03): money received, by hospital day.
public record RevenueSummary(decimal Today, decimal ThisMonth, decimal OutstandingBalance);
