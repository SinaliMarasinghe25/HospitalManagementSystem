# Hospital Management System (HMS)

A web-based Hospital Management System for one hospital. It keeps patients, doctors, appointments, electronic medical records, admissions, laboratory, pharmacy, billing, staff and reports in one secure application, used by seven staff roles.

> This is an academic demonstration project. It uses fictitious data only and must never store real patient information.

**Status:** all modules are built, redesigned and covered by automated tests, which GitHub runs on every pull request. The app ships as one Docker image and runs as a public demo on Render with a Neon database (see the [deployment guide](docs/guides/deployment-guide.md)).

## Features

| Module | What it does |
| --- | --- |
| Login and accounts | Login, logout, 20-minute idle timeout, lockout after 5 wrong passwords, change password, temporary passwords that must be changed, "forgot password" request to the administrators |
| Dashboard | Total patients, today's appointments, pending lab requests, pharmacy alerts and revenue. Each role sees only its own tiles |
| Patients | Register, edit, search (paged), medical history, upload PDF/JPG/PNG documents (up to 5 MB) |
| Doctors | Doctor list by department, weekly schedule and slot length |
| Appointments | Book from free slots, reschedule, cancel, check in, no-show, complete. Day and week calendar |
| Medical records | Consultations with diagnoses, treatments, prescriptions and lab requests. Printable medical report |
| Admissions | Bed board, admit, transfer between beds, vital signs, discharge with summary and bed charges |
| Laboratory | Test catalogue, work queue, sample collection, results with abnormal flag, printable lab report |
| Pharmacy | Medicines with batches and expiry, stock in, adjustments, write-offs, dispensing, low-stock and expiry alerts |
| Billing | Charges collected automatically, invoices with discount, part and full payments, printable invoice and receipt |
| Staff | Employees, departments, logins and roles, daily attendance, leave requests |
| Reports | Patient, appointment, revenue, pharmacy, laboratory and staff reports with CSV export and print |
| Notifications | In-app bell for new prescriptions, lab results, admissions, leave decisions and more |
| Audit log | Every login, change and sensitive view, read-only, searchable by the administrator |

## Technology

| Part | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, React Router |
| Backend | C#, ASP.NET Core Web API (.NET 10), ASP.NET Core Identity (cookie login) |
| Database | PostgreSQL, Entity Framework Core 10 (Npgsql) with migrations |
| Tests | xUnit v3 (backend), Vitest and React Testing Library (frontend) |

## Quick start (Windows, PowerShell)

You need the .NET 10 SDK, the `dotnet-ef` tool, Node.js LTS and PostgreSQL 17 or newer.
The full, step-by-step version is in the [setup guide](docs/guides/setup-guide.md).

```powershell
# 1. Settings for the API (once). Use your own PostgreSQL login and passwords.
cd backend\Hms.Api
dotnet user-secrets set "ConnectionStrings:HmsDatabase" "Host=localhost;Port=5432;Database=hms;Username=hms_app;Password=YOUR_DB_PASSWORD"
dotnet user-secrets set "Seed:AdminPassword" "YOUR_ADMIN_PASSWORD"

# 2. Create the tables and start the API on https://localhost:7019
dotnet ef database update
dotnet run --launch-profile https

# 3. In a second terminal: start the frontend on http://localhost:5173
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and log in as `admin` with the password from step 1.

## Run it with Docker (production version)

With Docker Desktop installed, this runs the same image as the live demo, plus a PostgreSQL database:

```powershell
Copy-Item .env.example .env    # then choose your own passwords in .env
docker compose up -d --build
```

Open http://localhost:8080 and log in as `admin` with `ADMIN_PASSWORD` from `.env`. Details, the public deployment and backups are in the [deployment guide](docs/guides/deployment-guide.md).

## Running the tests

```powershell
cd backend
dotnet test        # 366 backend tests; needs PostgreSQL and a login that may create databases

cd ..\frontend
npm test           # 61 frontend tests
```

See the [testing guide](docs/testing/testing-guide.md) for what is tested and how the test database works.

## Documentation

| Document | For |
| --- | --- |
| [Setup guide](docs/guides/setup-guide.md) | Installing the tools, the database, secrets, running the app, troubleshooting |
| [Deployment guide](docs/guides/deployment-guide.md) | Docker, the live demo on Render + Neon, CI, backup and restore, disaster recovery |
| [User manual](docs/guides/user-manual.md) | How each of the seven roles uses the system |
| [Architecture](docs/architecture/architecture.md) | Layers, folders, how a request flows, security design |
| [Roles and permissions](docs/architecture/roles-and-permissions.md) | Exactly what each role may see and do |
| [Database](docs/architecture/database.md) | Tables, relationships (ER diagram), rules enforced by the database, migrations |
| [API reference](docs/api/api-reference.md) | Every endpoint, who may call it, request conventions |
| [Testing guide](docs/testing/testing-guide.md) | Running and understanding the automated tests |
| [Project plan](docs/project-plan.md) | Requirements, traceability matrix and plan |

## Repository structure

| Folder | Contents |
| --- | --- |
| `backend/Hms.Api/` | ASP.NET Core Web API: controllers, services, entities, migrations |
| `frontend/` | React application |
| `tests/Hms.Api.Tests/` | Backend unit and integration tests |
| `docs/` | Plan, guides, architecture, API reference |
| `scripts/` | Database backup and restore (PowerShell) |
| `.github/workflows/` | CI: tests and Docker build on every pull request |
| `Dockerfile`, `docker-compose.yml`, `render.yaml` | Production image, local Docker setup, Render hosting |

## Roles

Administrator, Doctor, Nurse, Receptionist, Laboratory Staff, Pharmacist, Accountant. A login can have more than one role.

## Author

Sinali Lawanya
