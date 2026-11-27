# Testing guide

The HMS has two sets of automated tests. Run both before every pull request; both must pass.

| Set | Tool | Where | Command | Count (step 31) |
| --- | --- | --- | --- | --- |
| Backend | xUnit v3 | `tests/Hms.Api.Tests` | `dotnet test` in `backend` | 370 |
| Frontend | Vitest + React Testing Library | next to the code in `frontend/src` (`*.test.ts(x)`) | `npm test` in `frontend` | 56 |

```powershell
cd C:\dev\HospitalManagementSystem\backend
dotnet test
# Passed!  - Failed: 0, Passed: 370, ...

cd ..\frontend
npm test
# Test Files 5 passed (5)   Tests 56 passed (56)
```

Also run `npm run lint` and `npm run build` in `frontend`: no lint problems and no TypeScript errors.

## Backend tests

### What they need

The **integration** tests start the real API in memory and send it real HTTP requests, like the browser does. They need PostgreSQL, but they **never touch your `hms` database**:

1. They take the server, username and password from the API's User Secret `ConnectionStrings:HmsDatabase`, or from the environment variable `HMS_TEST_DATABASE` if it is set (a full connection string).
2. They create a new empty database `hms_test_<random>` and run every migration on it.
3. Each test creates its own users, patients and charges, so tests do not depend on each other. Test classes run one after another (`xunit.runner.json`).
4. At the end the test database is deleted.

**The PostgreSQL login must have the `CREATEDB` right.** See the [setup guide](../guides/setup-guide.md#3-create-the-database-and-its-login). To use another login for one terminal only:

```powershell
$env:HMS_TEST_DATABASE = "Host=localhost;Port=5432;Username=postgres;Password=YOUR_POSTGRES_PASSWORD"
dotnet test
```

The **unit** tests need nothing else.

### What they check

| File | Requirement | What is checked |
| --- | --- | --- |
| `Unit/RolePermissionTests.cs` | FR-UM-05 | All 36 permissions for all 7 roles match the plan's role table exactly. A new policy that is not in the table fails. |
| `Unit/SearchTextTests.cs` | NFR-SEC (SQL) | Search text escaping: `50%` finds "50%", not everything. |
| `Unit/DatabaseUrlTests.cs` | Deployment | A hosted `postgresql://...` database URL (with encoded password, port, `sslmode`) becomes a correct connection string; a normal one is unchanged. |
| `Unit/HospitalTimeTests.cs` | A11 | UTC ↔ Asia/Colombo conversions and day ranges. |
| `Unit/PagingMapTests.cs` | NFR-PERF-03 | Paging helpers keep page numbers and totals. |
| `Integration/AuthTests.cs` | FR-UM-01–03, NFR-SEC-01, 05 | Login, same message for unknown user and wrong password, lockout after 5, deactivated users, 401 without login, logout ends the session, cookie is HttpOnly + Secure + SameSite=Strict, temporary password must be changed, weak passwords refused, forgot-password rate limit. |
| `Integration/HostingTests.cs` | NFR-REL-02, NFR-SEC | `/health` is public and answers `Healthy`; responses carry the security headers (nosniff, no framing, Content-Security-Policy). |
| `Integration/RoleAccessTests.cs` | FR-UM-05, NFR-SEC-03 | Seven real logins open patients, billing, unbilled charges, audit log, users, lab, pharmacy and the revenue report: allowed roles get 200, others 403. Only reception and admin can register a patient. |
| `Integration/BillingTests.cs` | FR-BL-01, 05, 06 | Totals = lines − discount; exact decimals; discount ≤ subtotal; no double billing; part then full payment; no overpayment; card needs a reference; reprinted receipt keeps its old balance; cancelling releases charges; paid invoices cannot be cancelled; reception sees balances only; "total still due" covers all pages. |
| `Integration/AppointmentTests.cs` | FR-AP-01, 04, FR-BL-01 | Free slot booking; no double booking; outside schedule, between slots and past times refused; cancelled slot bookable again; no jump from Scheduled to Completed; completing adds the fee; another doctor cannot complete. |
| `Integration/PagingTests.cs` | NFR-PERF-03 | Pages of 10, 10 and 5 with no duplicates or gaps; page past the end; page size limits; patient search paging. |

Helpers live in `Infrastructure/`: `HmsApiFactory` (starts the API on the throwaway database), `HttpExtensions`, `TestData` (creates users, patients, doctors).

## Frontend tests

| File | What is checked |
| --- | --- |
| `components/layout/Sidebar.test.tsx` | Each role sees exactly its own menu items. |
| `pages/LoginPage.test.tsx` | Fields and button present; username trimmed; API error shown and password cleared; "Signing in..." while waiting; session-expired note. |
| `components/ui/Pagination.test.tsx` | "47 requests, page 1 of 3", Previous and Next. |
| `auth/permissions.test.ts` | Reads the API's `Policies.cs` and checks every permission has the same roles in `permissions.ts`. |
| `utils/formErrors.test.ts` | API field errors mapped to form fields. |

Shared set-up is in `frontend/src/test/` (`setup.ts`, and `renderWithAuth.tsx` to render a page as a given role).

`npm run test:watch` keeps Vitest running and re-runs tests when you save. In VS Code with C# Dev Kit, the **Testing** panel lists and runs the backend tests.

## Writing a new test

- **A business rule** (for example a new billing rule): add an integration test in the matching `Integration/*Tests.cs` that creates its own data with `TestData`, calls the API, and checks the status code and the answer.
- **A permission change:** update `Policies.cs`, `permissions.ts` and the expected table in `RolePermissionTests.cs` together; the tests fail until all three agree.
- **A screen:** add `Something.test.tsx` next to the component and render it with `renderWithAuth`.

## Manual checks

Some things are checked by hand before a release: printing (invoice, receipt, lab report, medical report, discharge summary, reports), phone-width layout (390 px), and a full walk-through of the "day in the hospital" flow in the project plan (section 10).

## If something goes wrong

| Message | Fix |
| --- | --- |
| "No database for the tests" | The User Secret is missing. In `backend\Hms.Api` run `dotnet user-secrets list`; it must show `ConnectionStrings:HmsDatabase`. |
| `permission denied to create database` | Give the login `CREATEDB` (setup guide, step 3), or use `HMS_TEST_DATABASE` with the `postgres` user. |
| `Failed to connect to ...:5432` | Start PostgreSQL (Windows Services, `postgresql-x64-...`). |
| A left-over `hms_test_...` database | A run was stopped half-way (Ctrl+C). It is safe to delete in pgAdmin. |

## Tests on GitHub (CI)

The workflow `.github/workflows/ci.yml` runs both test suites, the linter and the production builds on every pull request, with a throw-away PostgreSQL. On a pull request, the checks show at the bottom: a green tick per job means it passed; on a red cross, click **Details** to read the error.
