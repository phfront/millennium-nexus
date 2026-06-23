# Copia dados da Supabase cloud para o Postgres local (link + dump + import)
param(
  [string]$ProjectRef = "",
  [string]$DbPassword = "",
  [switch]$SkipLink,
  [switch]$SkipReset,
  [switch]$SkipStorage,
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

. (Join-Path $PSScriptRoot "env-file-utils.ps1")
. (Join-Path $PSScriptRoot "cloud-dump-repair.ps1")

function Invoke-Supabase {
  param([Parameter(Mandatory = $true)][string[]]$Args)

  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & supabase @Args 2>&1
    $exitCode = $LASTEXITCODE
    $text = @(
      foreach ($line in @($output)) {
        if ($line -is [System.Management.Automation.ErrorRecord]) {
          $msg = $line.Exception.Message
          if ($msg -match "^Stopped services:") { continue }
          $msg
        } else {
          "$line"
        }
      }
    )
    return @{
      ExitCode = $exitCode
      Output = ($text -join "`n").Trim()
    }
  } finally {
    $ErrorActionPreference = $prev
  }
}

function Get-SupabaseStatusJson {
  $result = Invoke-Supabase @("status", "--output", "json")
  if ($result.ExitCode -ne 0 -or -not $result.Output) {
    return $null
  }
  try {
    return $result.Output | ConvertFrom-Json
  } catch {
    return $null
  }
}

function Get-EnvValue {
  param(
    [string]$Path,
    [string]$Key
  )

  if (-not (Test-Path $Path)) {
    return $null
  }

  foreach ($line in Get-Content $Path) {
    if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
    $k, $v = $line -split '=', 2
    if ($k -eq $Key) {
      return $v
    }
  }

  return $null
}

function Get-ProjectRefFromEnv {
  $url = Get-EnvValue (Join-Path $Root ".env") "NEXT_PUBLIC_SUPABASE_URL"
  if (-not $url) {
    return $null
  }

  if ($url -match 'https://([a-z0-9]+)\.supabase\.co') {
    return $Matches[1]
  }

  return $null
}

function Test-SupabaseLoggedIn {
  if ($env:SUPABASE_ACCESS_TOKEN) {
    return $true
  }

  $result = Invoke-Supabase @("projects", "list")
  return $result.ExitCode -eq 0
}

function Test-SupabaseLinked {
  $result = Invoke-Supabase @("db", "dump", "--linked", "--dry-run", "--data-only")
  return $result.ExitCode -eq 0
}

function Get-LocalDbContainer {
  $container = (docker ps --filter "name=supabase_db" --format "{{.Names}}" | Select-Object -First 1)
  if (-not $container) {
    Write-Error "Container supabase_db nao encontrado. Rode: npm run local:up"
  }
  return $container
}

function Invoke-DockerPsqlFile {
  param(
    [Parameter(Mandatory = $true)][string]$Container,
    [Parameter(Mandatory = $true)][string]$FileInContainer,
    [switch]$StopOnError,
    [switch]$ShowOutput
  )

  $dockerArgs = @(
    "exec", $Container,
    "psql", "-U", "postgres", "-d", "postgres",
    "-f", $FileInContainer
  )
  if ($StopOnError) {
    $dockerArgs += @("-v", "ON_ERROR_STOP=1")
  }

  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $raw = & docker @dockerArgs 2>&1
    $exitCode = $LASTEXITCODE
    $lines = @(
      foreach ($line in @($raw)) {
        $text = if ($line -is [System.Management.Automation.ErrorRecord]) {
          $line.ToString()
        } else {
          "$line"
        }
        if ($text -match '^(NOTICE|DETAIL|HINT|CONTEXT):') { continue }
        if ($text -match '^\s*$') { continue }
        $text
      }
    )
    $output = ($lines -join "`n").Trim()
    if ($ShowOutput -and $output) {
      Write-Host $output
    }
    return @{
      ExitCode = $exitCode
      Output = $output
    }
  } finally {
    $ErrorActionPreference = $prev
  }
}

