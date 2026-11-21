using Hms.Api.Data;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Services;

// Business logic for PDF 3.8 Billing System.
//
// Charges are created where the work happens (completed visit, first lab result, dispensing, discharge).
// Billing gathers a patient's unbilled charges into an invoice, then records payments against it.
// An issued invoice never changes: to correct one, cancel it (only while nothing is paid) and bill again.
// Money is always decimal, never double, so 0.1 + 0.2 is exactly 0.3.
public class BillingService(AppDbContext db)
{
    private const int MaxRangeDays = 62;

    // ---------- Unbilled charges ----------

    // Oldest first, so the patient who has waited longest is at the top.
    public async Task<List<UnbilledPatient>> ListUnbilledPatientsAsync()
    {
        var totals = await db.Charges.AsNoTracking()
            .Where(c => c.InvoiceId == null)
            .GroupBy(c => c.PatientId)
            .Select(g => new { PatientId = g.Key, Count = g.Count(), Total = g.Sum(c => c.Amount), Oldest = g.Min(c => c.CreatedAt) })
            .OrderBy(g => g.Oldest)
            .Take(500)
            .ToListAsync();

        var ids = totals.Select(t => t.PatientId).ToList();
        var patients = await db.Patients.AsNoTracking().Where(p => ids.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => new { p.PatientNumber, Name = p.FirstName + " " + p.LastName });
        return totals.Select(t => new UnbilledPatient(t.PatientId, patients[t.PatientId].PatientNumber,
            patients[t.PatientId].Name, t.Count, t.Total, t.Oldest)).ToList();
    }

    public async Task<UnbilledCharges?> GetUnbilledAsync(int patientId)
    {
        var patient = await db.Patients.AsNoTracking().FirstOrDefaultAsync(p => p.Id == patientId);
        if (patient is null) return null;

        var charges = await ProjectCharges(db.Charges.AsNoTracking()
                .Where(c => c.PatientId == patientId && c.InvoiceId == null))
            .ToListAsync();
        return new UnbilledCharges(patient.Id, patient.PatientNumber, $"{patient.FirstName} {patient.LastName}", charges);
    }

    // ---------- FR-BL-05 Invoice generation ----------

    public async Task<ServiceResult<int>> CreateInvoiceAsync(CreateInvoiceRequest request, string? userId)
    {
        var chargeIds = request.ChargeIds.Distinct().ToArray();

        await using var transaction = await db.Database.BeginTransactionAsync();
        // Row locks: if two clerks bill the same charges at once, the second waits and then sees them as billed.
        await db.Database.ExecuteSqlAsync(
            $"SELECT 1 FROM \"Charges\" WHERE \"Id\" = ANY({chargeIds}) ORDER BY \"Id\" FOR UPDATE");
        var charges = await db.Charges.Where(c => chargeIds.Contains(c.Id)).ToListAsync();

        if (charges.Count != chargeIds.Length || charges.Any(c => c.PatientId != request.PatientId))
        {
            return Invalid("ChargeIds", "Some charges were not found for this patient. Reload the page.");
        }
        if (charges.Any(c => c.InvoiceId is not null))
        {
            return Invalid("ChargeIds", "Some charges are already on another invoice. Reload the page.");
        }

        var subtotal = charges.Sum(c => c.Amount);
        if (request.Discount > subtotal)
        {
            return Invalid("Discount", "The discount cannot be more than the subtotal.");
        }

        var next = await db.Database.SqlQuery<long>($"SELECT nextval('\"InvoiceNumbers\"') AS \"Value\"").SingleAsync();
        var invoice = new Invoice
        {
            InvoiceNumber = $"INV-{next:D6}",
            PatientId = request.PatientId!.Value,
            IssuedAt = DateTime.UtcNow,
            Status = InvoiceStatus.Issued,
            // Totals are worked out here from the lines, never taken from the browser.
            Subtotal = subtotal,
            Discount = request.Discount,
            Total = subtotal - request.Discount,
            AmountPaid = 0,
            CreatedByUserId = userId,
        };
        // A fully discounted invoice has nothing to pay.
        if (invoice.Total == 0) invoice.Status = InvoiceStatus.Paid;

        db.Invoices.Add(invoice);
        foreach (var charge in charges) charge.Invoice = invoice;
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return ServiceResult<int>.Ok(invoice.Id);
    }

    // Cancelling gives the charges back to "Ready to bill", so a wrong invoice can be issued again correctly.
    public async Task<ServiceResult<int>> CancelInvoiceAsync(int id)
    {
        await using var transaction = await db.Database.BeginTransactionAsync();
        await db.Database.ExecuteSqlAsync($"SELECT 1 FROM \"Invoices\" WHERE \"Id\" = {id} FOR UPDATE");
        var invoice = await db.Invoices.Include(i => i.Charges).FirstOrDefaultAsync(i => i.Id == id);
        if (invoice is null) return ServiceResult<int>.NotFound();
        if (invoice.Status == InvoiceStatus.Cancelled)
        {
            return Invalid("Status", "This invoice is already cancelled.");
        }
        if (invoice.AmountPaid > 0)
        {
            return Invalid("Status", "An invoice with payments cannot be cancelled.");
        }

        invoice.Status = InvoiceStatus.Cancelled;
        foreach (var charge in invoice.Charges) charge.InvoiceId = null;
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return ServiceResult<int>.Ok(id);
    }

