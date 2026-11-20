using Hms.Api.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Data;

// The DbContext is our "session" with the database.
// Each DbSet below becomes one table. IdentityDbContext adds the Users and Roles tables.
public class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<AppUser>(options)
{
    // Staff
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<Doctor> Doctors => Set<Doctor>();
    public DbSet<DoctorSchedule> DoctorSchedules => Set<DoctorSchedule>();
    public DbSet<AttendanceRecord> Attendance => Set<AttendanceRecord>();
    public DbSet<LeaveRequest> LeaveRequests => Set<LeaveRequest>();

    // Patients and appointments
    public DbSet<Patient> Patients => Set<Patient>();
    public DbSet<PatientDocument> PatientDocuments => Set<PatientDocument>();
    public DbSet<Appointment> Appointments => Set<Appointment>();

    // Medical records
    public DbSet<MedicalRecord> MedicalRecords => Set<MedicalRecord>();
    public DbSet<Diagnosis> Diagnoses => Set<Diagnosis>();
    public DbSet<Treatment> Treatments => Set<Treatment>();
    public DbSet<Prescription> Prescriptions => Set<Prescription>();
    public DbSet<PrescriptionItem> PrescriptionItems => Set<PrescriptionItem>();

    // Inpatient care
    public DbSet<Ward> Wards => Set<Ward>();
    public DbSet<Bed> Beds => Set<Bed>();
    public DbSet<Admission> Admissions => Set<Admission>();
    public DbSet<VitalSign> VitalSigns => Set<VitalSign>();
    public DbSet<BedTransfer> BedTransfers => Set<BedTransfer>();

    // Laboratory and pharmacy
    public DbSet<LabTest> LabTests => Set<LabTest>();
    public DbSet<LabRequest> LabRequests => Set<LabRequest>();
    public DbSet<Medicine> Medicines => Set<Medicine>();
    public DbSet<MedicineBatch> MedicineBatches => Set<MedicineBatch>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();

    // Billing and audit
    public DbSet<Charge> Charges => Set<Charge>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    // Rules that apply to every property of a type, in one place.
    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        // Store every enum as readable text, e.g. "Scheduled".
        configurationBuilder.Properties<Enum>().HaveConversion<string>().HaveMaxLength(30);

