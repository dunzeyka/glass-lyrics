# Копирует расширение в папку Spicetify, включает его и применяет к Spotify.
# Запуск: powershell -ExecutionPolicy Bypass -File .\install.ps1
$ErrorActionPreference = "Stop"

if (-not (Get-Command spicetify -ErrorAction SilentlyContinue)) {
    Write-Host "Spicetify not found. Install it: https://spicetify.app" -ForegroundColor Red
    exit 1
}

$userData = $null
try { $userData = (spicetify path userdata 2>$null | Select-Object -Last 1).Trim() } catch {}
if (-not $userData -or -not (Test-Path $userData)) { $userData = Join-Path $env:APPDATA "spicetify" }

$extDir = Join-Path $userData "Extensions"
New-Item -ItemType Directory -Force $extDir | Out-Null
Copy-Item (Join-Path $PSScriptRoot "src\glass-lyrics.js") $extDir -Force
Write-Host "Copied to $extDir"

spicetify config extensions glass-lyrics.js
spicetify apply
