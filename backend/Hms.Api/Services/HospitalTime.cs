using System.Globalization;

namespace Hms.Api.Services;

// The database stores every date-time in UTC. Doctors' schedules ("Monday 08:00-12:00")
// and "today" are in the hospital's local time (assumption A11: Asia/Colombo, UTC+05:30).
// This class converts between the two in one place.
public static class HospitalTime
{
    // IANA name. Works on Windows too, because .NET uses ICU time zone data.
    public static readonly TimeZoneInfo Zone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Colombo");

    public static DateTime ToLocal(DateTime utc) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), Zone);

    public static DateTime ToUtc(DateOnly date, TimeOnly time) =>
        TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(time, DateTimeKind.Unspecified), Zone);

    // Hospital days "from" to "to", both inclusive, as a UTC range [FromUtc, ToUtc) for database queries.
    public static (DateTime FromUtc, DateTime ToUtc) DaysToUtc(DateOnly from, DateOnly to) =>
        (ToUtc(from, TimeOnly.MinValue), ToUtc(to.AddDays(1), TimeOnly.MinValue));

    // How times are written in notifications, e.g. "Mon 23 Nov, 09:30" (hospital time).
    public static string Describe(DateTime utc) => ToLocal(utc).ToString("ddd d MMM, HH:mm", CultureInfo.InvariantCulture);

    public static DateOnly Today => DateOnly.FromDateTime(ToLocal(DateTime.UtcNow));

    // A time sent with "Z" is UTC. A time sent without a zone ("2026-11-20T10:00") is read as hospital time.
    public static DateTime NormalizeToUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => TimeZoneInfo.ConvertTimeToUtc(value, Zone),
    };
}
