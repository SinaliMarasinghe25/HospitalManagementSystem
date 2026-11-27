using Hms.Api.Authorization;
using Hms.Api.Entities;
using Hms.Api.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using static Hms.Api.Data.DemoDataCatalog;

namespace Hms.Api.Data;

// Fills the hospital with a small set of realistic made-up data for a demo: 4 doctors and 14 staff with logins,
// 11 patients, three weeks of appointments and visits (two back, one ahead), prescriptions and dispensing, lab tests, wards and admissions,
// invoices and payments, attendance, leave and notifications. Dates are worked out from "today", so the
// dashboard, today's appointments and the reports all have something to show on the day it runs.
//
// It is OFF unless Seed:DemoData is true (environment variable Seed__DemoData=true), and it runs only once:
// when the first demo doctor (licence SLMC-21457) already exists it does nothing. It only ADDS rows and never
// changes or deletes what is already in the database, so it is safe on a database that already has some data.
// Everything is added in one transaction: if anything fails, nothing is added.
//
// Demo logins (all with the password in Seed:DemoPassword) are listed in docs/guides/demo-data.md.
// Without Seed:DemoPassword the staff are added without login accounts.
public class DemoDataSeeder
{
    public const string MarkerLicense = "SLMC-21457";

    private readonly AppDbContext db;
    private readonly UserManager<AppUser> userManager;
    private readonly ILogger logger;
    private readonly string? demoPassword;
    private readonly Random random = new(2026);   // fixed seed: the same "random" data every time
    private readonly DateTime now = DateTime.UtcNow;
    private readonly DateOnly today = HospitalTime.Today;

    // What has been made so far, used by the later parts.
    private readonly Dictionary<string, Department> departments = new(StringComparer.OrdinalIgnoreCase);
    private readonly List<(DoctorInfo Info, Doctor Doctor, string? UserId)> doctors = [];
    private readonly List<(StaffInfo Info, Employee Employee)> staff = [];
    private readonly Dictionary<string, List<string>> usersByRole = new();
    private readonly Dictionary<string, Medicine> medicines = new();
    private readonly Dictionary<string, LabTest> labTests = new(StringComparer.OrdinalIgnoreCase);
    private readonly List<MedicineBatch> batches = [];
    private readonly List<Patient> adults = [];
    private readonly List<Patient> children = [];
    private readonly List<Appointment> appointments = [];
    private readonly List<LabRequest> labRequests = [];
    private readonly List<Prescription> prescriptions = [];
    private readonly List<Charge> charges = [];
    private readonly List<Admission> admissions = [];
    private readonly List<LeaveRequest> leaveRequests = [];
    private string? adminUserId;

    private DemoDataSeeder(AppDbContext db, UserManager<AppUser> userManager, IConfiguration configuration, ILogger logger)
    {
        this.db = db;
        this.userManager = userManager;
        this.logger = logger;
        demoPassword = configuration["Seed:DemoPassword"];
    }

    public static async Task SeedAsync(IServiceProvider services, IConfiguration configuration, ILogger logger)
    {
        if (!configuration.GetValue<bool>("Seed:DemoData")) return;

        var db = services.GetRequiredService<AppDbContext>();
        if (await db.Doctors.AnyAsync(d => d.LicenseNumber == MarkerLicense))
        {
            logger.LogInformation("Demo data was added before, so it is not added again. Seed:DemoData can be turned off.");
            return;
        }

        var seeder = new DemoDataSeeder(db, services.GetRequiredService<UserManager<AppUser>>(), configuration, logger);
        await using var transaction = await db.Database.BeginTransactionAsync();
        await seeder.RunAsync(configuration["Seed:AdminUserName"] ?? "admin");
        await transaction.CommitAsync();
    }

    private async Task RunAsync(string adminUserName)
    {
        logger.LogInformation("Adding demo data...");
        adminUserId = (await userManager.FindByNameAsync(adminUserName))?.Id;
        if (string.IsNullOrWhiteSpace(demoPassword))
        {
            logger.LogWarning("Seed:DemoPassword is not set, so the demo staff are added without login accounts.");
        }

        await AddDepartmentsAsync();
        await AddStaffAsync();
        await AddCataloguesAsync();
        AddStock();
        AddPatients();
        PlanAppointments();
        RecordVisits();
        await AddWardsAndAdmissionsAsync();
        await NumberEverythingAsync();
        await db.SaveChangesAsync();

        await BillAsync();
        AddAttendanceAndLeave();
        await db.SaveChangesAsync();

        await AddNotificationsAsync();
        await db.SaveChangesAsync();

        logger.LogInformation(
            "Demo data added: {Doctors} doctors, {Staff} other staff, {Patients} patients, {Appointments} appointments, " +
            "{Labs} lab requests, {Admissions} admissions.",
            doctors.Count, staff.Count, adults.Count + children.Count, appointments.Count, labRequests.Count, admissions.Count);
    }

    // ---------- Small helpers ----------

    private DateTime At(DateOnly date, int hour, int minute) => HospitalTime.ToUtc(date, new TimeOnly(hour, minute));

    private bool Chance(double probability) => random.NextDouble() < probability;

    private T Pick<T>(IReadOnlyList<T> items) => items[random.Next(items.Count)];

    private string Phone() => $"07{Pick(new[] { 0, 1, 2, 5, 6, 7, 8 })} {random.Next(100, 999)} {random.Next(1000, 9999)}";

    private string? UserOf(string role) => usersByRole.TryGetValue(role, out var ids) && ids.Count > 0 ? Pick(ids) : adminUserId;

    private List<string> UsersOf(string role) => usersByRole.TryGetValue(role, out var ids) ? ids : [];

    private async Task<List<long>> NextNumbersAsync(string sequence, int count)
    {
        if (count == 0) return [];
        var numbers = await db.Database
            .SqlQueryRaw<long>($"SELECT nextval('\"{sequence}\"') AS \"Value\" FROM generate_series(1, {count})")
            .ToListAsync();
        numbers.Sort();
        return numbers;
    }

    // ---------- Departments and staff ----------

    private async Task AddDepartmentsAsync()
    {
        foreach (var department in await db.Departments.ToListAsync()) departments[department.Name] = department;
        foreach (var (name, description) in ExtraDepartments)
        {
            if (departments.ContainsKey(name)) continue;
            var department = new Department { Name = name, Description = description, IsClinical = true, IsActive = true };
            db.Departments.Add(department);
            departments[name] = department;
        }
        await db.SaveChangesAsync();
    }

