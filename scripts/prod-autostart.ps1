# Sobe stack local em modo producao apos login no Windows.
$ErrorActionPreference = "Continue"
$utf8Encoding = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = $utf8Encoding
[Console]::OutputEncoding = $utf8Encoding
$OutputEncoding = $utf8Encoding
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

. (Join-Path $PSScriptRoot "tunnel-utils.ps1")

$logDir = Join-Path $Root "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir "prod-autostart.log"

function Write-Log {
  param([string]$Message)
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
  Add-Content -Path $logFile -Value $line -Encoding utf8
  Write-Host $line
}

function Get-ListeningProcessId {
  param([int]$Port = 3030)

  $match = netstat -ano | Select-String "0.0.0.0:$Port\s+.*LISTENING\s+(\d+)$" | Select-Object -First 1
  if ($match -and $match.Matches.Count -gt 0) {
    return [int]$match.Matches[0].Groups[1].Value
  }

  return $null
}

function Stop-AppOnPort {
  param([int]$Port = 3030)

  $processId = Get-ListeningProcessId -Port $Port
  if ($processId) {
    Write-Log "Encerrando processo existente na porta $Port (PID $processId)"
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
  }
}

function Test-ProductionBuildReady {
  $buildDir = Join-Path $Root ".next"
  $buildIdPath = Join-Path $buildDir "BUILD_ID"

  return (Test-Path $buildDir) -and (Test-Path $buildIdPath)
}

function Invoke-ProdAutostartOnce {
  Write-Log "==> prod-autostart tentativa iniciada"

  if (-not (Wait-ForDocker -TimeoutSeconds 300)) {
    Write-Log "Docker ainda nao ficou pronto; nova tentativa em 30s"
    return $false
  }

  Write-Log "Docker OK"

  try {
    & (Join-Path $PSScriptRoot "local-up.ps1") -SkipReset 2>&1 | ForEach-Object { Write-Log $_ }
    if ($LASTEXITCODE -ne 0) {
      Write-Log "local-up terminou com exit code $LASTEXITCODE; nova tentativa em 30s"
      return $false
    }
  } catch {
    Write-Log "ERRO local-up: $_"
    return $false
  }

  $appReady = Wait-ForHttp -Url "http://127.0.0.1:3030/login" -TimeoutSeconds 15
  if ($appReady) {
    Write-Log "Next.js ja estava respondendo em :3030"
    return $true
  }

  if (-not (Test-ProductionBuildReady)) {
    Write-Log "Build de producao ausente ou incompleta - rodando npm run build..."
    npm run build 2>&1 | ForEach-Object { Write-Log $_ }
    if ($LASTEXITCODE -ne 0) {
      Write-Log "Build falhou; nova tentativa em 30s"
      return $false
    }
  }

  Stop-AppOnPort -Port 3030

  Write-Log "Iniciando Next.js (npm start) em background..."
  $nextOutLog = Join-Path $logDir "next-start.out.log"
  $nextErrLog = Join-Path $logDir "next-start.err.log"
  Start-Process -FilePath "npm.cmd" `
    -ArgumentList "start" `
    -WorkingDirectory $Root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $nextOutLog `
    -RedirectStandardError $nextErrLog

  $appReady = Wait-ForHttp -Url "http://127.0.0.1:3030/login" -TimeoutSeconds 120
  if (-not $appReady) {
    Write-Log "Next.js ainda nao respondeu em :3030; nova tentativa em 30s"
    return $false
  }

  Write-Log "Next.js OK"
  return $true
}

Write-Log "==> prod-autostart iniciado"

while ($true) {
  try {
    if (Invoke-ProdAutostartOnce) {
      Write-Log "==> prod-autostart concluido"
      exit 0
    }
  } catch {
    Write-Log "ERRO inesperado: $_"
  }

  Start-Sleep -Seconds 30
}
