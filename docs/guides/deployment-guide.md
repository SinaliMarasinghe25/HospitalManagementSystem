# Deployment guide

How the HMS runs outside your development setup: on your own computer with Docker, and as a public HTTPS demo on Render (the app) and Neon (the database). It also covers automatic tests on GitHub, backups, restore and what to do when something breaks.

> The public site is a **demonstration environment** (plan item C1): fictitious data and demo accounts only. A real hospital would run the HMS on-premises or in a properly governed cloud with a signed data-protection agreement.

## 1. How it fits together

```text
 Browser ──HTTPS──▶ Render (free web service, Singapore)
                     reverse proxy: HTTPS certificate, forwards to the container
                        │ http, port 8080
                        ▼
                     Docker container "hms"
                     ASP.NET Core (Kestrel) API + the built React app in wwwroot
                        │ TLS (sslmode=require)
                        ▼
                     Neon PostgreSQL (free plan)
```

- **One image, one address.** The `Dockerfile` builds the React app and the API and puts the React files in the API's `wwwroot`. The API serves both, so the browser talks to one address, the login cookie stays same-site, and CORS stays closed, exactly as with the Vite proxy in development.
- **Web server (SW-02, plan item C2).** Kestrel, ASP.NET Core's built-in server, runs inside the container. Render's Nginx-based reverse proxy sits in front, ends HTTPS and forwards each request. `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` (set in the Dockerfile) makes the API trust the proxy's `X-Forwarded-Proto` and `X-Forwarded-For` headers, so it knows the visitor used HTTPS and sees the visitor's real IP address (the "forgot password" rate limit needs it).
- **Migrations.** `Database__MigrateOnStartup=true` (in the Dockerfile) makes the API apply any new migrations when it starts. On your development PC it stays off and you keep using `dotnet ef database update`.
- **Health check.** `GET /health` answers `Healthy` when the API runs and can reach the database. Render calls it before it switches traffic to a new version, and keeps the old version running if it fails.

### What changed in the code for deployment

| File | Why |
| --- | --- |
| `Dockerfile`, `.dockerignore` | Build the one image (Node builds React, the .NET SDK builds the API, the small ASP.NET runtime image runs it as a non-root user) |
| `docker-compose.yml`, `.env.example` | Run the image plus PostgreSQL on your own computer with one command |
| `render.yaml` | Tells Render how to run the image (free plan, Singapore, health check, which secrets to ask for) |
| `.github/workflows/ci.yml` | GitHub runs all tests and builds the image on every pull request |
| `scripts/backup-db.ps1`, `scripts/restore-db.ps1` | Backup and restore, locally or against Neon |
| `backend/Hms.Api/Program.cs` | Migrations on start-up, `/health`, security headers, serving React, keys folder for the cookie |
| `backend/Hms.Api/Hosting/` | `DatabaseUrl.cs` (accepts a `postgresql://...` URL), `DatabaseHealthCheck.cs`, `SecurityHeaders.cs` |
| `backend/Hms.Api/appsettings.Production.json` | Quieter logs in production (no SQL text in the log) |

### Settings (environment variables)

ASP.NET Core reads `__` (two underscores) in an environment variable name as `:`. So `ConnectionStrings__HmsDatabase` is the same setting as `ConnectionStrings:HmsDatabase` in User Secrets.

| Variable | Where it is set | Secret? | Meaning |
| --- | --- | --- | --- |
| `ConnectionStrings__HmsDatabase` | Render dashboard / `docker-compose.yml` | **Yes** | Database. Either `Host=...;Password=...` or a `postgresql://...` URL |
| `Seed__AdminPassword` | Render dashboard / `.env` | **Yes** | Password of the first `admin` login (only used when `admin` does not exist yet) |
| `ASPNETCORE_ENVIRONMENT` | Dockerfile | No | `Production`: no OpenAPI page, safe error answers, HSTS |
| `ASPNETCORE_FORWARDEDHEADERS_ENABLED` | Dockerfile | No | Trust the reverse proxy's forwarded headers |
| `Database__MigrateOnStartup` | Dockerfile | No | Apply migrations when the API starts |
| `DataProtection__KeysPath` | `docker-compose.yml` | No | Folder that keeps the cookie keys between restarts |
| `PORT` | `render.yaml` | No | Tells Render the container listens on 8080 |

