# Sobe stack + Tailscale Funnel apos reinicio do PC (Task Scheduler)
$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

. (Join-Path $PSScriptRoot "tunnel-utils.ps1")

$logDir = Join-Path $Root "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir "tunnel-autostart.log"

function Write-Log {
  param([string]$Message)
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
  Add-Content -Path $logFile -Value $line
  Write-Host $line
}

Write-Log "==> tunnel-autostart iniciado"

if (-not (Wait-ForDocker -TimeoutSeconds 300)) {
  Write-Log "ERRO: Docker nao ficou pronto em 5 min"
  exit 1
}

Write-Log "Docker OK"

try {
  & (Join-Path $PSScriptRoot "local-up.ps1") -SkipReset 2>&1 | ForEach-Object { Write-Log $_ }
} catch {
  Write-Log "ERRO local-up: $_"
  exit 1
}

$appReady = Wait-ForHttp -Url "http://127.0.0.1:3030/login" -TimeoutSeconds 30
if (-not $appReady) {
  $nextRunning = Get-NetTCPConnection -LocalPort 3030 -ErrorAction SilentlyContinue
  if (-not $nextRunning) {
    if (-not (Test-Path (Join-Path $Root ".next"))) {
      Write-Log "Build ausente — rodando npm run build..."
      npm run build 2>&1 | ForEach-Object { Write-Log $_ }
      if ($LASTEXITCODE -ne 0) {
        Write-Log "ERRO: build falhou"
        exit 1
      }
    }

    Write-Log "Iniciando Next.js (npm start) em background..."
    Start-Process -FilePath "npm" -ArgumentList "start" -WorkingDirectory $Root -WindowStyle Hidden
    $appReady = Wait-ForHttp -Url "http://127.0.0.1:3030/login" -TimeoutSeconds 120
  }
}

if (-not $appReady) {
  Write-Log "ERRO: Next.js nao respondeu em :3030"
  exit 1
}

Write-Log "Next.js OK"

try {
  Enable-TailscaleFunnel -Port 3030
  $ts = Get-TailscaleExe
  $status = & $ts funnel status 2>&1 | Out-String
  Write-Log $status.Trim()
} catch {
  Write-Log "ERRO funnel: $_"
  exit 1
}

$urlFile = Join-Path $Root "tunnels\public-url.txt"
if (Test-Path $urlFile) {
  Write-Log "URL fixa: $((Get-Content $urlFile -Raw).Trim())"
}

Write-Log "==> tunnel-autostart concluido"
