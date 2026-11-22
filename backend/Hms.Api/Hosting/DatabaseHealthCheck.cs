using Hms.Api.Data;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Hms.Api.Hosting;

// Used by GET /health. The hosting platform calls it every few seconds:
// "Healthy" means the API is running AND can reach the database.
public class DatabaseHealthCheck(AppDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            return await db.Database.CanConnectAsync(cancellationToken)
                ? HealthCheckResult.Healthy()
                : HealthCheckResult.Unhealthy("The database cannot be reached.");
        }
        catch (Exception)
        {
            // No error details: /health is public, and details could help an attacker.
            return HealthCheckResult.Unhealthy("The database cannot be reached.");
        }
    }
}
