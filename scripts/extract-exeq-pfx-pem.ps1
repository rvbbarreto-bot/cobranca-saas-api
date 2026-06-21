# Extrai cert.pem + key.pem do A1 EXEQ (.pfx) para homolog FISC-021.
# NUNCA commitar a pasta de saída.
#
# Uso:
#   $env:PFX_PASSWORD="sua_senha"
#   powershell -ExecutionPolicy Bypass -File scripts/extract-exeq-pfx-pem.ps1
#
# Opcional:
#   $env:PFX_FILE="C:\caminho\certificado.pfx"
#   $env:OUT_DIR="data/fisc-021-pilot-pem"

param(
  [string]$PfxFile = $env:PFX_FILE,
  [string]$Password = $env:PFX_PASSWORD,
  [string]$OutDir = $(if ($env:OUT_DIR) { $env:OUT_DIR } else { "data/fisc-021-pilot-pem" })
)

$ErrorActionPreference = "Stop"
$OpenSsl = "C:\Program Files\Git\usr\bin\openssl.exe"

if (-not (Test-Path $OpenSsl)) {
  throw "OpenSSL nao encontrado em $OpenSsl (instale Git for Windows)."
}

function Resolve-DefaultPfxFile {
  $searchRoots = @(
    (Join-Path $env:USERPROFILE "OneDrive\Empresas Ricardo"),
    (Join-Path $env:USERPROFILE "OneDrive - Empresas Ricardo")
  )

  foreach ($root in $searchRoots) {
    if (-not (Test-Path -LiteralPath $root)) { continue }
    $matches = Get-ChildItem -LiteralPath $root -Recurse -Filter "*37229907000137*.pfx" -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending
    if ($matches) { return $matches[0].FullName }
  }

  return $null
}

if (-not $PfxFile) {
  $PfxFile = Resolve-DefaultPfxFile
}

if (-not $PfxFile) {
  throw @"
PFX nao encontrado.

Defina o caminho completo antes de rodar:
  `$env:PFX_FILE="C:\caminho\para\certificado.pfx"
  `$env:PFX_PASSWORD="sua_senha"
  .\scripts\extract-exeq-pfx-pem.ps1
"@
}

if (-not (Test-Path -LiteralPath $PfxFile)) {
  throw "PFX nao encontrado: $PfxFile"
}

if (-not $Password) {
  throw "Defina PFX_PASSWORD com a senha do arquivo .pfx"
}

$root = Get-Location
if (-not (Test-Path (Join-Path $root "package.json"))) {
  $root = Split-Path $PSScriptRoot -Parent
}

if ([System.IO.Path]::IsPathRooted($OutDir)) {
  $outPath = $OutDir
} else {
  $outPath = Join-Path $root $OutDir
}
New-Item -ItemType Directory -Force -Path $outPath | Out-Null

$certOut = Join-Path $outPath "exeq-37229907000137-cert.pem"
$keyOut = Join-Path $outPath "exeq-37229907000137-key.pem"
$passFile = Join-Path $env:TEMP "pfx-pass-$(Get-Random).txt"

try {
  Set-Content -Path $passFile -Value $Password -NoNewline -Encoding ASCII
  $passInArg = "file:" + ($passFile -replace '\\', '/')

  & $OpenSsl pkcs12 -in $PfxFile -passin $passInArg -clcerts -nokeys -out $certOut 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Falha ao extrair certificado (senha incorreta?)" }

  & $OpenSsl pkcs12 -in $PfxFile -passin $passInArg -nocerts -nodes -out $keyOut 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Falha ao extrair chave privada." }

  $subj = & $OpenSsl x509 -in $certOut -noout -subject -dates 2>&1
  Write-Host "OK - PEM gerados em:" -ForegroundColor Green
  Write-Host "  Cert: $certOut"
  Write-Host "  Key:  $keyOut"
  Write-Host ""
  Write-Host $subj
  Write-Host ""
  Write-Host "Proximo passo (sync portal + homolog SERPRO):"
  Write-Host "  `$env:FISC_021_CERT_PEM_FILE=`"$certOut`""
  Write-Host "  `$env:FISC_021_KEY_PEM_FILE=`"$keyOut`""
  Write-Host "  npm run fisc-021:sync-cert"
  Write-Host "  `$env:FISCAL_SERPRO_MOCK=`"false`"; npm run fisc-021:live"
}
finally {
  Remove-Item -Force $passFile -ErrorAction SilentlyContinue
}
