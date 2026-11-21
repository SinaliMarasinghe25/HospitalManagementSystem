namespace Hms.Api.Dtos;

public record NotificationResponse(
    long Id,
    string Title,
    string Message,
    string? Link,
    DateTime CreatedAt,
    bool IsRead);

// The bell's list: the newest notifications, read or not, plus how many are unread in total.
public record NotificationList(IReadOnlyList<NotificationResponse> Items, int UnreadCount);

public record UnreadCount(int Count);
