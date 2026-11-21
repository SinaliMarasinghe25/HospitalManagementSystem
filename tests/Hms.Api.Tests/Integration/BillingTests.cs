using Hms.Api.Authorization;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Hms.Api.Tests.Infrastructure;

namespace Hms.Api.Tests.Integration;

// PDF 3.8: FR-BL-05 invoice totals match the line items, FR-BL-06 payments update balance and status.
[Collection(ApiCollection.Name)]
public class BillingTests(HmsApiFactory api)
{
    [Fact]
    public async Task Invoice_totals_are_the_sum_of_the_lines_minus_the_discount()
    {
        var patient = await api.AddPatientAsync();
        var charges = await api.AddChargesAsync(patient.Id, 2500m, 1200.50m, 349.50m);
        var accountant = await api.LoginAsAsync(Roles.Accountant);

        var invoice = await CreateInvoice(accountant, patient.Id, charges, discount: 50m);

        Assert.Equal(3, invoice.Lines.Count);
        Assert.Equal(4050.00m, invoice.Subtotal);
        Assert.Equal(50m, invoice.Discount);
        Assert.Equal(4000.00m, invoice.Total);
        Assert.Equal(invoice.Lines.Sum(l => l.Amount) - invoice.Discount, invoice.Total);
        Assert.Equal(4000.00m, invoice.Balance);
        Assert.Equal(InvoiceStatus.Issued, invoice.Status);
        Assert.Matches("^INV-[0-9]{6}$", invoice.InvoiceNumber);
    }

    [Fact]
    public async Task Money_is_exact_with_no_rounding_errors()
    {
        // With double, 0.1 + 0.2 is 0.30000000000000004. With decimal it is exactly 0.3.
        var patient = await api.AddPatientAsync();
        var charges = await api.AddChargesAsync(patient.Id, 0.10m, 0.20m);
        var accountant = await api.LoginAsAsync(Roles.Accountant);

        var invoice = await CreateInvoice(accountant, patient.Id, charges);

        Assert.Equal(0.30m, invoice.Total);
    }