function Read-DbPassword {
  param([string]$Existing)

  if ($Existing) {
    return ($Existing.Trim().Trim('"').Trim("'"))
  }

  if ($env:SUPABASE_DB_PASSWORD) {
    return ($env:SUPABASE_DB_PASSWORD.Trim().Trim('"').Trim("'"))
  }

  $fromEnv = Get-EnvValue (Join-Path $Root ".env") "SUPABASE_DB_PASSWORD"
  if ($fromEnv) {
    return ($fromEnv.Trim().Trim('"').Trim("'"))
  }

  $secure = Read-Host "Senha do Postgres da cloud (Dashboard > Project Settings > Database)" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return ([Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)).Trim()
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

function Get-CloudProjectRegion {
  param([string]$ProjectRef)

  $result = Invoke-Supabase @("projects", "list", "--output", "json")
  if ($result.ExitCode -ne 0 -or -not $result.Output) {
    return "us-west-2"
  }

  try {
    $projects = $result.Output | ConvertFrom-Json
    $match = $projects | Where-Object { $_.ref -eq $ProjectRef -or $_.id -eq $ProjectRef } | Select-Object -First 1
    if ($match -and $match.region) {
      return $match.region
    }
  } catch {
    return "us-west-2"
  }

  return "us-west-2"
}

function Get-CloudPoolerDbUrl {
  param(
    [string]$ProjectRef,
    [string]$Password,
    [string]$Region
  )

  $encoded = [uri]::EscapeDataString($Password)
  return "postgresql://postgres.${ProjectRef}:${encoded}@aws-0-${Region}.pooler.supabase.com:5432/postgres"
}

function Resolve-CloudDbUrl {
  param(
    [string]$ProjectRef,
    [string]$Password
  )

  if ($env:SUPABASE_DB_URL) {
    return $env:SUPABASE_DB_URL.Trim().Trim('"').Trim("'")
  }

  $fromEnv = Get-EnvValue (Join-Path $Root ".env") "SUPABASE_DB_URL"
  if ($fromEnv) {
    return $fromEnv.Trim().Trim('"').Trim("'")
  }

  $region = Get-CloudProjectRegion $ProjectRef
  return Get-CloudPoolerDbUrl -ProjectRef $ProjectRef -Password $Password -Region $region
}

function Write-PasswordAuthHelp {
  Write-Host ""
  Write-Host "Senha do POSTGRES rejeitada pela cloud." -ForegroundColor Red
  Write-Host "Nao use: anon key, service_role key, senha da sua conta supabase.com"
  Write-Host ""
  Write-Host "Use a Database password do projeto rpcuamylaejdtjnucwjq:"
  Write-Host "  1. https://supabase.com/dashboard/project/rpcuamylaejdtjnucwjq/database/settings"
  Write-Host "  2. Database password -> Reset database password"
  Write-Host "  3. Copie a senha NOVA (a antiga para de funcionar)"
  Write-Host "  4. No .env: SUPABASE_DB_PASSWORD=senha-sem-aspas"
  Write-Host "  5. Rode de novo: npm run local:cloud-pull"
  Write-Host ""
}

function Write-ConnectionHelp {
  Write-Host ""
  Write-Host "Nao foi possivel conectar ao Postgres da cloud." -ForegroundColor Red
  Write-Host "Causa comum no Windows: conexao direta db.*.supabase.co usa IPv6."
  Write-Host "Este script usa o pooler (IPv4): aws-0-<regiao>.pooler.supabase.com"
  Write-Host ""
  Write-Host "Se ainda falhar:"
  Write-Host "  - Dashboard > Database > Connection string > Session pooler"
  Write-Host "  - Cole no .env como SUPABASE_DB_URL=postgresql://..."
  Write-Host "  - Ou baixe backup manual em Database > Backups"
  Write-Host ""
}

Write-Host "==> Millennium Nexus - cloud to local" -ForegroundColor Cyan

Repair-EnvFile (Join-Path $Root ".env")
Repair-EnvFile (Join-Path $Root ".env.local")

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error "Docker nao encontrado. Instale Docker Desktop."
}

docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Error "Docker nao esta rodando. Inicie o Docker Desktop."
}

if (-not $ProjectRef) {
  $ProjectRef = Get-ProjectRefFromEnv
}
if (-not $ProjectRef) {
  Write-Error "Project ref nao encontrado. Passe -ProjectRef ou defina NEXT_PUBLIC_SUPABASE_URL no .env"
}

