# Pacote de demandas — Sprint G: `charge.emitted` n8n + testes

**Emitido por:** Tech Lead · **Para:** Fábrica (IA + dev)  
**Data:** Maio 2026 · **Base:** `main` @ `fcaae14` (após PR #11 Sprint F)  
**Prioridade:** P3 · **Branch:** `feat/sprint-g-charge-emitted-n8n`

---

## Gate de entrada

```bash
git fetch origin && git checkout main && git pull origin main
git checkout -b feat/sprint-g-charge-emitted-n8n
npm ci && npm run migrate && npm run seed:dev
npm run build && npm test && npm run portal:test && npm run quality:gate
```

**Governança:** [GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md) — IA faz commit + PR + handoff; **Tech Lead** faz merge.

**Pré-requisitos:** Sprint F mergeada (portal editar cobrança); Sprint E (demais eventos n8n).

---

## Objetivo

Fechar o evento outbound **`charge.emitted`** após emissão gateway bem-sucedida (`processPaymentEmission`), com **testes unitários** e **funcionais** (bateria API).

**Fora de escopo neste PR:** runbook auth produção completo (FASE2 A — backlog H/G+); workflows n8n commitados; merge pela IA.

---

## Entregas (checklist)

### G.1 — Evento `charge.emitted`

| Arquivo | Ação |
|---------|------|
| `src/platform/integrations/n8n-outbound.ts` | Incluir `charge.emitted` em `N8nPlatformEventType` |
| `src/platform/jobs/application/payment-emission-processor.ts` | `emitN8nPlatformEvent` **após** `runEmission` OK (fora da transação) |
| `docs/N8N_WEBHOOKS.md` | Tabela + seção `charge.emitted` |

Payload: `{ charge_id }` · `tenant_id` = tenant público da cobrança.

### G.2 — Testes unitários

| Arquivo | Casos |
|---------|--------|
| `tests/platform/integrations/n8n-outbound.test.ts` | `charge.emitted` no `it.each` |
| `tests/platform/jobs/payment-emission-n8n.test.ts` | Emite após sucesso; não emite em falha / `charge_not_found` |

### G.3 — Testes funcionais

| Arquivo | Casos |
|---------|--------|
| `tests/functional/api-battery.integration.test.ts` | **B6** PATCH editável (já existia) · **B6b** PATCH em `paga` → `409 charge_not_editable` |

### G.4 — Documentação fábrica

- Atualizar `RETOMADA_FABRICA.md` e `PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md` (Sprint G atual → backlog H).

### G.5 — PR + handoff

- `npm run quality:gate` verde
- PR com corpo: resumo, test plan, link `N8N_WEBHOOKS.md`
- **Sem merge** (Tech Lead)

---

## Critérios de aceite

- [ ] `charge.emitted` só após emissão OK (não em `erro_emissao` / `charge_not_found`)
- [ ] n8n noop sem `N8N_PLATFORM_WEBHOOK_URL` (comportamento existente)
- [ ] `npm test` e `npm run test:integration` (bateria) verdes com `DATABASE_URL`
- [ ] Cobertura global ≥ 82% (gate CI)

---

## Backlog pós-G

| Sprint | Tema |
|--------|------|
| H | `e2e:asaas:evidence` + checklist Sprint 1 homolog |
| — | Runbook `ENABLE_MOCK_AUTH` / JWT produção (FASE2 A) |
