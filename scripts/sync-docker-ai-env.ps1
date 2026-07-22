# Sync AI env vars from Go/.env into the root .env used by Docker Compose.
# Does NOT print secrets. Root .env is gitignored.
# Usage: powershell -File scripts/sync-docker-ai-env.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$goEnv = Join-Path $root 'Go\.env'
$rootEnv = Join-Path $root '.env'
$example = Join-Path $root '.env.example'

if (-not (Test-Path $goEnv)) {
  Write-Error "Go/.env not found. Create it from Go/.env.example first."
}

function Read-EnvFile([string]$path) {
  $map = @{}
  if (-not (Test-Path $path)) { return $map }
  Get-Content $path | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq '' -or $line.StartsWith('#')) { return }
    $i = $line.IndexOf('=')
    if ($i -lt 1) { return }
    $k = $line.Substring(0, $i).Trim()
    $v = $line.Substring($i + 1)
    $map[$k] = $v
  }
  return $map
}

$src = Read-EnvFile $goEnv
$dst = Read-EnvFile $rootEnv
if ($dst.Count -eq 0 -and (Test-Path $example)) {
  Copy-Item $example $rootEnv -Force
  $dst = Read-EnvFile $rootEnv
}

# Docker DB must stay on Compose service DNS — never copy Go/.env DB_HOST=localhost.
$dst['DB_USER'] = if ($dst['DB_USER']) { $dst['DB_USER'] } else { 'smartca' }
$dst['DB_PASSWORD'] = if ($dst['DB_PASSWORD']) { $dst['DB_PASSWORD'] } else { 'smartca' }
$dst['DB_NAME'] = if ($dst['DB_NAME']) { $dst['DB_NAME'] } else { 'smartca' }

foreach ($k in @('AI_PROVIDER', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'AI_SETTINGS_SECRET', 'GEMINI_TIMEOUT', 'GEMINI_MAX_TOKENS')) {
  if ($src.ContainsKey($k) -and -not [string]::IsNullOrWhiteSpace($src[$k])) {
    $dst[$k] = $src[$k]
  }
}

if ([string]::IsNullOrWhiteSpace($dst['AI_SETTINGS_SECRET'])) {
  $dst['AI_SETTINGS_SECRET'] = 'smartca-ai-settings'
}
if ([string]::IsNullOrWhiteSpace($dst['GEMINI_MODEL'])) {
  $dst['GEMINI_MODEL'] = 'gemini-flash-latest'
}
# Prefer gemini when a key was synced.
if (-not [string]::IsNullOrWhiteSpace($dst['GEMINI_API_KEY'])) {
  if ([string]::IsNullOrWhiteSpace($dst['AI_PROVIDER']) -or $dst['AI_PROVIDER'] -eq 'mock') {
    $dst['AI_PROVIDER'] = 'gemini'
  }
}

$order = @('DB_USER', 'DB_PASSWORD', 'DB_NAME', 'AI_PROVIDER', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'AI_SETTINGS_SECRET', 'GEMINI_TIMEOUT', 'GEMINI_MAX_TOKENS')
$lines = @(
  '# Generated for Docker Compose. Do not commit.',
  '# Synced AI vars from Go/.env — DB_* kept Docker-safe.',
  ''
)
foreach ($k in $order) {
  if ($dst.ContainsKey($k)) {
    $lines += "$k=$($dst[$k])"
  }
}
foreach ($k in ($dst.Keys | Sort-Object)) {
  if ($order -notcontains $k) {
    $lines += "$k=$($dst[$k])"
  }
}
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($rootEnv, ($lines -join "`n") + "`n", $utf8NoBom)

$keyLen = if ($dst['GEMINI_API_KEY']) { $dst['GEMINI_API_KEY'].Length } else { 0 }
Write-Host "Wrote $rootEnv"
Write-Host "AI_PROVIDER=$($dst['AI_PROVIDER']) GEMINI_MODEL=$($dst['GEMINI_MODEL']) GEMINI_API_KEY len=$keyLen"
Write-Host "Run: docker compose up -d --force-recreate api"