    // ---------- Reading invoices ----------

    // Without a patient or search text, a date range (hospital days) keeps the list small.
    // Invoices with money still due are always shown, whatever their date.
    // due = true: every invoice with money still to pay (Issued or PartiallyPaid).
    public async Task<ServiceResult<List<InvoiceSummary>>> ListInvoicesAsync(
        InvoiceStatus? status, bool due, int? patientId, string? search, DateOnly? fromDate, DateOnly? toDate)
    {
        var query = db.Invoices.AsNoTracking();
        if (status is not null) query = query.Where(i => i.Status == status);
        if (due) query = query.Where(i => i.Status == InvoiceStatus.Issued || i.Status == InvoiceStatus.PartiallyPaid);
        if (patientId is not null) query = query.Where(i => i.PatientId == patientId);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = SearchText.Contains(search);
            query = query.Where(i =>
                EF.Functions.ILike(i.InvoiceNumber, pattern, "\\") ||
                EF.Functions.ILike(i.Patient.PatientNumber, pattern, "\\") ||
                EF.Functions.ILike(i.Patient.FirstName + " " + i.Patient.LastName, pattern, "\\"));
        }

        var isDueList = due || status is InvoiceStatus.Issued or InvoiceStatus.PartiallyPaid;
        if (patientId is null && string.IsNullOrWhiteSpace(search) && !isDueList)
        {
            var to = toDate ?? HospitalTime.Today;
            var from = fromDate ?? to.AddDays(-29);
            if (to < from || to.DayNumber - from.DayNumber > MaxRangeDays)
            {
                return ServiceResult<List<InvoiceSummary>>.Invalid(new()
                {
                    ["ToDate"] = [$"The end date must be on or after the start date, and at most {MaxRangeDays} days later."]
                });
            }
            var fromUtc = HospitalTime.ToUtc(from, TimeOnly.MinValue);
            var toUtc = HospitalTime.ToUtc(to.AddDays(1), TimeOnly.MinValue);
            query = query.Where(i => i.IssuedAt >= fromUtc && i.IssuedAt < toUtc);
        }

