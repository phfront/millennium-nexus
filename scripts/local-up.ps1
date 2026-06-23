# Sobe Supabase local (Docker), aplica migrations + seed, atualiza .env.local
param(
  [switch]$SkipReset
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

. (Join-Path $PSScriptRoot "env-file-utils.ps1")

Write-Host "==> Millennium Nexus - local up" -ForegroundColor Cyan

$SupabaseCmd = Join-Path $Root "node_modules\.bin\supabase.cmd"
if (-not (Test-Path $SupabaseCmd)) {
  $supabaseCommand = Get-Command supabase -ErrorAction SilentlyContinue
  if ($supabaseCommand) {
    $SupabaseCmd = $supabaseCommand.Source
  }
}

if (-not (Test-Path $SupabaseCmd)) {
  Write-Error "Supabase CLI nao encontrado. Rode: npm install"
}

function Get-LocalSupabaseStatus {
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $statusOutput = & $SupabaseCmd status --output json 2>$null
    $statusExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($statusExitCode -ne 0 -or -not $statusOutput) {
    return $null
  }

  try {
    $status = $statusOutput | ConvertFrom-Json
    if ($status.API_URL -and $status.ANON_KEY -and $status.SERVICE_ROLE_KEY) {
      return $status
    }
  } catch {
    return $null
  }

  return $null
}

function Wait-LocalSupabase {
  param(
    [int]$TimeoutSeconds = 0
  )

  $deadline = if ($TimeoutSeconds -gt 0) { (Get-Date).AddSeconds($TimeoutSeconds) } else { $null }
  do {
    $status = Get-LocalSupabaseStatus
    if ($status) {
      return $status
    }

    Start-Sleep -Seconds 2
  } while (-not $deadline -or (Get-Date) -lt $deadline)

  return $null
}

# Supabase CLI le .env na raiz; UTF-8 BOM quebra o parser (char '>>')
Repair-EnvFile (Join-Path $Root ".env")
Repair-EnvFile (Join-Path $Root ".env.local")

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error "Docker nao encontrado. Instale Docker Desktop."
}

docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Error "Docker nao esta rodando. Inicie o Docker Desktop."
}

$statusJson = Get-LocalSupabaseStatus
if ($statusJson) {
  Write-Host "==> Supabase local ja esta online; reutilizando a instancia atual." -ForegroundColor Green
} else {
  Write-Host "==> supabase start (pode demorar na primeira vez)..." -ForegroundColor Yellow
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & $SupabaseCmd start
    $startExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($startExitCode -ne 0) {
    Write-Host "==> Supabase ainda esta iniciando; aguardando ficar pronto..." -ForegroundColor Yellow
  }

  $statusJson = Wait-LocalSupabase
  if (-not $statusJson) {
    Write-Error "Supabase nao ficou pronto. Rode: supabase start --debug"
  }
}

if (-not $SkipReset) {
  Write-Host "==> supabase db reset (migrations + seed)..." -ForegroundColor Yellow
  & $SupabaseCmd db reset --local
  if ($LASTEXITCODE -ne 0) {
    Write-Error "supabase db reset falhou."
  }
} else {
  Write-Host "==> Banco existente preservado (reset ignorado)." -ForegroundColor DarkGray
}

Write-Host "==> Lendo keys do supabase status..." -ForegroundColor Yellow
$statusJson = Get-LocalSupabaseStatus
if (-not $statusJson) {
  Write-Error "Supabase deixou de responder antes da leitura das chaves."
}

$apiUrl = $statusJson.API_URL
$anonKey = $statusJson.ANON_KEY
$serviceKey = $statusJson.SERVICE_ROLE_KEY

if (-not $apiUrl -or -not $anonKey -or -not $serviceKey) {
  Write-Error "Nao foi possivel ler API_URL / ANON_KEY / SERVICE_ROLE_KEY. Rode: supabase status"
}

Write-Host "==> Aguardando Supabase Auth responder..." -ForegroundColor Yellow
$authHealthUrl = "$apiUrl/auth/v1/health"
$authReady = $false
while (-not $authReady) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $authHealthUrl -TimeoutSec 3
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
      $authReady = $true
      break
    }
  } catch {
    Start-Sleep -Seconds 2
  }
}

if (-not $authReady) {
  Write-Error "Supabase iniciou, mas o Auth nao respondeu em $authHealthUrl."
}

$envLocal = Join-Path $Root ".env.local"
$example = Join-Path $Root ".env.local.example"
$map = @{}

if (Test-Path $example) {
  Repair-EnvFile $example
  Get-Content $example | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
    $k, $v = $_ -split '=', 2
    $map[$k] = $v
  }
}

if (Test-Path $envLocal) {
  Get-Content $envLocal | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
    $k, $v = $_ -split '=', 2
    if ($k -in @(
        'CRON_SECRET', 'NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT',
        'NEXT_PUBLIC_APP_URL', 'SUPABASE_INTERNAL_URL', 'TUNNEL_ACCESS_TOKEN'
      )) {
      if ($v -and $v -ne 'change-me-to-a-long-random-string') {
        $map[$k] = $v
      }
    }
  }
}

$map['SUPABASE_INTERNAL_URL'] = $apiUrl

if ($map['NEXT_PUBLIC_APP_URL']) {
  $map['NEXT_PUBLIC_SUPABASE_URL'] = '/supabase-api'
} else {
  $map['NEXT_PUBLIC_SUPABASE_URL'] = $apiUrl
}

$map['NEXT_PUBLIC_SUPABASE_ANON_KEY'] = $anonKey
$map['SUPABASE_SERVICE_ROLE_KEY'] = $serviceKey

if (-not $map['CRON_SECRET']) {
  $map['CRON_SECRET'] = 'change-me-to-a-long-random-string'
}

# Preserva VAPID do .env cloud se ainda nao estiver no map
$cloudEnv = Join-Path $Root ".env"
if (Test-Path $cloudEnv) {
  Get-Content $cloudEnv | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
    $k, $v = $_ -split '=', 2
    if ($k -in @('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT') -and -not $map[$k]) {
      if ($v) { $map[$k] = $v }
    }
  }
}

$lines = $map.GetEnumerator() | ForEach-Object { "{0}={1}" -f $_.Key, $_.Value }
Write-Utf8NoBomLines -Path $envLocal -Lines $lines

Write-Host ""
Write-Host "==> Pronto!" -ForegroundColor Green
Write-Host "  Studio:   http://127.0.0.1:15023"
Write-Host "  API:      $apiUrl"
Write-Host "  Inbucket: http://127.0.0.1:15024"
Write-Host "  .env.local atualizado (sem BOM)"
Write-Host ""
Write-Host "Proximo passo: npm run dev"
Write-Host "App: http://127.0.0.1:3030"
Write-Host "Guia: LOCAL.md"