Write-Host "  Cloud project: $ProjectRef" -ForegroundColor DarkGray

$statusJson = Get-SupabaseStatusJson
if (-not $statusJson -or -not $statusJson.API_URL) {
  Write-Host "==> Supabase local nao esta rodando. Subindo..." -ForegroundColor Yellow
  $start = Invoke-Supabase @("start")
  if ($start.ExitCode -ne 0) {
    Write-Error "supabase start falhou.`n$($start.Output)"
  }
}

if (-not (Test-SupabaseLoggedIn)) {
  Write-Host ""
  Write-Host "Supabase CLI nao esta logado." -ForegroundColor Red
  Write-Host "Rode em outro terminal: supabase login"
  Write-Host "Ou defina SUPABASE_ACCESS_TOKEN no ambiente."
  Write-Error "Login necessario para linkar o projeto cloud."
}

$DbPassword = Read-DbPassword $DbPassword
$DbUrl = Resolve-CloudDbUrl -ProjectRef $ProjectRef -Password $DbPassword
$cloudRegion = Get-CloudProjectRegion $ProjectRef
Write-Host "  Cloud region: $cloudRegion (pooler IPv4)" -ForegroundColor DarkGray

if (-not $SkipLink) {
  Write-Host "==> Linkando projeto cloud (valida senha do banco)..." -ForegroundColor Yellow
  $link = Invoke-Supabase @("link", "--project-ref", $ProjectRef, "--password", $DbPassword)
  if ($link.ExitCode -ne 0) {
    if ($link.Output -match "password authentication failed") {
      Write-PasswordAuthHelp
    }
    if ($link.Output -match "Connection refused|IPv6 is not supported|i/o timeout") {
      Write-ConnectionHelp
    }
    Write-Error "supabase link falhou. Confira a Database password.`n$($link.Output)"
  }
} elseif (-not (Test-SupabaseLinked)) {
  Write-Error "Projeto nao linkado. Rode sem -SkipLink ou execute: supabase link --project-ref $ProjectRef"
}

Write-Host ""
Write-Host "Isso vai APAGAR os dados locais e importar da cloud." -ForegroundColor Red
Write-Host "Um dump SQL sera salvo em backups/ antes do import." -ForegroundColor DarkGray

if (-not $Force) {
  $confirm = Read-Host "Continuar? (s/N)"
  if ($confirm -notin @("s", "S", "sim", "Sim")) {
    Write-Host "Cancelado."
    exit 0
  }
}

$backupDir = Join-Path $Root "backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
$dumpFile = Join-Path $backupDir "cloud-data_$timestamp.sql"

if (-not $SkipReset) {
  Write-Host "==> Reset local (migrations, sem seed)..." -ForegroundColor Yellow
  $reset = Invoke-Supabase @("db", "reset", "--local", "--no-seed")
  if ($reset.ExitCode -ne 0) {
    Write-Error "supabase db reset falhou.`n$($reset.Output)"
  }
}

Write-Host "==> Dump da cloud (auth + public + storage)..." -ForegroundColor Yellow
Write-Host "    Via pooler IPv4 (nao usa db.*.supabase.co direto)." -ForegroundColor DarkGray
Write-Host "    Pode demorar se a instancia cloud estiver lenta." -ForegroundColor DarkGray

$dumpArgs = @(
  "db", "dump",
  "--db-url", $DbUrl,
  "--data-only",
  "--use-copy",
  "--schema", "auth,public,storage",
  "--exclude", "auth.schema_migrations",
  "--file", $dumpFile
)

$dump = Invoke-Supabase $dumpArgs
if ($dump.ExitCode -ne 0) {
  if ($dump.Output -match "password authentication failed") {
    Write-PasswordAuthHelp
    Write-Error "Dump da cloud falhou: senha do Postgres incorreta."
  }
  if ($dump.Output -match "Connection refused|IPv6 is not supported|i/o timeout") {
    Write-ConnectionHelp
    Write-Error "Dump da cloud falhou: rede/IPv6 ou banco cloud indisponivel."
  }
  Write-Error "Dump da cloud falhou. Se a cloud estiver unhealthy, tente de novo ou use um backup manual.`n$($dump.Output)"
}

