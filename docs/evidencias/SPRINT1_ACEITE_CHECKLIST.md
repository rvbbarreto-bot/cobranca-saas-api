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

Saída esperada: caminho `docs/evidencias/asaas-e2e-<timestamp>.json` e **14 assertions OK** no terminal (13 critérios; critério 7 usa duas assertions).

No JSON gerado, cada linha abaixo deve ter `"ok": true` no nome **Assertion runner** correspondente.

| # | Critério | Assertion runner | OK | Evidência (arquivo / print) |
|---|----------|------------------|----|-----------------------------|
| 1 | Ambiente Asaas Sandbox (não mock) | `ambiente_asaas_sandbox` | ☐ | `environment.asaasApiUrl` |
| 2 | Cobrança criada no Asaas | `cobranca_criada_asaas` | ☐ | `detail` com `gateway_transaction_id` |
| 3 | Vínculo cobrança interna ↔ Asaas | `vinculo_interno_asaas` | ☐ | `steps.afterEmission.ch.provider_charge_id` |
| 4 | Identificador externo persistido | `identificador_externo` | ☐ | `steps.createCharge.idempotency_key` |
| 5 | Webhook recebido e salvo | `webhook_inbox_inserido` | ☐ | `steps.webhookFirstInsert` |
| 6 | Idempotência webhook duplicado | `webhook_idempotente_sem_evento_duplicado` | ☐ | assertion no JSON |
| 7 | Transição em `charge_events` | `charge_event_emissao` + `charge_event_webhook` | ☐ | duas assertions |
| 8 | Payload bruto Asaas salvo | `payment_transaction_com_raw` | ☐ | `has_raw` em `afterEmission` |
| 9 | Erros com `request_id` / correlation | `correlation_id_rastreavel` | ☐ | `correlationId` no JSON |
| 10 | Sem segredos no repositório | `relatorio_sem_segredos` | ☐ | JSON sem `$aact_` |
| 11 | Credenciais só em env/cofre | `env_nao_commitada` | ☐ | `.env.example` + `secretsPolicy` |
| 12 | Evidências objetivas anexadas | `evidencia_json_gerada` | ☐ | caminho no `detail` (fora do git) |
| 13 | Reproduzível por outro dev | `reproducivel_documentado` | ☐ | `automatedTestsNote` + docs |

**Testes automatizados (sem Asaas):** `npm test` (incl. `tests/dev/asaas-e2e-evidence.test.ts`) e `tests/inbox/webhook-inbox-idempotency.integration.test.ts` (requer `DATABASE_URL`).

**Template redigido:** [asaas-e2e-EXAMPLE.redacted.json](./asaas-e2e-EXAMPLE.redacted.json) · [README.md](./README.md)

**Data da execução:** _______________  
**Executor:** _______________  
**Branch / commit:** _______________ (copiar de `git` no JSON)  
**Aprovado PO / Lead Tech:** _______________
