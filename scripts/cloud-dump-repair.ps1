function Get-LocalColumnMap {
  param([string]$Container)

  $query = @"
SELECT table_schema || '.' || table_name, column_name
FROM information_schema.columns
WHERE table_schema IN ('public', 'auth', 'storage')
ORDER BY table_schema, table_name, ordinal_position
"@

  $raw = docker exec $Container psql -U postgres -d postgres -At -F '|' -c $query 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Nao foi possivel ler colunas do Postgres local."
  }

  $map = @{}
  foreach ($line in $raw) {
    if (-not $line -or $line -notmatch '\|') { continue }
    $table, $column = $line -split '\|', 2
    if (-not $map.ContainsKey($table)) {
      $map[$table] = New-Object System.Collections.Generic.List[string]
    }
    [void]$map[$table].Add($column)
  }

  return $map
}

function Get-LocalInsertableTables {
  param([string]$Container)

  $query = @"
SELECT n.nspname || '.' || c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname IN ('public', 'auth', 'storage')
  AND has_table_privilege('postgres', c.oid, 'INSERT')
"@

  $raw = docker exec $Container psql -U postgres -d postgres -At -c $query 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Nao foi possivel ler permissoes do Postgres local."
  }

  $set = @{}
  foreach ($line in $raw) {
    if ($line) { $set[$line.Trim()] = $true }
  }
  return $set
}

function Repair-CloudDumpFile {
  param(
    [Parameter(Mandatory = $true)][string]$InputPath,
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [Parameter(Mandatory = $true)][string]$Container
  )

  $columnMap = Get-LocalColumnMap -Container $Container
  $insertable = Get-LocalInsertableTables -Container $Container
  $lines = [System.IO.File]::ReadAllLines($InputPath)
  $out = New-Object System.Collections.Generic.List[string]
  $copyPattern = '^COPY "([^"]+)"\."([^"]+)" \((.+)\) FROM stdin;$'

  $i = 0
  while ($i -lt $lines.Count) {
    $line = $lines[$i]

    if ($line -match $copyPattern) {
      $schema = $Matches[1]
      $table = $Matches[2]
      $colListRaw = $Matches[3]
      $fullTable = "$schema.$table"

      if (-not $insertable.ContainsKey($fullTable)) {
        Write-Host "    Ignorando $fullTable (sem permissao INSERT no Postgres local)" -ForegroundColor DarkGray
        $i++
        while ($i -lt $lines.Count -and $lines[$i] -ne '\.') {
          $i++
        }
        if ($i -lt $lines.Count) {
          $i++
        }
        continue
      }

      $dumpCols = @(
        foreach ($part in ($colListRaw -split ',\s*')) {
          $part.Trim().Trim('"')
        }
      )

      $localCols = $columnMap[$fullTable]
      if (-not $localCols) {
        [void]$out.Add($line)
        $i++
        while ($i -lt $lines.Count -and $lines[$i] -ne '\.') {
          [void]$out.Add($lines[$i])
          $i++
        }
        if ($i -lt $lines.Count) {
          [void]$out.Add($lines[$i])
        }
        $i++
        continue
      }

      $localSet = @{}
      foreach ($c in $localCols) { $localSet[$c] = $true }

      $keepIndexes = New-Object System.Collections.Generic.List[int]
      $newCols = New-Object System.Collections.Generic.List[string]
      for ($j = 0; $j -lt $dumpCols.Count; $j++) {
        if ($localSet.ContainsKey($dumpCols[$j])) {
          [void]$keepIndexes.Add($j)
          [void]$newCols.Add($dumpCols[$j])
        }
      }

      if ($keepIndexes.Count -eq 0) {
        Write-Warning "Ignorando COPY de $fullTable (nenhuma coluna compativel com schema local)."
        $i++
        while ($i -lt $lines.Count -and $lines[$i] -ne '\.') {
          $i++
        }
        if ($i -lt $lines.Count) {
          $i++
        }
        continue
      }

      if ($keepIndexes.Count -ne $dumpCols.Count) {
        $dropped = @($dumpCols | Where-Object { -not $localSet.ContainsKey($_) })
        Write-Host "    Ajustando $fullTable (remove colunas obsoletas: $($dropped -join ', '))" -ForegroundColor DarkGray
      }

      $quotedCols = ($newCols | ForEach-Object { '"' + $_ + '"' }) -join ', '
      [void]$out.Add("COPY `"$schema`".`"$table`" ($quotedCols) FROM stdin;")

      $i++
      while ($i -lt $lines.Count -and $lines[$i] -ne '\.') {
        $dataLine = $lines[$i]
        if ($keepIndexes.Count -ne $dumpCols.Count -and $dataLine.Length -gt 0) {
          $fields = $dataLine -split "`t", -1
          $filtered = @(
            foreach ($idx in $keepIndexes) {
              if ($idx -lt $fields.Count) { $fields[$idx] } else { '\N' }
            }
          )
          [void]$out.Add(($filtered -join "`t"))
        } else {
          [void]$out.Add($dataLine)
        }
        $i++
      }

      if ($i -lt $lines.Count) {
        [void]$out.Add($lines[$i])
      }
      $i++
      continue
    }

    [void]$out.Add($line)
    $i++
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllLines($OutputPath, $out, $utf8NoBom)
}
