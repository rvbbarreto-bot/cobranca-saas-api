# Sobe ambiente local cobranca-saas-api (DevOps / QA)
# Uso: powershell -ExecutionPolicy Bypass -File scripts/dev-up.ps1
# Requer: Docker Desktop em execucao, .env com DB_PASSWORD=dev_only

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Test-DotEnvDatabasePort {
  $envFile = Join-Path $Root ".env"
  if (-not (Test-Path $envFile)) {
    Write-Host "[dev-up] AVISO: .env ausente. Copie .env.example para .env" -ForegroundColor Yellow
    return
  }
  $content = Get-Content $envFile -Raw
  if ($content -match "DATABASE_URL=postgres://app:[^@]+@localhost:5432/") {
    Write-Host "[dev-up] AVISO: DATABASE_URL usa porta 5432; o Compose publica Postgres em 5434." -ForegroundColor Yellow
    Write-Host "         Corrija para: postgres://app:`${DB_PASSWORD}@localhost:5434/cobranca_saas" -ForegroundColor Yellow
  }
}

Write-Host "[dev-up] Verificando Docker..." -ForegroundColor Cyan
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  throw "Docker nao esta acessivel. Abra o Docker Desktop e tente novamente."
}

Test-DotEnvDatabasePort

Write-Host "[dev-up] Subindo postgres + redis..." -ForegroundColor Cyan
docker compose up -d postgres redis
if ($LASTEXITCODE -ne 0) { throw "docker compose up postgres/redis falhou" }

Write-Host "[dev-up] Aguardando Postgres healthy (ate 60s)..." -ForegroundColor Cyan
$deadline = (Get-Date).AddSeconds(60)
do {
  Start-Sleep -Seconds 2
  $ps = docker compose ps postgres --format json 2>$null | ConvertFrom-Json
  if ($ps -and $ps.Health -eq "healthy") { break }
} while ((Get-Date) -lt $deadline)
if ($ps.Health -ne "healthy") { throw "Postgres nao ficou healthy a tempo" }

Write-Host "[dev-up] Migrations..." -ForegroundColor Cyan
docker compose run --rm migrate
if ($LASTEXITCODE -ne 0) { throw "migrate falhou" }

Write-Host "[dev-up] Subindo API (porta 3333)..." -ForegroundColor Cyan
docker compose up -d api
if ($LASTEXITCODE -ne 0) { throw "api falhou" }

Start-Sleep -Seconds 8
try {
  $h = Invoke-WebRequest -Uri "http://localhost:3333/health/ready" -UseBasicParsing -TimeoutSec 10
  Write-Host "[dev-up] API ready: HTTP $($h.StatusCode)" -ForegroundColor Green
} catch {
  Write-Host "[dev-up] API ainda nao respondeu em /health/ready. Ver: docker compose logs api" -ForegroundColor Yellow
}

Write-Host "[dev-up] Seed (host)..." -ForegroundColor Cyan
npm run seed:dev
if ($LASTEXITCODE -ne 0) { throw "seed:dev falhou" }

$portalEnvLocal = Join-Path $Root "apps\portal-web\.env.local"
$portalEnvDocker = @"
# Gerado/alinhado por dev-up.ps1 — API Docker na porta 3333 (proxy Vite em dev).
# Homolog Inter no host (:3334): copie apps/portal-web/.env.local.inter-homolog.example

"@
Set-Content -Path $portalEnvLocal -Value $portalEnvDocker -Encoding utf8
Write-Host "[dev-up] Portal .env.local alinhado ao Docker (:3333 via proxy Vite)" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== Ambiente base OK ===" -ForegroundColor Green
Write-Host "  API:    http://localhost:3333/health/ready"
Write-Host "  Portal: npm run portal:dev  ->  http://localhost:5173/login  (reinicie o Vite se ja estava aberto)"
Write-Host "  Login:  portal-seed@local.dev | tenant: escritorio-demo (ou 1) | senha: PortalSeedDev!ChangeMe1"
Write-Host ""
Write-Host "Parar: docker compose stop api postgres redis" -ForegroundColor DarkGray
