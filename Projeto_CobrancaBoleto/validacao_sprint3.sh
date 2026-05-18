#!/bin/bash
# ============================================================
#  VALIDAÇÃO SPRINT 3 — NFS-e + Portal Cliente + Relatórios
#  Execute da raiz do projeto cobranca-saas-api:
#     bash Projeto_CobrancaBoleto/validacao_sprint3.sh
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSOU=0
FALHOU=0
AVISO=0

ok()    { echo -e "  ${GREEN}✅ OK${NC}     $1"; ((PASSOU++)); }
fail()  { echo -e "  ${RED}❌ FALHA${NC}  $1"; ((FALHOU++)); }
warn()  { echo -e "  ${YELLOW}⚠  AVISO${NC}  $1"; ((AVISO++)); }
info()  { echo -e "  ${BLUE}ℹ  INFO${NC}   $1"; }

echo ""
echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   VALIDAÇÃO SPRINT 3 — NFS-e + Portal Cliente    ${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "$(basename "$SCRIPT_DIR")" == "Projeto_CobrancaBoleto" ]]; then
  PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
else
  PROJECT_ROOT="$SCRIPT_DIR"
fi
info "Raiz do projeto: $PROJECT_ROOT"
echo ""

echo -e "${BLUE}[1/8] Worker nfse-emit${NC}"
if [ -f "$PROJECT_ROOT/src/platform/jobs/workers/nfse-emit.worker.ts" ]; then
  ok "nfse-emit.worker.ts existe"
else
  fail "nfse-emit.worker.ts ausente"
fi
echo ""

echo -e "${BLUE}[2/8] FocusNFeAdapter${NC}"
if [ -f "$PROJECT_ROOT/src/modules/nfse/infrastructure/focus-nfe/focus-nfe-adapter.ts" ]; then
  ok "FocusNFeAdapter existe"
else
  fail "FocusNFeAdapter ausente"
fi
echo ""

echo -e "${BLUE}[3/8] Referência nfse_emissions no código${NC}"
if grep -rq "nfse_emissions" "$PROJECT_ROOT/src" 2>/dev/null; then
  ok "nfse_emissions referenciada em src/"
else
  fail "nfse_emissions não encontrada em src/"
fi
echo ""

echo -e "${BLUE}[4/8] Tabela cliente_access_tokens (migrations)${NC}"
if grep -rq "cliente_access_tokens" "$PROJECT_ROOT/db/migrations" 2>/dev/null; then
  ok "cliente_access_tokens em db/migrations/"
else
  fail "cliente_access_tokens ausente em migrations"
fi
echo ""

echo -e "${BLUE}[5/8] Migration 021${NC}"
if ls "$PROJECT_ROOT/db/migrations/"021_* 1>/dev/null 2>&1; then
  ok "Migration 021 presente"
else
  fail "Migration 021 ausente"
fi
echo ""

echo -e "${BLUE}[6/8] Rotas /v1/portal/cliente${NC}"
if grep -rq "portal/cliente\|/cliente" "$PROJECT_ROOT/src/modules/portal-read" 2>/dev/null; then
  ok "Rotas portal cliente encontradas"
else
  fail "Rotas portal cliente não encontradas"
fi
echo ""

echo -e "${BLUE}[7/8] GET dashboard escritório${NC}"
if grep -rq "dashboard" "$PROJECT_ROOT/src/modules/portal-read" 2>/dev/null; then
  ok "Endpoint dashboard referenciado"
else
  fail "Dashboard não encontrado"
fi
echo ""

echo -e "${BLUE}[8/8] Export CSV${NC}"
if grep -rqE "export.*csv|csv.*export|streamCobrancasCsvRows|cobrancas/export" "$PROJECT_ROOT/src" 2>/dev/null; then
  ok "Export CSV referenciado"
else
  fail "Export CSV não encontrado"
fi
echo ""

echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
echo -e "  Resultado: ${GREEN}${PASSOU} OK${NC}  ${RED}${FALHOU} FALHA${NC}  ${YELLOW}${AVISO} AVISO${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
echo ""

if [ "$FALHOU" -gt 0 ]; then
  exit 1
fi
exit 0
