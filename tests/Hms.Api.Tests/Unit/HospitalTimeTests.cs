using Hms.Api.Services;

namespace Hms.Api.Tests.Unit;

// Assumption A11: the hospital is in Asia/Colombo (UTC+05:30); the database stores UTC.
public class HospitalTimeTests
{
    [Fact]
    public void Hospital_time_is_five_and_a_half_hours_ahead_of_utc()
    {
        var utc = HospitalTime.ToUtc(new DateOnly(2026, 11, 23), new TimeOnly(9, 30));
        Assert.Equal(new DateTime(2026, 11, 23, 4, 0, 0, DateTimeKind.Utc), utc);
    }

    [Fact]
    public void ToLocal_is_the_reverse_of_ToUtc()
    {
        var local = HospitalTime.ToLocal(new DateTime(2026, 11, 23, 4, 0, 0, DateTimeKind.Utc));
        Assert.Equal(new DateTime(2026, 11, 23, 9, 30, 0), local);
    }

    [Fact]
    public void A_time_without_a_zone_is_read_as_hospital_time()
    {
        var sent = new DateTime(2026, 11, 23, 9, 30, 0, DateTimeKind.Unspecified);
        Assert.Equal(new DateTime(2026, 11, 23, 4, 0, 0, DateTimeKind.Utc), HospitalTime.NormalizeToUtc(sent));
    }

    [Fact]
    public void A_utc_time_is_kept_as_it_is()
    {
        var sent = new DateTime(2026, 11, 23, 4, 0, 0, DateTimeKind.Utc);
        Assert.Equal(sent, HospitalTime.NormalizeToUtc(sent));
    }

    [Fact]
    public void A_hospital_day_becomes_a_utc_range_from_midnight_to_midnight()
    {
        var (fromUtc, toUtc) = HospitalTime.DaysToUtc(new DateOnly(2026, 11, 23), new DateOnly(2026, 11, 23));
        Assert.Equal(new DateTime(2026, 11, 22, 18, 30, 0, DateTimeKind.Utc), fromUtc);
        Assert.Equal(new DateTime(2026, 11, 23, 18, 30, 0, DateTimeKind.Utc), toUtc);
    }
}
