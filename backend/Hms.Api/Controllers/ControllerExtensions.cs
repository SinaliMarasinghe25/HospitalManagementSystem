using Microsoft.AspNetCore.Mvc;

namespace Hms.Api.Controllers;

public static class ControllerExtensions
{
    // Turns a service's field errors into the standard 400 "validation problem" response,
    // the same shape ASP.NET Core uses for [Required] and other attribute errors.
    public static ActionResult ValidationErrors(this ControllerBase controller, Dictionary<string, string[]> errors)
    {
        foreach (var (field, messages) in errors)
        {
            foreach (var message in messages)
            {
                controller.ModelState.AddModelError(field, message);
            }
        }
        return controller.ValidationProblem(controller.ModelState);
    }
}
