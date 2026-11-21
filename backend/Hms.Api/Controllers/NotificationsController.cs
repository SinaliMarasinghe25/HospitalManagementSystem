using Hms.Api.Dtos;
using Hms.Api.Entities;
using Hms.Api.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Hms.Api.Controllers;

// The bell in the header (assumption A27). Every signed-in user, whatever their role,
// reads and marks only their own notifications. Nobody can create one through the API:
// they are made by the services when something happens.
[ApiController]
[Route("api/notifications")]
public class NotificationsController(NotificationService notifications, UserManager<AppUser> userManager) : ControllerBase
{
    private string Me => userManager.GetUserId(User)!;

    // GET /api/notifications   (the newest 20, and how many are unread)
    [HttpGet]
    public Task<NotificationList> GetMine() => notifications.ListAsync(Me);

    // GET /api/notifications/unread-count   (asked every minute by the bell; does not extend the session)
    [HttpGet("unread-count")]
    public async Task<UnreadCount> GetUnreadCount() => new(await notifications.CountUnreadAsync(Me));

    // POST /api/notifications/{id}/read
    [HttpPost("{id:long}/read")]
    public async Task<IActionResult> MarkRead(long id) =>
        await notifications.MarkReadAsync(Me, id) ? NoContent() : NotFound();

    // POST /api/notifications/read-all
    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllRead()
    {
        await notifications.MarkAllReadAsync(Me);
        return NoContent();
    }
}
