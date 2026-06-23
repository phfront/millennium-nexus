# pg_dump do Postgres local (Supabase Docker)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$backupDir = Join-Path $Root "backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
$outFile = Join-Path $backupDir "nexus-local_$timestamp.dump"

$container = (docker ps --filter "name=supabase_db" --format "{{.Names}}" | Select-Object -First 1)
if (-not $container) {
  Write-Error "Container supabase_db nao encontrado. Rode npm run local:up"
}

Write-Host "==> Backup: $outFile" -ForegroundColor Cyan
docker exec $container pg_dump -U postgres -Fc postgres -f /tmp/nexus-backup.dump
docker cp "${container}:/tmp/nexus-backup.dump" $outFile
docker exec $container rm -f /tmp/nexus-backup.dump

$sizeMb = [math]::Round((Get-Item $outFile).Length / 1MB, 2)
Write-Host "==> OK ($sizeMb MB)" -ForegroundColor Green