        // Money: 12 digits, 2 after the decimal point. Never float.
        configurationBuilder.Properties<decimal>().HavePrecision(12, 2);
    }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        // Must run first: creates the Identity tables.
        base.OnModelCreating(builder);

        ConfigureIdentity(builder);
        ConfigureStaff(builder);
        ConfigurePatients(builder);
        ConfigureClinical(builder);
        ConfigureLabAndPharmacy(builder);
        ConfigureBilling(builder);

        // Hospital data is never hard-deleted: block deletes that would remove related rows.
        foreach (var foreignKey in builder.Model.GetEntityTypes()
                     .Where(e => e.ClrType.Namespace == typeof(Patient).Namespace)
                     .SelectMany(e => e.GetForeignKeys()))
        {
            foreignKey.DeleteBehavior = DeleteBehavior.Restrict;
        }
    }

    private static void ConfigureIdentity(ModelBuilder builder)
    {
        // Shorter table names than the default "AspNetUsers", matching our ER diagram.
        builder.Entity<AppUser>().ToTable("Users");
        builder.Entity<IdentityRole>().ToTable("Roles");
        builder.Entity<IdentityUserRole<string>>().ToTable("UserRoles");
        builder.Entity<IdentityUserClaim<string>>().ToTable("UserClaims");
        builder.Entity<IdentityUserLogin<string>>().ToTable("UserLogins");
        builder.Entity<IdentityUserToken<string>>().ToTable("UserTokens");
        builder.Entity<IdentityRoleClaim<string>>().ToTable("RoleClaims");
    }

    private static void ConfigureStaff(ModelBuilder builder)
    {
        // Gives EMP-0001, EMP-0002... for every employee, including doctors.
        builder.HasSequence<long>("EmployeeNumbers");

        builder.Entity<Department>().HasIndex(d => d.Name).IsUnique();

        builder.Entity<Employee>(e =>
        {
            e.HasIndex(x => x.EmployeeNumber).IsUnique();
            // One login account belongs to at most one employee.
            e.HasOne(x => x.User).WithOne(u => u.Employee)
                .HasForeignKey<Employee>(x => x.UserId);
        });

        builder.Entity<Doctor>(e =>
        {
            e.HasIndex(x => x.LicenseNumber).IsUnique();
            // A doctor IS an employee: one-to-one.
            e.HasOne(x => x.Employee).WithOne(emp => emp.Doctor)
                .HasForeignKey<Doctor>(x => x.EmployeeId);
            e.ToTable(t =>
            {
                t.HasCheckConstraint("CK_Doctors_ConsultationFee", "\"ConsultationFee\" >= 0");
                t.HasCheckConstraint("CK_Doctors_SlotMinutes", "\"SlotMinutes\" > 0");
            });
        });

        builder.Entity<DoctorSchedule>(e =>
        {
            e.ToTable(t => t.HasCheckConstraint("CK_DoctorSchedules_Times", "\"EndTime\" > \"StartTime\""));
            e.HasIndex(x => new { x.DoctorId, x.DayOfWeek, x.StartTime }).IsUnique();
        });

        builder.Entity<AttendanceRecord>(e =>
        {
            // One attendance row per employee per day.
            e.HasIndex(x => new { x.EmployeeId, x.Date }).IsUnique();
            e.HasOne<AppUser>().WithMany().HasForeignKey(x => x.RecordedByUserId);
        });

        builder.Entity<LeaveRequest>(e =>
        {
            e.ToTable(t => t.HasCheckConstraint("CK_LeaveRequests_Dates", "\"EndDate\" >= \"StartDate\""));
            e.HasOne<AppUser>().WithMany().HasForeignKey(x => x.ReviewedByUserId);
        });
    }

    private static void ConfigurePatients(ModelBuilder builder)
    {
        // Gives P-000001, P-000002... without duplicates, even with many users at once.
        builder.HasSequence<long>("PatientNumbers");

        builder.Entity<Patient>(e =>
        {
            e.HasIndex(x => x.PatientNumber).IsUnique();
            e.HasIndex(x => x.NationalId).IsUnique();
            // Speeds up "search patient" by name and phone.
            e.HasIndex(x => new { x.LastName, x.FirstName });
            e.HasIndex(x => x.Phone);
        });

        builder.Entity<PatientDocument>(e =>
        {
            e.HasIndex(x => x.StoredFileName).IsUnique();
            e.ToTable(t => t.HasCheckConstraint("CK_PatientDocuments_Size", "\"SizeBytes\" > 0 AND \"SizeBytes\" <= 5242880"));
            e.HasOne<AppUser>().WithMany().HasForeignKey(x => x.UploadedByUserId);
        });

        builder.Entity<Appointment>(e =>
        {
            // A doctor cannot have two active appointments starting at the same time.
            e.HasIndex(x => new { x.DoctorId, x.StartTime })
                .IsUnique()
                .HasFilter("\"Status\" NOT IN ('Cancelled', 'Rescheduled')");
            e.HasIndex(x => x.StartTime);
            e.HasOne(x => x.RescheduledFrom).WithMany().HasForeignKey(x => x.RescheduledFromId);
            e.ToTable(t => t.HasCheckConstraint("CK_Appointments_Times", "\"EndTime\" > \"StartTime\""));
            e.HasOne<AppUser>().WithMany().HasForeignKey(x => x.CreatedByUserId);
        });
    }

    private static void ConfigureClinical(ModelBuilder builder)
    {
        builder.Entity<MedicalRecord>(e =>
        {
            // An appointment has at most one medical record.
            e.HasOne(x => x.Appointment).WithOne().HasForeignKey<MedicalRecord>(x => x.AppointmentId);
            e.HasIndex(x => new { x.PatientId, x.VisitDate });
        });

        builder.Entity<PrescriptionItem>().ToTable(t =>
        {
            t.HasCheckConstraint("CK_PrescriptionItems_Quantity", "\"Quantity\" > 0");
            t.HasCheckConstraint("CK_PrescriptionItems_Duration", "\"DurationDays\" > 0");
            t.HasCheckConstraint("CK_PrescriptionItems_Dispensed", "\"QuantityDispensed\" >= 0 AND \"QuantityDispensed\" <= \"Quantity\"");
        });

        builder.Entity<Ward>(e =>
        {
            e.HasIndex(x => x.Name).IsUnique();
            e.ToTable(t => t.HasCheckConstraint("CK_Wards_DailyCharge", "\"DailyCharge\" >= 0"));
        });

        builder.Entity<Bed>().HasIndex(x => new { x.WardId, x.BedNumber }).IsUnique();

        // Gives ADM-000001, ADM-000002, ... without two admissions ever getting the same number.
        builder.HasSequence<long>("AdmissionNumbers");

        builder.Entity<Admission>(e =>
        {
            e.HasIndex(x => x.AdmissionNumber).IsUnique();
            // A bed holds one patient at a time, and a patient has one active admission.
            e.HasIndex(x => x.BedId).IsUnique().HasFilter("\"DischargedAt\" IS NULL");
            e.HasIndex(x => x.PatientId).IsUnique().HasFilter("\"DischargedAt\" IS NULL");
        });

        builder.Entity<BedTransfer>(e =>
        {
            e.HasOne(x => x.FromBed).WithMany().HasForeignKey(x => x.FromBedId);
            e.HasOne(x => x.ToBed).WithMany().HasForeignKey(x => x.ToBedId);
            e.HasOne<AppUser>().WithMany().HasForeignKey(x => x.TransferredByUserId);
            e.ToTable(t => t.HasCheckConstraint("CK_BedTransfers_DifferentBeds", "\"FromBedId\" <> \"ToBedId\""));
        });

        builder.Entity<VitalSign>(e =>
        {
            e.Property(x => x.TemperatureC).HasPrecision(4, 1);
            e.HasOne<AppUser>().WithMany().HasForeignKey(x => x.RecordedByUserId);
        });
    }

    private static void ConfigureLabAndPharmacy(ModelBuilder builder)
    {
        builder.Entity<LabTest>(e =>
        {
            e.HasIndex(x => x.Code).IsUnique();
            e.ToTable(t => t.HasCheckConstraint("CK_LabTests_Price", "\"Price\" >= 0"));
        });

        // Gives LAB-000001, LAB-000002, ... for lab requests.
        builder.HasSequence<long>("LabRequestNumbers");

        builder.Entity<LabRequest>(e =>
        {
            e.HasIndex(x => x.RequestNumber).IsUnique();
            e.HasIndex(x => x.SampleId).IsUnique();
            e.HasIndex(x => x.Status);
            e.HasOne<AppUser>().WithMany().HasForeignKey(x => x.CollectedByUserId);
            e.HasOne<AppUser>().WithMany().HasForeignKey(x => x.ResultEnteredByUserId);
        });

        builder.Entity<Medicine>(e =>
        {
            e.HasIndex(x => new { x.Name, x.Strength, x.Form }).IsUnique();
            e.ToTable(t =>
            {
                t.HasCheckConstraint("CK_Medicines_UnitPrice", "\"UnitPrice\" >= 0");
                t.HasCheckConstraint("CK_Medicines_ReorderLevel", "\"ReorderLevel\" >= 0");
            });
        });

        builder.Entity<MedicineBatch>(e =>
        {
            e.HasIndex(x => new { x.MedicineId, x.BatchNumber }).IsUnique();
            // Used by expiry monitoring.
            e.HasIndex(x => x.ExpiryDate);
            // Stock can never go below zero, even if the code has a bug.
            e.ToTable(t => t.HasCheckConstraint("CK_MedicineBatches_Quantity", "\"QuantityOnHand\" >= 0"));
        });

        builder.Entity<StockMovement>(e =>
        {
            e.ToTable(t => t.HasCheckConstraint("CK_StockMovements_Quantity", "\"Quantity\" <> 0"));
            e.HasOne<AppUser>().WithMany().HasForeignKey(x => x.CreatedByUserId);
        });
    }

    private static void ConfigureBilling(ModelBuilder builder)
    {
        builder.Entity<Charge>(e =>
        {
            // Finding a patient's unbilled charges is a common query.
            e.HasIndex(x => new { x.PatientId, x.InvoiceId });
            e.ToTable(t =>
            {
                // Exactly one source is set: appointment, lab request, stock movement or admission.
                t.HasCheckConstraint("CK_Charges_OneSource",
                    "num_nonnulls(\"AppointmentId\", \"LabRequestId\", \"StockMovementId\", \"AdmissionId\") = 1");
                t.HasCheckConstraint("CK_Charges_Quantity", "\"Quantity\" > 0");
                t.HasCheckConstraint("CK_Charges_Amount", "\"Amount\" >= 0");
            });
        });

        builder.Entity<Invoice>(e =>
        {
            e.HasIndex(x => x.InvoiceNumber).IsUnique();
            e.ToTable(t =>
            {
                t.HasCheckConstraint("CK_Invoices_Discount", "\"Discount\" >= 0");
                t.HasCheckConstraint("CK_Invoices_Total", "\"Total\" >= 0");
            });
            e.HasOne<AppUser>().WithMany().HasForeignKey(x => x.CreatedByUserId);
        });

        builder.Entity<Payment>(e =>
        {
            e.HasIndex(x => x.ReceiptNumber).IsUnique();
            e.ToTable(t => t.HasCheckConstraint("CK_Payments_Amount", "\"Amount\" > 0"));
            e.HasOne<AppUser>().WithMany().HasForeignKey(x => x.ReceivedByUserId);
        });

        builder.Entity<AuditLog>(e =>
        {
            e.Property(x => x.Changes).HasColumnType("jsonb");
            e.HasIndex(x => x.Timestamp);
            e.HasIndex(x => new { x.EntityName, x.EntityId });
        });
    }
}
