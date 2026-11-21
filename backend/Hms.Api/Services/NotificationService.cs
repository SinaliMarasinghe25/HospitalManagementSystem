using System.Security.Claims;
using Hms.Api.Data;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Services;

// In-app notifications (assumption A27, proposed): the bell in the header.
//
// Each business service calls ONE of the Send... methods after its action has been saved,
// so every event is announced from exactly one place (for example LabService.EnterResultAsync).
// Rules:
// - The person who did the action is not told about it: they already know.
// - Inactive logins get nothing, and nobody gets the same unread message twice.
// - A message holds only what its readers' roles may already see (role table, plan section 4).
//   The link opens the page, and that page checks permissions as usual.
public class NotificationService(AppDbContext db, IHttpContextAccessor httpContextAccessor)
{
    public const int ListSize = 20;

    // ---------- Sending ----------

    public Task SendToUserAsync(string? userId, string title, string message, string? link) =>
        SendAsync(userId is null ? [] : [userId], title, message, link);

    // The doctor's login, found through doctor -> employee -> login.
    public async Task SendToDoctorAsync(int doctorId, string title, string message, string? link)
    {
        var userId = await db.Doctors.Where(d => d.Id == doctorId).Select(d => d.Employee.UserId).FirstOrDefaultAsync();
        await SendToUserAsync(userId, title, message, link);
    }

    // Everyone with this role, e.g. every pharmacist for a new prescription.
    // includeMe: also tell the person whose action caused it. Used for alerts about a state they may not
    // have noticed (low stock), rather than for the action itself.
    public async Task SendToRoleAsync(string role, string title, string message, string? link, bool includeMe = false)
    {
        var userIds = await db.UserRoles
            .Where(ur => db.Roles.Any(r => r.Id == ur.RoleId && r.Name == role))
            .Select(ur => ur.UserId)
            .ToListAsync();
        await SendAsync(userIds, title, message, link, includeMe);
    }

    // How a patient is named in a notification: "Nimal Perera (P-000012)".
    public async Task<string> PatientLabelAsync(int patientId) =>
        await db.Patients.Where(p => p.Id == patientId)
            .Select(p => p.FirstName + " " + p.LastName + " (" + p.PatientNumber + ")")
            .FirstAsync();

    private async Task SendAsync(IReadOnlyCollection<string> userIds, string title, string message, string? link,
        bool includeMe = false)
    {
        title = Shorten(title, 120);
        message = Shorten(message, 500);
        var me = includeMe ? null : httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier);
        var recipients = await db.Users
            .Where(u => userIds.Contains(u.Id) && u.IsActive && u.Id != me)
            // Someone who still has the very same message unread does not get it twice
            // (for example when "Forgot password" is pressed again).
            .Where(u => !db.Notifications.Any(n => n.UserId == u.Id && n.ReadAt == null &&
                                                   n.Title == title && n.Message == message && n.Link == link))
            .Select(u => u.Id)
            .ToListAsync();
        if (recipients.Count == 0) return;

        var now = DateTime.UtcNow;
        db.Notifications.AddRange(recipients.Select(id => new Notification
        {
            UserId = id,
            Title = title,
            Message = message,
            Link = link,
            CreatedAt = now,
        }));
        await db.SaveChangesAsync();
    }

    // ---------- Reading (always only the signed-in user's own notifications) ----------

    public async Task<NotificationList> ListAsync(string userId)
    {
        var mine = db.Notifications.AsNoTracking().Where(n => n.UserId == userId);
        var items = await mine
            .OrderByDescending(n => n.CreatedAt).ThenByDescending(n => n.Id)
            .Take(ListSize)
            .Select(n => new NotificationResponse(n.Id, n.Title, n.Message, n.Link, n.CreatedAt, n.ReadAt != null))
            .ToListAsync();
        return new NotificationList(items, await CountUnreadAsync(userId));
    }

    public Task<int> CountUnreadAsync(string userId) =>
        db.Notifications.CountAsync(n => n.UserId == userId && n.ReadAt == null);

    // Returns false when the notification does not exist or belongs to someone else (the same answer for both).
    public async Task<bool> MarkReadAsync(string userId, long id) =>
        await db.Notifications
            .Where(n => n.Id == id && n.UserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.ReadAt, n => n.ReadAt ?? DateTime.UtcNow)) > 0;

    public Task MarkAllReadAsync(string userId) =>
        db.Notifications
            .Where(n => n.UserId == userId && n.ReadAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.ReadAt, DateTime.UtcNow));

    private static string Shorten(string text, int max) => text.Length <= max ? text : text[..(max - 1)] + "…";
}