    [Fact]
    public async Task A_discount_bigger_than_the_subtotal_is_refused()
    {
        var patient = await api.AddPatientAsync();
        var charges = await api.AddChargesAsync(patient.Id, 1000m);
        var accountant = await api.LoginAsAsync(Roles.Accountant);

        var response = await accountant.PostJsonAsync("/api/billing/invoices",
            new { patientId = patient.Id, chargeIds = charges, discount = 1000.01m });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task A_charge_cannot_be_billed_twice()
    {
        var patient = await api.AddPatientAsync();
        var charges = await api.AddChargesAsync(patient.Id, 1000m);
        var accountant = await api.LoginAsAsync(Roles.Accountant);
        await CreateInvoice(accountant, patient.Id, charges);

        var second = await accountant.PostJsonAsync("/api/billing/invoices",
            new { patientId = patient.Id, chargeIds = charges, discount = 0 });

        Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
    }

    [Fact]
    public async Task Another_patients_charge_cannot_go_on_the_invoice()
    {
        var patient = await api.AddPatientAsync();
        var otherPatient = await api.AddPatientAsync();
        var otherCharges = await api.AddChargesAsync(otherPatient.Id, 1000m);
        var accountant = await api.LoginAsAsync(Roles.Accountant);

        var response = await accountant.PostJsonAsync("/api/billing/invoices",
            new { patientId = patient.Id, chargeIds = otherCharges, discount = 0 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Part_payment_then_full_payment_updates_balance_and_status()
    {
        var patient = await api.AddPatientAsync();
        var charges = await api.AddChargesAsync(patient.Id, 3000m);
        var accountant = await api.LoginAsAsync(Roles.Accountant);
        var invoice = await CreateInvoice(accountant, patient.Id, charges);

        var first = await (await accountant.PostJsonAsync($"/api/billing/invoices/{invoice.Id}/payments",
            new { amount = 1000m, method = "Cash" })).ReadAsAsync<ReceiptResponse>(HttpStatusCode.Created);

        Assert.Equal(2000m, first.BalanceAfter);
        Assert.Matches("^RCP-[0-9]{6}$", first.Payment.ReceiptNumber);
        var afterFirst = await GetInvoice(accountant, invoice.Id);
        Assert.Equal(InvoiceStatus.PartiallyPaid, afterFirst.Status);
        Assert.Equal(1000m, afterFirst.AmountPaid);
        Assert.Equal(2000m, afterFirst.Balance);

        var second = await (await accountant.PostJsonAsync($"/api/billing/invoices/{invoice.Id}/payments",
            new { amount = 2000m, method = "Card", referenceNumber = "SLIP-778" })).ReadAsAsync<ReceiptResponse>(HttpStatusCode.Created);

        Assert.Equal(0m, second.BalanceAfter);
        var afterSecond = await GetInvoice(accountant, invoice.Id);
        Assert.Equal(InvoiceStatus.Paid, afterSecond.Status);
        Assert.Equal(0m, afterSecond.Balance);
        Assert.Equal(2, afterSecond.Payments.Count);

        // A reprinted first receipt still shows the balance it had at the time.
        var reprint = await (await accountant.GetAsync($"/api/billing/payments/{first.Payment.Id}/receipt"))
            .ReadAsAsync<ReceiptResponse>();
        Assert.Equal(2000m, reprint.BalanceAfter);
    }

    [Fact]
    public async Task Paying_more_than_the_balance_is_refused()
    {
        var patient = await api.AddPatientAsync();
        var charges = await api.AddChargesAsync(patient.Id, 500m);
        var accountant = await api.LoginAsAsync(Roles.Accountant);
        var invoice = await CreateInvoice(accountant, patient.Id, charges);

        var response = await accountant.PostJsonAsync($"/api/billing/invoices/{invoice.Id}/payments",
            new { amount = 500.01m, method = "Cash" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0m, (await GetInvoice(accountant, invoice.Id)).AmountPaid);
    }

    [Fact]
    public async Task A_card_payment_needs_a_reference_number()
    {
        var patient = await api.AddPatientAsync();
        var charges = await api.AddChargesAsync(patient.Id, 500m);
        var accountant = await api.LoginAsAsync(Roles.Accountant);
        var invoice = await CreateInvoice(accountant, patient.Id, charges);

        var response = await accountant.PostJsonAsync($"/api/billing/invoices/{invoice.Id}/payments",
            new { amount = 500m, method = "Card" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Cancelling_an_unpaid_invoice_gives_the_charges_back()
    {
        var patient = await api.AddPatientAsync();
        var charges = await api.AddChargesAsync(patient.Id, 700m, 300m);
        var accountant = await api.LoginAsAsync(Roles.Accountant);
        var invoice = await CreateInvoice(accountant, patient.Id, charges);

        var cancelled = await (await accountant.PostAsync($"/api/billing/invoices/{invoice.Id}/cancel", null))
            .ReadAsAsync<InvoiceDetail>();

        Assert.Equal(InvoiceStatus.Cancelled, cancelled.Status);
        Assert.Equal(0m, cancelled.Balance);
        var unbilled = await (await accountant.GetAsync($"/api/billing/unbilled/{patient.Id}")).ReadAsAsync<UnbilledCharges>();
        Assert.Equal(charges.Order(), unbilled.Charges.Select(c => c.Id).Order());
    }

    [Fact]
    public async Task An_invoice_with_a_payment_cannot_be_cancelled()
    {
        var patient = await api.AddPatientAsync();
        var charges = await api.AddChargesAsync(patient.Id, 900m);
        var accountant = await api.LoginAsAsync(Roles.Accountant);
        var invoice = await CreateInvoice(accountant, patient.Id, charges);
        await (await accountant.PostJsonAsync($"/api/billing/invoices/{invoice.Id}/payments",
            new { amount = 100m, method = "Cash" })).ShouldBeAsync(HttpStatusCode.Created);

        var response = await accountant.PostAsync($"/api/billing/invoices/{invoice.Id}/cancel", null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Reception_sees_balances_but_cannot_bill_or_open_line_items()
    {
        var patient = await api.AddPatientAsync();
        var charges = await api.AddChargesAsync(patient.Id, 400m);
        var accountant = await api.LoginAsAsync(Roles.Accountant);
        var invoice = await CreateInvoice(accountant, patient.Id, charges);
        var reception = await api.LoginAsAsync(Roles.Receptionist);

        var list = await (await reception.GetAsync($"/api/billing/invoices?patientId={patient.Id}")).ReadAsAsync<InvoicePage>();
        Assert.Equal(400m, Assert.Single(list.Items).Balance);

        Assert.Equal(HttpStatusCode.Forbidden, (await reception.GetAsync($"/api/billing/invoices/{invoice.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await reception.PostJsonAsync($"/api/billing/invoices/{invoice.Id}/payments",
            new { amount = 100m, method = "Cash" })).StatusCode);
    }

    [Fact]
    public async Task Total_still_due_counts_every_page_not_only_the_first()
    {
        // Step 26: with 3 invoices and 1 per page, the total must still include all 3.
        var patient = await api.AddPatientAsync();
        var accountant = await api.LoginAsAsync(Roles.Accountant);
        foreach (var amount in new[] { 100m, 200m, 300m })
        {
            var charges = await api.AddChargesAsync(patient.Id, amount);
            await CreateInvoice(accountant, patient.Id, charges);
        }

        var page = await (await accountant.GetAsync($"/api/billing/invoices?patientId={patient.Id}&page=1&pageSize=1"))
            .ReadAsAsync<InvoicePage>();

        Assert.Single(page.Items);
        Assert.Equal(3, page.TotalCount);
        Assert.Equal(600m, page.TotalBalance);
    }

    private static async Task<InvoiceDetail> CreateInvoice(HttpClient accountant, int patientId, List<int> chargeIds, decimal discount = 0)
    {
        var response = await accountant.PostJsonAsync("/api/billing/invoices", new { patientId, chargeIds, discount });
        return await response.ReadAsAsync<InvoiceDetail>(HttpStatusCode.Created);
    }

    private static async Task<InvoiceDetail> GetInvoice(HttpClient client, int id) =>
        await (await client.GetAsync($"/api/billing/invoices/{id}")).ReadAsAsync<InvoiceDetail>();
}
