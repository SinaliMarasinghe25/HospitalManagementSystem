using Npgsql;

namespace Hms.Api.Hosting;

// Hosting companies (Render, Neon and others) give the database address as a URL:
//     postgresql://user:password@host:5432/database?sslmode=require
// Npgsql, the PostgreSQL driver, expects the "key=value" form instead:
//     Host=host;Port=5432;Database=database;Username=user;Password=password;SSL Mode=Require
// This turns the first form into the second, so you can paste the URL exactly as the host shows it.
// A connection string that is already in the key=value form is returned unchanged.
public static class DatabaseUrl
{
    public static string ToNpgsqlConnectionString(string value)
    {
        var text = value.Trim();
        if (!text.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) &&
            !text.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            return value;
        }

        var uri = new Uri(text);
        var userInfo = uri.UserInfo.Split(':', 2);

        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.IsDefaultPort || uri.Port <= 0 ? 5432 : uri.Port,
            Database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/')),
            Username = Uri.UnescapeDataString(userInfo[0]),
        };
        if (userInfo.Length == 2)
        {
            builder.Password = Uri.UnescapeDataString(userInfo[1]);
        }

        // Options after the "?" that matter for hosted databases.
        foreach (var pair in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = pair.Split('=', 2);
            var key = Uri.UnescapeDataString(parts[0]).ToLowerInvariant();
            var setting = parts.Length == 2 ? Uri.UnescapeDataString(parts[1]) : "";
            switch (key)
            {
                case "sslmode":
                    builder.SslMode = Enum.Parse<SslMode>(setting.Replace("-", ""), ignoreCase: true);
                    break;
                case "channel_binding":
                    builder.ChannelBinding = Enum.Parse<ChannelBinding>(setting, ignoreCase: true);
                    break;
            }
        }

        return builder.ConnectionString;
    }
}
