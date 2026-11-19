namespace Hms.Api.Entities;

// Enums are stored as text in PostgreSQL (see AppDbContext.ConfigureConventions),
// so a row shows "Scheduled" instead of a meaningless number like 0.

public enum Gender { Male, Female, Other }

public enum AppointmentStatus { Scheduled, CheckedIn, Completed, Cancelled, NoShow, Rescheduled }

public enum PrescriptionStatus { Pending, PartiallyDispensed, Dispensed, Cancelled }

public enum AdmissionStatus { Admitted, Discharged }

public enum LabRequestStatus { Requested, SampleCollected, Completed, Cancelled }

public enum StockMovementType { StockIn, Dispense, Adjustment, Expired }

public enum ChargeType { Consultation, Laboratory, Pharmacy, Admission }

public enum InvoiceStatus { Draft, Issued, PartiallyPaid, Paid, Cancelled }

public enum PaymentMethod { Cash, Card, BankTransfer }

public enum AttendanceStatus { Present, Absent, Late, OnLeave }

public enum LeaveType { Annual, Sick, Casual, Other }

public enum LeaveStatus { Pending, Approved, Rejected }

public enum AuditAction { Login, LoginFailed, Logout, Create, Update, Delete, View }
