$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
Write-Host "==> Supabase status" -ForegroundColor Cyan
supabase status
Write-Host ""
Write-Host "App Next.js (quando rodando): http://127.0.0.1:3030" -ForegroundColor Gray