    private Department DepartmentNamed(string name) =>
        departments.TryGetValue(name, out var department) ? department
            : departments.TryGetValue(DepartmentSeeder.DefaultName, out var fallback) ? fallback
            : departments.Values.First();

    private async Task<string?> CreateLoginAsync(string? userName, string email, params string[] roles)
    {
        if (userName is null || string.IsNullOrWhiteSpace(demoPassword)) return null;
        if (await userManager.FindByNameAsync(userName) is not null)
        {
            logger.LogWarning("Demo login {UserName} already exists, so this employee is added without a login.", userName);
            return null;
        }

        var user = new AppUser { UserName = userName, Email = email, IsActive = true, MustChangePassword = false };
        var result = await userManager.CreateAsync(user, demoPassword);
        if (!result.Succeeded)
        {
            throw new InvalidOperationException("Could not create the demo login " + userName + ": " +
                string.Join("; ", result.Errors.Select(e => e.Description)) +
                " Check that Seed:DemoPassword meets the password rules.");
        }
        await userManager.AddToRolesAsync(user, roles);
        foreach (var role in roles)
        {
            if (!usersByRole.TryGetValue(role, out var list)) usersByRole[role] = list = [];
            list.Add(user.Id);
        }
        return user.Id;
    }

    private async Task AddStaffAsync()
    {
        var numbers = await NextNumbersAsync("EmployeeNumbers", Doctors.Length + Staff.Length);
        var n = 0;

        foreach (var info in Doctors)
        {
            var email = $"{info.UserName}@example.com";
            var userId = await CreateLoginAsync(info.UserName, email, Roles.Doctor);
            var employee = new Employee
            {
                EmployeeNumber = $"EMP-{numbers[n++]:D4}",
                FirstName = info.FirstName,
                LastName = info.LastName,
                JobTitle = info.Specialization,
                Phone = info.Phone,
                Email = email,
                HireDate = today.AddDays(-random.Next(400, 3600)),
                IsActive = true,
                Department = DepartmentNamed(info.Department),
                UserId = userId,
            };
            var doctor = new Doctor
            {
                Employee = employee,
                Specialization = info.Specialization,
                LicenseNumber = info.License,
                ConsultationFee = info.Fee,
                SlotMinutes = info.SlotMinutes,
                Schedules = info.Sessions.Select(s => new DoctorSchedule
                {
                    DayOfWeek = s.Day, StartTime = new TimeOnly(s.FromHour, 0), EndTime = new TimeOnly(s.ToHour, 0),
                }).ToList(),
            };
            db.Doctors.Add(doctor);
            doctors.Add((info, doctor, userId));
        }

        foreach (var info in Staff)
        {
            var email = $"{(info.UserName ?? (info.FirstName + "." + info.LastName).ToLowerInvariant())}@example.com";
            var userId = info.Role == "" ? null : await CreateLoginAsync(info.UserName, email, info.Role);
            var employee = new Employee
            {
                EmployeeNumber = $"EMP-{numbers[n++]:D4}",
                FirstName = info.FirstName,
                LastName = info.LastName,
                JobTitle = info.JobTitle,
                Phone = info.Phone,
                Email = email,
                HireDate = today.AddDays(-random.Next(200, 3000)),
                IsActive = true,
                Department = DepartmentNamed(info.Department),
                UserId = userId,
            };
            db.Employees.Add(employee);
            staff.Add((info, employee));
        }
        await db.SaveChangesAsync();
    }

    // ---------- Medicines, lab tests and stock ----------

    private async Task AddCataloguesAsync()
    {
        foreach (var medicine in await db.Medicines.ToListAsync())
        {
            medicines.TryAdd($"{medicine.Name}|{medicine.Strength}|{medicine.Form}", medicine);
        }
        foreach (var (name, form, strength, price, reorder) in ExtraMedicines)
        {
            var key = $"{name}|{strength}|{form}";
            if (medicines.ContainsKey(key)) continue;
            var medicine = new Medicine
            {
                Name = name, GenericName = name, Form = form, Strength = strength, UnitPrice = price, ReorderLevel = reorder, IsActive = true,
            };
            db.Medicines.Add(medicine);
            medicines[key] = medicine;
        }

        // LabTestSeeder has added the starter catalogue (if the table was empty); use what is there.
        foreach (var test in await db.LabTests.Where(t => t.IsActive).ToListAsync()) labTests[test.Code] = test;
        await db.SaveChangesAsync();
    }

    private void AddStock()
    {
        var usedBatchNumbers = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var supplierDay = today.AddDays(-70);

        foreach (var (key, medicine) in medicines)
        {
            if (!medicine.IsActive) continue;
            var name = medicine.Name;
            // Enough for the demo's prescriptions and still well above the reorder level.
            var big = medicine.Form is "Inhaler" or "Bottle" or "Sachet" ? medicine.ReorderLevel * 4 + random.Next(20, 60)
                : Math.Max(medicine.ReorderLevel * 6, 1500) + random.Next(100, 600);
            MedicineBatch Batch(string suffix, DateOnly received, DateOnly expiry, int quantity) => new()
            {
                Medicine = medicine,
                BatchNumber = $"{new string(name.Where(char.IsLetter).Take(3).ToArray()).ToUpperInvariant()}{received:yyMM}{suffix}",
                ReceivedAt = At(received, 10, 30),
                ExpiryDate = expiry,
                QuantityOnHand = quantity,
                CostPrice = Math.Round(medicine.UnitPrice * 0.7m, 2),
            };

            var list = new List<MedicineBatch>();
            if (name == "Salbutamol")
            {
                // Low stock on purpose, so the dashboard shows a low-stock alert.
                list.Add(Batch("A", supplierDay, today.AddDays(400), 15));
            }
            else
            {
                list.Add(Batch("A", supplierDay, today.AddDays(random.Next(150, 400)), big));
                list.Add(Batch("B", today.AddDays(-12), today.AddDays(random.Next(500, 720)), big / 2 + 50));
            }
            // One batch near its expiry date and one already expired, so the expiry alerts have something to show.
            if (name == "Azithromycin") list.Add(Batch("C", today.AddDays(-200), today.AddDays(40), 60));
            if (name == "Chlorphenamine") list.Add(Batch("X", today.AddDays(-400), today.AddDays(-40), 45));

            foreach (var batch in list.Where(b => usedBatchNumbers.Add($"{key}|{b.BatchNumber}")))
            {
                db.MedicineBatches.Add(batch);
                db.StockMovements.Add(new StockMovement
                {
                    MedicineBatch = batch,
                    MovementType = StockMovementType.StockIn,
                    Quantity = batch.QuantityOnHand,
                    Reason = "Delivery from State Pharmaceuticals Corporation",
                    CreatedByUserId = UserOf(Roles.Pharmacist),
                    CreatedAt = batch.ReceivedAt,
                });
                batches.Add(batch);
            }
        }
    }

