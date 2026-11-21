using Microsoft.AspNetCore.Authorization;

namespace Hms.Api.Authorization;

// Named permissions, from the role table in the project plan (section 4).
// Controllers say [Authorize(Policy = Policies.EditPatients)] instead of listing roles everywhere,
// so a permission change is made in one place.
public static class Policies
{
    public const string ViewPatients = nameof(ViewPatients);
    public const string EditPatients = nameof(EditPatients);
    public const string ViewMedicalHistory = nameof(ViewMedicalHistory);
    public const string ViewPatientDocuments = nameof(ViewPatientDocuments);
    public const string UploadPatientDocuments = nameof(UploadPatientDocuments);
    public const string ViewDoctors = nameof(ViewDoctors);
    public const string ManageDoctors = nameof(ManageDoctors);
    public const string ViewAppointments = nameof(ViewAppointments);
    public const string BookAppointments = nameof(BookAppointments);
    public const string UpdateAppointmentStatus = nameof(UpdateAppointmentStatus);
    public const string EditMedicalRecords = nameof(EditMedicalRecords);
    public const string ViewPrescriptions = nameof(ViewPrescriptions);
    public const string ViewAdmissions = nameof(ViewAdmissions);
    public const string AdmitPatients = nameof(AdmitPatients);
    public const string TransferPatients = nameof(TransferPatients);
    public const string RecordVitals = nameof(RecordVitals);
    public const string DischargePatients = nameof(DischargePatients);
    public const string ManageWards = nameof(ManageWards);
    public const string ViewLabRequests = nameof(ViewLabRequests);
    public const string RequestLabTests = nameof(RequestLabTests);
    public const string ProcessLabRequests = nameof(ProcessLabRequests);
    public const string ManageLabTests = nameof(ManageLabTests);
    public const string ViewPharmacyStock = nameof(ViewPharmacyStock);
    public const string ManagePharmacyStock = nameof(ManagePharmacyStock);
    public const string DispenseMedicines = nameof(DispenseMedicines);
    public const string EditMedicinePrices = nameof(EditMedicinePrices);
    public const string ViewInvoiceBalances = nameof(ViewInvoiceBalances);
    public const string ViewInvoiceDetails = nameof(ViewInvoiceDetails);
    public const string ManageBilling = nameof(ManageBilling);
    public const string ViewRevenue = nameof(ViewRevenue);
    public const string ManageStaff = nameof(ManageStaff);
    public const string ViewPatientReport = nameof(ViewPatientReport);
    public const string ViewAppointmentReport = nameof(ViewAppointmentReport);
    public const string ViewPharmacyReport = nameof(ViewPharmacyReport);
    public const string ViewLabReport = nameof(ViewLabReport);

