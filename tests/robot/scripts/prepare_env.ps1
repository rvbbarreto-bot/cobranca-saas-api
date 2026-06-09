#Requires -Version 5.1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
Set-Location $Root

Write-Host "== Robot E2E - preparacao ==" -ForegroundColor Cyan

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$pyCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pyCmd) {
    Write-Error "Python 3 nao encontrado. Instale com: winget install Python.Python.3.12"
}
$ver = & python --version 2>&1
Write-Host $ver

# Venv fora do OneDrive evita corrupcao de pacotes em caminhos longos
$venv = if ($env:ROBOT_VENV) { $env:ROBOT_VENV } else { Join-Path $env:LOCALAPPDATA "exeq-robot-venv" }
Write-Host "Venv: $venv"

if (-not (Test-Path $venv)) {
    Write-Host "Criando venv ..."
    python -m venv $venv
}

$pip = Join-Path $venv "Scripts\pip.exe"
$pythonVenv = Join-Path $venv "Scripts\python.exe"

& $pythonVenv -m pip install --upgrade pip
& $pip install -r (Join-Path $Root "tests\robot\requirements.txt")

Write-Host "Instalando browsers Playwright ..."
& $pythonVenv -m Browser.entry init

& $pythonVenv -c "import assertionengine; print('assertionengine OK')"

Write-Host ""
Write-Host "Pre-requisitos:" -ForegroundColor Yellow
Write-Host "  npm run migrate"
Write-Host "  npm run seed:dev"
Write-Host "  npm run seed:dev-rbac"
Write-Host "  npm run dev"
Write-Host "  npm run portal:dev"
Write-Host ""
Write-Host "Executar: npm run test:robot" -ForegroundColor Green
Write-Host "Venv configurado em: $venv" -ForegroundColor Cyan

try {
    Invoke-WebRequest -Uri "http://localhost:3333/health" -UseBasicParsing -TimeoutSec 3 | Out-Null
    Write-Host "API health OK" -ForegroundColor Green
} catch {
    Write-Host "API indisponivel" -ForegroundColor DarkYellow
}

try {
    Invoke-WebRequest -Uri "http://localhost:5173/login" -UseBasicParsing -TimeoutSec 3 | Out-Null
    Write-Host "Portal OK" -ForegroundColor Green
} catch {
    Write-Host "Portal indisponivel" -ForegroundColor DarkYellow
}

Write-Host "Ambiente Robot preparado." -ForegroundColor Green
