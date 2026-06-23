# Túnel rápido Cloudflare (grátis) — celular abre no navegador, sem app
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  $localBin = Join-Path $PSScriptRoot "cloudflared.exe"
  if (-not (Test-Path $localBin)) {
    Write-Host "cloudflared nao encontrado. Baixando para scripts/cloudflared.exe..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/download/2026.5.2/cloudflared-windows-amd64.exe" -OutFile $localBin
  }
  $cloudflared = $localBin
} else {
  $cloudflared = "cloudflared"
}

try {
  $null = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:3030" -TimeoutSec 3
} catch {
  Write-Error "Next.js nao responde em http://127.0.0.1:3030. Rode npm run dev antes."
}

Write-Host ""
Write-Host "==> Cloudflare Quick Tunnel -> http://127.0.0.1:3030" -ForegroundColor Cyan
Write-Host ""
Write-Host "Quando aparecer a URL *.trycloudflare.com, em OUTRO terminal:" -ForegroundColor Yellow
Write-Host "  npm run tunnel:env -- https://SUA-URL.trycloudflare.com"
Write-Host ""
Write-Host "Depois reinicie o Next (Ctrl+C e npm run dev) e abra o link com tunnel_token." -ForegroundColor Gray
Write-Host "Ctrl+C para encerrar o tunel." -ForegroundColor Gray
Write-Host ""

& $cloudflared tunnel --url http://127.0.0.1:3030
