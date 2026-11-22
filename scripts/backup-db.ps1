<#
.SYNOPSIS
  Makes a backup of the HMS database (and, for the Docker setup, the uploaded patient documents).

.EXAMPLE
  # The database running in Docker Compose on this computer:
  .\scripts\backup-db.ps1

.EXAMPLE
  # A hosted database (paste the connection URL your host shows, in quotes):
  .\scripts\backup-db.ps1 -DatabaseUrl "postgresql://user:password@host/dbname?sslmode=require"

  Backups are saved in the "backups" folder (never committed: it is in .gitignore).
  Only Docker Desktop is needed; PostgreSQL does not have to be installed on this computer.
#>
param(
    [string]$DatabaseUrl,
    # The PostgreSQL tools image. Its version must be the same as, or newer than, the database server's.
    [string]$PgImage = "postgres:17-alpine"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$backupDir = Join-Path $root "backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$stamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$fileName = "hms-$stamp.dump"

if ($DatabaseUrl) {
    # A temporary PostgreSQL container runs pg_dump and writes straight into the backups folder.
    docker run --rm -v "${backupDir}:/backups" $PgImage pg_dump "$DatabaseUrl" --format=custom --no-owner --file "/backups/$fileName"
    if ($LASTEXITCODE -ne 0) { throw "pg_dump failed (see the message above)." }
}
else {
    Push-Location $root
    try {
        # The dump is written inside the db container first, then copied out.
        # (Piping it through PowerShell would damage the binary file.)
        docker compose exec -T db pg_dump -U hms_app -d hms --format=custom --file /tmp/hms.dump
        if ($LASTEXITCODE -ne 0) { throw "pg_dump failed. Is the app running? (docker compose up -d)" }
        docker compose cp db:/tmp/hms.dump (Join-Path $backupDir $fileName)
        docker compose exec -T db rm /tmp/hms.dump

        # The uploaded patient documents live in a Docker volume; copy them next to the database backup.
        $docsDir = Join-Path $backupDir "hms-$stamp-documents"
        docker compose cp app:/app/App_Data/patient-documents $docsDir
    }
    finally { Pop-Location }
}

$file = Get-Item (Join-Path $backupDir $fileName)
Write-Host "Backup saved: $($file.FullName) ($([math]::Round($file.Length / 1KB)) KB)" -ForegroundColor Green
