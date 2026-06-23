# Configura .env.local para acesso remoto via túnel (Cloudflare ou Tailscale Funnel)
param(
  [Parameter(Mandatory = $true)]
  [string]$PublicUrl,

  [switch]$GenerateToken
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

. (Join-Path $PSScriptRoot "env-file-utils.ps1")

$PublicUrl = $PublicUrl.Trim().TrimEnd('/')
if ($PublicUrl -notmatch '^https?://') {
  Write-Error "PublicUrl deve comecar com http:// ou https:// (ex.: https://abc.trycloudflare.com)"
}

$envLocal = Join-Path $Root ".env.local"
if (-not (Test-Path $envLocal)) {
  Write-Error ".env.local nao encontrado. Rode: npm run local:up"
}

Repair-EnvFile $envLocal
$map = @{}
Get-Content $envLocal | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $k, $v = $_ -split '=', 2
  $map[$k] = $v
}

$map['NEXT_PUBLIC_APP_URL'] = $PublicUrl
$map['NEXT_PUBLIC_SUPABASE_URL'] = '/supabase-api'
if (-not $map['SUPABASE_INTERNAL_URL']) {
  $map['SUPABASE_INTERNAL_URL'] = 'http://127.0.0.1:15021'
}

if ($GenerateToken -or -not $map['TUNNEL_ACCESS_TOKEN']) {
  $token = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
  $map['TUNNEL_ACCESS_TOKEN'] = $token
  Write-Host "==> TUNNEL_ACCESS_TOKEN gerado (guarde este link):" -ForegroundColor Yellow
}

$lines = $map.GetEnumerator() | ForEach-Object { "{0}={1}" -f $_.Key, $_.Value }
Write-Utf8NoBomLines -Path $envLocal -Lines $lines

$accessUrl = "$PublicUrl/?tunnel_token=$($map['TUNNEL_ACCESS_TOKEN'])"

Write-Host ""
Write-Host "==> .env.local atualizado para modo tunel" -ForegroundColor Green
Write-Host "  NEXT_PUBLIC_APP_URL=$PublicUrl"
Write-Host "  NEXT_PUBLIC_SUPABASE_URL=$($map['NEXT_PUBLIC_SUPABASE_URL'])"
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Cyan
Write-Host "  1. Adicione em supabase/config.toml -> [auth] additional_redirect_urls:"
Write-Host "     `"$PublicUrl`", `"$PublicUrl/**`""
Write-Host "  2. Reinicie Supabase: npm run local:down && npm run local:up -SkipReset"
Write-Host "  3. Reinicie o Next (npm run dev) para carregar o .env.local"
Write-Host ""
Write-Host "Link de acesso (guarde - nao commitar):" -ForegroundColor Green
Write-Host "  $accessUrl"
Write-Host ""
Write-Host "Para desligar o tunel: npm run tunnel:down"
