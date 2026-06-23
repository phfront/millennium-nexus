# Tailscale Funnel — URL publica HTTPS FIXA (*.ts.net), celular so no navegador
param(
  [switch]$ConfigureEnv
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

. (Join-Path $PSScriptRoot "tunnel-utils.ps1")

try {
  $null = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:3030/login" -TimeoutSec 3
} catch {
  Write-Error "Next.js nao responde em http://127.0.0.1:3030. Rode npm run dev ou npm start antes."
}

$publicUrl = Get-TailscaleFunnelUrl
if (-not $publicUrl) {
  Write-Error "Tailscale nao encontrado ou nao logado."
}

Write-Host "==> Tailscale Funnel -> http://127.0.0.1:3030" -ForegroundColor Cyan
Write-Host "    URL fixa: $publicUrl" -ForegroundColor Green
Write-Host "    ATENCAO: acessivel na internet enquanto o funnel estiver ativo." -ForegroundColor Yellow
Write-Host ""

Enable-TailscaleFunnel -Port 3030
$ts = Get-TailscaleExe
Write-Host (& $ts funnel status 2>&1 | Out-String)

if ($ConfigureEnv) {
  & (Join-Path $PSScriptRoot "tunnel-setup.ps1") -PublicUrl $publicUrl -SkipSupabaseRestart
} else {
  Write-Host ""
  Write-Host "Configuracao unica (se ainda nao fez):" -ForegroundColor Yellow
  Write-Host "  npm run tunnel:setup"
}

Write-Host ""
Write-Host "Para desligar o funnel: npm run tunnel:down"
