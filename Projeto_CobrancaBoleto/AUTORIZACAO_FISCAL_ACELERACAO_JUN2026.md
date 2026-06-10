# Autorização PO + Gestão — continuidade e aceleração fiscal SERPRO

**De:** Ricardo Barreto (PO) · Gestão Exeq  
**Para:** Fábrica Sênior Full-Stack · DevOps · QA · UX  
**Data:** 06/06/2026  
**Status:** ✅ **AUTORIZADO EXECUTAR AGORA**

Complementa: [`docs/AUTORIZACAO_PO_FABRICA_EXECUCAO_IMEDIATA.md`](../docs/AUTORIZACAO_PO_FABRICA_EXECUCAO_IMEDIATA.md)

---

## EXECUTAR AGORA (ordem)

1. CI verde `fiscal-portal-e2e` → merge PR #41 (`EXEQ-FISC-050`) — **concluído 2026-06-09**
2. Abrir/merge PR FISC-095 (hardening go-live) — **concluído 2026-06-09** (PR #42)
3. P1: FISC-053 audit apuração SERPRO — **concluído 2026-06-09** (PR #43 + gate #44)
4. Paralelo: N.3.1 relatórios CSV — **já no trunk** (`RelatoriosPage` + filtros data)
5. P1: FISC-041 factory `RECEITA_GATEWAY_PROVIDER` — **concluído 2026-06-09** (PR #45)
6. P1: FISC-071 dashboard fiscal + gates go-live — **concluído 2026-06-09** (PR #46)
7. FISC-090 + FISC-094 gates — **concluído 2026-06-10** (PR #47)
8. FISC-070 design system fiscal — **PR #48** (`verify:sprint70`)
9. **Próximo:** FISC-092 Playwright portal (`verify:sprint92` + CI `fiscal-portal-e2e.yml`)
10. **Bloqueio PO:** FISC-001 credenciais SERPRO live → `verify:fisc-001`
11. **Go-live:** `verify:fiscal-go-live-homolog` (sprint10+70+90+94) + assinaturas checklist §6

## MODO ACELERADO

- PRs ≤ 400 linhas, 1 story/PR, review Tech Lead ≤ 48h
- Mock SERPRO até FISC-001 (credenciais PO)
- **NÃO:** deploy prod, force push, secrets no git, Fase 2+

## GATES

`build` + `test:fiscal-serpro` + `verify:sprint*` aplicável + E2E fiscal CI

Checklist: [`docs/FISCAL_GO_LIVE_CHECKLIST.md`](../docs/FISCAL_GO_LIVE_CHECKLIST.md)

---

## SYSTEM PROMPT (fábrica)

```
Repositório: cobranca-saas-api
AUTORIZAÇÃO PO: continuidade + aceleração fiscal SERPRO (Jun/2026)

EXECUTAR AGORA (ordem):
1. CI verde fiscal-portal-e2e → merge PR #41 (EXEQ-FISC-050)
2. Abrir/merge PR FISC-095 (hardening go-live)
3. P1: FISC-053 audit apuração SERPRO
4. Paralelo opcional: N.3.1 feat/sprint-n-relatorios-filtros

MODO ACELERADO:
- PRs ≤ 400 linhas, 1 story/PR, review Tech Lead ≤ 48h
- Mock SERPRO até FISC-001 (credenciais PO)
- NÃO: deploy prod, force push, secrets no git, Fase 2+

GATES: build + test:fiscal-serpro + verify sprint + E2E fiscal CI
Checklist: docs/FISCAL_GO_LIVE_CHECKLIST.md
```

---

*Assinatura digital: Ricardo Barreto — PO · CobrançaSaaS v2*