    public static AuthorizationBuilder AddHmsPolicies(this AuthorizationBuilder builder) => builder
        .AddPolicy(ViewPatients, p => p.RequireRole(Roles.Administrator, Roles.Doctor, Roles.Nurse, Roles.Receptionist))
        .AddPolicy(EditPatients, p => p.RequireRole(Roles.Administrator, Roles.Receptionist))
        .AddPolicy(ViewMedicalHistory, p => p.RequireRole(Roles.Administrator, Roles.Doctor, Roles.Nurse))
        .AddPolicy(ViewPatientDocuments, p => p.RequireRole(Roles.Administrator, Roles.Doctor, Roles.Nurse, Roles.Receptionist))
        .AddPolicy(UploadPatientDocuments, p => p.RequireRole(Roles.Administrator, Roles.Doctor, Roles.Receptionist))
        .AddPolicy(ViewDoctors, p => p.RequireRole(Roles.Administrator, Roles.Doctor, Roles.Nurse, Roles.Receptionist))
        .AddPolicy(ManageDoctors, p => p.RequireRole(Roles.Administrator))
        // Appointments row of the role table: Admin full, Doctor own (status), Nurse view, Receptionist book/cancel/reschedule.
        .AddPolicy(ViewAppointments, p => p.RequireRole(Roles.Administrator, Roles.Doctor, Roles.Nurse, Roles.Receptionist))
        .AddPolicy(BookAppointments, p => p.RequireRole(Roles.Administrator, Roles.Receptionist))
        .AddPolicy(UpdateAppointmentStatus, p => p.RequireRole(Roles.Administrator, Roles.Doctor, Roles.Receptionist))
        // Medical history, diagnoses, treatments: Doctor edits; Admin and Nurse view (ViewMedicalHistory).
        .AddPolicy(EditMedicalRecords, p => p.RequireRole(Roles.Doctor))
        // Prescriptions: Doctor edits; Admin, Nurse and Pharmacist view.
        .AddPolicy(ViewPrescriptions, p => p.RequireRole(Roles.Administrator, Roles.Doctor, Roles.Nurse, Roles.Pharmacist))
        // Admissions, wards, beds: Admin full; Doctor edit; Nurse vitals, notes, transfers; Receptionist admit.
        .AddPolicy(ViewAdmissions, p => p.RequireRole(Roles.Administrator, Roles.Doctor, Roles.Nurse, Roles.Receptionist))
        .AddPolicy(AdmitPatients, p => p.RequireRole(Roles.Administrator, Roles.Doctor, Roles.Receptionist))
        .AddPolicy(TransferPatients, p => p.RequireRole(Roles.Administrator, Roles.Doctor, Roles.Nurse))
        .AddPolicy(RecordVitals, p => p.RequireRole(Roles.Administrator, Roles.Doctor, Roles.Nurse))
        .AddPolicy(DischargePatients, p => p.RequireRole(Roles.Administrator, Roles.Doctor))
        .AddPolicy(ManageWards, p => p.RequireRole(Roles.Administrator))
        // Lab requests: Admin and Nurse view; Doctor requests and views results; Lab Staff collect and enter results.
        .AddPolicy(ViewLabRequests, p => p.RequireRole(Roles.Administrator, Roles.Doctor, Roles.Nurse, Roles.LaboratoryStaff))
        .AddPolicy(RequestLabTests, p => p.RequireRole(Roles.Doctor))
        .AddPolicy(ProcessLabRequests, p => p.RequireRole(Roles.LaboratoryStaff))
        // Assumption A9: prices are admin-managed fee lists.
        .AddPolicy(ManageLabTests, p => p.RequireRole(Roles.Administrator))
        // Pharmacy stock and dispensing: Pharmacist full; Admin view; Doctor view (stock only, no cost prices);
        // Accountant view (stock value). Fees row: Admin full, Pharmacist and Accountant edit medicine prices.
        .AddPolicy(ViewPharmacyStock, p => p.RequireRole(Roles.Administrator, Roles.Doctor, Roles.Pharmacist, Roles.Accountant))
        .AddPolicy(ManagePharmacyStock, p => p.RequireRole(Roles.Pharmacist))
        .AddPolicy(DispenseMedicines, p => p.RequireRole(Roles.Pharmacist))
        .AddPolicy(EditMedicinePrices, p => p.RequireRole(Roles.Administrator, Roles.Pharmacist, Roles.Accountant))
        // Invoices and payments: Accountant full; Admin view; Receptionist view (balance due only, no line items).
        .AddPolicy(ViewInvoiceBalances, p => p.RequireRole(Roles.Administrator, Roles.Receptionist, Roles.Accountant))
        .AddPolicy(ViewInvoiceDetails, p => p.RequireRole(Roles.Administrator, Roles.Accountant))
        .AddPolicy(ManageBilling, p => p.RequireRole(Roles.Accountant))
        // Dashboard tile "Revenue Summary": Admin and Accountant only (UI-DSH-03).
        .AddPolicy(ViewRevenue, p => p.RequireRole(Roles.Administrator, Roles.Accountant))
        // Staff, attendance, leave: Admin full. Every role manages its own leave, which needs only a login.
        .AddPolicy(ManageStaff, p => p.RequireRole(Roles.Administrator))
        // Reports row of the role table. The revenue report uses ViewRevenue (Admin, Accountant)
        // and the staff report uses ManageStaff (Admin), because those rows have exactly the same roles.
        .AddPolicy(ViewPatientReport, p => p.RequireRole(Roles.Administrator, Roles.Doctor, Roles.Nurse))
        .AddPolicy(ViewAppointmentReport, p => p.RequireRole(Roles.Administrator, Roles.Doctor, Roles.Receptionist))
        .AddPolicy(ViewPharmacyReport, p => p.RequireRole(Roles.Administrator, Roles.Pharmacist))
        .AddPolicy(ViewLabReport, p => p.RequireRole(Roles.Administrator, Roles.Doctor, Roles.LaboratoryStaff));
}