Secrets live **only** in the Render dashboard and in your local `.env` file. `.env` is in `.gitignore`; only `.env.example` (with placeholder values) is committed.

## 2. Run the production version on your own computer (Docker)

This is the same image that runs on Render, so it is the best test before you deploy.

**Install Docker Desktop once** from docker.com (Download for Windows). Accept the WSL 2 option it offers, restart Windows when asked, and start Docker Desktop. Check in PowerShell:

```powershell
docker --version
docker compose version
```

**Start the HMS:**

```powershell
cd C:\dev\HospitalManagementSystem
Copy-Item .env.example .env     # once; then open .env in VS Code and choose your own passwords
docker compose up -d --build
```

The first build downloads about 1 GB and takes a few minutes; later builds are quicker. Then open **http://localhost:8080** and log in as `admin` with `ADMIN_PASSWORD` from `.env`.

| Command | What it does |
| --- | --- |
| `docker compose ps` | Shows the two containers (`db` and `app`) and whether they run |
| `docker compose logs app -f` | Shows the API's log live (Ctrl+C to stop watching) |
| `docker compose up -d --build` | Rebuilds after you changed code, and restarts |
| `docker compose down` | Stops everything. Your data stays (it is in Docker volumes) |
| `docker compose down -v` | Stops everything **and deletes the data** (database, documents) |

This Docker database is separate from the PostgreSQL you installed for development, so you start with an empty system.

## 3. Deploy the public demo (Render + Neon)

Both have free plans that need no credit card.

### 3.1 Create the database on Neon

1. Sign up at **neon.com** (Sign up with GitHub is easiest).
2. Create a project: name `hms`, PostgreSQL version **17**, region **AWS Asia Pacific (Singapore)** (close to the Render app).
3. On the project dashboard click **Connect**. Turn **Connection pooling off** (the API keeps its own pool, and migrations need a direct connection). Copy the connection string. It looks like
   `postgresql://neondb_owner:xxxx@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
4. Keep it somewhere private (for example a password manager). It contains the database password. Never put it in a file in the repository.

### 3.2 Create the app on Render

1. Sign up at **render.com** with your GitHub account.
2. **New** → **Blueprint**. Connect the `HospitalManagementSystem` repository. Render finds `render.yaml`.
3. Render asks for the two secret values:
   - `ConnectionStrings__HmsDatabase`: paste the Neon connection string from 3.1.
   - `Seed__AdminPassword`: a strong password for `admin` (8+ characters, upper case, lower case, digit, symbol).
4. Click **Apply**. The first build takes about 5 to 10 minutes. Watch **Logs**: at the end you see `Applying database migrations...`, `Created admin account admin` and `Application started`. On the very first start you also see one red `fail:` line about `__EFMigrationsHistory`: that is EF Core checking for a table that does not exist yet. It is harmless.
5. Your address is shown at the top, for example `https://hms-xxxx.onrender.com`. Open it and log in as `admin`.

From now on, every merge to `main` deploys automatically. If the new version fails its health check, Render keeps the old one running.

### 3.3 Prepare the demo

1. Log in as `admin`. Because this password was typed into Render's dashboard, change it once (account menu → Change password) and keep the new one private.
2. Create one demo login per role on the **Users** page (for example `demo.doctor`, `demo.nurse`, `demo.reception`, `demo.lab`, `demo.pharmacy`, `demo.accounts`), with the matching doctor or employee record where the form asks for it.
3. Add a few **fictitious** patients and walk through the demo scenario in the project plan (book, consult, lab, dispense, bill).
4. Make a backup (section 5) once the demo data is complete, so you can always return to it.

### 3.4 Smoke test (after every deployment)

| Check | Expected |
| --- | --- |
| Open `https://<your-app>.onrender.com/health` | `Healthy` |
| The address bar | A padlock (HTTPS). `http://` is redirected to `https://` |
| Log in with each demo role | Each role sees only its own menu and dashboard tiles |
| Refresh the browser on a deep page such as `/patients` | The page loads again (not a 404) |
| Wrong password 5 times on a demo login | The account is locked for 15 minutes |

### 3.5 Limits of the free demo hosting (NFR-REL-02)

