# Autorização PO — próximo desenvolvimento (pós Sprint N B/D + fix schema)

**De:** Ricardo Barreto (PO)  
**Para:** Fábrica Sênior Full-Stack + DevOps  
**Data:** 28/05/2026  
**Status:** ✅ **AUTORIZADO EXECUTAR AGORA**

---

## 1. Trunk e merges considerados encerrados

| Item | PR | Commit área |
|------|-----|-------------|
| Sprint K (DLQ, SLI, admin) | #28 | `e734aad` |
| Docs autorização pós-K | #29 | `16cf460` |
| Gaps B/D (PDF erro, testes) | #30 | — |
| Homolog + docs Onda 0 | #31–#32 | — |
| **BUG-QA-001** (schema `027` / clientes 500) | **#33** | **`f9120a6`** |

**Trunk único:** `main` @ **`f9120a6`** ou posterior.

**Pré-requisito ambiente (DevOps — já autorizado):** `npm run migrate` com **027** aplicada · `/health/ready` com `portalClienteEndereco: true`.

---

## 2. O que a fábrica está **autorizada a iniciar agora**

### P1 — Desenvolvimento (principal)

| ID | Entrega | Branch | Pacote |
|----|---------|--------|--------|
| **N.3.1** | **Relatórios / CSV com filtros de data** | `feat/sprint-n-relatorios-filtros` | [DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md](./DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md) § Onda C |

**Escopo N.3.1 (resumo PO):**

- API: `GET /v1/portal/escritorio/cobrancas/export` com `from` / `to` (ISO date), tenant isolado.
- Portal: `RelatoriosPage` — dois `BrDatePicker`, export CSV, feedback de erro.
- Testes: integração export com intervalo; smoke portal.

**Gate merge:** `quality:gate` + review Tech Lead.

### P0 — Paralelo (QA, não bloqueia dev)

| ID | Entrega | Responsável |
|----|---------|-------------|
| **Onda 0** | Reexecutar checklist P2 (itens **C1–C3** após migration 027) + assinar relatório | QA/PO |

Artefato: [docs/evidencias/SPRINT_N_HOMOLOG_RELATORIO.md](../docs/evidencias/SPRINT_N_HOMOLOG_RELATORIO.md)

### P2 — Opcional (se capacidade após N.3.1)

| ID | Entrega | Branch |
|----|---------|--------|
| N.1.2 / N.1.4 | Polish portal (Clientes, Config, Login, a11y residual) | `feat/sprint-n-portal-polish` |

---

## 3. Fora de escopo neste ciclo (não iniciar sem novo RFC PO)

| Item | Motivo |
|------|--------|
| Reimplementar **Onda B** (PDF Inter) ou **Onda D** (webhook) | ✅ Concluídas (#27, #30) |
| Sprint **O** (BB sandbox) | Pacote futuro |
| Recorrência E2E completa | Pacote dedicado |
| Fallback cross-gateway automático | ADR-001 v1 = sem failover |
| `feat/sprint1-payment-emission-portal` | Legado — usar só `main` |

---

## 4. Gate de entrada (obrigatório, dia 1)

```bash
git fetch origin && git checkout main && git pull origin main
git checkout -b feat/sprint-n-relatorios-filtros
npm ci && npm run migrate && npm run seed:dev
npm run build && npm test && npm run portal:test && npm run quality:gate
```

DevOps local: `npm run dev:up` e `docker compose up -d --build api` após pull.

---

## 5. Gates de saída deste pacote

| Gate | Critério |
|------|----------|
| **G-N-C** | Export CSV com filtro `from`/`to` funcional + testes |
| **G-N-0** | Relatório homolog P2 assinado (C1–C3 **PASS** pós 027) |
| **G-merge** | PR ≤ ~400 linhas; IA abre · **Tech Lead merge** |

---

## 6. SYSTEM PROMPT (colar no Cursor)

```
Repositório: cobranca-saas-api
main @ f9120a6+

AUTORIZAÇÃO PO IMEDIATA — próximo desenvolvimento
Pacote: Projeto_CobrancaBoleto/AUTORIZACAO_PROXIMO_DESENVOLVIMENTO.md
Branch: feat/sprint-n-relatorios-filtros (Onda C — N.3.1 relatórios filtros data)
Especificação: DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md (Onda C)

NÃO REIMPLEMENTAR: PDF Inter, webhook Inter (Ondas B/D #27/#30).
Migration 027 obrigatória no ambiente (portal.cliente endereco_*).
Paralelo QA: fechar Onda 0 homolog (C1–C3) em SPRINT_N_HOMOLOG_RELATORIO.md.
Gate: npm run quality:gate antes de abrir PR.
Governança: GOVERNANCA_FABRICA_COMMIT_PR.md
```

---

*Assinatura digital: Ricardo Barreto — PO · CobrançaSaaS v2*
