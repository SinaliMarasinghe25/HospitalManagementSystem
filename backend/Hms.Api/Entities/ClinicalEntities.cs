using System.ComponentModel.DataAnnotations;

namespace Hms.Api.Entities;

// ---------- Medical records (PDF section 6: Medical Records) ----------
public class MedicalRecord
{
    public int Id { get; set; }

    public int PatientId { get; set; }
    public Patient Patient { get; set; } = null!;

    public int DoctorId { get; set; }
    public Doctor Doctor { get; set; } = null!;

    // Set for an outpatient visit.
    public int? AppointmentId { get; set; }
    public Appointment? Appointment { get; set; }

    // Set for notes written during an admission.
    public int? AdmissionId { get; set; }
    public Admission? Admission { get; set; }

    public DateTime VisitDate { get; set; }

    [MaxLength(500)]
    public string? ChiefComplaint { get; set; }

    public string? ClinicalNotes { get; set; }

    public DateTime CreatedAt { get; set; }

    public List<Diagnosis> Diagnoses { get; set; } = [];
    public List<Treatment> Treatments { get; set; } = [];
    public List<Prescription> Prescriptions { get; set; } = [];
}

public class Diagnosis
{
    public int Id { get; set; }

    public int MedicalRecordId { get; set; }
    public MedicalRecord MedicalRecord { get; set; } = null!;

    [MaxLength(10)]
    public string? Code { get; set; }

    [MaxLength(500)]
    public string Description { get; set; } = string.Empty;

    public bool IsPrimary { get; set; }
}

public class Treatment
{
    public int Id { get; set; }

    public int MedicalRecordId { get; set; }
    public MedicalRecord MedicalRecord { get; set; } = null!;

    [MaxLength(1000)]
    public string Description { get; set; } = string.Empty;

    public DateTime? PerformedAt { get; set; }
}

public class Prescription
{
    public int Id { get; set; }

    public int MedicalRecordId { get; set; }
    public MedicalRecord MedicalRecord { get; set; } = null!;

    public DateTime PrescribedAt { get; set; }

    public PrescriptionStatus Status { get; set; } = PrescriptionStatus.Pending;

    public List<PrescriptionItem> Items { get; set; } = [];
}

public class PrescriptionItem
{
    public int Id { get; set; }

    public int PrescriptionId { get; set; }
    public Prescription Prescription { get; set; } = null!;

    public int MedicineId { get; set; }
    public Medicine Medicine { get; set; } = null!;

    [MaxLength(50)]
    public string Dosage { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Frequency { get; set; } = string.Empty;

    public int DurationDays { get; set; }
    public int Quantity { get; set; }
    public int QuantityDispensed { get; set; }

    [MaxLength(300)]
    public string? Instructions { get; set; }
}

// ---------- Inpatient care (PDF section 6: Admissions; assumptions A1, A3) ----------
public class Ward
{
    public int Id { get; set; }

    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(50)]
    public string WardType { get; set; } = string.Empty;

    // Bed charge per day for every bed in this ward.
    public decimal DailyCharge { get; set; }

    public List<Bed> Beds { get; set; } = [];
}

public class Bed
{
    public int Id { get; set; }

    public int WardId { get; set; }
    public Ward Ward { get; set; } = null!;

    [MaxLength(20)]
    public string BedNumber { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;
}

public class Admission
{
    public int Id { get; set; }

    [MaxLength(20)]
    public string AdmissionNumber { get; set; } = string.Empty;

    public int PatientId { get; set; }
    public Patient Patient { get; set; } = null!;

    public int BedId { get; set; }
    public Bed Bed { get; set; } = null!;

    public int AdmittingDoctorId { get; set; }
    public Doctor AdmittingDoctor { get; set; } = null!;

    public DateTime AdmittedAt { get; set; }

    // Null while the patient is still in hospital.
    public DateTime? DischargedAt { get; set; }

    public AdmissionStatus Status { get; set; } = AdmissionStatus.Admitted;

    [MaxLength(500)]
    public string? AdmissionReason { get; set; }

    public string? DischargeSummary { get; set; }

    public List<VitalSign> VitalSigns { get; set; } = [];
}

public class VitalSign
{
    public int Id { get; set; }

    public int AdmissionId { get; set; }
    public Admission Admission { get; set; } = null!;

    public DateTime RecordedAt { get; set; }

    public decimal? TemperatureC { get; set; }
    public int? PulseBpm { get; set; }
    public int? SystolicBp { get; set; }
    public int? DiastolicBp { get; set; }
    public int? RespiratoryRate { get; set; }
    public int? OxygenSaturation { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    public string? RecordedByUserId { get; set; }
}
