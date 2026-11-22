<#
.SYNOPSIS
  Puts a backup made by backup-db.ps1 back into the database. EVERYTHING in the database is replaced.

.EXAMPLE
  # The database running in Docker Compose on this computer:
  .\scripts\restore-db.ps1 -BackupFile .\backups\hms-2026-11-21_150000.dump

.EXAMPLE
  # A hosted database:
  .\scripts\restore-db.ps1 -BackupFile .\backups\hms-2026-11-21_150000.dump -DatabaseUrl "postgresql://user:password@host/dbname?sslmode=require"
#>
param(
    [Parameter(Mandatory = $true)][string]$BackupFile,
    [string]$DatabaseUrl,
    [string]$PgImage = "postgres:17-alpine"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$file = Get-Item $BackupFile   # stops here if the file does not exist

Write-Host "This REPLACES all data in the database with the backup $($file.Name)." -ForegroundColor Yellow
$answer = Read-Host "Type YES to continue"
if ($answer -cne "YES") { Write-Host "Cancelled. Nothing was changed."; exit 1 }

if ($DatabaseUrl) {
    docker run --rm -v "$($file.DirectoryName):/backups" $PgImage pg_restore --dbname "$DatabaseUrl" --clean --if-exists --no-owner --no-privileges "/backups/$($file.Name)"
    if ($LASTEXITCODE -ne 0) { throw "pg_restore failed (see the message above)." }
}
else {
    Push-Location $root
    try {
        # Stop the app so nobody changes data in the middle of the restore.
        docker compose stop app
        docker compose cp $file.FullName db:/tmp/restore.dump
        docker compose exec -T db pg_restore -U hms_app -d hms --clean --if-exists --no-owner /tmp/restore.dump
        $failed = $LASTEXITCODE -ne 0
        docker compose exec -T db rm /tmp/restore.dump
        docker compose start app
        if ($failed) { throw "pg_restore failed (see the message above)." }
    }
    finally { Pop-Location }
}

Write-Host "Restore finished. Log in and check the data." -ForegroundColor Green
