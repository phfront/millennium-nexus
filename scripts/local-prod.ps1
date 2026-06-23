# Inicia o backend local sem resetar dados, gera o build e executa o Next.js em modo producao.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Stop-AppOnPort {
  param([int]$Port = 3030)
  Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

function Invoke-NpmScript {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Script
  )

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = cmd /c "npm run $Script 2>&1"
    $exitCode = $LASTEXITCODE
    if ($output) {
      $output | ForEach-Object { Write-Host $_ }
    }
    return $exitCode
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
}

function Invoke-NextBuild {
  param([switch]$CleanFirst)

  if ($CleanFirst) {
    Write-Host "==> Limpando cache .next..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force (Join-Path $Root ".next") -ErrorAction SilentlyContinue
  }

  return (Invoke-NpmScript -Script "build")
}

Write-Host "==> Liberando porta 3030 (se ocupada)..." -ForegroundColor DarkGray
Stop-AppOnPort
Start-Sleep -Seconds 1

Write-Host "==> Iniciando backend local..." -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "local-up.ps1") -SkipReset

Write-Host ""
Write-Host "==> Gerando build de producao..." -ForegroundColor Cyan
$buildExit = Invoke-NextBuild
if ($buildExit -ne 0) {
  Write-Host "==> Build falhou (exit $buildExit); tentando novamente com cache limpo..." -ForegroundColor Yellow
  $buildExit = Invoke-NextBuild -CleanFirst
}
if ($buildExit -ne 0) {
  Write-Error "O build do Next.js falhou (exit $buildExit). Rode: Remove-Item -Recurse -Force .next; npm run build"
}

Write-Host ""
Write-Host "==> Iniciando app em modo producao: http://127.0.0.1:3030" -ForegroundColor Green
Write-Host "    Ctrl+C encerra o app; o Supabase continua ativo." -ForegroundColor DarkGray
Stop-AppOnPort
Start-Sleep -Seconds 1

$startExit = Invoke-NpmScript -Script "start"
if ($startExit -ne 0) {
  Write-Error "npm start falhou (exit $startExit). Verifique se a porta 3030 esta livre."
}
