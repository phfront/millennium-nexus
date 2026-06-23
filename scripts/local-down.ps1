$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
Write-Host "==> Parando Supabase local..." -ForegroundColor Yellow
supabase stop
Write-Host "==> Parado." -ForegroundColor Green
