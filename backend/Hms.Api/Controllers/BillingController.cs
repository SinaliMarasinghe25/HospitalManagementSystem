using Hms.Api.Authorization;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Hms.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Hms.Api.Controllers;

// PDF 3.8 Billing System, following the role table:
// Accountant: full (bills, payments, receipts). Administrator: view everything.
// Receptionist: view invoice balances only (no line items, which could reveal tests or medicines).
// Doctors, nurses, lab staff and pharmacists get 403.
[ApiController]
[Route("api/billing")]
[Authorize(Policy = Policies.ViewInvoiceBalances)]
public class BillingController(BillingService billing, AuditService audit, UserManager<AppUser> userManager) : ControllerBase
{
    // ---------- Unbilled charges ----------

    // GET /api/billing/unbilled   (patients with charges not on an invoice yet)
    [HttpGet("unbilled")]
    [Authorize(Policy = Policies.ViewInvoiceDetails)]
    public Task<List<UnbilledPatient>> Unbilled() => billing.ListUnbilledPatientsAsync();

    // GET /api/billing/unbilled/3
    [HttpGet("unbilled/{patientId:int}")]
    [Authorize(Policy = Policies.ViewInvoiceDetails)]
    public async Task<ActionResult<UnbilledCharges>> UnbilledForPatient(int patientId)
    {
        var result = await billing.GetUnbilledAsync(patientId);
        return result is null ? NotFound() : result;
    }

    // ---------- Invoices ----------

    // GET /api/billing/invoices?due=true          (everything still to be paid)
    // GET /api/billing/invoices?search=P-000001&fromDate=...&toDate=...&status=Paid
    [HttpGet("invoices")]
    public async Task<ActionResult<List<InvoiceSummary>>> Invoices(
        InvoiceStatus? status, bool due, int? patientId, string? search, DateOnly? fromDate, DateOnly? toDate)
    {
        var result = await billing.ListInvoicesAsync(status, due, patientId, search, fromDate, toDate);
        return result.Succeeded ? result.Value! : this.ValidationErrors(result.Errors);
    }

    // GET /api/billing/invoices/5   (also used by the printable invoice)
    [HttpGet("invoices/{id:int}")]
    [Authorize(Policy = Policies.ViewInvoiceDetails)]
    public async Task<ActionResult<InvoiceDetail>> Invoice(int id)
    {
        var invoice = await billing.GetInvoiceAsync(id);
        return invoice is null ? NotFound() : invoice;
    }

    // POST /api/billing/invoices   (UI-BIL-01 Generate Bill)
    [HttpPost("invoices")]
    [Authorize(Policy = Policies.ManageBilling)]
    public async Task<ActionResult<InvoiceDetail>> CreateInvoice(CreateInvoiceRequest request)
    {
        var result = await billing.CreateInvoiceAsync(request, userManager.GetUserId(User));
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);

        var invoice = (await billing.GetInvoiceAsync(result.Value))!;
        await audit.LogChangeAsync(AuditAction.Create, "Invoice", invoice.Id, new
        {
            invoice.InvoiceNumber, invoice.PatientId, request.ChargeIds, invoice.Subtotal, invoice.Discount, invoice.Total,
        });
        return CreatedAtAction(nameof(Invoice), new { id = invoice.Id }, invoice);
    }

    // POST /api/billing/invoices/5/cancel   (only while nothing is paid)
    [HttpPost("invoices/{id:int}/cancel")]
    [Authorize(Policy = Policies.ManageBilling)]
    public async Task<ActionResult<InvoiceDetail>> CancelInvoice(int id)
    {
        var before = await billing.GetInvoiceAsync(id);
        var result = await billing.CancelInvoiceAsync(id);
        if (result.IsNotFound) return NotFound();
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);

        // The audit log keeps which charges were on the cancelled invoice.
        await audit.LogChangeAsync(AuditAction.Update, "Invoice", id, new
        {
            Status = InvoiceStatus.Cancelled, ReleasedChargeIds = before!.Lines.Select(l => l.Id), before.Total,
        });
        return (await billing.GetInvoiceAsync(id))!;
    }

    // ---------- Payments ----------

    // POST /api/billing/invoices/5/payments   (UI-BIL-02 Receive Payment)
    [HttpPost("invoices/{id:int}/payments")]
    [Authorize(Policy = Policies.ManageBilling)]
    public async Task<ActionResult<ReceiptResponse>> AddPayment(int id, PaymentRequest request)
    {
        var result = await billing.AddPaymentAsync(id, request, userManager.GetUserId(User));
        if (result.IsNotFound) return NotFound();
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);

        var receipt = (await billing.GetReceiptAsync(result.Value))!;
        await audit.LogChangeAsync(AuditAction.Create, "Payment", result.Value, new
        {
            InvoiceId = id, receipt.Payment.ReceiptNumber, receipt.Payment.Amount, receipt.Payment.Method,
        });
        return StatusCode(StatusCodes.Status201Created, receipt);
    }

    // GET /api/billing/payments/7/receipt   (UI-BIL-03 Print Receipt)
    [HttpGet("payments/{paymentId:int}/receipt")]
    [Authorize(Policy = Policies.ViewInvoiceDetails)]
    public async Task<ActionResult<ReceiptResponse>> Receipt(int paymentId)
    {
        var receipt = await billing.GetReceiptAsync(paymentId);
        return receipt is null ? NotFound() : receipt;
    }
}
