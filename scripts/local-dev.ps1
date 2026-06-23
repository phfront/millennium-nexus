# Inicia o backend local sem resetar dados e mantem o Next.js no terminal atual.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "==> Iniciando backend local..." -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "local-up.ps1") -SkipReset

Write-Host ""
Write-Host "==> Iniciando frontend em http://127.0.0.1:3030" -ForegroundColor Cyan
Write-Host "    Ctrl+C encerra o frontend; o Supabase continua ativo." -ForegroundColor DarkGray
npm run dev
