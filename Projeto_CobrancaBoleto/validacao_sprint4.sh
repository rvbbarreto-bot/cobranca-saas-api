#!/bin/bash
# VALIDAÇÃO SPRINT 4 — SaaS Billing (planos, assinaturas, metering)
# Execute da raiz: bash Projeto_CobrancaBoleto/validacao_sprint4.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSOU=0
FALHOU=0

ok()   { PASSOU=$((PASSOU + 1)); echo -e "  ${GREEN}✅ OK${NC}    $1"; }
fail() { FALHOU=$((FALHOU + 1)); echo -e "  ${RED}❌ FALHA${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "$(basename "$SCRIPT_DIR")" == "Projeto_CobrancaBoleto" ]]; then
  PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
else
  PROJECT_ROOT="$SCRIPT_DIR"
fi

MIGRATIONS_DIR="$PROJECT_ROOT/db/migrations"

echo ""
echo -e "${BLUE}   VALIDAÇÃO SPRINT 4 — SaaS Billing   ${NC}"
echo ""

echo -e "${BLUE}[1/6] Migration 023${NC}"
if ls "$MIGRATIONS_DIR"/023_*.sql 1>/dev/null 2>&1; then
  ok "Migration 023 encontrada"
else
  fail "Migration 023 ausente"
fi

echo -e "${BLUE}[2/6] Módulo saas-billing${NC}"
if [ -d "$PROJECT_ROOT/src/modules/saas-billing" ]; then
  ok "src/modules/saas-billing existe"
else
  fail "Módulo saas-billing ausente"
fi

echo -e "${BLUE}[3/6] Rotas SaaS${NC}"
if grep -rq '"/plans"' "$PROJECT_ROOT/src/modules/saas-billing" 2>/dev/null; then
  ok "GET /v1/saas/plans referenciado"
else
  fail "Rota /saas/plans não encontrada"
fi

echo -e "${BLUE}[4/6] Assinatura portal escritório${NC}"
if grep -rq 'escritorio/assinatura\|"/assinatura"' "$PROJECT_ROOT/src/modules/portal-read" 2>/dev/null; then
  ok "GET escritorio/assinatura referenciado"
else
  fail "Endpoint assinatura do escritório ausente"
fi

echo -e "${BLUE}[5/6] Enforcement de limites${NC}"
if grep -rq 'assertTenantCanMutate\|LIMIT_COBRANCAS_MES' "$PROJECT_ROOT/src" --include="*.ts" 2>/dev/null; then
  ok "Metering/limites referenciados no código"
else
  fail "Enforcement de limites não encontrado"
fi

echo -e "${BLUE}[6/6] UI portal — bloco assinatura${NC}"
if grep -q 'fetchEscritorioAssinatura' "$PROJECT_ROOT/apps/portal-web/src/lib/api.ts" 2>/dev/null \
  && grep -q 'Plano e assinatura' "$PROJECT_ROOT/apps/portal-web/src/pages/EscritorioPage.tsx" 2>/dev/null; then
  ok "EscritorioPage consome assinatura"
else
  fail "UI assinatura ausente no portal"
fi

echo ""
echo -e "${BLUE}══════════════════════════════════════${NC}"
echo -e "  Resultado: ${GREEN}$PASSOU passou${NC} | ${RED}$FALHOU falhou${NC}"
echo -e "${BLUE}══════════════════════════════════════${NC}"
echo ""

if [ "$FALHOU" -eq 0 ] && [ "$PASSOU" -eq 6 ]; then
  echo -e "  ${GREEN}✅ SPRINT 4 (fase 1) VALIDADA — 6/6 OK${NC}"
  exit 0
fi

echo -e "  ${RED}⛔ Corrija os itens com falha${NC}"
exit 1
