## Summary

- Estende eventos outbound n8n: `charge.overdue`, `charge.cancelled`, `notification.regua_enqueued`.
- Emissões em `webhook-side-effects`, `enqueueReguaNotificationJob` e worker `daily-regua`.
- Documentação: `N8N_WEBHOOKS.md`, `N8N_REGUA_WORKFLOW_EXEMPLO.md`, `DEPLOY_CHECKLIST` (vars n8n).

## Sprint / governança

- Sprint: **E** (P3 n8n) — `DEMANDA_SPRINT_E_N8N_ORQUESTRACAO.md`
- IA: commit + PR apenas — merge pelo **Tech Lead** (`GOVERNANCA_FABRICA_COMMIT_PR.md`)

## Test plan

- [x] `npm run build`
- [x] `npm test` (203/203)
- [x] `npm run portal:test` (29/29)
- [ ] CI `npm run quality:gate` (integração + Postgres no runner)

## Demo sugerida (TL/PO)

1. Definir `N8N_PLATFORM_WEBHOOK_URL` apontando para webhook de teste no n8n.
2. Simular cobrança vencida (webhook Asaas / inbox) → ver `charge.overdue` + `notification.regua_enqueued`.
3. Cancelar cobrança → ver `charge.cancelled`.

## Riscos / atenção

- Outbound continua fire-and-forget; pipeline Resend/Z-API inalterado.
- Sem migration; sem mudança de contrato HTTP público (só eventos n8n opcionais).
