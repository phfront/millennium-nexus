# Encerra tunel publico e restaura .env.local para acesso so local
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

. (Join-Path $PSScriptRoot "env-file-utils.ps1")

if (Get-Command tailscale -ErrorAction SilentlyContinue) {
  Write-Host "==> tailscale funnel reset" -ForegroundColor Cyan
  tailscale funnel reset 2>$null
}

$envLocal = Join-Path $Root ".env.local"
if (Test-Path $envLocal) {
  Repair-EnvFile $envLocal
  $map = @{}
  Get-Content $envLocal | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
    $k, $v = $_ -split '=', 2
    $map[$k] = $v
  }

  $map.Remove('NEXT_PUBLIC_APP_URL')
  $map.Remove('TUNNEL_ACCESS_TOKEN')
  $map.Remove('SUPABASE_INTERNAL_URL')
  if ($map['NEXT_PUBLIC_SUPABASE_URL'] -match '/supabase-api$') {
    $map['NEXT_PUBLIC_SUPABASE_URL'] = 'http://127.0.0.1:15021'
  }

  $lines = $map.GetEnumerator() | ForEach-Object { "{0}={1}" -f $_.Key, $_.Value }
  Write-Utf8NoBomLines -Path $envLocal -Lines $lines
  Write-Host "==> .env.local restaurado para modo local" -ForegroundColor Green
}

Write-Host ""
Write-Host "Encerre cloudflared manualmente (Ctrl+C) se estiver rodando." -ForegroundColor Gray
Write-Host "Reinicie o Next para aplicar o .env.local." -ForegroundColor Gray
