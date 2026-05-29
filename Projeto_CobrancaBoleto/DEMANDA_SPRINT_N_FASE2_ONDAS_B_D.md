# Sprint N — Fase 2 (próxima entrega à fábrica)

**Emitido por:** PO · Tech Lead  
**Para:** Fábrica (IA + dev)  
**Data:** 2026-05-28 · **Base:** `main` @ `16cf460` (pós #28 Sprint K, #29 docs autorização)  
**Pacote mãe:** [DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md](./DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md)  
**Governança:** [GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md)  
**Auditoria B/D:** [AUDITORIA_SPRINT_N_ONDAS_B_D.md](./AUDITORIA_SPRINT_N_ONDAS_B_D.md)

---

## 1. O que já foi entregue (não refazer)

| Item | PR | Status |
|------|-----|--------|
| Tokens P0 (#25) | #25 | ✅ `main` |
| Onda A — detalhe boleto, BrDatePicker edição, dash/toolbar | #26 | ✅ `main` |
| P2.2 endereço, PEM, Onda C MVP | #24 | ✅ `main` |
| Sprint K — DLQ, SLI, admin API | #28 | ✅ `main` |
| **Onda B — PDF Inter (proxy portal)** | **#27** | ✅ **CONCLUÍDO** |
| **Onda D — Webhook Inter** | **#27** | ✅ **CONCLUÍDO** |
| Gaps B/D (erro PDF portal, testes, fixture vencido) | `fix/sprint-n-b-d-gaps` | PR aberto p/ merge |

**Onda A remanescente (opcional):** N.1.2 Clientes/Config/Login (hex legados), N.1.4 a11y residual.

---

## 2. Objetivo atual (PO) — pós B/D

**Autorização de desenvolvimento ativa:** [AUTORIZACAO_PROXIMO_DESENVOLVIMENTO.md](./AUTORIZACAO_PROXIMO_DESENVOLVIMENTO.md)

| Prioridade | Onda | Status | Próxima ação |
|------------|------|--------|--------------|
| **P1** | **C** — Relatórios (filtros data) | **AUTORIZADO** | `feat/sprint-n-relatorios-filtros` |
| **P0** | **0** — Homolog | Paralelo | Revalidar C1–C3 pós #33 |
| Opcional | Onda A restante | Backlog | `feat/sprint-n-portal-polish` |

**Ondas B e D:** DoD técnico atendido em `main` (#27). Não reimplementar adapter/webhook.

---

## 3. Bloco de autorização PO (referência — B/D encerrados)

```text
AUTORIZAÇÃO PO + TECH LEAD — Sprint N Fase 2
Data: 2026-05-28
Repo: cobranca-saas-api
Base: main (16cf460)

Ondas B + D: CONCLUÍDAS (#27 + PR gaps se aplicável)
Pacote vigente: Onda 0 (QA) — docs/evidencias/SPRINT_N_HOMOLOG_RELATORIO.md

NÃO REIMPLEMENTAR: PDF Inter, webhook Inter, Onda A #26, Sprint K #28.
```

---

## 4. Gate de entrada (Onda 0)

```bash
git fetch origin && git checkout main && git pull origin main
git checkout docs/sprint-n-homolog   # ou main após merge do relatório
npm ci && npm run migrate && npm run seed:dev
npm run build && npm test && npm run portal:test
```

---

## 5. Onda B — status DoD (concluído)

| ID | Critério | Status |
|----|----------|--------|
| N.2.1 | Adapter PDF Inter + placeholder `inter://` | ✅ #27 |
| N.2.2 | Proxy portal + botão PDF + erro amigável | ✅ #27 + gaps PR |
| N.2.3 | Testes mock + `GATEWAY_UNIVERSAL.md` | ✅ |

---

## 6. Onda D — status DoD (concluído)

| ID | Critério | Status |
|----|----------|--------|
| N.4.1 | Webhook `source: inter` + fixtures | ✅ |
| N.4.2 | charge-sync idempotente | ✅ |
| N.4.4 | Testes integração/fixtures | ✅ |

**Fora desta fase:** N.4.3 estorno `estornada` → PR dedicado futuro.

---

## 7. Onda 0 — QA (única frente P0 aberta)

Preencher e assinar [docs/evidencias/SPRINT_N_HOMOLOG_RELATORIO.md](../docs/evidencias/SPRINT_N_HOMOLOG_RELATORIO.md):

- SHA `16cf460` ou posterior  
- Checklist P2 (tabela R/C/G/U/K)  
- Prints em `docs/evidencias/prints/`  
- Bloqueio Inter cert: SIM/NÃO  
- Declaração impacto endpoints  

---

## 8. PRs (histórico + abertos)

| # | Branch | Conteúdo | Status |
|---|--------|----------|--------|
| — | `feat/sprint-n` (#27) | Ondas B + D | ✅ mergeado |
| — | `fix/sprint-n-b-d-gaps` | Gaps auditoria | Aberto |
| — | `docs/sprint-n-homolog` | Relatório Onda 0 pré-preenchido | Aberto |

---

## 9. SYSTEM PROMPT (fábrica)

```
main @ 16cf460. Sprint N Fase 2: Ondas B + D CONCLUÍDAS (#27).
Pacote: DEMANDA_SPRINT_N_FASE2_ONDAS_B_D.md — foco Onda 0 (homolog).
Não refazer PDF/webhook Inter. QA: docs/evidencias/SPRINT_N_HOMOLOG_RELATORIO.md
```

---

*Atualizado pelo Tech Lead em 2026-05-28. Vigente até nova instrução do PO.*
