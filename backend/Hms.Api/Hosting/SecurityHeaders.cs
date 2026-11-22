namespace Hms.Api.Hosting;

// Extra browser protections added to every response.
public static class SecurityHeaders
{
    // Only our own scripts may run, the app may not be shown inside another site's frame (clickjacking),
    // and the browser must not guess file types. 'unsafe-inline' for styles only: React sets some style="..." values.
    private const string ContentSecurityPolicy =
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
        "connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; " +
        "frame-ancestors 'none'";

    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app) =>
        app.Use(async (context, next) =>
        {
            var headers = context.Response.Headers;
            headers["X-Content-Type-Options"] = "nosniff";
            headers["X-Frame-Options"] = "DENY";
            headers["Referrer-Policy"] = "no-referrer";
            // The policy is for the web pages. API answers (JSON, downloaded patient documents) skip it,
            // because a strict policy can stop the browser's built-in PDF viewer.
            if (!context.Request.Path.StartsWithSegments("/api"))
            {
                headers["Content-Security-Policy"] = ContentSecurityPolicy;
            }
            await next();
        });
}
