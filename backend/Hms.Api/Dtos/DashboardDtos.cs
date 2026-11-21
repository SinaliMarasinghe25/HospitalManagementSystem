namespace Hms.Api.Dtos;

// GET /api/dashboard: every dashboard number in one answer, worked out on the server at the same moment.
// Tiles lists the tiles this user may see, in display order. A tile the user may not see is null here,
// so a number the role is not allowed to have never leaves the server.
public record DashboardSummary(
    DateOnly Today,
    DateTime GeneratedAt,
    List<string> Tiles,
    int? TotalPatients,
    TodayAppointments? Appointments,
    int? OpenLabRequests,
    PharmacyAlertCounts? PharmacyAlerts,
    RevenueSummary? Revenue);

// Today's real visits (cancelled and rescheduled appointments left out). A doctor gets only their own.
public record TodayAppointments(int Count, List<AppointmentResponse> Items);
