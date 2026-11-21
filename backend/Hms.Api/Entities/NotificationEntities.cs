using System.ComponentModel.DataAnnotations;

namespace Hms.Api.Entities;

// ---------- In-app notifications (assumption A27, proposed) ----------
// One row = one message for one user, shown under the bell in the header.
// PDF section 12 lists SMS and email notifications as future work, so these stay inside the app.
public class Notification
{
    public long Id { get; set; }

    // Who it is for. Each user only ever sees their own rows.
    [MaxLength(450)]
    public string UserId { get; set; } = string.Empty;

    [MaxLength(120)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(500)]
    public string Message { get; set; } = string.Empty;

    // A page inside the app, e.g. "/laboratory/requests/12". Never a full web address.
    [MaxLength(200)]
    public string? Link { get; set; }

    public DateTime CreatedAt { get; set; }

    // Null until the user opens it or presses "Mark all as read".
    public DateTime? ReadAt { get; set; }
}
