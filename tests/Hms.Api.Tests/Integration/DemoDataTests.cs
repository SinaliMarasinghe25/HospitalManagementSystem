using Hms.Api.Data;
using Hms.Api.Entities;
using Hms.Api.Tests.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace Hms.Api.Tests.Integration;

// The same API, started with Seed:DemoData = true, on its own new database (step 33).
public class DemoApiFactory : HmsApiFactory
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseSetting("Seed:DemoData", "true");
        builder.UseSetting("Seed:DemoPassword", Password);
    }
}

// Step 33: the demo data seeder fills every module, keeps the business rules, and runs only once.
public class DemoDataTests(DemoApiFactory api) : IClassFixture<DemoApiFactory>
{
    [Fact]
    public async Task Every_module_gets_demo_data()
    {
        await using var db = api.CreateDbContext();

        Assert.Equal(11, await db.Patients.CountAsync());
        Assert.Equal(4, await db.Doctors.CountAsync());
        Assert.Equal(18, await db.Employees.CountAsync(e => e.UserId != null));   // the 18 demo logins
        Assert.True(await db.Appointments.AnyAsync(a => a.Status == AppointmentStatus.Scheduled));
        Assert.True(await db.MedicalRecords.AnyAsync());
        Assert.True(await db.LabRequests.AnyAsync(l => l.Status == LabRequestStatus.Completed));
        Assert.True(await db.Prescriptions.AnyAsync(p => p.Status == PrescriptionStatus.Dispensed));
        Assert.True(await db.Admissions.AnyAsync(a => a.DischargedAt == null));
        Assert.True(await db.Invoices.AnyAsync(i => i.Status == InvoiceStatus.Paid));
        Assert.True(await db.Charges.AnyAsync(c => c.InvoiceId == null));   // something left to bill
        Assert.True(await db.Attendance.AnyAsync());
        Assert.True(await db.Notifications.AnyAsync());
    }

    [Fact]
    public async Task Demo_data_follows_the_business_rules()
    {
        await using var db = api.CreateDbContext();

        // Invoice total = its lines minus the discount, and the amount paid = its payments.
        var invoices = await db.Invoices.Select(i => new
        {
            i.Total, i.Discount, i.AmountPaid,
            Lines = i.Charges.Sum(c => c.Amount),
            Paid = i.Payments.Sum(p => p.Amount),
        }).ToListAsync();
        Assert.All(invoices, i => Assert.Equal(i.Lines - i.Discount, i.Total));
        Assert.All(invoices, i => Assert.Equal(i.Paid, i.AmountPaid));

        // Every completed visit has its consultation charge; every completed lab test has its charge.
        Assert.False(await db.Appointments.AnyAsync(a =>
            a.Status == AppointmentStatus.Completed && !db.Charges.Any(c => c.AppointmentId == a.Id)));
        Assert.False(await db.LabRequests.AnyAsync(l =>
            l.Status == LabRequestStatus.Completed && !db.Charges.Any(c => c.LabRequestId == l.Id)));

        // Stock on hand = everything in minus everything out, for every batch.
        var batches = await db.MedicineBatches
            .Select(b => new { b.QuantityOnHand, Moved = db.StockMovements.Where(m => m.MedicineBatchId == b.Id).Sum(m => m.Quantity) })
            .ToListAsync();
        Assert.All(batches, b => Assert.Equal(b.Moved, b.QuantityOnHand));

        // Nothing in the past is still "Scheduled".
        Assert.False(await db.Appointments.AnyAsync(a => a.Status == AppointmentStatus.Scheduled && a.StartTime < DateTime.UtcNow.AddHours(-1)));
    }

    [Fact]
    public async Task A_demo_doctor_can_log_in_and_sees_their_dashboard()
    {
        var client = await api.LoginAsync("nuwan.perera");

        var response = await client.GetAsync("/api/dashboard");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Running_the_seeder_again_adds_nothing()
    {
        await using var before = api.CreateDbContext();
        var patients = await before.Patients.CountAsync();
        var appointments = await before.Appointments.CountAsync();

        using var scope = api.Services.CreateScope();
        var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        await DemoDataSeeder.SeedAsync(scope.ServiceProvider, configuration, NullLogger.Instance);

        await using var after = api.CreateDbContext();
        Assert.Equal(patients, await after.Patients.CountAsync());
        Assert.Equal(appointments, await after.Appointments.CountAsync());
    }
}