    // ---------- Patients ----------

    private void AddPatients()
    {
        var usedNics = db.Patients.Where(p => p.NationalId != null).Select(p => p.NationalId!).ToHashSet();

        Patient Make(bool male, bool child, bool young = false)
        {
            var first = child ? Pick(male ? BoyNames : GirlNames) : Pick(male ? MaleNames : FemaleNames);
            var last = Pick(Surnames);
            var age = child ? random.Next(1, 13) : young ? random.Next(24, 38) : random.Next(18, 84);
            var birth = today.AddYears(-age).AddDays(-random.Next(1, 360));
            string? nic = null;
            if (!child)
            {
                do
                {
                    var day = birth.DayOfYear + (male ? 0 : 500);
                    nic = birth.Year < 1990 && Chance(0.6)
                        ? $"{birth.Year % 100:D2}{day:D3}{random.Next(100, 999)}{random.Next(0, 9)}V"
                        : $"{birth.Year}{day:D3}{random.Next(1000, 9999)}{random.Next(0, 9)}";
                } while (!usedNics.Add(nic));
            }
            var parentName = $"{Pick(male ? FemaleNames : FemaleNames)} {last}";
            return new Patient
            {
                FirstName = first,
                LastName = last,
                DateOfBirth = birth,
                Gender = male ? Gender.Male : Gender.Female,
                NationalId = nic,
                Phone = Phone(),
                Email = !child && Chance(0.45) ? $"{first.ToLowerInvariant()}.{last.Replace(" ", "").ToLowerInvariant()}{random.Next(1, 99)}@example.com" : null,
                Address = Pick(Addresses),
                BloodGroup = Chance(0.85) ? Pick(BloodGroups) : null,
                Allergies = Chance(0.15) ? Pick(Allergies) : null,
                EmergencyContactName = child ? $"{parentName} (mother)" : $"{Pick(male ? FemaleNames : MaleNames)} {last} ({(male ? "wife" : Chance(0.5) ? "husband" : "son")})",
                EmergencyContactPhone = Phone(),
            };
        }

        // 8 adults (two young women for the antenatal clinic and the maternity ward) and 3 children: 11 patients.
        for (var i = 0; i < 8; i++) adults.Add(Make(male: i % 2 == 0, child: false, young: i is 1 or 3));
        for (var i = 0; i < 3; i++) children.Add(Make(male: i % 2 == 0, child: true));
        db.Patients.AddRange(adults);
        db.Patients.AddRange(children);
    }

    private Patient PatientFor(string group) => group switch
    {
        "paediatrics" => Pick(children),
        "obstetrics" => Pick(adults.Where(p => p.Gender == Gender.Female && p.DateOfBirth > today.AddYears(-45)).ToList()),
        _ => Pick(adults),
    };

    // ---------- Appointments ----------

    private readonly Dictionary<Appointment, (int DoctorIndex, Case Case)> visitPlan = [];

    private void PlanAppointments()
    {
        var taken = new HashSet<(int, DateTime)>();
        var bookedDays = new HashSet<(Patient, DateOnly)>();   // one visit per patient per day
        var reschedules = new List<(Appointment Old, int DoctorIndex, Case Case)>();

        for (var date = today.AddDays(-14); date <= today.AddDays(6); date = date.AddDays(1))
        {
            for (var d = 0; d < doctors.Count; d++)
            {
                var (info, doctor, _) = doctors[d];
                foreach (var session in info.Sessions.Where(s => s.Day == date.DayOfWeek))
                {
                    var slots = (session.ToHour - session.FromHour) * 60 / info.SlotMinutes;
                    var wanted = date < today ? random.Next(0, 3)
                        : date == today ? random.Next(2, 4)
                        : random.Next(0, 2);
                    var chosen = Enumerable.Range(0, slots).OrderBy(_ => random.Next()).Take(Math.Min(wanted, slots)).Order();

                    foreach (var slot in chosen)
                    {
                        var start = At(date, session.FromHour, 0).AddMinutes(slot * info.SlotMinutes);
                        var visitCase = Pick(Cases[info.CaseGroup]);
                        var patient = PatientFor(info.CaseGroup);
                        var free = bookedDays.Add((patient, date));
                        for (var tries = 0; !free && tries < 20; tries++)
                        {
                            patient = PatientFor(info.CaseGroup);
                            free = bookedDays.Add((patient, date));
                        }
                        if (!free) continue;   // every suitable patient already has a visit that day
                        var appointment = NewAppointment(doctor, patient, start, info.SlotMinutes, visitCase);
                        taken.Add((d, start));
                        appointment.Status = StatusFor(start);

                        if (appointment.Status == AppointmentStatus.Cancelled) appointment.CancellationReason = Pick(CancelReasons);
                        if (start < now && start > now.AddDays(-12) && appointment.Status == AppointmentStatus.Completed && Chance(0.04))
                        {
                            appointment.Status = AppointmentStatus.Rescheduled;
                            reschedules.Add((appointment, d, visitCase));
                        }
                        appointments.Add(appointment);
                        visitPlan[appointment] = (d, visitCase);
                    }
                }
            }
        }

        // A rescheduled appointment points back to the one it replaced, one week later at the same time.
        foreach (var (old, d, visitCase) in reschedules)
        {
            var start = old.StartTime.AddDays(7);
            if (!taken.Add((d, start)))
            {
                old.Status = AppointmentStatus.Cancelled;
                old.CancellationReason = "Patient asked to cancel";
                continue;
            }
            var (info, doctor, _) = doctors[d];
            var moved = NewAppointment(doctor, old.Patient, start, info.SlotMinutes, visitCase);
            moved.Status = StatusFor(start);
            moved.RescheduledFrom = old;
            moved.CreatedAt = old.StartTime.AddDays(-1);
            appointments.Add(moved);
            visitPlan[moved] = (d, visitCase);
        }
        db.Appointments.AddRange(appointments);
    }

    private Appointment NewAppointment(Doctor doctor, Patient patient, DateTime start, int minutes, Case visitCase) => new()
    {
        Doctor = doctor,
        Patient = patient,
        StartTime = start,
        EndTime = start.AddMinutes(minutes),
        Reason = visitCase.Complaint,
        CreatedByUserId = UserOf(Roles.Receptionist),
        CreatedAt = Min(start.AddDays(-random.Next(1, 10)).AddHours(-random.Next(0, 6)), now.AddMinutes(-random.Next(30, 300))),
    };

