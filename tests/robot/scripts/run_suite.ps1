#Requires -Version 5.1
param(
    [string[]]$Tags = @(),
    [string]$Headless = $env:BROWSER_HEADLESS
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
Set-Location $Root

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$venv = if ($env:ROBOT_VENV) { $env:ROBOT_VENV } else { Join-Path $env:LOCALAPPDATA "exeq-robot-venv" }
$venvRobot = Join-Path $venv "Scripts\robot.exe"

if (-not (Test-Path $venvRobot)) {
    Write-Error "Robot venv ausente em $venv. Rode: npm run test:robot:setup"
}

if (-not $Headless) { $Headless = "true" }
$env:BROWSER_HEADLESS = $Headless
$env:PORTAL_BASE_URL = if ($env:PORTAL_BASE_URL) { $env:PORTAL_BASE_URL } else { "http://localhost:5173" }
$env:API_BASE_URL = if ($env:API_BASE_URL) { $env:API_BASE_URL } else { "http://localhost:3333" }
$env:FISCAL_ENABLED = if ($env:FISCAL_ENABLED) { $env:FISCAL_ENABLED } else { "true" }

$outDir = Join-Path $Root "tests\robot\results"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$robotArgs = @(
    "--outputdir", $outDir,
    (Join-Path $Root "tests\robot\tests")
)

foreach ($t in $Tags) {
    $robotArgs += @("-i", $t)
}

Write-Host "Robot E2E - PORTAL=$env:PORTAL_BASE_URL API=$env:API_BASE_URL HEADLESS=$env:BROWSER_HEADLESS" -ForegroundColor Cyan
Write-Host "Venv: $venv" -ForegroundColor Cyan

& $venvRobot @robotArgs
$code = $LASTEXITCODE

if ($code -eq 0) {
    Write-Host "Suite Robot: PASS - tests/robot/results/report.html" -ForegroundColor Green
} else {
    Write-Host "Suite Robot: FAIL exit $code - tests/robot/results/log.html" -ForegroundColor Red
}

exit $code
