# Setup guide

How to get the HMS running on a Windows 10 or 11 computer for development. Every command is typed in **PowerShell**, for example in VS Code (Terminal → New Terminal).

The project folder in this guide is `C:\dev\HospitalManagementSystem`. If yours is somewhere else, use your own path.

## 1. Install the tools

| Tool | Where | Check it works |
| --- | --- | --- |
| Git for Windows | git-scm.com | `git --version` |
| .NET 10 SDK | dotnet.microsoft.com | `dotnet --version` shows `10.x` |
| dotnet-ef (EF Core command-line tool) | `dotnet tool install --global dotnet-ef` | `dotnet ef --version` |
| Node.js LTS (includes npm) | nodejs.org | `node -v` and `npm -v` |
| PostgreSQL 17 or newer, with pgAdmin 4 | postgresql.org | `psql --version`; pgAdmin connects |
| Visual Studio Code (recommended) | code.visualstudio.com | `code --version` |

Useful VS Code extensions: **C# Dev Kit** (C# editing and the Testing panel), **REST Client** (runs `backend/Hms.Api/Hms.Api.http`), **Tailwind CSS IntelliSense**.

Trust the .NET development HTTPS certificate once, so the API can run on `https://`:

```powershell
dotnet dev-certs https --trust
```

## 2. Get the code

```powershell
cd C:\dev
git clone https://github.com/SinaliMarasinghe25/HospitalManagementSystem.git
cd HospitalManagementSystem
```

## 3. Create the database and its login

The API connects to PostgreSQL with its own login (here `hms_app`), not with the `postgres` superuser.

**That login must be allowed to create databases (`CREATEDB`).** The app itself does not need it, but the automated backend tests create a temporary database `hms_test_...` for every run and delete it afterwards. Without `CREATEDB`, `dotnet test` fails with "permission denied to create database".

Open **pgAdmin**, connect as `postgres`, open the **Query Tool** on the `postgres` database, and run (choose your own password):

```sql
CREATE ROLE hms_app WITH LOGIN PASSWORD 'choose-a-strong-password' CREATEDB;
CREATE DATABASE hms OWNER hms_app;
```

If the login already exists without that right, give it once:

```sql
ALTER ROLE hms_app CREATEDB;
```

(In pgAdmin you can do the same with the mouse: right-click the login under **Login/Group Roles** → **Properties** → **Privileges** → switch on **Create databases** → **Save**.)

## 4. Store the secrets (User Secrets)

Passwords are **never** written in `appsettings.json` or anywhere else in Git. In development they live in .NET **User Secrets**, a file in your Windows user profile, outside the project folder.

```powershell
cd C:\dev\HospitalManagementSystem\backend\Hms.Api
dotnet user-secrets set "ConnectionStrings:HmsDatabase" "Host=localhost;Port=5432;Database=hms;Username=hms_app;Password=choose-a-strong-password"
dotnet user-secrets set "Seed:AdminPassword" "Your-Admin-Passw0rd!"
dotnet user-secrets list
```

| Setting | Required | What it does |
| --- | --- | --- |
| `ConnectionStrings:HmsDatabase` | Yes | How the API reaches PostgreSQL. The API stops at start-up if it is missing. |
| `Seed:AdminPassword` | For the first start | Password of the first administrator, created when no account with the admin user name exists yet. It must have at least 8 characters with an upper-case letter, a lower-case letter, a digit and a symbol. |
| `Seed:AdminUserName` | No (default `admin`) | User name of the first administrator. |
| `Seed:AdminEmail` | No | E-mail stored on the first administrator. |
| `Storage:PatientDocumentsPath` | No (default `App_Data/patient-documents`) | Folder for uploaded patient documents, relative to `backend/Hms.Api`. |

`App_Data` holds uploaded files and must never be committed. The root `.gitignore` excludes every `App_Data` folder.

## 5. Create the tables

