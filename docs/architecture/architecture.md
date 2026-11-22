# Architecture

## The big picture

The HMS is a **single-page web application** with a separate API, as the PDF's four-layer architecture asks (section 5).

```text
 Browser (Chrome, Edge, Firefox)
   React app ── fetch('/api/...') with the login cookie
        │
        ▼
 Vite dev server  http://localhost:5173      (development only: serves React, forwards /api)
        │
        ▼
 ASP.NET Core API  https://localhost:7019
   Controllers → Services → AppDbContext (EF Core)
        │
        ▼
 PostgreSQL  database "hms"
```

Because the browser only ever talks to one address, the login cookie works as a normal same-site cookie and CORS stays closed. In production there is no Vite server: the API serves the built React app itself from one Docker image, so the same holds. See the [deployment guide](../guides/deployment-guide.md).

## The four layers

| PDF layer | Where it lives | Job | Must not |
| --- | --- | --- | --- |
| Presentation | `frontend/src/pages`, `frontend/src/components` | Show data, collect input, call the API | Make security decisions the server does not repeat |
| Application | `backend/Hms.Api/Controllers`, `Dtos`, `Authorization` | Receive HTTP, check login and permission, validate input, call a service, return a status code | Hold business rules or query the database |
| Business logic | `backend/Hms.Api/Services` | Hospital rules (slots, status steps, stock, billing), transactions, notifications | Know about HTTP |
| Database | `backend/Hms.Api/Entities`, `Data`, `Migrations`, PostgreSQL | Tables, relationships, constraints, starter data | Be reached from React or controllers directly |

Entities are never returned from the API. Controllers return **DTOs** (records in `Dtos/`), so internal fields such as password hashes, cost prices for doctors or diagnoses for receptionists cannot leak by accident.

## Backend (`backend/Hms.Api`)

| Folder / file | Contents |
| --- | --- |
| `Program.cs` | Start-up: database, Identity, cookie, authorization, rate limit, services, seeding, middleware order |
| `Authorization/` | `Roles.cs` (the 7 roles), `Policies.cs` (36 named permissions), `MustChangePassword.cs` (temporary-password lock) |
| `Controllers/` | One controller per module. Thin: permission attribute, call a service, map the result to 200/201/400/404 |
| `Dtos/` | Request and response records. `[Required]`, `[MaxLength]`, `[Range]` attributes give automatic 400 answers |
| `Services/` | One service per module (`PatientService`, `AppointmentService`, `BillingService`, ...) plus shared helpers: `Paging`, `HospitalTime`, `SearchText`, `ServiceResult`, `AuditService`, `NotificationService` |
| `Entities/` | Table classes and enums |
| `Data/` | `AppDbContext` (tables, indexes, constraints) and the seeders |
| `Migrations/` | EF Core migrations |
| `Hms.Api.http` | Hand-run requests for the REST Client extension |

### How one request flows

Example: a receptionist books an appointment.

1. React calls `apiFetch('/appointments', { method: 'POST', body })` (`frontend/src/api/client.ts`). The browser adds the `hms.auth` cookie.
2. **Authentication** reads the cookie and builds the user with their roles.
3. **MustChangePassword** stops users who still have a temporary password.
4. **Authorization** checks `[Authorize(Policy = Policies.BookAppointments)]` on `AppointmentsController.Book`. Wrong role: 403.
5. **Model validation** checks the `AppointmentRequest` attributes. Problems: 400 with field errors.
6. `AppointmentService` checks the doctor's schedule, that the slot is free and in the future, saves the row, writes the audit entry and notifies the doctor.
7. The database's unique index on (doctor, start time) is the last line of defence: if two people book the same slot at the same moment, the second gets a friendly "just booked by someone else" message.
8. The controller returns **201 Created** with an `AppointmentResponse`.

Services return a `ServiceResult` (OK, Invalid with field errors, or NotFound), which controllers turn into the right status code with `ValidationErrors()`.

## Frontend (`frontend/src`)

| Folder / file | Contents |
| --- | --- |
| `main.tsx`, `App.tsx` | Entry point and all routes |
| `navigation.ts` | Sidebar items and which roles see them |
| `api/` | `client.ts` (the one fetch helper) and one file per module |
| `auth/` | Login state (`AuthProvider`), `ProtectedRoute`, `RequireRole`, `roles.ts`, `permissions.ts` (mirror of `Policies.cs`) |
| `pages/` | One folder per module, one file per screen |
| `components/` | Shared pieces: `layout/` (sidebar, header, bell), `ui/` (form fields, tabs, pagination), and module parts |
| `types/` | TypeScript shapes of the API's DTOs |
| `utils/` | Date formatting in hospital time, CSV export, form error helpers |
| `test/` | Test set-up for Vitest |

