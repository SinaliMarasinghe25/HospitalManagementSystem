using Hms.Api.Data;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Services;

// PDF 3.2 "Upload Documents". Files are stored on disk OUTSIDE the web root, under random names,
// so nobody can open them by guessing a URL; they are only served through the API after a role check.
public class PatientDocumentService(AppDbContext db, IConfiguration configuration, IWebHostEnvironment environment)
{
    public const long MaxFileBytes = 5 * 1024 * 1024; // 5 MB (assumption A6)

    // Allowed types, checked by extension AND by the file's first bytes ("magic number"),
    // because a renamed .exe could otherwise pretend to be a .pdf.
    private static readonly Dictionary<string, (string ContentType, byte[] Signature)> Allowed = new()
    {
        [".pdf"] = ("application/pdf", "%PDF"u8.ToArray()),
        [".png"] = ("image/png", [0x89, 0x50, 0x4E, 0x47]),
        [".jpg"] = ("image/jpeg", [0xFF, 0xD8, 0xFF]),
        [".jpeg"] = ("image/jpeg", [0xFF, 0xD8, 0xFF]),
    };

    private string StorageFolder =>
        Path.GetFullPath(Path.Combine(environment.ContentRootPath,
            configuration["Storage:PatientDocumentsPath"] ?? "App_Data/patient-documents"));

    public async Task<List<PatientDocumentResponse>> ListAsync(int patientId) =>
        await db.PatientDocuments.AsNoTracking()
            .Where(d => d.PatientId == patientId)
            .OrderByDescending(d => d.UploadedAt)
            .Select(d => new PatientDocumentResponse(d.Id, d.FileName, d.ContentType, d.SizeBytes, d.Description, d.UploadedAt))
            .ToListAsync();

    public async Task<ServiceResult<PatientDocumentResponse>> UploadAsync(
        int patientId, IFormFile file, string? description, string? userId)
    {
        if (!await db.Patients.AnyAsync(p => p.Id == patientId))
        {
            return ServiceResult<PatientDocumentResponse>.NotFound();
        }

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (file.Length == 0 || file.Length > MaxFileBytes)
        {
            return Invalid("The file must be between 1 byte and 5 MB.");
        }
        if (!Allowed.TryGetValue(extension, out var type))
        {
            return Invalid("Only PDF, JPG and PNG files are allowed.");
        }

        var header = new byte[type.Signature.Length];
        await using (var stream = file.OpenReadStream())
        {
            var read = await stream.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false);
            if (read < header.Length || !header.SequenceEqual(type.Signature))
            {
                return Invalid("The file content does not match its type.");
            }
        }

        Directory.CreateDirectory(StorageFolder);
        var storedName = $"{Guid.NewGuid():N}{extension}";
        await using (var target = File.Create(Path.Combine(StorageFolder, storedName)))
        {
            await file.CopyToAsync(target);
        }

        var document = new PatientDocument
        {
            PatientId = patientId,
            // Keep only the file name part; never trust a path sent by the browser.
            FileName = Path.GetFileName(file.FileName),
            StoredFileName = storedName,
            ContentType = type.ContentType,
            SizeBytes = file.Length,
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            UploadedByUserId = userId,
            UploadedAt = DateTime.UtcNow,
        };
        db.PatientDocuments.Add(document);
        await db.SaveChangesAsync();

        return ServiceResult<PatientDocumentResponse>.Ok(new PatientDocumentResponse(
            document.Id, document.FileName, document.ContentType, document.SizeBytes, document.Description, document.UploadedAt));
    }

    public async Task<(PatientDocument Document, Stream Content)?> OpenAsync(int patientId, int documentId)
    {
        var document = await db.PatientDocuments.AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == documentId && d.PatientId == patientId);
        if (document is null)
        {
            return null;
        }

        var path = Path.Combine(StorageFolder, document.StoredFileName);
        if (!File.Exists(path))
        {
            return null;
        }
        return (document, File.OpenRead(path));
    }

    private static ServiceResult<PatientDocumentResponse> Invalid(string message) =>
        ServiceResult<PatientDocumentResponse>.Invalid(new() { ["file"] = [message] });
}
