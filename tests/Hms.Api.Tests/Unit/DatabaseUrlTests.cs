using Hms.Api.Hosting;
using Npgsql;

namespace Hms.Api.Tests.Unit;

// Hosting companies give the database as a postgresql://... URL; the API turns it into an Npgsql connection string.
public class DatabaseUrlTests
{
    [Fact]
    public void A_hosted_database_url_becomes_a_connection_string()
    {
        var result = DatabaseUrl.ToNpgsqlConnectionString(
            "postgresql://hms_user:p%40ss%3Aword@db.example.com:6543/hms_demo?sslmode=require&channel_binding=require");

        var parsed = new NpgsqlConnectionStringBuilder(result);
        Assert.Equal("db.example.com", parsed.Host);
        Assert.Equal(6543, parsed.Port);
        Assert.Equal("hms_demo", parsed.Database);
        Assert.Equal("hms_user", parsed.Username);
        Assert.Equal("p@ss:word", parsed.Password);   // %40 and %3A are decoded
        Assert.Equal(SslMode.Require, parsed.SslMode);
        Assert.Equal(ChannelBinding.Require, parsed.ChannelBinding);
    }

    [Fact]
    public void A_url_without_a_port_uses_5432()
    {
        var parsed = new NpgsqlConnectionStringBuilder(
            DatabaseUrl.ToNpgsqlConnectionString("postgres://u:p@dpg-internal-a/hms"));

        Assert.Equal("dpg-internal-a", parsed.Host);
        Assert.Equal(5432, parsed.Port);
        Assert.Equal("hms", parsed.Database);
    }

    [Fact]
    public void A_normal_connection_string_is_left_unchanged()
    {
        const string normal = "Host=localhost;Port=5432;Database=hms;Username=hms_app;Password=secret";
        Assert.Equal(normal, DatabaseUrl.ToNpgsqlConnectionString(normal));
    }
}
