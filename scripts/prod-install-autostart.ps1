# Registra Task Scheduler para subir backend + frontend em modo producao apos login no Windows.
param(
  [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$taskName = "MillenniumNexus-ProdAutostart"
$scriptPath = Join-Path $PSScriptRoot "prod-autostart.ps1"
$hiddenLauncherPath = Join-Path $PSScriptRoot "prod-autostart-hidden.vbs"

if ($Uninstall) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "==> Tarefa '$taskName' removida." -ForegroundColor Green
  exit 0
}

if (-not (Test-Path $scriptPath)) {
  Write-Error "Script nao encontrado: $scriptPath"
}

if (-not (Test-Path $hiddenLauncherPath)) {
  Write-Error "Launcher oculto nao encontrado: $hiddenLauncherPath"
}

$action = New-ScheduledTaskAction `
  -Execute "wscript.exe" `
  -Argument "`"$hiddenLauncherPath`"" `
  -WorkingDirectory $Root

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Seconds 0)

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Sobe Supabase + Next em modo producao apos login no Windows" `
  -Force | Out-Null

Write-Host "==> Tarefa agendada '$taskName' criada (executa no login)." -ForegroundColor Green
Write-Host ""
Write-Host "Requisitos:" -ForegroundColor Cyan
Write-Host "  1. Docker Desktop inicia com o Windows"
Write-Host "  2. Node/npm continuam instalados para o usuario atual"
Write-Host "  3. .env.local ja esta configurado"
Write-Host ""
Write-Host "Testar agora: npm run prod:autostart" -ForegroundColor Yellow
Write-Host "Remover: npm run prod:install-autostart -- -Uninstall" -ForegroundColor Gray
