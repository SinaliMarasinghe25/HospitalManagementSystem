using Hms.Api.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

// Database: read the connection string named "HmsDatabase".
// In development it comes from User Secrets, in production from an environment variable.
// It is never written in appsettings.json, so the password never reaches GitHub.
var connectionString = builder.Configuration.GetConnectionString("HmsDatabase")
    ?? throw new InvalidOperationException("Connection string 'HmsDatabase' is not configured.");

builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();
