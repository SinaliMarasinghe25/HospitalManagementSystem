using System.ComponentModel.DataAnnotations;

namespace Hms.Api.Entities;

// ---------- Patients (PDF section 6: Patients) ----------
public class Patient
{
    public int Id { get; set; }

    [MaxLength(20)]
    public string PatientNumber { get; set; } = string.Empty;

    [MaxLength(100)]
    public string FirstName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string LastName { get; set; } = string.Empty;

    public DateOnly DateOfBirth { get; set; }

    public Gender Gender { get; set; }

    [MaxLength(20)]
    public string? NationalId { get; set; }

    [MaxLength(20)]
    public string Phone { get; set; } = string.Empty;

    [MaxLength(256)]
    public string? Email { get; set; }

    [MaxLength(300)]
    public string? Address { get; set; }

    [MaxLength(5)]
    public string? BloodGroup { get; set; }

    [MaxLength(500)]
    public string? Allergies { get; set; }

    [MaxLength(200)]
    public string? EmergencyContactName { get; set; }

    [MaxLength(20)]
    public string? EmergencyContactPhone { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public List<PatientDocument> Documents { get; set; } = [];
    public List<Appointment> Appointments { get; set; } = [];
}

public class PatientDocument
{
    public int Id { get; set; }

    public int PatientId { get; set; }
    public Patient Patient { get; set; } = null!;

    // The name the user uploaded, shown in the UI.
    [MaxLength(255)]
    public string FileName { get; set; } = string.Empty;

    // A random name used on disk, so files cannot overwrite or guess each other.
    [MaxLength(100)]
    public string StoredFileName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string ContentType { get; set; } = string.Empty;

    public long SizeBytes { get; set; }

    [MaxLength(300)]
    public string? Description { get; set; }

    public string? UploadedByUserId { get; set; }
    public DateTime UploadedAt { get; set; }
}

// ---------- Appointments (PDF section 6: Appointments) ----------
public class Appointment
{
    public int Id { get; set; }

    public int PatientId { get; set; }
    public Patient Patient { get; set; } = null!;

    public int DoctorId { get; set; }
    public Doctor Doctor { get; set; } = null!;

    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }

    public AppointmentStatus Status { get; set; } = AppointmentStatus.Scheduled;

    [MaxLength(500)]
    public string? Reason { get; set; }

    [MaxLength(500)]
    public string? CancellationReason { get; set; }

    // Points to the appointment this one replaced, so history is kept.
    public int? RescheduledFromId { get; set; }
    public Appointment? RescheduledFrom { get; set; }

    public string? CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
}