    private static DateTime Min(DateTime a, DateTime b) => a < b ? a : b;

    private AppointmentStatus StatusFor(DateTime start)
    {
        if (start > now)
        {
            return start.Date <= now.Date.AddDays(1) || !Chance(0.08) ? AppointmentStatus.Scheduled : AppointmentStatus.Cancelled;
        }
        if (start > now.AddMinutes(-40)) return AppointmentStatus.CheckedIn;
        var roll = random.NextDouble();
        return roll < 0.84 ? AppointmentStatus.Completed : roll < 0.92 ? AppointmentStatus.NoShow : AppointmentStatus.Cancelled;
    }

    // ---------- Visits: medical records, prescriptions, dispensing, lab tests and their charges ----------

    private void RecordVisits()
    {
        foreach (var appointment in appointments.Where(a => a.Status == AppointmentStatus.Completed).OrderBy(a => a.StartTime))
        {
            var (d, visitCase) = visitPlan[appointment];
            var (info, doctor, _) = doctors[d];
            var finished = appointment.EndTime.AddMinutes(random.Next(0, 10));

            charges.Add(new Charge
            {
                Patient = appointment.Patient,
                ChargeType = ChargeType.Consultation,
                Description = $"Consultation, Dr {info.FirstName} {info.LastName}, {HospitalTime.ToLocal(appointment.StartTime):yyyy-MM-dd}",
                Quantity = 1,
                UnitPrice = info.Fee,
                Amount = info.Fee,
                Appointment = appointment,
                CreatedAt = finished,
            });

            var record = new MedicalRecord
            {
                Patient = appointment.Patient,
                Doctor = doctor,
                Appointment = appointment,
                VisitDate = appointment.StartTime,
                ChiefComplaint = visitCase.Complaint,
                ClinicalNotes = visitCase.Notes,
                CreatedAt = finished,
                Diagnoses = [new Diagnosis { Code = visitCase.Code, Description = visitCase.Diagnosis, IsPrimary = true }],
                Treatments = visitCase.Treatment is null ? []
                    : [new Treatment { Description = visitCase.Treatment, PerformedAt = appointment.StartTime.AddMinutes(10) }],
            };
            db.MedicalRecords.Add(record);

            AddPrescription(record, visitCase.Medicines, finished);
            if (visitCase.LabCodes.Length > 0 && Chance(0.7))
            {
                foreach (var code in visitCase.LabCodes) AddLabRequest(record, doctor, code, finished);
            }
        }
    }

    private void AddPrescription(MedicalRecord record, MedicineLine[] lines, DateTime prescribedAt)
    {
        var items = lines.Where(l => medicines.ContainsKey(l.Key)).Select(l => new PrescriptionItem
        {
            Medicine = medicines[l.Key],
            Dosage = l.Dosage,
            Frequency = l.Frequency,
            DurationDays = l.Days,
            Quantity = medicines[l.Key].Form is "Inhaler" or "Bottle" ? 1 : Math.Max(1, l.PerDay * l.Days),
            Instructions = l.Instructions,
        }).ToList();
        if (items.Count == 0) return;

        var prescription = new Prescription { MedicalRecord = record, PrescribedAt = prescribedAt, Items = items };
        record.Prescriptions.Add(prescription);
        prescriptions.Add(prescription);

        // Older prescriptions were collected from the pharmacy; some of today's are still waiting.
        var dispensedAt = prescribedAt.AddMinutes(random.Next(20, 90));
        var waiting = dispensedAt > now || (prescribedAt > now.AddHours(-30) && Chance(0.45));
        if (waiting) return;

        foreach (var item in items) Dispense(record.Patient, item, dispensedAt);
        prescription.Status = items.All(i => i.QuantityDispensed == i.Quantity) ? PrescriptionStatus.Dispensed
            : items.Any(i => i.QuantityDispensed > 0) ? PrescriptionStatus.PartiallyDispensed
            : PrescriptionStatus.Pending;
    }

    // Takes stock from the batch that expires first (FEFO), like PharmacyService does.
    private void Dispense(Patient patient, PrescriptionItem item, DateTime at)
    {
        var day = DateOnly.FromDateTime(HospitalTime.ToLocal(at));
        var left = item.Quantity;
        foreach (var batch in batches
                     .Where(b => b.Medicine == item.Medicine && b.ExpiryDate > day && b.QuantityOnHand > 0 && b.ReceivedAt <= at)
                     .OrderBy(b => b.ExpiryDate))
        {
            if (left == 0) break;
            var take = Math.Min(left, batch.QuantityOnHand);
            batch.QuantityOnHand -= take;
            left -= take;
            var movement = new StockMovement
            {
                MedicineBatch = batch,
                MovementType = StockMovementType.Dispense,
                Quantity = -take,
                PrescriptionItem = item,
                CreatedByUserId = UserOf(Roles.Pharmacist),
                CreatedAt = at,
            };
            db.StockMovements.Add(movement);
            charges.Add(new Charge
            {
                Patient = patient,
                ChargeType = ChargeType.Pharmacy,
                Description = $"{item.Medicine.Name} {item.Medicine.Strength} {item.Medicine.Form}",
                Quantity = take,
                UnitPrice = item.Medicine.UnitPrice,
                Amount = item.Medicine.UnitPrice * take,
                StockMovement = movement,
                CreatedAt = at,
            });
            item.QuantityDispensed += take;
        }
    }

    private void AddLabRequest(MedicalRecord record, Doctor doctor, string code, DateTime requestedAt)
    {
        if (!labTests.TryGetValue(code, out var test)) return;
        var lab = new LabRequest
        {
            Patient = record.Patient,
            LabTest = test,
            RequestedByDoctor = doctor,
            MedicalRecord = record,
            RequestedAt = requestedAt,
            Status = LabRequestStatus.Requested,
        };
        labRequests.Add(lab);
        db.LabRequests.Add(lab);

        var age = now - requestedAt;
        if (Chance(0.03)) { lab.Status = LabRequestStatus.Cancelled; return; }

        var collectedAt = requestedAt.AddMinutes(random.Next(15, 60));
        if (collectedAt > now || (age < TimeSpan.FromHours(6) && Chance(0.5))) return;
        lab.Status = LabRequestStatus.SampleCollected;
        lab.SampleCollectedAt = collectedAt;
        lab.CollectedByUserId = UserOf(Roles.LaboratoryStaff);

        var resultAt = collectedAt.AddMinutes(random.Next(90, 360));
        if (resultAt > now || (age < TimeSpan.FromHours(28) && Chance(0.4))) return;
        var (value, abnormal, notes) = Result(code, record.Diagnoses.FirstOrDefault()?.Code);
        lab.Status = LabRequestStatus.Completed;
        lab.ResultValue = value;
        lab.IsAbnormal = abnormal;
        lab.ResultNotes = notes;
        lab.ResultEnteredAt = resultAt;
        lab.ResultEnteredByUserId = lab.CollectedByUserId;
        charges.Add(new Charge
        {
            Patient = record.Patient,
            ChargeType = ChargeType.Laboratory,
            Description = test.Name,   // the request number is added once it is known (NumberEverythingAsync)
            Quantity = 1,
            UnitPrice = test.Price,
            Amount = test.Price,
            LabRequest = lab,
            CreatedAt = resultAt,
        });
    }

