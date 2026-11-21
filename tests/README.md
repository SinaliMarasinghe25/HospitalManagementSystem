# Automated tests

## Backend (xUnit): `tests/Hms.Api.Tests`

Run from the `backend` folder (or the repository root with `dotnet test backend/Hms.slnx`):

```powershell
cd backend
dotnet test
```

- `Unit/` tests need nothing else: the full role table (36 permissions x 7 roles), search text escaping,
  hospital time zone, paging helpers.
- `Integration/` tests start the real API in memory and talk to it over HTTP, like the browser does:
  login, lockout, logout, temporary passwords, role access on real endpoints, billing totals and payments,
  appointment booking and status steps, paging.

The integration tests need PostgreSQL running. They take the server, user name and password from the API's
User Secret `ConnectionStrings:HmsDatabase` (or the environment variable `HMS_TEST_DATABASE`),
create their **own** database `hms_test_<random>`, run every migration on it, and delete it at the end.
Your real database is never touched. The database user needs permission to create databases
(the `postgres` user has it).

## Frontend (Vitest + React Testing Library)

```powershell
cd frontend
npm test
```

Test files sit next to the code they test (`Sidebar.test.tsx` next to `Sidebar.tsx`).
Shared set-up is in `frontend/src/test/`.
