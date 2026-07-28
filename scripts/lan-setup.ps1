param(
  [string]$Domain = "millennium.com",
  [string]$StaticIP,
  [switch]$Revert
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$TaskName = "MillenniumNexus-LanDNS"
$DnsScript = Join-Path $PSScriptRoot "lan-dns-server.cjs"
$HostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"

. (Join-Path $PSScriptRoot "env-file-utils.ps1")

if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
  Write-Error "Execute como ADMINISTRADOR (botao direito > Executar como administrador)"
  exit 1
}

$adapter = Get-NetAdapter | Where-Object { $_.Status -eq "Up" -and $_.InterfaceDescription -notmatch "Virtual|Loopback|Bluetooth|Pseudo" } | Select-Object -First 1
if (-not $adapter) { Write-Error "Nenhuma placa de rede ativa encontrada"; exit 1 }

$adapterIndex = $adapter.ifIndex
$adapterName = $adapter.Name
$currentIp = (Get-NetIPAddress -InterfaceIndex $adapterIndex -AddressFamily IPv4).IPAddress
$gateway = (Get-NetRoute -InterfaceIndex $adapterIndex -DestinationPrefix "0.0.0.0/0").NextHop

Write-Host "Placa: $adapterName (IP: $currentIp, Gateway: $gateway)" -ForegroundColor Cyan

if (-not $StaticIP) {
  $parts = $currentIp -split '\.'
  $parts[-1] = [int]$parts[-1]
  $StaticIP = $parts -join '.'
}

if ($Revert) {
  Write-Host "==> Revertendo LAN mode..." -ForegroundColor Yellow
  Set-NetIPInterface -InterfaceIndex $adapterIndex -Dhcp Enabled
  Set-DnsClientServerAddress -InterfaceIndex $adapterIndex -ResetServerAddresses
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match "lan-dns-server" } | Stop-Process -Force

  $hostsBytes = [System.IO.File]::ReadAllBytes($HostsPath)
  $hostsContent = [System.Text.Encoding]::UTF8.GetString($hostsBytes)
  $hostsContent = $hostsContent -replace "(?m)^\s*$StaticIP\s+$Domain\s*`r?`n", ""
  [System.IO.File]::WriteAllBytes($HostsPath, [System.Text.Encoding]::UTF8.GetBytes($hostsContent))

  Restart-NetAdapter -Name $adapterName -Confirm:$false
  Write-Host "Revertido para DHCP. Reconecte o WiFi." -ForegroundColor Green
  exit 0
}

# ── 1. Static IP ──
Write-Host "==> 1. IP estatico: $StaticIP" -ForegroundColor Yellow
try {
  $existing = Get-NetIPAddress -InterfaceIndex $adapterIndex -IPAddress $StaticIP -ErrorAction SilentlyContinue
  if (-not $existing) {
    New-NetIPAddress -InterfaceIndex $adapterIndex -IPAddress $StaticIP -PrefixLength 24 -DefaultGateway $gateway -ErrorAction Stop
  }
  Write-Host "    OK" -ForegroundColor Green
} catch { Write-Host "    $($_.Exception.Message)" -ForegroundColor Gray }

# ── 2. PC DNS (localhost -> DNS server -> roteador) ──
Write-Host "==> 2. DNS local" -ForegroundColor Yellow
Set-DnsClientServerAddress -InterfaceIndex $adapterIndex -ServerAddresses ("127.0.0.1", $gateway)

# ── 3. Hosts file (fallback no proprio PC) ──
Write-Host "==> 3. Hosts file" -ForegroundColor Yellow
$hostsLine = "$StaticIP $Domain"
$hostsBytes = [System.IO.File]::ReadAllBytes($HostsPath)
$hostsContent = [System.Text.Encoding]::UTF8.GetString($hostsBytes)
if ($hostsContent -notmatch [regex]::Escape($hostsLine)) {
  $hostsContent = $hostsContent.TrimEnd() + "`r`n$hostsLine" + "`r`n"
  [System.IO.File]::WriteAllBytes($HostsPath, [System.Text.Encoding]::UTF8.GetBytes($hostsContent))
  Write-Host "    $Domain -> $StaticIP adicionado ao hosts" -ForegroundColor Green
} else { Write-Host "    Ja existe" -ForegroundColor Gray }