    private (string Value, bool Abnormal, string? Notes) Result(string code, string? diagnosis)
    {
        var dengue = diagnosis is "A90" or "A91";
        decimal Between(double from, double to, int decimals) => Math.Round((decimal)(from + random.NextDouble() * (to - from)), decimals);
        switch (code.ToUpperInvariant())
        {
            case "FBC-HB":
            {
                var v = diagnosis == "D50.9" ? Between(8.2, 10.8, 1) : Between(11.2, 15.6, 1);
                return (v.ToString("0.0"), v < 12.0m || v > 16.0m, v < 10m ? "Low haemoglobin. Iron studies suggested." : null);
            }
            case "FBC-WBC":
            {
                var v = dengue ? Between(2.1, 4.2, 1) : diagnosis is "J18.9" or "K35.8" ? Between(12.5, 18.0, 1) : Between(4.5, 10.5, 1);
                return (v.ToString("0.0"), v < 4.0m || v > 11.0m, null);
            }
            case "FBC-PLT":
            {
                var v = dengue ? random.Next(45, 140) : random.Next(160, 380);
                return (v.ToString(), v < 150, v < 100 ? "Platelets low. Repeat in 12 hours." : null);
            }
            case "FBS":
            {
                var v = diagnosis == "E11.9" ? random.Next(118, 190) : random.Next(78, 112);
                return (v.ToString(), v > 100, null);
            }
            case "HBA1C":
            {
                var v = Between(6.2, 9.4, 1);
                return (v.ToString("0.0"), v > 5.6m, null);
            }
            case "SCR":
            {
                var v = Between(0.7, 1.5, 2);
                return (v.ToString("0.00"), v > 1.2m, null);
            }
            case "CHOL":
            {
                var v = diagnosis is "E78.0" or "I20.9" ? random.Next(215, 290) : random.Next(150, 230);
                return (v.ToString(), v >= 200, null);
            }
            case "CRP":
            {
                var v = diagnosis is "J18.9" or "K35.8" ? random.Next(25, 140) : random.Next(1, 9);
                return (v.ToString(), v >= 5, null);
            }
            case "UFR":
                return diagnosis == "N39.0"
                    ? ("Pus cells 25-30 /hpf, RBC 4-6 /hpf, protein trace", true, "Suggest urine culture.")
                    : ("Pus cells 1-2 /hpf, RBC nil, protein nil", false, null);
            case "NS1":
                return dengue && Chance(0.7) ? ("Positive", true, "Dengue NS1 antigen detected.") : ("Negative", false, null);
            default:
                return ("Within normal limits", false, null);
        }
    }

    // ---------- Wards, beds and admissions ----------