        var list = await query.OrderByDescending(i => i.IssuedAt).Take(500)
            .Select(i => new InvoiceSummary(i.Id, i.InvoiceNumber, i.PatientId, i.Patient.PatientNumber,
                i.Patient.FirstName + " " + i.Patient.LastName, i.IssuedAt!.Value, i.Status, i.Total, i.AmountPaid,
                i.Status == InvoiceStatus.Cancelled ? 0 : i.Total - i.AmountPaid))
            .ToListAsync();
        return ServiceResult<List<InvoiceSummary>>.Ok(list);
    }

    public async Task<InvoiceDetail?> GetInvoiceAsync(int id)
    {
        var invoice = await db.Invoices.AsNoTracking()
            .Where(i => i.Id == id)
            .Select(i => new
            {
                i.Id, i.InvoiceNumber, i.PatientId, i.Patient.PatientNumber,
                PatientName = i.Patient.FirstName + " " + i.Patient.LastName, i.Patient.Phone,
                i.IssuedAt, IssuedBy = db.Users.Where(u => u.Id == i.CreatedByUserId).Select(u => u.UserName).FirstOrDefault(),
                i.Status, i.Subtotal, i.Discount, i.Total, i.AmountPaid,
            })
            .FirstOrDefaultAsync();
        if (invoice is null) return null;

        // A cancelled invoice has given its charges back, so its lines are kept only in the audit log.
        var lines = await ProjectCharges(db.Charges.AsNoTracking().Where(c => c.InvoiceId == id)).ToListAsync();
        var payments = await ProjectPayments(db.Payments.AsNoTracking().Where(p => p.InvoiceId == id)).ToListAsync();

        return new InvoiceDetail(invoice.Id, invoice.InvoiceNumber, invoice.PatientId, invoice.PatientNumber,
            invoice.PatientName, invoice.Phone, invoice.IssuedAt!.Value, invoice.IssuedBy, invoice.Status, lines,
            invoice.Subtotal, invoice.Discount, invoice.Total, invoice.AmountPaid,
            invoice.Status == InvoiceStatus.Cancelled ? 0 : invoice.Total - invoice.AmountPaid, payments);
    }

    // ---------- FR-BL-06 Payment recording ----------

    public async Task<ServiceResult<int>> AddPaymentAsync(int invoiceId, PaymentRequest request, string? userId)
    {
        await using var transaction = await db.Database.BeginTransactionAsync();
        // Row lock: two payments for the same invoice are recorded one after the other, so the balance is always right.
        await db.Database.ExecuteSqlAsync($"SELECT 1 FROM \"Invoices\" WHERE \"Id\" = {invoiceId} FOR UPDATE");
        var invoice = await db.Invoices.FirstOrDefaultAsync(i => i.Id == invoiceId);
        if (invoice is null) return ServiceResult<int>.NotFound();
        if (invoice.Status is not (InvoiceStatus.Issued or InvoiceStatus.PartiallyPaid))
        {
            return Invalid("Amount", $"This invoice is {invoice.Status}, so no payment can be added.");
        }

        var amount = decimal.Round(request.Amount, 2);
        var balance = invoice.Total - invoice.AmountPaid;
        if (amount > balance)
        {
            return Invalid("Amount", $"The amount is more than the balance due ({balance:N2}). Overpayment is not allowed.");
        }
        var method = request.Method!.Value;
        var reference = string.IsNullOrWhiteSpace(request.ReferenceNumber) ? null : request.ReferenceNumber.Trim();
        if (method != PaymentMethod.Cash && reference is null)
        {
            return Invalid("ReferenceNumber", "Enter the card slip or bank transfer reference.");
        }

        var next = await db.Database.SqlQuery<long>($"SELECT nextval('\"ReceiptNumbers\"') AS \"Value\"").SingleAsync();
        var payment = new Payment
        {
            ReceiptNumber = $"RCP-{next:D6}",
            InvoiceId = invoiceId,
            Amount = amount,
            Method = method,
            ReferenceNumber = reference,
            PaidAt = DateTime.UtcNow,
            ReceivedByUserId = userId,
        };
        db.Payments.Add(payment);
        invoice.AmountPaid += amount;
        invoice.Status = invoice.AmountPaid == invoice.Total ? InvoiceStatus.Paid : InvoiceStatus.PartiallyPaid;
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return ServiceResult<int>.Ok(payment.Id);
    }

    public async Task<ReceiptResponse?> GetReceiptAsync(int paymentId)
    {
        var payment = await ProjectPayments(db.Payments.AsNoTracking().Where(p => p.Id == paymentId)).FirstOrDefaultAsync();
        if (payment is null) return null;

        var invoice = await db.Payments.AsNoTracking().Where(p => p.Id == paymentId)
            .Select(p => new
            {
                p.Invoice.Id, p.Invoice.InvoiceNumber, p.Invoice.Patient.PatientNumber,
                PatientName = p.Invoice.Patient.FirstName + " " + p.Invoice.Patient.LastName, p.Invoice.Total,
                // Everything paid up to and including this receipt, so a reprinted old receipt still shows its own balance.
                PaidToDate = p.Invoice.Payments.Where(x => x.Id <= p.Id).Sum(x => x.Amount),
            })
            .FirstAsync();
        return new ReceiptResponse(payment, invoice.InvoiceNumber, invoice.Id, invoice.PatientNumber, invoice.PatientName,
            invoice.Total, invoice.PaidToDate, invoice.Total - invoice.PaidToDate);
    }

    // ---------- UI-DSH-03 Revenue Summary ----------

    public async Task<RevenueSummary> GetRevenueSummaryAsync()
    {
        var today = HospitalTime.Today;
        var todayUtc = HospitalTime.ToUtc(today, TimeOnly.MinValue);
        var monthUtc = HospitalTime.ToUtc(new DateOnly(today.Year, today.Month, 1), TimeOnly.MinValue);

        var todayTotal = await db.Payments.Where(p => p.PaidAt >= todayUtc).SumAsync(p => p.Amount);
        var monthTotal = await db.Payments.Where(p => p.PaidAt >= monthUtc).SumAsync(p => p.Amount);
        var outstanding = await db.Invoices
            .Where(i => i.Status == InvoiceStatus.Issued || i.Status == InvoiceStatus.PartiallyPaid)
            .SumAsync(i => i.Total - i.AmountPaid);
        return new RevenueSummary(todayTotal, monthTotal, outstanding);
    }

    // ---------- Helpers ----------

    private static IQueryable<ChargeResponse> ProjectCharges(IQueryable<Charge> query) =>
        query.OrderBy(c => c.CreatedAt).ThenBy(c => c.Id)
            .Select(c => new ChargeResponse(c.Id, c.ChargeType, c.Description, c.Quantity, c.UnitPrice, c.Amount, c.CreatedAt));

    private IQueryable<PaymentResponse> ProjectPayments(IQueryable<Payment> query) =>
        query.OrderBy(p => p.PaidAt).ThenBy(p => p.Id)
            .Select(p => new PaymentResponse(p.Id, p.ReceiptNumber, p.Amount, p.Method, p.ReferenceNumber, p.PaidAt,
                db.Users.Where(u => u.Id == p.ReceivedByUserId).Select(u => u.UserName).FirstOrDefault()));

    private static ServiceResult<int> Invalid(string field, string message) =>
        ServiceResult<int>.Invalid(new() { [field] = [message] });
}
