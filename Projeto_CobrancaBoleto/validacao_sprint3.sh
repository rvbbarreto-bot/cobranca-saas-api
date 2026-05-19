#!/bin/bash
# ============================================================
#  VALIDAÇÃO SPRINT 3 — Portal Cliente + Relatórios (sem NFS-e)
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
echo -e "${BLUE}   VALIDAÇÃO SPRINT 3 — Portal Cliente + Relatórios ${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
echo ""

# ── Detectar raiz do projeto ──────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "$(basename "$SCRIPT_DIR")" == "Projeto_CobrancaBoleto" ]]; then
  PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
else
  PROJECT_ROOT="$SCRIPT_DIR"
fi
info "Raiz do projeto: $PROJECT_ROOT"
echo ""

MIGRATIONS_DIR="$PROJECT_ROOT/db/migrations"

# ────────────────────────────────────────────────────────────
echo -e "${BLUE}[1/6] Migration 021 (cliente_access_tokens)${NC}"
# ────────────────────────────────────────────────────────────
if ls "$MIGRATIONS_DIR"/021_*.sql 1>/dev/null 2>&1; then
  ok "Migration 021 encontrada em db/migrations/"
  info "$(ls "$MIGRATIONS_DIR"/021_*.sql | head -1)"
else
  fail "Nenhum arquivo 021_*.sql em db/migrations/"
fi
echo ""

# ────────────────────────────────────────────────────────────
echo -e "${BLUE}[2/6] Tabela cliente_access_tokens no código${NC}"
# ────────────────────────────────────────────────────────────
CAT_REFS=$(grep -r "cliente_access_tokens" "$PROJECT_ROOT/src" --include="*.ts" -l 2>/dev/null | wc -l)
if [ "$CAT_REFS" -gt 0 ]; then
  ok "cliente_access_tokens referenciada em $CAT_REFS arquivo(s) TypeScript"
else
  fail "Nenhuma referência a cliente_access_tokens em src/"
fi
echo ""

# ────────────────────────────────────────────────────────────
echo -e "${BLUE}[3/6] Endpoints /v1/portal/cliente${NC}"
# ────────────────────────────────────────────────────────────
CLIENTE_ENDPOINTS=$(grep -r "portal/cliente" "$PROJECT_ROOT/src" --include="*.ts" -l 2>/dev/null | wc -l)
if [ "$CLIENTE_ENDPOINTS" -gt 0 ]; then
  ok "Endpoints portal/cliente referenciados em $CLIENTE_ENDPOINTS arquivo(s)"
else
  fail "Nenhuma referência a portal/cliente em src/"
fi
echo ""

# ────────────────────────────────────────────────────────────
echo -e "${BLUE}[4/6] Endpoint dashboard do escritório${NC}"
# ────────────────────────────────────────────────────────────
DASHBOARD_REFS=$(grep -r "escritorio/dashboard" "$PROJECT_ROOT/src" --include="*.ts" -l 2>/dev/null | wc -l)
if [ "$DASHBOARD_REFS" -gt 0 ]; then
  ok "escritorio/dashboard referenciado em $DASHBOARD_REFS arquivo(s)"
else
  fail "Nenhuma referência a escritorio/dashboard em src/"
fi
echo ""

# ────────────────────────────────────────────────────────────
echo -e "${BLUE}[5/6] Export CSV de cobranças${NC}"
# ────────────────────────────────────────────────────────────
EXPORT_REFS=$(grep -rE "export.*format|format.*csv" "$PROJECT_ROOT/src" --include="*.ts" -l 2>/dev/null | wc -l)
if [ "$EXPORT_REFS" -gt 0 ]; then
  ok "Export CSV (format=csv) referenciado em $EXPORT_REFS arquivo(s)"
else
  fail "Nenhuma referência a export/format CSV em src/"
fi
echo ""

# ────────────────────────────────────────────────────────────
echo -e "${BLUE}[6/6] Ausência de NFS-e no código TypeScript${NC}"
# ────────────────────────────────────────────────────────────
NFSE_REFS=$(grep -rE "nfse_emissions|focus_nfe|FocusNFe|nfseEmit" \
  "$PROJECT_ROOT/src" --include="*.ts" -l 2>/dev/null)

if [ -z "$NFSE_REFS" ]; then
  ok "Nenhuma referência a NFS-e (nfse_emissions, focus_nfe, FocusNFe, nfseEmit) em src/"
else
  fail "Referências NFS-e encontradas (Sprint 3 não inclui NFS-e):"
  while IFS= read -r f; do
    [ -n "$f" ] && info "  → $f"
  done <<< "$NFSE_REFS"
fi
echo ""

# ────────────────────────────────────────────────────────────
# RESULTADO FINAL
# ────────────────────────────────────────────────────────────
TOTAL=$((PASSOU + FALHOU))
echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
echo -e "  Resultado: ${GREEN}$PASSOU passou${NC} | ${RED}$FALHOU falhou${NC} | ${YELLOW}$AVISO aviso${NC} (de $TOTAL verificações)"
echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
echo ""

if [ "$FALHOU" -eq 0 ] && [ "$PASSOU" -eq 6 ]; then
  echo -e "  ${GREEN}✅ SPRINT 3 VALIDADA — 6/6 OK${NC}"
  echo -e "  Portal cliente, dashboard e export CSV presentes; NFS-e ausente do código."
  exit 0
elif [ "$FALHOU" -eq 0 ]; then
  echo -e "  ${GREEN}✅ Nenhuma falha${NC} ($PASSOU verificações OK)"
  exit 0
else
  echo -e "  ${RED}⛔ SPRINT 3 INCOMPLETA — $FALHOU item(s) com falha${NC}"
  echo -e "  Corrija os itens ❌ e execute novamente."
  exit 1
fi
