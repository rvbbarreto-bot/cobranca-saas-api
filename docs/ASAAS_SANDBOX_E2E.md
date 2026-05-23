# Asaas Sandbox — E2E e evidências (Sprint 1)

Este guia permite reproduzir o fluxo end-to-end exigido pelo PO: cobrança interna → emissão real no **Asaas Sandbox** → persistência → webhook → `charge_events` → idempotência.

## Pré-requisitos

| Item | Obrigatório |
|------|-------------|
| Conta [Asaas Sandbox](https://sandbox.asaas.com/) | Sim |
| API Key sandbox (`$aact_...`) | Sim — **somente em `.env`**, nunca no Git |
| PostgreSQL migrado | `npm run migrate` |
| Seed portal | `npm run seed:dev` |
| `ENCRYPTION_KEY` | 64 hex chars (`openssl rand -hex 32`) |
| `WEBHOOK_INBOX_SECRET` | Para simular webhooks na API |

### Variáveis (`.env`)

```env
DATABASE_URL=postgres://...
ASAAS_API_KEY=$aact_YOUR_SANDBOX_KEY
ASAAS_API_URL=https://sandbox.asaas.com/api/v3
ENCRYPTION_KEY=<64 hex>
WEBHOOK_INBOX_SECRET=<hex>
```

## Execução automatizada (evidência JSON)

```bash
npm run migrate
npm run seed:dev
npm run e2e:asaas:evidence
```

Gera `docs/evidencias/asaas-e2e-<timestamp>.json` com:

- branch/commit
- passos (cliente, cobrança, emissão, consulta Asaas, webhook, dedup)
- assertions nomeadas (14 entradas — checklist Sprint 1; ver [SPRINT1_ACEITE_CHECKLIST.md](./evidencias/SPRINT1_ACEITE_CHECKLIST.md))
- payloads **sem** segredos
- template redigido: [asaas-e2e-EXAMPLE.redacted.json](./evidencias/asaas-e2e-EXAMPLE.redacted.json)

### Vitest (CI opcional)

```bash
set RUN_ASAAS_E2E=1
npm run test:integration:asaas
```

Requer `DATABASE_URL`, `ASAAS_API_KEY`, `ENCRYPTION_KEY` no ambiente.

### GitHub Actions (homolog manual — Sprint J)

Disparo manual (não roda em `push`/`pull_request`): workflow **Asaas E2E (manual)**.

1. Configurar secret `ASAAS_API_KEY` (sandbox) no repositório.
2. **Actions** → **Asaas E2E (manual)** → **Run workflow**.
3. Baixar o artefacto JSON gerado (ver [evidencias/README.md](./evidencias/README.md#ci-manual-github-actions--sprint-j)).

## Fluxo manual (Postman / curl)

Collection: [`postman/Asaas_Sandbox_E2E.postman_collection.json`](../postman/Asaas_Sandbox_E2E.postman_collection.json)

1. **Login portal** — `POST /v1/portal/auth/login` (seed: `portal-seed@local.dev`, tenant `escritorio-demo`)
2. **Criar cliente** — `POST /v1/portal/clientes`
3. **Criar cobrança** — `POST /v1/portal/cobrancas` → `201` `rascunho`
4. **Worker** — subir API com Redis + worker de emissão, ou rodar `npm run e2e:asaas:evidence` (emissão síncrona no script)
5. **Detalhe** — `GET /v1/portal/cobrancas/:id` → `payment` com boleto/PIX
6. **Webhook Asaas** — `POST /v1/inbox/webhooks` com corpo nativo:

```json
{
  "event": "PAYMENT_RECEIVED",
  "payment": {
    "id": "pay_xxx",
    "status": "RECEIVED",
    "externalReference": "<idempotency_key>"
  }
}
```

Headers: `x-tenant-id: 00000000-0000-4000-8000-000000000001`, `x-webhook-secret`, `x-external-event-id`, `x-correlation-id`.

7. **Processar inbox** — `POST /v1/inbox/webhooks/process-pending`
8. **Reenviar mesmo webhook** — deve retornar `deduplicated: true` e não duplicar `charge_events`.

## Consultas SQL de auditoria

```sql
-- Cobrança + vínculo Asaas
SELECT id, reference, canonical_status, provider, provider_charge_id
FROM charges WHERE reference = 'sua-ref';

-- Transação + payload bruto
SELECT gateway_transaction_id, status, boleto_url, gateway_raw_response
FROM payment_transactions WHERE charge_id = '<uuid>';

-- Eventos
SELECT event_type, old_status, new_status, payload_json, created_at
FROM charge_events WHERE charge_id = '<uuid>' ORDER BY created_at;

-- Webhook inbox
SELECT external_event_id, source, payload, processed_at
FROM webhook_inbox ORDER BY created_at DESC LIMIT 5;
```

## Homolog PO / Tech Lead (Sprint H)

1. Executar `npm run e2e:asaas:evidence` com API key **sandbox** real (não mock de adapter).
2. Conferir terminal: todas as assertions `ok` (nomes estáveis no JSON).
3. Preencher checklist: [`docs/evidencias/SPRINT1_ACEITE_CHECKLIST.md`](./evidencias/SPRINT1_ACEITE_CHECKLIST.md) usando coluna **Assertion runner**.
4. Anexar print + JSON ao ticket/PR — **não** commitar o JSON gerado (ver [evidencias/README.md](./evidencias/README.md)).
5. Tech Lead mergeia após `quality:gate` verde no PR da fábrica.

**Evento n8n `charge.emitted`:** validado em testes unitários (`payment-emission-n8n.test.ts`); opcional no E2E sandbox (n8n URL pode estar vazio).

## Checklist de aceite PO

Preencher: [`docs/evidencias/SPRINT1_ACEITE_CHECKLIST.md`](./evidencias/SPRINT1_ACEITE_CHECKLIST.md)

## Status Sprint 1

| Critério | Implementação |
|----------|----------------|
| Emissão real Asaas Sandbox | `AsaasAdapter` + `payment-emission-processor` |
| `provider_charge_id` | Atualizado na emissão |
| `gateway_raw_response` | Migração `017_*` + coluna JSONB |
| Webhook nativo Asaas | `parse-asaas-webhook-charge-payload.ts` |
| Inbox dedup | `ON CONFLICT (tenant_id, external_event_id)` |
| `charge_events` | `charge.created`, `emissao_gateway`, `webhook_asaas` |
| E2E reproduzível | `npm run e2e:asaas:evidence` |

**A Sprint 1 só deve ser marcada “concluída” após executar o E2E com API key sandbox real e anexar o JSON de evidências ao relatório PO.**
