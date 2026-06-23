# Configuracao UNICA — URL fixa Tailscale Funnel (nao muda ao reiniciar o PC)
param(
  [string]$PublicUrl,
  [switch]$SkipSupabaseRestart
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

. (Join-Path $PSScriptRoot "tunnel-utils.ps1")
. (Join-Path $PSScriptRoot "env-file-utils.ps1")

if (-not $PublicUrl) {
  $PublicUrl = Get-TailscaleFunnelUrl
  if (-not $PublicUrl) {
    Write-Error "Nao foi possivel detectar a URL do Funnel. Passe manualmente: npm run tunnel:setup -- https://seu-pc.seu-tailnet.ts.net"
  }
}

Write-Host "==> URL fixa Tailscale Funnel: $PublicUrl" -ForegroundColor Cyan
Write-Host "    (Esta URL nao muda quando o PC reinicia.)" -ForegroundColor Gray
Write-Host ""

& (Join-Path $PSScriptRoot "tunnel-env.ps1") -PublicUrl $PublicUrl -GenerateToken

$configToml = Join-Path $Root "supabase\config.toml"
$content = Get-Content $configToml -Raw
$urlBase = $PublicUrl.TrimEnd('/')
$urlGlob = "$urlBase/**"

if ($content -notmatch [regex]::Escape($urlBase)) {
  $content = $content -replace '(additional_redirect_urls = \[\s*)', "`$1`n  `"$urlBase`",`n  `"$urlGlob`","
  [System.IO.File]::WriteAllText($configToml, $content)
  Write-Host "==> supabase/config.toml atualizado com redirect da URL fixa" -ForegroundColor Green
} else {
  Write-Host "==> supabase/config.toml ja contem a URL" -ForegroundColor DarkGray
}

$tunnelDir = Join-Path $Root "tunnels"
New-Item -ItemType Directory -Force -Path $tunnelDir | Out-Null

$envLocal = Join-Path $Root ".env.local"
Repair-EnvFile $envLocal
$token = $null
Get-Content $envLocal | ForEach-Object {
  if ($_ -match '^TUNNEL_ACCESS_TOKEN=(.+)$') {
    $token = $Matches[1]
  }
}

$accessLink = "$urlBase/?tunnel_token=$token"
Set-Content -Path (Join-Path $tunnelDir "public-url.txt") -Value $urlBase -Encoding utf8
Set-Content -Path (Join-Path $tunnelDir "access-link.txt") -Value $accessLink -Encoding utf8

Write-Host ""
Write-Host "==> Link permanente (guarde nos favoritos do celular):" -ForegroundColor Green
Write-Host "  $accessLink"
Write-Host ""

if (-not $SkipSupabaseRestart) {
  Write-Host "==> Reiniciando Supabase para aplicar redirects..." -ForegroundColor Yellow
  $null = Invoke-SupabaseCli stop
  $startExit = Invoke-SupabaseCli start
  if ($startExit -ne 0) {
    Write-Error "supabase start falhou (exit $startExit). Rode: supabase start --debug"
  }
  & (Join-Path $PSScriptRoot "local-up.ps1") -SkipReset
}

Write-Host ""
Write-Host "Proximo passo (uma vez): npm run tunnel:install-autostart" -ForegroundColor Cyan
Write-Host "Depois de reiniciar o PC, o funnel sobe sozinho." -ForegroundColor Gray
