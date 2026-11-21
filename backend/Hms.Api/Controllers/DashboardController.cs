using Hms.Api.Dtos;
using Hms.Api.Entities;
using Hms.Api.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Hms.Api.Controllers;

// The dashboard (PDF section 7). Every signed-in user may call it; DashboardTiles decides which numbers they get.
[ApiController]
[Route("api/dashboard")]
public class DashboardController(DashboardService dashboard, UserManager<AppUser> userManager) : ControllerBase
{
    // GET /api/dashboard   (asked again every 30 seconds while the dashboard is open; does not extend the session)
    [HttpGet]
    public Task<DashboardSummary> Get()
    {
        // Always fresh: the browser must never show a saved copy of these numbers.
        Response.Headers.CacheControl = "no-store";
        return dashboard.GetSummaryAsync(User, userManager.GetUserId(User));
    }
}
