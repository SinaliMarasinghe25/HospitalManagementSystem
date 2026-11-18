# Hospital Management System (HMS)

A web-based Hospital Management System that manages patients, doctors, appointments, electronic medical records, laboratory, pharmacy, billing, inpatient and outpatient care, staff, and reports, with role-based access for seven hospital roles.

> **Status:** In development (Phase 2: environment setup).
> This is an academic demonstration project. It uses fictitious data only and must not store real patient information.

## Planned features

- User management: login, logout, password management, role-based access control
- Patient management: registration, search, medical history, documents
- Doctor management: departments and schedules
- Appointments: booking, cancelling, rescheduling, calendar view
- Electronic medical records: diagnoses, prescriptions, treatment history, reports
- Laboratory, pharmacy, billing and payments
- Inpatient and outpatient management
- Staff management: attendance and leave
- Reports and dashboard analytics

## User roles

Administrator, Doctor, Nurse, Receptionist, Laboratory Staff, Pharmacist, Accountant.

## Technology stack

| Part | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS, React Router |
| Backend | C#, ASP.NET Core Web API (.NET 10), ASP.NET Core Identity |
| Database | PostgreSQL with Entity Framework Core (Npgsql) |
| Testing | xUnit, Vitest, React Testing Library |

## Repository structure

| Folder | Contents |
| --- | --- |
| `backend/` | ASP.NET Core Web API |
| `frontend/` | React application |
| `tests/` | Automated backend tests |
| `docs/` | Requirements, architecture, guides and reports |

## Getting started

Setup instructions will be added as each part is built.
Prerequisites: .NET 10 SDK, Node.js LTS, PostgreSQL, Git.

## Author

Sinali Lawanya