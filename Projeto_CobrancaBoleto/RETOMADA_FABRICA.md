# Retomada da fábrica — SaaS Cobranças (PO + Tech Lead)

**Emissão:** Maio 2026 · **Repositório:** `cobranca-saas-api`  
**Operação diária:** este arquivo + [PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md](./PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md)

---

## 1. Onde estamos (snapshot)

| Marco | PR | Status |
|-------|-----|--------|
| Sprints B–F | #6–#11 | Concluído |
| Sprint G — `charge.emitted` n8n | #12 | Concluído (branch integração) |
| Sprint H — homolog Asaas E2E | #14 | Concluído (branch integração) |
| **FASE2 A — auth produção** | — | **← ATUAL** |

**Testes:** `npm test` 208+ · `portal:test` 33 · CI `quality:gate`

**Branch fábrica:** `feat/fase2-a-auth-producao` ← `main` (após consolidar integração sprint1 se necessário)

**Atenção release:** G/H podem estar em `feat/sprint1-payment-emission-portal` (`cf6b334`) e ainda não em `main` — Tech Lead consolida antes de produção.

---

## 2. Gate de entrada

```bash
git fetch origin && git checkout main && git pull origin main
npm ci && npm run migrate && npm run seed:dev
npm run build && npm test && npm run portal:test && npm run quality:gate
```

---

## 3. Implementado (não refazer)

- Portal + API (editar cobrança, configurações, paginação, SaaS billing)
- Inbox idempotência, n8n (6 eventos), runner E2E Asaas + checklist Sprint 1
- Flags mock auth + `check:prod-env` (base já no código)

---

## 4. Trabalho imediato — FASE2 A

**Pacote:** [DEMANDA_FASE2_A_AUTH_PRODUCAO.md](./DEMANDA_FASE2_A_AUTH_PRODUCAO.md)

| # | Item |
|---|------|
| A.1 | `RUNBOOK_AUTH_PRODUCAO.md` |
| A.2 | `check:prod-env` anti-placeholder |
| A.3–A.4 | Testes unit + integração mocks 404 |
| A.5 | Contrato + portal ajuda |
| A.6 | CI check prod-env (opcional) |
| A.7 | PR + handoff TL |

### Backlog pós–FASE2 A

- CI `workflow_dispatch` Asaas E2E
- Aceite PO checklist sandbox (processo)

---

## 5. Ordem de execução

```
git pull main → feat/fase2-a-auth-producao
DEMANDA_FASE2_A → quality:gate → PR → handoff (sem merge IA)
```

---

## 6. SYSTEM PROMPT (colar no Cursor)

```
Repositório: cobranca-saas-api.
FASE2 A ATUAL: runbook auth produção + JWT/mock + testes.
Branch: feat/fase2-a-auth-producao
Pacote: Projeto_CobrancaBoleto/DEMANDA_FASE2_A_AUTH_PRODUCAO.md
Gate: npm test + portal:test + quality:gate
Governança: IA abre PR; Tech Lead merge.
```
