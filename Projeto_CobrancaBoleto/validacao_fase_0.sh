#!/bin/bash
# ============================================================
#  VALIDAÇÃO FASE 0 — SaaS de Cobranças
#  Execute da raiz do projeto cobranca-saas-api:
#     bash Projeto_CobrancaBoleto/validacao_fase_0.sh
# ============================================================

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # sem cor

PASSOU=0
FALHOU=0
AVISO=0

ok()    { echo -e "  ${GREEN}✅ OK${NC}     $1"; ((PASSOU++)); }
fail()  { echo -e "  ${RED}❌ FALHA${NC}  $1"; ((FALHOU++)); }
warn()  { echo -e "  ${YELLOW}⚠  AVISO${NC}  $1"; ((AVISO++)); }
info()  { echo -e "  ${BLUE}ℹ  INFO${NC}   $1"; }

echo ""
echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   VALIDAÇÃO FASE 0 — SaaS de Cobranças           ${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
echo ""

# ── Detectar raiz do projeto ──────────────────────────────
# Sobe um nível se estiver dentro de Projeto_CobrancaBoleto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "$(basename "$SCRIPT_DIR")" == "Projeto_CobrancaBoleto" ]]; then
  PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
else
  PROJECT_ROOT="$SCRIPT_DIR"
fi
info "Raiz do projeto: $PROJECT_ROOT"
echo ""

# ────────────────────────────────────────────────────────────
echo -e "${BLUE}[1/8] Secrets no histórico git${NC}"
# ────────────────────────────────────────────────────────────
if [ ! -d "$PROJECT_ROOT/.git" ]; then
  warn "Repositório git não encontrado em $PROJECT_ROOT"
else
  # Verifica se .env tem conteúdo real commitado
  ENV_NO_GIT=$(git -C "$PROJECT_ROOT" log --all -p -- .env 2>/dev/null | \
    grep -E "^\+[^+].*(JWT_SECRET|DATABASE_URL|API_KEY|SECRET|PASSWORD)\s*=\s*[^$<{]" | \
    grep -v "TROCAR\|example\|your_\|<\|{" | wc -l)

  if [ "$ENV_NO_GIT" -gt 0 ]; then
    fail ".env com secrets reais encontrado no histórico git ($ENV_NO_GIT linhas)"
    info "Execute: git filter-branch ou BFG Repo Cleaner para remover"
  else
    ok "Nenhum secret real encontrado no histórico git"
  fi

  # Verifica .gitignore
  if grep -q "^\.env$" "$PROJECT_ROOT/.gitignore" 2>/dev/null; then
    ok ".env está no .gitignore"
  else
    fail ".env NÃO está no .gitignore"
  fi
fi
echo ""

# ────────────────────────────────────────────────────────────
echo -e "${BLUE}[2/8] .env.example com placeholders${NC}"
# ────────────────────────────────────────────────────────────
if [ -f "$PROJECT_ROOT/.env.example" ]; then
  ok ".env.example existe"
  # Verifica se tem as variáveis obrigatórias
  for VAR in NODE_ENV PORT DATABASE_URL JWT_SECRET WEBHOOK_INBOX_SECRET; do
    if grep -q "^$VAR" "$PROJECT_ROOT/.env.example" 2>/dev/null; then
      ok "  → $VAR presente no .env.example"
    else
      fail "  → $VAR ausente no .env.example"
    fi
  done
else
  fail ".env.example não existe — a fábrica ainda não criou"
fi
echo ""

# ────────────────────────────────────────────────────────────
echo -e "${BLUE}[3/8] Docker (Dockerfile + docker-compose.yml)${NC}"
# ────────────────────────────────────────────────────────────
if [ -f "$PROJECT_ROOT/Dockerfile" ]; then
  ok "Dockerfile existe"
  if grep -q "multi-stage\|AS base\|AS builder\|AS production" "$PROJECT_ROOT/Dockerfile" 2>/dev/null; then
    ok "Dockerfile usa multi-stage build"
  else
    warn "Dockerfile pode não usar multi-stage build (verifique)"
  fi
else
  fail "Dockerfile não existe"
fi

if [ -f "$PROJECT_ROOT/docker-compose.yml" ] || [ -f "$PROJECT_ROOT/docker-compose.yaml" ]; then
  ok "docker-compose.yml existe"
  if grep -q "healthcheck" "$PROJECT_ROOT/docker-compose.yml" 2>/dev/null || \
     grep -q "healthcheck" "$PROJECT_ROOT/docker-compose.yaml" 2>/dev/null; then
    ok "docker-compose tem healthcheck configurado"
  else
    warn "docker-compose sem healthcheck (recomendado)"
  fi
else
  fail "docker-compose.yml não existe"
fi
echo ""

# ────────────────────────────────────────────────────────────
echo -e "${BLUE}[4/8] Migrações de banco (Fase 0)${NC}"
# ────────────────────────────────────────────────────────────
MIGRATIONS_DIR="$PROJECT_ROOT/db/migrations"
if [ -d "$MIGRATIONS_DIR" ]; then
  ok "Pasta db/migrations existe"
  TOTAL_MIGRATIONS=$(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | wc -l)
  info "$TOTAL_MIGRATIONS arquivo(s) de migration encontrado(s)"

  # Verifica migrations específicas da Fase 0
  if ls "$MIGRATIONS_DIR"/013_*.sql 2>/dev/null | grep -q .; then
    ok "Migration 013 (desacoplamento NFS-e) existe"
  else
    fail "Migration 013_desacoplamento_nfse.sql não existe"
  fi

  if ls "$MIGRATIONS_DIR"/014_*.sql 2>/dev/null | grep -q .; then
    ok "Migration 014 (audit_log) existe"
  else
    fail "Migration 014_audit_log.sql não existe"
  fi
else
  fail "Pasta db/migrations não encontrada"
  info "Esperado em: $MIGRATIONS_DIR"
fi
echo ""

# ────────────────────────────────────────────────────────────
echo -e "${BLUE}[5/8] Tabela audit_log no código${NC}"
# ────────────────────────────────────────────────────────────
AUDIT_REFS=$(grep -r "audit_log\|writeAuditLog\|AuditService" \
  "$PROJECT_ROOT/src" --include="*.ts" -l 2>/dev/null | wc -l)

if [ "$AUDIT_REFS" -gt 0 ]; then
  ok "Referências ao audit_log encontradas em $AUDIT_REFS arquivo(s)"
else
  fail "Nenhuma referência a audit_log no código TypeScript"
  info "Esperado: src/platform/audit/audit.service.ts"
fi
echo ""

# ────────────────────────────────────────────────────────────
echo -e "${BLUE}[6/8] Rate limiting implementado${NC}"
# ────────────────────────────────────────────────────────────
RATELIMIT_REFS=$(grep -r "rate-limit\|rateLimit\|RateLimit\|express-rate-limit" \
  "$PROJECT_ROOT/src" --include="*.ts" -l 2>/dev/null | wc -l)

if [ "$RATELIMIT_REFS" -gt 0 ]; then
  ok "Rate limiting encontrado em $RATELIMIT_REFS arquivo(s)"
else
  fail "Rate limiting não implementado"
  info "Esperado: src/platform/http/middleware/rate-limit.middleware.ts"
fi
echo ""

# ────────────────────────────────────────────────────────────
echo -e "${BLUE}[7/8] Cobertura tenant-provisioning${NC}"
# ────────────────────────────────────────────────────────────
PROV_FILE=$(find "$PROJECT_ROOT/src" -name "provision-public-tenant.ts" 2>/dev/null | head -1)
if [ -n "$PROV_FILE" ]; then
  ok "provision-public-tenant.ts encontrado"
  # Verifica se há arquivo de teste
  TEST_FILE=$(find "$PROJECT_ROOT" -name "*provision*" \
    \( -path "*__tests__*" -o -path "*spec*" -o -name "*.test.ts" -o -name "*.spec.ts" \) \
    2>/dev/null | head -1)
  if [ -n "$TEST_FILE" ]; then
    ok "Arquivo de teste encontrado: $(basename $TEST_FILE)"
  else
    fail "Nenhum arquivo de teste para provision-public-tenant"
    info "Crie: src/modules/tenant-provisioning/application/__tests__/provision-public-tenant.test.ts"
  fi
else
  warn "provision-public-tenant.ts não encontrado (verifique o caminho)"
fi

# Verifica se package.json tem script de cobertura
if grep -q '"coverage"' "$PROJECT_ROOT/package.json" 2>/dev/null; then
  ok "Script 'coverage' existe no package.json"
  info "Para ver cobertura real: npm run coverage"
else
  warn "Script 'coverage' não encontrado no package.json"
fi
echo ""

# ────────────────────────────────────────────────────────────
echo -e "${BLUE}[8/8] Sentry configurado${NC}"
# ────────────────────────────────────────────────────────────
SENTRY_REFS=$(grep -r "Sentry\|sentry" \
  "$PROJECT_ROOT/src" --include="*.ts" -l 2>/dev/null | wc -l)

if [ "$SENTRY_REFS" -gt 0 ]; then
  ok "Sentry encontrado em $SENTRY_REFS arquivo(s) TypeScript"
else
  warn "Sentry não configurado no código (recomendado para produção)"
  info "Instale: npm install @sentry/node"
fi
echo ""

# ────────────────────────────────────────────────────────────
# RESULTADO FINAL
# ────────────────────────────────────────────────────────────
echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
echo -e "  Resultado: ${GREEN}$PASSOU passou${NC} | ${RED}$FALHOU falhou${NC} | ${YELLOW}$AVISO aviso${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
echo ""

if [ "$FALHOU" -eq 0 ]; then
  echo -e "  ${GREEN}✅ FASE 0 COMPLETA${NC}"
  echo -e "  A fábrica está autorizada a iniciar a Sprint 1."
elif [ "$FALHOU" -le 3 ]; then
  echo -e "  ${YELLOW}⚠  FASE 0 QUASE LÁ — $FALHOU item(s) pendente(s)${NC}"
  echo -e "  Resolva os itens com ❌ antes de iniciar a Sprint 1."
else
  echo -e "  ${RED}⛔ FASE 0 INCOMPLETA — $FALHOU item(s) faltando${NC}"
  echo -e "  A Sprint 1 NÃO pode iniciar. Compartilhe este resultado com a fábrica."
fi
echo ""
