# Backend: Hms.Api

ASP.NET Core Web API (.NET 10) for the HMS, with ASP.NET Core Identity and Entity Framework Core on PostgreSQL.

```powershell
cd backend\Hms.Api
dotnet ef database update            # apply migrations
dotnet run --launch-profile https    # https://localhost:7019
cd ..
dotnet test                          # backend tests (tests/Hms.Api.Tests)
```

The connection string and first admin password come from User Secrets; see the [setup guide](../docs/guides/setup-guide.md).

- Folders and layers: [architecture](../docs/architecture/architecture.md)
- Endpoints: [API reference](../docs/api/api-reference.md)
- Permissions: [roles and permissions](../docs/architecture/roles-and-permissions.md)
- Tables and migrations: [database](../docs/architecture/database.md)
