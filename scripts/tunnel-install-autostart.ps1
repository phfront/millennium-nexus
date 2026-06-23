# Registra Task Scheduler para subir Funnel apos login no Windows
param(
  [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$taskName = "MillenniumNexus-TunnelAutostart"
$scriptPath = Join-Path $PSScriptRoot "tunnel-autostart.ps1"

if ($Uninstall) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "==> Tarefa '$taskName' removida." -ForegroundColor Green
  exit 0
}

if (-not (Test-Path $scriptPath)) {
  Write-Error "Script nao encontrado: $scriptPath"
}

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" `
  -WorkingDirectory $Root

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1)

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Sobe Supabase + Next + Tailscale Funnel (URL fixa) apos login no Windows" `
  -Force | Out-Null

Write-Host "==> Tarefa agendada '$taskName' criada (executa no login)." -ForegroundColor Green
Write-Host ""
Write-Host "Requisitos:" -ForegroundColor Cyan
Write-Host "  1. Tailscale logado (app aberto uma vez apos boot)"
Write-Host "  2. Docker Desktop inicia com o Windows"
Write-Host "  3. npm run tunnel:setup ja executado (URL fixa configurada)"
Write-Host ""
Write-Host "Testar agora: npm run tunnel:autostart" -ForegroundColor Yellow
Write-Host "Remover: npm run tunnel:install-autostart -- -Uninstall" -ForegroundColor Gray
