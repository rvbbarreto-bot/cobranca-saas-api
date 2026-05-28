# Autorização PO — execução imediata Onda 0 (QA P2 + prints)

**De:** Ricardo Barreto (PO)  
**Para:** Fábrica / QA  
**Data:** 28/05/2026  
**Status:** ✅ **AUTORIZADO EXECUTAR AGORA**

---

## Escopo autorizado

1. Checklist **`docs/QA_P2_POS_MERGE_CHECKLIST.md`** (regressão Asaas + endereço + UX Onda C + config gateway).
2. Checklist **`docs/QA_PORTAL_UI_TOKENS_P0.md`** (tema claro/escuro, dropdown, calendário).
3. Preencher e atualizar **`docs/evidencias/SPRINT_N_HOMOLOG_RELATORIO.md`**.
4. Registrar prints em **`docs/evidencias/prints/`** (prefixo `sprint-n-*`).

**Base obrigatória:** `main` @ **`153c8ed`** (pós merge **#30** gaps B/D + **#31** docs homolog).

**Ambiente:** `npm run dev:up` + `npm run portal:dev` — login seed `portal-seed@local.dev` / tenant `escritorio-demo`.

---

## Gates

| Gate | Critério |
|------|----------|
| G-N-0a | `npm test` + `npm run portal:test` verdes |
| G-N-0b | R1 + lista cobranças OK no portal |
| G-N-0c | Prints P0/P2 anexados ao relatório |
| G-N-0d | Bloqueios documentados (ex.: Inter cert, API clientes 500) |

Homolog Inter **real** (cert sandbox) permanece **opcional** — não bloqueia encerramento Onda 0 se mocks/dev OK.

---

## SYSTEM PROMPT (fábrica)

```
AUTORIZAÇÃO PO: executar AGORA checklist P2 + QA_PORTAL_UI_TOKENS_P0.
Base main @ 153c8ed. Atualizar docs/evidencias/SPRINT_N_HOMOLOG_RELATORIO.md e prints/.
```

---

*Assinatura digital: Ricardo Barreto — PO · CobrançaSaaS v2*
