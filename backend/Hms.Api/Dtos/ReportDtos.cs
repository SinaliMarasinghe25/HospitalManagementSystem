using Hms.Api.Entities;

namespace Hms.Api.Dtos;

// PDF 3.10 Reports (FR-RP-01 to 06). Every report has summary tables, worked out by the database over the
// whole period, and a detail list for printing and CSV export. The detail list stops at
// ReportService.MaxDetailRows rows; DetailTruncated then says so. The summary totals are always complete.

// The period a report covers: hospital days, both inclusive.
public record ReportPeriod(DateOnly From, DateOnly To);

// One line of a "how many of each" table, e.g. ("Female", 12).
public record CountRow(string Label, int Count);

// ---------- FR-RP-01 Patient reports: registrations by date range ----------
public record PatientReport(
    ReportPeriod Period,
    int TotalRegistered,
    IReadOnlyList<CountRow> ByDay,
    IReadOnlyList<CountRow> ByGender,
    IReadOnlyList<CountRow> ByAgeGroup,
    IReadOnlyList<PatientReportRow> Patients,
    bool DetailTruncated);

public record PatientReportRow(
    int Id, string PatientNumber, string FullName, Gender Gender, DateOnly DateOfBirth, string Phone, DateTime RegisteredAt);

// ---------- FR-RP-02 Appointment reports: by doctor, status and date range ----------
public record AppointmentReport(
    ReportPeriod Period,
    int Total,
    IReadOnlyList<CountRow> ByStatus,
    IReadOnlyList<DoctorAppointmentRow> ByDoctor,
    IReadOnlyList<AppointmentReportRow> Appointments,
    bool DetailTruncated);

public record DoctorAppointmentRow(
    int DoctorId, string DoctorName, string Specialization, int Total, int Completed, int Cancelled, int NoShow, int Open);

public record AppointmentReportRow(
    int Id, DateTime StartTime, string PatientNumber, string PatientName, string DoctorName, AppointmentStatus Status);

// ---------- FR-RP-03 Revenue reports: revenue by source and date range ----------
// Billed = invoices issued in the period (cancelled invoices left out), split by where the charges came from.
// Collected = payments received in the period. Its total is exactly the sum of those payments.
public record RevenueReport(
    ReportPeriod Period,
    IReadOnlyList<RevenueSourceRow> BySource,
    decimal BilledSubtotal,
    decimal Discounts,
    decimal BilledTotal,
    int InvoiceCount,
    IReadOnlyList<PaymentMethodRow> ByMethod,
    decimal Collected,
    IReadOnlyList<DailyRevenueRow> ByDay,
    decimal OutstandingNow,
    IReadOnlyList<RevenuePaymentRow> Payments,
    bool DetailTruncated);

public record RevenueSourceRow(ChargeType Source, int Charges, decimal Amount);

public record PaymentMethodRow(PaymentMethod Method, int Payments, decimal Amount);

public record DailyRevenueRow(DateOnly Date, decimal Billed, decimal Collected);

public record RevenuePaymentRow(
    int Id, string ReceiptNumber, DateTime PaidAt, int InvoiceId, string InvoiceNumber, string PatientNumber,
    string PatientName, PaymentMethod Method, decimal Amount);

// ---------- FR-RP-04 Pharmacy reports: stock levels, low stock, near expiry, dispensed items ----------
public record PharmacyReport(
    ReportPeriod Period,
    int NearExpiryDays,
    IReadOnlyList<MedicineStockResponse> Stock,
    decimal StockValue,
    IReadOnlyList<MedicineStockResponse> LowStock,
    IReadOnlyList<AlertBatch> NearExpiry,
    IReadOnlyList<AlertBatch> Expired,
    IReadOnlyList<DispensedRow> Dispensed,
    int DispensedQuantity,
    decimal DispensedAmount);

public record DispensedRow(int MedicineId, string Name, string Strength, string Form, int Quantity, decimal Amount);

// ---------- FR-RP-05 Laboratory reports: tests by type, status and date range ----------
public record LabReport(
    ReportPeriod Period,
    int Total,
    IReadOnlyList<CountRow> ByStatus,
    IReadOnlyList<LabTestCountRow> ByTest,
    IReadOnlyList<LabReportRow> Requests,
    bool DetailTruncated);

public record LabTestCountRow(
    int LabTestId, string Code, string Name, int Total, int Waiting, int Completed, int Abnormal, int Cancelled);

public record LabReportRow(
    int Id, string RequestNumber, DateTime RequestedAt, string PatientNumber, string PatientName, string TestName,
    string DoctorName, LabRequestStatus Status, bool? IsAbnormal);

// ---------- FR-RP-06 Staff reports: attendance and leave by employee and month ----------
public record StaffReport(
    int Year,
    int Month,
    int DaysInMonth,
    IReadOnlyList<StaffMonthRow> Employees,
    IReadOnlyList<StaffLeaveRow> Leave);

// Present ... OnLeave count the attendance rows of the month. LeaveDays counts approved leave days in the month.
public record StaffMonthRow(
    int EmployeeId, string EmployeeNumber, string FullName, string JobTitle, string DepartmentName,
    int Present, int Late, int Absent, int OnLeave, int DaysRecorded, int LeaveDays, int PendingLeaveRequests);

// Leave requests that overlap the month. DaysInMonth is the part of the leave inside the month.
public record StaffLeaveRow(
    int Id, int EmployeeId, string EmployeeNumber, string FullName, LeaveType LeaveType, DateOnly StartDate, DateOnly EndDate,
    int DaysInMonth, LeaveStatus Status);