- **Routing:** React Router. Every page except login, forgot-password and change-password sits inside `ProtectedRoute` (must be logged in) and `RequireRole` (must have a role that may open it).
- **State:** plain React state and context. There is no global store; each page loads its own data through `api/`.
- **Styling:** Tailwind CSS classes. Print views (invoice, receipt, lab report, medical report, discharge summary, reports) use print styles.
- **Session expiry:** when any call returns 401, the app returns to the login page with a "session expired" note.

## Security design

| Threat / requirement | Protection |
| --- | --- |
| Stolen or guessed passwords | ASP.NET Core Identity hashes passwords (PBKDF2). Policy: 8+ characters with upper, lower, digit and symbol. 5 wrong passwords lock the account for 15 minutes. Wrong user and wrong password give the same message. |
| Shared passwords | An administrator-set password is temporary; the API refuses everything except change-password until the user picks their own. |
| Session theft (XSS) | The login cookie is **HttpOnly** (JavaScript cannot read it) and **Secure** (HTTPS only). React escapes all output; no raw HTML is inserted. |
| Cross-site requests (CSRF) | The cookie is **SameSite=Strict**, so the browser never sends it with requests started by another site. There is no CORS policy, so other origins cannot read API answers. |
| Unattended screens | 20-minute sliding timeout. Background polling (bell, dashboard) does not keep a session alive. |
| Access control | Secure by default: the fallback policy requires a login on every endpoint; each action names its permission; record-level rules (own appointments, own records) are in the services. |
| Changed roles or deactivated users | The security stamp is checked every minute, so changes apply within a minute. |
| SQL injection | All queries go through EF Core, which sends parameters. Search text is escaped (`SearchText`) so `%` and `_` are matched literally. |
| Malicious uploads | Only PDF, JPG, PNG up to 5 MB, checked by extension **and** by the file's first bytes. Files are stored under random names outside the web root, never under the uploaded name. |
| Spreadsheet formula injection | CSV export prefixes cells starting with `=`, `+`, `-`, `@` so Excel does not run them. |
| Password-reset flooding | "Forgot password" is limited to 5 requests per 15 minutes per address. |
| Secrets in Git | Connection string and admin password live in User Secrets (development) or environment variables (production), never in `appsettings.json`. |
| Error details | Errors are ProblemDetails JSON without stack traces; production uses the exception handler and HSTS. |
| Audit trail | Logins, failed logins, logouts, creates, updates and sensitive views (medical history, records, lab results, documents) are written to `AuditLogs` with user, time and IP. There is no way to edit or delete entries. |

## Cross-cutting design decisions

- **Hospital time:** the database stores UTC. Schedules, "today", report date ranges and printed times use Asia/Colombo (UTC+05:30) through `Services/HospitalTime.cs` on the server and `utils/format.ts` in the browser.
- **Paging:** long lists use `Services/Paging.cs`: a `COUNT` plus `OFFSET/LIMIT`, always sorted with `Id` as the last tie-breaker, page size capped at 100.
- **Charges are created by the event that causes them:** completing an appointment, completing a lab test, dispensing and discharging each add a `Charge` in the same transaction, so the bill can never miss or double a charge. The accountant then groups unbilled charges into invoices.
- **Notifications:** each business event calls one `NotificationService.Send...` method after saving. The person who did the action is not notified; messages contain only what the reader's role may already see.
- **Dashboard:** built from the same service methods as the module pages, so its numbers always match.
- **No deletes:** records are deactivated or cancelled, never removed, and foreign keys use `RESTRICT`.

## Differences from the original plan

The plan's proposed folder layout (section 6) was simplified while building:

| Plan | As built | Why |
| --- | --- | --- |
| `HmsDbContext` | `AppDbContext` | Name chosen in step 8 |
| `Validation/`, `Middleware/` folders | Validation attributes on DTOs; the one middleware lives in `Authorization/MustChangePassword.cs` | Not enough code to justify separate folders |
| Antiforgery tokens | SameSite=Strict cookie, no CORS | Same-site deployment makes the cookie never travel cross-site; no extra token round-trip |
| `frontend/src/features/<module>` | `pages/<module>` and `components/<module>` | Easier to find a screen by its URL |
| `tests/Hms.UnitTests` and `tests/Hms.IntegrationTests` | One project `tests/Hms.Api.Tests` with `Unit/` and `Integration/` folders | One `dotnet test`, one set of helpers |
