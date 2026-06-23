# Restaura dump no Postgres local
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$DumpPath
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path $DumpPath)) {
  Write-Error "Arquivo nao encontrado: $DumpPath"
}

$resolved = (Resolve-Path $DumpPath).Path
Write-Host "==> Restaurando $resolved" -ForegroundColor Yellow
Write-Host "    Isso substitui dados no Postgres local." -ForegroundColor Red

$confirm = Read-Host "Continuar? (s/N)"
if ($confirm -notin @("s", "S", "sim", "Sim")) {
  Write-Host "Cancelado."
  exit 0
}

$container = (docker ps --filter "name=supabase_db" --format "{{.Names}}" | Select-Object -First 1)
if (-not $container) {
  Write-Error "Container supabase_db nao encontrado. Rode npm run local:up"
}

docker cp $resolved "${container}:/tmp/nexus-restore.dump"
docker exec $container pg_restore -U postgres -d postgres --clean --if-exists --no-owner --no-acl /tmp/nexus-restore.dump
docker exec $container rm -f /tmp/nexus-restore.dump

Write-Host "==> Restore concluido." -ForegroundColor Green