    private async Task AddWardsAndAdmissionsAsync()
    {
        var existingNames = (await db.Wards.Select(w => w.Name).ToListAsync()).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var wards = new Dictionary<string, Ward>();
        foreach (var (name, type, daily, prefix, count) in Wards)
        {
            if (existingNames.Contains(name)) continue;   // never touch a ward the hospital already made
            var ward = new Ward
            {
                Name = name, WardType = type, DailyCharge = daily,
                Beds = Enumerable.Range(1, count).Select(i => new Bed { BedNumber = $"{prefix}{i:D2}", IsActive = true }).ToList(),
            };
            if (name == "Medical Ward (Male)") ward.Beds[^1].IsActive = false;   // one bed out of use (broken)
            db.Wards.Add(ward);
            wards[name] = ward;
        }
        if (wards.Count == 0) return;

        var busy = new Dictionary<Bed, List<(DateTime From, DateTime? To)>>();
        Bed? FreeBed(IEnumerable<string> wardNames, DateTime from, DateTime? to)
        {
            foreach (var wardName in wardNames)
            {
                if (!wards.TryGetValue(wardName, out var ward)) continue;
                foreach (var bed in ward.Beds.Where(b => b.IsActive).OrderBy(_ => random.Next()))
                {
                    var stays = busy.TryGetValue(bed, out var list) ? list : busy[bed] = [];
                    if (stays.Any(s => from < (s.To ?? DateTime.MaxValue) && s.From < (to ?? DateTime.MaxValue))) continue;
                    stays.Add((from, to));
                    return bed;
                }
            }
            return null;
        }

        string[] WardsFor(string group, Patient patient) => group switch
        {
            "paediatrics" => ["Paediatric Ward"],
            "obstetrics" => ["Maternity Ward", "Private Rooms"],
            "surgery" or "orthopaedics" => ["Surgical Ward", "Private Rooms"],
            "cardiology" => ["Intensive Care Unit", patient.Gender == Gender.Male ? "Medical Ward (Male)" : "Medical Ward (Female)"],
            _ => [patient.Gender == Gender.Male ? "Medical Ward (Male)" : "Medical Ward (Female)", "Private Rooms"],
        };

        var used = new HashSet<Patient>();
        Patient PatientFree(string group)
        {
            for (var tries = 0; ; tries++)
            {
                var candidate = group == "obstetrics"
                    ? PatientFor(group)
                    : group == "paediatrics" ? Pick(children)
                    : Pick(adults.Where(p => p.DateOfBirth < today.AddYears(-20)).ToList());
                if (used.Add(candidate) || tries > 50) return candidate;
            }
        }

        // 3 discharged stays in the last two weeks (dengue, gastroenteritis, pneumonia),
        // then 3 patients in hospital now (chest pain in ICU, labour, asthma). Indexes into AdmissionReasons.
        (int Reason, bool Current)[] stays = [(0, false), (5, false), (1, false), (3, true), (7, true), (8, true)];
        foreach (var (reasonIndex, current) in stays)
        {
            var reason = AdmissionReasons[reasonIndex];
            var doctorEntry = doctors.FirstOrDefault(x => x.Info.CaseGroup == reason.Group && x.Info.Department != "Emergency");
            if (doctorEntry.Doctor is null) continue;
            var patient = PatientFree(reason.Group);

            var admittedAt = current
                ? now.AddHours(-random.Next(4, 24 * 5))
                : now.AddDays(-random.Next(7, 14)).AddHours(-random.Next(0, 12));
            DateTime? dischargedAt = current ? null : admittedAt.AddHours(random.Next(30, 24 * 6));

            // One ICU patient moves to the ward after a day and a half (a bed transfer).
            var transfer = current && reason.Group == "cardiology";
            var wardNames = WardsFor(reason.Group, patient);
            Bed? firstBed = null;
            DateTime transferAt = admittedAt.AddHours(36);
            if (transfer && transferAt < now)
            {
                firstBed = FreeBed(["Intensive Care Unit"], admittedAt, transferAt);
                wardNames = wardNames.Where(w => w != "Intensive Care Unit").ToArray();
            }
            else transfer = false;
            var bed = FreeBed(wardNames, transfer ? transferAt : admittedAt, dischargedAt);
            if (bed is null) continue;

            var admission = new Admission
            {
                Patient = patient,
                Bed = bed,
                AdmittingDoctor = doctorEntry.Doctor,
                AdmittedAt = admittedAt,
                DischargedAt = dischargedAt,
                Status = current ? AdmissionStatus.Admitted : AdmissionStatus.Discharged,
                AdmissionReason = reason.Reason,
                DischargeSummary = current ? null :
                    $"Admitted with {reason.Diagnosis.ToLowerInvariant()}. Treated and improved. Stable on discharge. " +
                    "Clinic review in 2 weeks with the discharge card.",
            };
            if (transfer && firstBed is not null)
            {
                admission.BedTransfers.Add(new BedTransfer
                {
                    FromBed = firstBed, ToBed = bed, TransferredAt = transferAt,
                    Reason = "Stable, moved from ICU to the ward", TransferredByUserId = UserOf(Roles.Nurse),
                });
            }
            db.Admissions.Add(admission);
            admissions.Add(admission);

            // A ward-round note by the admitting doctor.
            db.MedicalRecords.Add(new MedicalRecord
            {
                Patient = patient,
                Doctor = doctorEntry.Doctor,
                Admission = admission,
                VisitDate = admittedAt.AddHours(2),
                ChiefComplaint = reason.Reason,
                ClinicalNotes = "Ward round. Plan explained to patient and family. Vitals to be monitored every 6 hours.",
                CreatedAt = admittedAt.AddHours(2),
                Diagnoses = [new Diagnosis { Code = reason.Code, Description = reason.Diagnosis, IsPrimary = true }],
                Treatments = [new Treatment { Description = "IV fluids and monitoring started", PerformedAt = admittedAt.AddHours(1) }],
            });

            // Vital signs every 6 hours (the last 12 readings at most).
            var end = dischargedAt ?? now;
            var times = new List<DateTime>();
            for (var t = admittedAt.AddMinutes(30); t < end; t = t.AddHours(6)) times.Add(t);
            foreach (var t in times.TakeLast(12))
            {
                var unwell = t < admittedAt.AddHours(24);
                db.VitalSigns.Add(new VitalSign
                {
                    Admission = admission,
                    RecordedAt = t,
                    TemperatureC = Math.Round((decimal)(unwell ? 37.6 + random.NextDouble() * 1.2 : 36.5 + random.NextDouble() * 0.7), 1),
                    PulseBpm = unwell ? random.Next(92, 112) : random.Next(70, 90),
                    SystolicBp = random.Next(108, 142),
                    DiastolicBp = random.Next(68, 92),
                    RespiratoryRate = unwell ? random.Next(18, 24) : random.Next(14, 18),
                    OxygenSaturation = unwell ? random.Next(93, 97) : random.Next(96, 100),
                    Notes = unwell && Chance(0.3) ? "Patient uncomfortable, doctor informed" : null,
                    RecordedByUserId = UserOf(Roles.Nurse),
                });
            }
        }
    }

    // ---------- Numbers (P-000001, LAB-000001, ADM-000001) from the database sequences ----------

    private async Task NumberEverythingAsync()
    {
        var allPatients = adults.Concat(children).ToList();

        // A patient was registered a little before their first appointment or admission.
        foreach (var patient in allPatients)
        {
            var first = appointments.Where(a => a.Patient == patient).Select(a => (DateTime?)a.CreatedAt).Min();
            var admitted = admissions.Where(a => a.Patient == patient).Select(a => (DateTime?)a.AdmittedAt).Min();
            var earliest = new[] { first, admitted }.Where(t => t is not null).Select(t => t!.Value).DefaultIfEmpty(now.AddDays(-random.Next(1, 90))).Min();
            patient.CreatedAt = earliest.AddDays(-random.Next(0, 60)).AddHours(-random.Next(1, 8));
        }

        var patientNumbers = await NextNumbersAsync("PatientNumbers", allPatients.Count);
        var p = 0;
        foreach (var patient in allPatients.OrderBy(x => x.CreatedAt)) patient.PatientNumber = $"P-{patientNumbers[p++]:D6}";

        var labNumbers = await NextNumbersAsync("LabRequestNumbers", labRequests.Count);
        var l = 0;
        var samples = 0;
        foreach (var lab in labRequests.OrderBy(x => x.RequestedAt))
        {
            lab.RequestNumber = $"LAB-{labNumbers[l++]:D6}";
            if (lab.SampleCollectedAt is not null) lab.SampleId = $"DS{HospitalTime.ToLocal(lab.SampleCollectedAt.Value):yyMMdd}-{++samples:D4}";
        }
        foreach (var charge in charges.Where(c => c.LabRequest is not null))
        {
            charge.Description = $"{charge.LabRequest!.LabTest.Name} ({charge.LabRequest.RequestNumber})";
        }

        var admissionNumbers = await NextNumbersAsync("AdmissionNumbers", admissions.Count);
        var a = 0;
        foreach (var admission in admissions.OrderBy(x => x.AdmittedAt))
        {
            admission.AdmissionNumber = $"ADM-{admissionNumbers[a++]:D6}";
            if (admission.DischargedAt is null) continue;

            // Bed charge on discharge: every started 24 hours is one bed-day (AdmissionService.DaysBetween).
            var days = AdmissionService.DaysBetween(admission.AdmittedAt, admission.DischargedAt.Value);
            var ward = admission.Bed.Ward;
            charges.Add(new Charge
            {
                Patient = admission.Patient,
                ChargeType = ChargeType.Admission,
                Description = $"Bed charge, {ward.Name}, {days} day{(days == 1 ? "" : "s")} ({admission.AdmissionNumber})",
                Quantity = days,
                UnitPrice = ward.DailyCharge,
                Amount = ward.DailyCharge * days,
                Admission = admission,
                CreatedAt = admission.DischargedAt.Value,
            });
        }
        db.Charges.AddRange(charges);
    }

