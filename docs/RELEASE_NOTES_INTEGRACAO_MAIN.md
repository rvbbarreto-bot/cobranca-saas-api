# Release notes — Integração `main` (Sprint I)

**Branch integrada:** `feat/sprint1-payment-emission-portal`  
**Alvo:** `main`  
**Data:** Maio 2026

Este documento resume o que entra em `main` quando o PR Sprint I for mergeado. Commits anteriores a Sprint F (#11) já estavam parcialmente em `main`; o delta principal é **G → FASE2 A** e a linha **Sprint 1 / SaaS billing** acumulada na branch de integração.

---

## Pull requests incluídos (delta vs `main` @ Sprint F)

| PR | Tema |
|----|------|
| #12 | Sprint G — evento n8n `charge.emitted` |
| #14 | Sprint H — homolog Asaas E2E, assertions nomeadas, evidências |
| #15 | FASE2 A — `RUNBOOK_AUTH_PRODUCAO`, política JWT, gate mocks em produção |
| (integração) | Sprint 1 emissão, portal cliente, SaaS billing, n8n B–F, inbox D, etc. |

---

## Funcional (resumo PO)

- Portal: editar cobrança, configurações, paginação/cursor, área cliente, exportações
- API: inbox webhook idempotente, 6 eventos n8n (incl. `charge.emitted`)
- SaaS billing: planos, assinatura plataforma Asaas, métricas, `assert-tenant-can-mutate`
- Homolog: runner `npm run e2e:asaas:evidence` + checklist Sprint 1
- Produção: runbook auth JWT/mock; `check:prod-env --strict` no CI

---

## Migrations novas (aplicar em ordem)

- `023_saas_billing_plans_subscriptions.sql`
- `024_asaas_platform_subscription_billing.sql`

Comando pós-deploy: `npm run migrate`

---

## Breaking / remoções

- Módulo **NFS-e Focus NFe** legado removido do código (escopo produto atual = cobrança + portal; NFS-e fora do pacote Sprint 1).

---

## Operação pós-merge

```bash
git checkout main && git pull origin main
npm ci && npm run migrate && npm run seed:dev   # dev
npm run build && npm test && npm run portal:test && npm run quality:gate
```

Produção: [DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md), [RUNBOOK_AUTH_PRODUCAO.md](./RUNBOOK_AUTH_PRODUCAO.md), [PRODUCAO_ENDURECIMENTO_PASSO_A_PASSO.md](./PRODUCAO_ENDURECIMENTO_PASSO_A_PASSO.md).

Homolog PO (manual): `ASAAS_API_KEY` no `.env` → `npm run e2e:asaas:evidence` → assinar [evidencias/SPRINT1_ACEITE_CHECKLIST.md](./evidencias/SPRINT1_ACEITE_CHECKLIST.md).

---

## Próximo sprint fábrica

Sprint J — CI `workflow_dispatch` Asaas E2E: [../Projeto_CobrancaBoleto/DEMANDA_SPRINT_J_CI_ASAAS_E2E.md](../Projeto_CobrancaBoleto/DEMANDA_SPRINT_J_CI_ASAAS_E2E.md)
