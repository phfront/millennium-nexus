# Dispara cron de push - use no Task Scheduler (a cada 15-30 min)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $Root ".env.local"

if (-not (Test-Path $envFile)) {
  Write-Error "Arquivo .env.local nao encontrado. Rode npm run local:up"
}

Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $name, $value = $_ -split '=', 2
  Set-Item -Path "Env:$name" -Value $value
}

$secret = $env:CRON_SECRET
if (-not $secret -or $secret -eq "change-me-to-a-long-random-string") {
  Write-Error "Defina CRON_SECRET no .env.local"
}

$baseUrl = if ($env:NEXT_PUBLIC_APP_URL) { $env:NEXT_PUBLIC_APP_URL.TrimEnd('/') } else { "http://127.0.0.1:3030" }
$url = "$baseUrl/api/cron/push"

Write-Host "==> POST $url" -ForegroundColor Cyan

try {
  $response = Invoke-RestMethod -Uri $url -Method POST -Headers @{
    Authorization = "Bearer $secret"
  } -TimeoutSec 120
  $response | ConvertTo-Json -Compress
  Write-Host "==> OK" -ForegroundColor Green
} catch {
  Write-Error $_.Exception.Message
}
