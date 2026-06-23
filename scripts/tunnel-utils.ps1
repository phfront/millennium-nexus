function Get-TailscaleExe {
  if (Get-Command tailscale -ErrorAction SilentlyContinue) {
    return (Get-Command tailscale).Source
  }
  $defaultPath = "C:\Program Files\Tailscale\tailscale.exe"
  if (Test-Path $defaultPath) {
    return $defaultPath
  }
  return $null
}

function Get-TailscaleFunnelUrl {
  $ts = Get-TailscaleExe
  if (-not $ts) {
    return $null
  }

  $raw = & $ts status --json 2>$null
  if (-not $raw) {
    return $null
  }

  try {
    $status = $raw | ConvertFrom-Json
  } catch {
    return $null
  }

  if ($status.BackendState -eq 'NeedsLogin') {
    Write-Error "Tailscale nao esta logado. Abra o app Tailscale e faca login, depois rode o setup de novo."
  }

  $dns = $status.Self.DNSName
  if (-not $dns) {
    return $null
  }

  $hostName = $dns.Trim().TrimEnd('.')
  return "https://$hostName"
}

function Enable-TailscaleFunnel {
  param([int]$Port = 3030)

  $ts = Get-TailscaleExe
  if (-not $ts) {
    Write-Error "Tailscale CLI nao encontrado."
  }

  & $ts funnel --bg --https=443 "http://127.0.0.1:$Port"
  if ($LASTEXITCODE -ne 0) {
    Write-Error "tailscale funnel falhou. Verifique se Funnel esta habilitado no painel Tailscale (DNS -> Funnel)."
  }
}

function Wait-ForHttp {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 120
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $true
      }
    } catch {
      Start-Sleep -Seconds 3
    }
  } while ((Get-Date) -lt $deadline)

  return $false
}

function Wait-ForDocker {
  param([int]$TimeoutSeconds = 180)

  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    return $false
  }

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
      return $true
    }
    Start-Sleep -Seconds 5
  } while ((Get-Date) -lt $deadline)

  return $false
}
