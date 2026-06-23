# Expoe Next.js (porta 3030) via Tailscale Serve com HTTPS
$ErrorActionPreference = "Stop"

if (-not (Get-Command tailscale -ErrorAction SilentlyContinue)) {
  Write-Error "Tailscale CLI nao encontrado. Instale: https://tailscale.com/download/windows"
}

Write-Host "==> Tailscale Serve -> http://127.0.0.1:3030 (HTTPS na tailnet)" -ForegroundColor Cyan
Write-Host "    Certifique-se de que o Next esta rodando (npm run dev ou npm start)" -ForegroundColor Gray
Write-Host ""

tailscale serve --bg --https=443 http://127.0.0.1:3030
tailscale serve status

Write-Host ""
Write-Host "Adicione a URL HTTPS acima em supabase/config.toml [auth] additional_redirect_urls" -ForegroundColor Yellow
Write-Host "Depois: npm run local:down && npm run local:up"
