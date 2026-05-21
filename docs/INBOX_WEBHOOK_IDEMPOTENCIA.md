# Inbox — idempotência de webhooks

Contrato para integradores (n8n, Asaas, scripts internos) antes de automação em produção.

## Identificador do evento

| Origem | Campo |
|--------|--------|
| Header (recomendado) | `X-External-Event-Id` |
| Corpo JSON (alternativa) | `external_event_id` |

Sem `external_event_id`, cada `POST` cria **nova** linha em `webhook_inbox` (sem deduplicação).

Com `external_event_id`, a unicidade é por **tenant** (`UNIQUE (tenant_id, external_event_id)` na migration `001`).

## Resposta HTTP `POST /v1/inbox/webhooks`

| Situação | Status | Corpo |
|----------|--------|--------|
| Primeira inserção | **202** | `{ accepted: true, deduplicated: false, already_processed: false, id }` |
| Reenvio antes de processar | **200** | `{ accepted: true, deduplicated: true, already_processed: false, id }` — mesmo `id` da linha existente |
| Reenvio após `processed_at` | **200** | `{ accepted: true, deduplicated: true, already_processed: true, id }` |

A API **não** rejeita duplicatas com 409: o consumidor pode repetir o POST com segurança.

## Autenticação e tenant

- `x-tenant-id`: slug do tenant core (ex.: `demo`).
- `X-Webhook-Secret`: obrigatório quando `WEBHOOK_INBOX_SECRET` está definido; em `NODE_ENV=production` o secret é **obrigatório** no servidor (senão **503** `webhook_inbox_misconfigured`).

## Processamento

Após inserção, o servidor agenda `inbox-process` (BullMQ). Processamento manual ou job:

`POST /v1/inbox/webhooks/process-pending?limit=25` (JWT com roles `owner`, `admin`, `finance`, `service_account`).

Duplicatas na fila já processadas incrementam `skipped_already_processed` no JSON de resposta.

## Regras para n8n / gateways

1. Sempre enviar o **mesmo** `X-External-Event-Id` para retries do mesmo evento de negócio (ID do provedor, hash estável do payload, etc.).
2. Tratar **200** com `deduplicated: true` como sucesso (não reprocessar lado a lado).
3. Não depender do corpo do segundo POST para atualizar a linha — o primeiro payload persistido é o da fila.
4. Rate limit: middleware `webhookRateLimit` na rota de entrada.

## Testes e evidências

| Comando | O que cobre |
|---------|-------------|
| `npm test` | Unitário `tests/inbox/webhook-inbox-repository.test.ts` |
| `npx vitest run tests/inbox/webhook-inbox-idempotency.integration.test.ts` | Integração: sequência, pós-processamento, 8 POSTs concorrentes |
| `npm run e2e:asaas:evidence` | Assertion `webhook_idempotente_sem_evento_duplicado` no relatório Asaas |

Ver também [API_CONTRATO_E_SMOKE.md](./API_CONTRATO_E_SMOKE.md) e [FASE2_KICKOFF_QUALIDADE.md](./FASE2_KICKOFF_QUALIDADE.md) (P2).