    // ---------- Invoices and payments ----------

    private async Task BillAsync()
    {
        var plans = new List<(Invoice Invoice, List<Charge> Charges, decimal Paying, DateTime PaidAt)>();

        // One invoice per patient per day of charges. Charges older than three days are all billed;
        // the last few days are partly left in "Ready to bill" so the billing screen has work on it.
        foreach (var group in charges
                     .Where(c => c.CreatedAt < now.AddMinutes(-20))
                     .GroupBy(c => (c.Patient, Day: DateOnly.FromDateTime(HospitalTime.ToLocal(c.CreatedAt))))
                     .OrderBy(g => g.Max(c => c.CreatedAt)))
        {
            var day = group.Key.Day;
            var billChance = day < today.AddDays(-3) ? 1.0 : day < today ? 0.6 : 0.55;
            if (!Chance(billChance)) continue;

            var lines = group.ToList();
            var subtotal = lines.Sum(c => c.Amount);
            var discount = Chance(0.1) ? Math.Round(subtotal * 0.05m / 10m) * 10m : 0m;
            var issuedAt = Min(lines.Max(c => c.CreatedAt).AddMinutes(random.Next(5, 40)), now.AddMinutes(-5));
            var invoice = new Invoice
            {
                Patient = group.Key.Patient,
                IssuedAt = issuedAt,
                Status = InvoiceStatus.Issued,
                Subtotal = subtotal,
                Discount = discount,
                Total = subtotal - discount,
                CreatedByUserId = UserOf(Roles.Accountant),
            };

            var roll = random.NextDouble();
            var paying = roll < 0.8 ? invoice.Total : roll < 0.9 ? Math.Round(invoice.Total / 2m / 100m) * 100m : 0m;
            if (paying <= 0 && invoice.Total > 0 && day < today.AddDays(-20)) paying = invoice.Total;   // old ones are settled
            plans.Add((invoice, lines, Math.Min(paying, invoice.Total), Min(issuedAt.AddMinutes(random.Next(1, 15)), now.AddMinutes(-1))));
        }

        var invoiceNumbers = await NextNumbersAsync("InvoiceNumbers", plans.Count);
        var receiptNumbers = await NextNumbersAsync("ReceiptNumbers", plans.Count(x => x.Paying > 0));
        var i = 0;
        var r = 0;
        foreach (var (invoice, lines, paying, paidAt) in plans)
        {
            invoice.InvoiceNumber = $"INV-{invoiceNumbers[i++]:D6}";
            foreach (var charge in lines) charge.Invoice = invoice;
            if (invoice.Total == 0) invoice.Status = InvoiceStatus.Paid;
            if (paying > 0)
            {
                var method = random.NextDouble() switch { < 0.6 => PaymentMethod.Cash, < 0.9 => PaymentMethod.Card, _ => PaymentMethod.BankTransfer };
                invoice.Payments.Add(new Payment
                {
                    ReceiptNumber = $"RCP-{receiptNumbers[r++]:D6}",
                    Amount = paying,
                    Method = method,
                    ReferenceNumber = method switch
                    {
                        PaymentMethod.Card => $"Card ending {random.Next(1000, 9999)}",
                        PaymentMethod.BankTransfer => $"BOC-{random.Next(100000, 999999)}",
                        _ => null,
                    },
                    PaidAt = paidAt,
                    ReceivedByUserId = UserOf(Roles.Accountant),
                });
                invoice.AmountPaid = paying;
                invoice.Status = paying >= invoice.Total ? InvoiceStatus.Paid : InvoiceStatus.PartiallyPaid;
            }
            db.Invoices.Add(invoice);
        }
        await Task.CompletedTask;
    }

    // ---------- Attendance (last two weeks) and leave ----------

    private void AddAttendanceAndLeave()
    {
        var employees = doctors.Select(x => x.Doctor.Employee).Concat(staff.Select(x => x.Employee)).ToList();

        LeaveRequest Leave(Employee employee, LeaveType type, int fromDay, int toDay, LeaveStatus status, string reason, string? note = null)
        {
            var created = now.AddDays(Math.Min(fromDay, 0) - random.Next(3, 8));
            var leave = new LeaveRequest
            {
                Employee = employee, LeaveType = type, StartDate = today.AddDays(fromDay), EndDate = today.AddDays(toDay),
                Reason = reason, Status = status, RequestedByUserId = employee.UserId ?? adminUserId, CreatedAt = created,
                ReviewedByUserId = status is LeaveStatus.Approved or LeaveStatus.Rejected ? adminUserId : null,
                ReviewedAt = status is LeaveStatus.Approved or LeaveStatus.Rejected ? created.AddHours(random.Next(2, 30)) : null,
                ReviewNote = note,
            };
            db.LeaveRequests.Add(leave);
            leaveRequests.Add(leave);
            return leave;
        }

        Employee Staffer(string first) => staff.First(s => s.Info.FirstName == first).Employee;
        var leaves = new[]
        {
            Leave(Staffer("Malsha"), LeaveType.Annual, -6, -5, LeaveStatus.Approved, "Family wedding in Kandy", "Approved. Ward covered by Hiruni."),
            Leave(Staffer("Dinusha"), LeaveType.Sick, -12, -11, LeaveStatus.Approved, "Fever", "Get well soon."),
            Leave(Staffer("Lahiru"), LeaveType.Annual, -3, -1, LeaveStatus.Rejected, "Trip to Ella", "Two lab staff already on leave that week. Please choose other dates."),
            Leave(Staffer("Pradeep"), LeaveType.Casual, 5, 5, LeaveStatus.Pending, "Child's school sports meet"),
            Leave(Staffer("Kavindu"), LeaveType.Annual, 10, 12, LeaveStatus.Pending, "Pilgrimage to Anuradhapura"),
            Leave(doctors[2].Doctor.Employee, LeaveType.Annual, 18, 20, LeaveStatus.Pending, "Attending a paediatrics conference in Colombo"),
        };

        var localNow = HospitalTime.ToLocal(now);
        foreach (var employee in employees)
        {
            for (var date = today.AddDays(-14); date <= today; date = date.AddDays(1))
            {
                if (date.DayOfWeek == DayOfWeek.Sunday) continue;
                if (date == today && localNow.Hour < 9) continue;

                var onLeave = leaves.Any(lv => lv.Employee == employee && lv.Status == LeaveStatus.Approved && date >= lv.StartDate && date <= lv.EndDate);
                var roll = random.NextDouble();
                var status = onLeave ? AttendanceStatus.OnLeave : roll < 0.03 ? AttendanceStatus.Absent : roll < 0.12 ? AttendanceStatus.Late : AttendanceStatus.Present;
                TimeOnly? checkIn = status switch
                {
                    AttendanceStatus.Present => new TimeOnly(7, 40).AddMinutes(random.Next(0, 35)),
                    AttendanceStatus.Late => new TimeOnly(8, 20).AddMinutes(random.Next(0, 50)),
                    _ => null,
                };
                TimeOnly? checkOut = checkIn is null || date == today ? null : new TimeOnly(16, 0).AddMinutes(random.Next(0, 90));
                db.Attendance.Add(new AttendanceRecord
                {
                    Employee = employee, Date = date, Status = status, CheckIn = checkIn, CheckOut = checkOut,
                    RecordedByUserId = adminUserId,
                });
            }
        }
    }