$dumpSizeMb = [math]::Round((Get-Item $dumpFile).Length / 1MB, 2)
Write-Host "    Dump salvo: $dumpFile ($dumpSizeMb MB)" -ForegroundColor DarkGray

$container = Get-LocalDbContainer

$repairedDump = Join-Path $backupDir ("cloud-data_{0}_repaired.sql" -f $timestamp)
Write-Host "==> Ajustando dump ao schema local..." -ForegroundColor Yellow
Repair-CloudDumpFile -InputPath $dumpFile -OutputPath $repairedDump -Container $container
Write-Host "    OK -> $repairedDump" -ForegroundColor Green
$importFile = $repairedDump

Write-Host "==> Limpando dados locais (seeds das migrations)..." -ForegroundColor Yellow
$prepSql = Join-Path $PSScriptRoot "cloud-import-prep.sql"
docker cp $prepSql "${container}:/tmp/cloud-import-prep.sql"
$prep = Invoke-DockerPsqlFile -Container $container -FileInContainer "/tmp/cloud-import-prep.sql" -StopOnError
docker exec $container rm -f /tmp/cloud-import-prep.sql
if ($prep.ExitCode -ne 0) {
  Write-Error "Falha ao limpar tabelas antes do import.`n$($prep.Output)"
}
Write-Host "    OK" -ForegroundColor Green

Write-Host "==> Import no Postgres local..." -ForegroundColor Yellow
docker cp $importFile "${container}:/tmp/cloud-data.sql"
$import = Invoke-DockerPsqlFile -Container $container -FileInContainer "/tmp/cloud-data.sql" -StopOnError -ShowOutput
docker exec $container rm -f /tmp/cloud-data.sql
if ($import.ExitCode -ne 0) {
  Write-Error "Import falhou. O dump foi preservado em $dumpFile`n$($import.Output)"
}
Write-Host "    OK" -ForegroundColor Green

$seedPath = Join-Path $Root "supabase\seed.sql"
if (Test-Path $seedPath) {
  Write-Host "==> Aplicando seed local (policies de storage, idempotente)..." -ForegroundColor Yellow
  docker cp $seedPath "${container}:/tmp/seed.sql"
  $seed = Invoke-DockerPsqlFile -Container $container -FileInContainer "/tmp/seed.sql" -StopOnError
  docker exec $container rm -f /tmp/seed.sql
  if ($seed.ExitCode -ne 0) {
    Write-Warning "seed.sql retornou aviso/erro; confira policies de storage no Studio.`n$($seed.Output)"
  }
}

if (-not $SkipStorage) {
  Write-Host "==> Copiando arquivos do Storage (bucket avatars)..." -ForegroundColor Yellow
  $staging = Join-Path $backupDir "cloud-storage-staging"
  $avatarsStaging = Join-Path $staging "avatars"
  New-Item -ItemType Directory -Force -Path $avatarsStaging | Out-Null

  $dl = Invoke-Supabase @("storage", "cp", "-r", "ss:///avatars", $avatarsStaging, "--linked")
  if ($dl.ExitCode -ne 0) {
    Write-Warning "Download do bucket avatars falhou (cloud lenta ou bucket vazio). DB ja foi importado."
  } else {
    $ul = Invoke-Supabase @("storage", "cp", "-r", $avatarsStaging, "ss:///avatars", "--local")
    if ($ul.ExitCode -ne 0) {
      Write-Warning "Upload local do bucket avatars falhou. Rode de novo: supabase storage cp -r `"$avatarsStaging`" ss:///avatars --local"
    }
  }
}

Write-Host ""
Write-Host "==> Pronto!" -ForegroundColor Green
Write-Host "  Dump:     $dumpFile"
Write-Host "  Studio:   http://127.0.0.1:15023"
Write-Host "  App:      npm run dev  ->  http://127.0.0.1:3030"
Write-Host ""
Write-Host "Faca login com o mesmo e-mail/senha da cloud."
Write-Host "Se a cloud estava quebrada, o dump pode estar incompleto; confira dados no Studio."
