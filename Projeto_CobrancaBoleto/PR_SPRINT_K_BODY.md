## Summary

- **Sprint K — fundação operacional:** hardening BullMQ (retry/DLQ), API admin de filas + SLIs, `GatewayError.retryable`, logs estruturados em workers.
- **K-005:** `classifyJobError`, filas `*-dlq`, reprocessamento `POST /v1/admin/queues/dlq/:queueName/reprocess`, `GET /v1/admin/queues/status`.
- **K-006:** `docs/observability/sli-definitions.md` (7 SLIs) + `GET /v1/admin/metrics/sli` (snapshot SQL).
- **K-002:** workflow `.github/workflows/e2e-asaas.yml` (`workflow_dispatch`, skip sem `ASAAS_API_KEY`).
- **K-010:** `.gitignore` + seção artefatos ignorados em `GOVERNANCA_FABRICA_COMMIT_PR.md`.

## Sprint / governança

- Sprint: **K** (autorização PO Mai/2026 — `AUTORIZACAO_SPRINT_K_MAIO2026.md`)
- IA: commit + PR apenas — merge pelo **Tech Lead**
- **K-001 (Sprint I):** já integrado em `main` via **PR #16** — este PR não reabre consolidação I

## O que mudou (técnico)

| Área | Detalhe |
|------|---------|
| Filas | `JOB_OPTS`: emission 5× exp, webhook 8× exp, notification 4× fixo 120s |
| Erros | `GatewayError` + `PaymentGatewayError` estende com `retryable` |
| Admin | `/v1/admin/*` — JWT **owner** + `x-tenant-id` |
| Observabilidade | SLIs em `charge_events`, `webhook_inbox`, `communication_events` |

## Test plan

- [x] `npm run build`
- [x] `npm test` — `classify-job-error`, `dlq-service`, `payment-gateway/*`
- [ ] `npm run quality:gate` (CI no PR)
- [ ] Staging: `GET /v1/admin/queues/status` com token owner
- [ ] Actions → **E2E Asaas (manual)** — sandbox com/sem `ASAAS_API_KEY`

## Como testar

```bash
npm run build && npm test -- tests/platform/jobs/classify-job-error.test.ts tests/platform/jobs/dlq-service.test.ts
```

Admin (exemplo):

```http
GET /v1/admin/queues/status
Authorization: Bearer <owner-jwt>
x-tenant-id: <tenant-uuid>
```

## Riscos / atenção

- `main` já possui `.github/workflows/asaas-e2e-manual.yml` (Sprint J #17); este PR adiciona `e2e-asaas.yml` alinhado ao pacote autorizado — TL pode consolidar nomes depois.
- SLI “disponibilidade portal” retorna `unavailable` até agregador de logs HTTP.

## Handoff — Tech Lead

- **Branch:** `feat/sprint-k-ops-foundation`
- **Gates locais:** build ✅ | test ✅ (escopo Sprint K)
- **Ação:** revisar e **aprovar merge** (IA não faz merge)
- **Próximo gate:** checkpoint dia 5 Sprint K (filas staging + workflow)

## Revisão

- [ ] **Tech Lead:** aprovação técnica + merge
- [ ] **PO:** aceite checkpoint operacional (opcional neste PR)