    // ---------- Notifications under the bell ----------

    private async Task AddNotificationsAsync()
    {
        string Label(Patient p) => $"{p.FirstName} {p.LastName} ({p.PatientNumber})";

        void Send(IEnumerable<string?> userIds, string title, string message, string link, DateTime at, bool read)
        {
            foreach (var userId in userIds.Where(u => u is not null).Distinct())
            {
                db.Notifications.Add(new Notification
                {
                    UserId = userId!, Title = title, Message = message, Link = link, CreatedAt = at,
                    ReadAt = read ? Min(at.AddMinutes(random.Next(5, 120)), now) : null,
                });
            }
        }

        // Doctors: their latest lab results, today's bookings, their admitted patients.
        foreach (var (_, doctor, userId) in doctors.Where(d => d.UserId is not null))
        {
            foreach (var lab in labRequests.Where(x => x.RequestedByDoctor == doctor && x.Status == LabRequestStatus.Completed)
                         .OrderByDescending(x => x.ResultEnteredAt).Take(5))
            {
                Send([userId], "Lab result ready",
                    $"{lab.LabTest.Name} ({lab.RequestNumber}) for {Label(lab.Patient)}" + (lab.IsAbnormal == true ? ", marked abnormal." : "."),
                    $"/laboratory/requests/{lab.Id}", lab.ResultEnteredAt!.Value, read: lab.ResultEnteredAt < now.AddHours(-20));
            }
            foreach (var appointment in appointments.Where(x => x.Doctor == doctor && x.Status == AppointmentStatus.Scheduled && x.CreatedAt > now.AddDays(-2))
                         .OrderByDescending(x => x.CreatedAt).Take(3))
            {
                Send([userId], "New appointment", $"{Label(appointment.Patient)} on {HospitalTime.Describe(appointment.StartTime)}.",
                    $"/appointments/{appointment.Id}", appointment.CreatedAt, read: false);
            }
            foreach (var admission in admissions.Where(x => x.AdmittingDoctor == doctor && x.DischargedAt is null))
            {
                Send([userId], "Patient admitted", $"{Label(admission.Patient)} admitted to {admission.Bed.Ward.Name}, bed {admission.Bed.BedNumber}.",
                    $"/admissions/{admission.Id}", admission.AdmittedAt, read: admission.AdmittedAt < now.AddHours(-12));
            }
        }

        // Nurses: patients admitted to the wards.
        foreach (var admission in admissions.Where(x => x.DischargedAt is null))
        {
            Send(UsersOf(Roles.Nurse), "Patient admitted",
                $"{Label(admission.Patient)} admitted to {admission.Bed.Ward.Name}, bed {admission.Bed.BedNumber}.",
                $"/admissions/{admission.Id}", admission.AdmittedAt, read: admission.AdmittedAt < now.AddHours(-12));
        }

        // Laboratory: requests still waiting for a sample.
        foreach (var group in labRequests.Where(x => x.Status == LabRequestStatus.Requested)
                     .GroupBy(x => (x.Patient, x.RequestedAt)).OrderByDescending(g => g.Key.RequestedAt).Take(8))
        {
            Send(UsersOf(Roles.LaboratoryStaff), "New lab request", $"{group.Count()} test(s) requested for {Label(group.Key.Patient)}.",
                "/laboratory", group.Key.RequestedAt, read: false);
        }

        // Pharmacy: prescriptions waiting, and medicines below their reorder level.
        foreach (var prescription in prescriptions.Where(x => x.Status == PrescriptionStatus.Pending).OrderByDescending(x => x.PrescribedAt).Take(8))
        {
            var doctor = prescription.MedicalRecord.Doctor.Employee;
            Send(UsersOf(Roles.Pharmacist), "New prescription",
                $"{Label(prescription.MedicalRecord.Patient)}, {prescription.Items.Count} medicine(s), from Dr {doctor.FirstName} {doctor.LastName}.",
                $"/pharmacy/prescriptions/{prescription.Id}", prescription.PrescribedAt, read: false);
        }
        var today0 = today;
        foreach (var medicine in medicines.Values.Where(m => m.IsActive))
        {
            var left = batches.Where(b => b.Medicine == medicine && b.ExpiryDate > today0).Sum(b => b.QuantityOnHand);
            if (left >= medicine.ReorderLevel) continue;
            Send(UsersOf(Roles.Pharmacist), "Low stock",
                $"{medicine.Name} {medicine.Strength}: {left} left after dispensing, below the reorder level of {medicine.ReorderLevel}.",
                $"/pharmacy/medicines/{medicine.Id}", now.AddHours(-random.Next(2, 20)), read: false);
        }

        // Administrators: leave requests to review.
        var admins = (await userManager.GetUsersInRoleAsync(Roles.Administrator)).Where(u => u.IsActive).Select(u => (string?)u.Id).ToList();
        foreach (var leave in leaveRequests.Where(x => x.Status == LeaveStatus.Pending))
        {
            var days = leave.StartDate == leave.EndDate ? $"{leave.StartDate:d MMM}" : $"{leave.StartDate:d MMM} to {leave.EndDate:d MMM}";
            Send(admins, "Leave request to review", $"{leave.Employee.FirstName} {leave.Employee.LastName}: {leave.LeaveType} leave, {days}.",
                "/staff?tab=leave", leave.CreatedAt, read: false);
        }
    }
}