| Limit | Effect | In a real hospital |
| --- | --- | --- |
| Render free web service sleeps after 15 minutes without visitors | The first visit after a quiet period takes about a minute to load. Open the site a few minutes before a presentation | A paid, always-on instance, at least two for high availability |
| Render free has no permanent disk | **Uploaded patient documents disappear** when the app restarts or redeploys, and everyone is logged out. Database data is safe (it is on Neon) | Documents in cloud object storage or the database; a paid disk |
| Neon free compute pauses when idle and has limited storage | The first query after a pause takes about a second longer | A paid plan with guaranteed resources |
| One instance only | No failover if the instance fails | Several instances behind a load balancer |

## 4. Automatic tests on GitHub (CI)

`.github/workflows/ci.yml` runs on every pull request and every push to `main`:

| Job | What it does |
| --- | --- |
| Backend tests (xUnit) | Starts a throw-away PostgreSQL 17 and runs `dotnet test` (all backend tests) |
| Frontend lint, tests and build | `npm ci`, `npm run lint`, `npm test`, `npm run build` |
| Docker image builds | Builds the same image Render will build (only after the two jobs above pass) |

On a pull request, scroll to the bottom: you see a yellow dot while it runs, then a green tick or a red cross per job. Click **Details** on a red cross to read the error. Only merge when all three are green. Free for public repositories. It needs no secrets.

## 5. Backup and restore (NFR-REL-01, BR-01 to BR-04)

The scripts need only Docker Desktop. Backups go to the `backups` folder, which is in `.gitignore`.

**Back up the Docker database on your computer** (also copies the uploaded documents):

```powershell
.\scripts\backup-db.ps1
```

**Back up the Neon database** (paste your Neon connection string in quotes):

```powershell
.\scripts\backup-db.ps1 -DatabaseUrl "postgresql://...neon.tech/neondb?sslmode=require&channel_binding=require"
```

**Restore** (asks you to type `YES`, then replaces all data with the backup):

```powershell
.\scripts\restore-db.ps1 -BackupFile .\backups\hms-2026-11-22_090000.dump
.\scripts\restore-db.ps1 -BackupFile .\backups\hms-2026-11-22_090000.dump -DatabaseUrl "postgresql://..."
```

If PowerShell says running scripts is disabled, run this once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

**Scheduled backup.** Neon itself keeps a short history of the database, so you can also restore it to an earlier moment from the Neon dashboard (its **Backup & Restore** page; how far back depends on the free plan). For your own copies, let Windows run the backup every night at 21:00 (while the PC is on and Docker Desktop runs). Run this once in PowerShell, with your Neon URL:

```powershell
$url = "postgresql://...neon.tech/neondb?sslmode=require&channel_binding=require"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File C:\dev\HospitalManagementSystem\scripts\backup-db.ps1 -DatabaseUrl `"$url`""
Register-ScheduledTask -TaskName "HMS nightly backup" -Action $action -Trigger (New-ScheduledTaskTrigger -Daily -At 21:00)
```

The task stores the URL (with its password) in Windows Task Scheduler on your PC only. Delete old `.dump` files from time to time.

**Restore test (do it once, and record it as evidence).** Make a backup; add a test patient; restore the backup; check the test patient is gone and everything else is there. This was tested with the Docker setup while building this step.

## 6. If something goes wrong (disaster recovery)

| Problem | What to do |
| --- | --- |
| A new version is broken after a merge | Render → your service → **Events** → pick the last good deploy → **Rollback**. Then fix the code in a new pull request |
| Data was deleted or damaged by mistake | Restore the latest good backup (section 5), or use Neon's **Restore** to a time before the mistake |
| Render shows "Deploy failed" | Open **Logs**. A database error usually means a wrong `ConnectionStrings__HmsDatabase`: copy it again from Neon |
| `/health` says `Unhealthy` | The API cannot reach Neon. Check the Neon project is not deleted or out of storage, and the connection string |
| `admin` password is lost | Another administrator resets it on the Users page. If there is none: restore a backup from before, or (last resort) delete the Neon database, create a new one, and deploy again (empty system) |
| A secret leaked (for example the Neon URL was committed) | In Neon, **Reset password** for the role; put the new connection string into Render (Environment) and save. Then remove it from Git history |
| `docker compose up` says a variable is not set | Create `.env` from `.env.example` (section 2) |
| Port 8080 is already in use on your PC | In `docker-compose.yml` change `"8080:8080"` to `"8081:8080"` and open http://localhost:8081 |

Recovery goals for the demo: at most one day of data lost (nightly backup, Neon history), back online within one hour (redeploy or restore).