# ── 4. DNS Server (scheduled task) ──
Write-Host "==> 4. Servico DNS na inicializacao" -ForegroundColor Yellow
$nodeExe = (Get-Command node).Source
$action = New-ScheduledTaskAction -Execute $nodeExe -Argument "`"$DnsScript`" $StaticIP"
$trigger = New-ScheduledTaskTrigger -AtLogon
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId ([Environment]::UserName) -RunLevel Highest
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Write-Host "    Tarefa '$TaskName' criada" -ForegroundColor Green

# Start now
$running = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match "lan-dns-server" }
if (-not $running) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $nodeExe; $psi.Arguments = "`"$DnsScript`" $StaticIP"
  $psi.UseShellExecute = $true; $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
  [System.Diagnostics.Process]::Start($psi) | Out-Null
  Write-Host "    DNS rodando em 127.0.0.1:53" -ForegroundColor Green
} else { Write-Host "    Ja rodando" -ForegroundColor Gray }

# ── 5. .env.local ──
Write-Host "==> 5. .env.local para LAN" -ForegroundColor Yellow
$envLocal = Join-Path $Root ".env.local"
if (Test-Path $envLocal) {
  Repair-EnvFile $envLocal
  $map = @{}
  Get-Content $envLocal | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
    $k, $v = $_ -split '=', 2
    $map[$k] = $v.Trim()
  }
  $map['NEXT_PUBLIC_APP_URL'] = "http://$Domain`:3030"
  $map['NEXT_PUBLIC_SUPABASE_URL'] = '/supabase-api'
  if (-not $map['SUPABASE_INTERNAL_URL']) {
    $map['SUPABASE_INTERNAL_URL'] = 'http://127.0.0.1:15021'
  }
  $map.Remove('TUNNEL_ACCESS_TOKEN')
  $lines = $map.GetEnumerator() | ForEach-Object { "{0}={1}" -f $_.Key, $_.Value }
  Write-Utf8NoBomLines -Path $envLocal -Lines $lines
  Write-Host "    .env.local atualizado" -ForegroundColor Green
} else {
  Write-Host "    .env.local nao encontrado (rode npm run local:up primeiro)" -ForegroundColor Yellow
}

# ── 6. Summary ──
Write-Host ""
Write-Host "= Resumo ========================================" -ForegroundColor Cyan
Write-Host "  Seu PC (fixo):     $StaticIP" -ForegroundColor White
Write-Host "  Dominio local:     http://$Domain`:3030" -ForegroundColor White
Write-Host "  Gateway:           $gateway" -ForegroundColor White
Write-Host ""
Write-Host "= Proximo passo (IMPORTANTE) =" -ForegroundColor Yellow
Write-Host "  Para todo dispositivo no WiFi enxergar $Domain:" -ForegroundColor White
Write-Host ""
Write-Host "  ROTEADOR: No DHCP server, troque o DNS primario para $StaticIP" -ForegroundColor White
Write-Host "    (http://$gateway > DHCP / LAN > Primary DNS = $StaticIP)"
Write-Host ""
Write-Host "  Ou manualmente em cada dispositivo:" -ForegroundColor Gray
Write-Host "    Configuracao WiFi > DNS customizado > $StaticIP" -ForegroundColor Gray
Write-Host ""
Write-Host "  Supabase (auth redirects):" -ForegroundColor Yellow
Write-Host "    Adicione em supabase/config.toml -> [auth] additional_redirect_urls:" -ForegroundColor White
Write-Host "      ""http://$Domain`:3030""," -ForegroundColor White
Write-Host "      ""http://$Domain`:3030/**""" -ForegroundColor White
Write-Host "    Depois: npm run local:down && npm run local:up -SkipReset" -ForegroundColor White
Write-Host ""
Write-Host "= Reverter: npm run lan:revert =" -ForegroundColor Yellow
