# Sprint 1 — Checklist de aceite (Asaas Sandbox E2E)

Preencher após `npm run e2e:asaas:evidence` ou bateria manual documentada em [ASAAS_SANDBOX_E2E.md](../ASAAS_SANDBOX_E2E.md).

## Como gerar evidências

```bash
cd cobranca-saas-api
npm run migrate
npm run seed:dev   # apenas homolog / sandbox local
```

No `.env` (não commitar): `DATABASE_URL`, `ASAAS_API_KEY` (sandbox), `ENCRYPTION_KEY`, `WEBHOOK_INBOX_SECRET`, `JWT_SECRET`.

```bash
npm run e2e:asaas:evidence
```

Saída esperada: caminho `docs/evidencias/asaas-e2e-<timestamp>.json` e contagem de assertions OK no terminal.

| # | Critério | OK | Evidência (arquivo / print) |
|---|----------|----|-----------------------------|
| 1 | Ambiente Asaas Sandbox (não mock) | ☐ | |
| 2 | Cobrança criada no Asaas | ☐ | `gateway_transaction_id` no JSON E2E |
| 3 | Vínculo cobrança interna ↔ Asaas | ☐ | `provider_charge_id` em `charges` |
| 4 | Identificador externo persistido | ☐ | SQL / JSON passo `afterEmission` |
| 5 | Webhook recebido e salvo | ☐ | `webhook_inbox` + `webhookFirstInsert` |
| 6 | Idempotência webhook duplicado | ☐ | assertion `webhook_idempotente_sem_evento_duplicado` no JSON |
| 7 | Transição em `charge_events` | ☐ | `emissao_gateway`, `webhook_asaas` |
| 8 | Payload bruto Asaas salvo | ☐ | `gateway_raw_response` |
| 9 | Erros com `request_id` / correlation | ☐ | logs HTTP (middleware) |
| 10 | Sem segredos no repositório | ☐ | `git grep` / `.gitignore` |
| 11 | Credenciais só em env/cofre | ☐ | `.env.example` placeholders |
| 12 | Evidências objetivas anexadas | ☐ | `docs/evidencias/asaas-e2e-*.json` |
| 13 | Reproduzível por outro dev | ☐ | `docs/ASAAS_SANDBOX_E2E.md` + [INBOX_WEBHOOK_IDEMPOTENCIA.md](../INBOX_WEBHOOK_IDEMPOTENCIA.md) |

**Testes automatizados (sem Asaas):** `tests/inbox/webhook-inbox-idempotency.integration.test.ts` (requer `DATABASE_URL`).

**Data da execução:** _______________  
**Executor:** _______________  
**Branch / commit:** _______________  
**Aprovado PO / Lead Tech:** _______________