The migrations in `backend/Hms.Api/Migrations` create every table. They are **not** applied automatically when the API starts; you apply them with:

```powershell
cd C:\dev\HospitalManagementSystem\backend\Hms.Api
dotnet ef database update
```

Run it again whenever a pull request adds a new migration.

## 6. Start the API

```powershell
dotnet run --launch-profile https
```

The API listens on **https://localhost:7019** (and http://localhost:5031). On every start it makes sure these exist, and adds only what is missing:

- the 7 roles,
- the first administrator (from `Seed:AdminPassword`),
- a starter list of medicines (demo prices) and lab tests,
- the starter departments: General Medicine, Surgery, Paediatrics, Cardiology, Emergency, Nursing, Laboratory, Pharmacy (clinical) and Administration (non-clinical).

If no **active** administrator is left (for example, the role was removed by mistake), start-up gives the seed `admin` account the Administrator role back and reactivates it.

In development the OpenAPI description is at https://localhost:7019/openapi/v1.json. Stop the API with **Ctrl+C**.

## 7. Start the frontend

Open a **second** terminal:

```powershell
cd C:\dev\HospitalManagementSystem\frontend
npm install
npm run dev
```

`npm install` is needed the first time and whenever `package.json` changes. Then open **http://localhost:5173**.

Vite forwards every `/api/...` request to the API (see `frontend/vite.config.ts`), so the browser only talks to one address and the login cookie works without opening CORS. If your API runs on another address, set it for that terminal before `npm run dev`:

```powershell
$env:HMS_API_URL = "https://localhost:7019"
```

## 8. First login

1. Log in as `admin` with the password from `Seed:AdminPassword`.
2. Go to **Staff → Employees → Add employee** to add people. Tick **This person is a doctor** for doctors (then set the specialisation, licence number and fee), and create a login with roles for anyone who needs to use the system.
3. A new login gets a **temporary password**. The person must choose their own password at their first login.
4. Set each doctor's weekly hours on **Doctors → (doctor) → Schedule**, so appointments can be booked.
5. Add wards and beds on **Admissions → Wards** before admitting patients.

Use fictitious people and patients only.

## Everyday commands

| Task | Where | Command |
| --- | --- | --- |
| Start the API | `backend\Hms.Api` | `dotnet run --launch-profile https` |
| Start the frontend | `frontend` | `npm run dev` |
| Apply new migrations | `backend\Hms.Api` | `dotnet ef database update` |
| Backend tests | `backend` | `dotnet test` |
| Frontend tests | `frontend` | `npm test` |
| Lint and production build | `frontend` | `npm run lint` and `npm run build` |

## Troubleshooting

| Message | Cause and fix |
| --- | --- |
| `Connection string 'HmsDatabase' is not configured.` | The User Secret is missing. Run step 4 in `backend\Hms.Api`. |
| `Failed to connect to ...:5432` | PostgreSQL is not running. Start the `postgresql-x64-...` service in Windows **Services**. |
| `password authentication failed for user ...` | The password in the connection string does not match the login. Fix it with `dotnet user-secrets set` again. |
| `permission denied to create database` (in `dotnet test`) | The login lacks `CREATEDB`. See step 3. |
| `Seed:AdminPassword is not set, so no admin account was created.` | Set the secret (step 4) and start the API again. |
| `Could not create admin: ...` | The admin password does not meet the password rules. Choose a stronger one. |
| Browser shows a certificate warning, or `npm run dev` cannot reach the API | Run `dotnet dev-certs https --trust`, and make sure the API runs with `--launch-profile https`. |
| `Port 5173 is in use` | Another `npm run dev` is still running. Close it with **Ctrl+C**. |
| Login works but you are sent back to the login page after a while | The session ends after 20 minutes without activity. Log in again. |
| "Account locked" | 5 wrong passwords lock an account for 15 minutes. Wait, or ask an administrator to reset the password. |
