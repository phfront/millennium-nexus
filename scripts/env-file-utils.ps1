# Utilitarios para .env sem BOM (Supabase CLI falha com UTF-8 BOM / char 0xBB)
function Repair-EnvFile {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    return
  }

  $bytes = [System.IO.File]::ReadAllBytes($Path)
  $offset = 0
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    $offset = 3
  }

  $text = [System.Text.Encoding]::UTF8.GetString($bytes, $offset, $bytes.Length - $offset)
  $text = $text -replace "`r`n", "`n" -replace "`r", "`n"
  $lines = $text -split "`n"

  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($Path, (($lines -join "`n").TrimEnd() + "`n"), $utf8NoBom)
}

function Write-Utf8NoBomLines {
  param(
    [string]$Path,
    [string[]]$Lines
  )

  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($Path, (($Lines -join "`n").TrimEnd() + "`n"), $utf8NoBom)
}

# Supabase CLI escreve avisos (ex.: nova versao) no stderr — nao tratar como erro fatal.
function Invoke-SupabaseCli {
  param(
    [Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)]
    [string[]]$Args
  )

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & supabase @Args 2>&1 | ForEach-Object {
      $line = $_.ToString()
      if ($line -match 'A new version of Supabase CLI is available') {
        Write-Host $line -ForegroundColor DarkGray
      } else {
        Write-Host $line
      }
    }
    return $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
}
