# Webhooks outbound — integração n8n (Sprint 4.6 + E)

A API pode notificar um workflow n8n quando eventos de negócio ocorrem. O envio é **opcional** e **assíncrono** (não bloqueia cobrança nem inbox).

Workflow exemplo: [N8N_REGUA_WORKFLOW_EXEMPLO.md](./N8N_REGUA_WORKFLOW_EXEMPLO.md).

## Configuração

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `N8N_PLATFORM_WEBHOOK_URL` | Não | URL do webhook trigger no n8n (POST JSON). Vazio = desligado. |
| `N8N_PLATFORM_WEBHOOK_SECRET` | Não | Se definido, enviado no header `X-Webhook-Secret`. |

Exemplo `.env`:

```env
N8N_PLATFORM_WEBHOOK_URL=https://seu-n8n.example/webhook/cobranca-saas-events
N8N_PLATFORM_WEBHOOK_SECRET=openssl_rand_hex_32
```

## Envelope comum

```json
{
  "event": "charge.paid",
  "occurred_at": "2026-05-19T12:00:00.000Z",
  "tenant_id": "00000000-0000-4000-8000-000000000001",
  "payload": {}
}
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `event` | string | Tipo do evento (ver tabela abaixo). |
| `occurred_at` | ISO 8601 | Momento do disparo na API. |
| `tenant_id` | UUID string | Tenant público (`public.tenants.id`). |
| `payload` | object | Dados específicos do evento. |

## Eventos

| `event` | Origem | Payload |
|---------|--------|---------|
| `charge.paid` | `applyWebhookSideEffectPlan` (`payment_confirmed`) | `{ charge_id }` |
| `charge.overdue` | `payment_overdue` (após enfileirar régua 3d/7d) | `{ charge_id }` |
| `charge.cancelled` | `payment_cancelled` | `{ charge_id }` |
| `notification.regua_enqueued` | `enqueueReguaNotificationJob` (webhook overdue + `daily-regua`) | `{ charge_id, event_type, days_offset, channel? }` |
| `subscription.past_due` | `applyAsaasPlatformSubscriptionWebhook` | `{ subscription_id, plano_slug, gateway_subscription_id }` |

### `charge.paid`

Disparado após webhook Asaas confirmar pagamento e a API enfileirar notificação de confirmação.

```json
{ "charge_id": "uuid-da-cobranca" }
```

### `charge.overdue`

Disparado quando cobrança fica vencida (`payment_overdue`) e jobs de régua pós-vencimento são enfileirados.

```json
{ "charge_id": "uuid-da-cobranca" }
```

### `charge.cancelled`

Disparado quando cobrança é cancelada e jobs de régua pendentes são removidos.

```json
{ "charge_id": "uuid-da-cobranca" }
```

### `notification.regua_enqueued`

Disparado a cada job BullMQ de régua enfileirado (não substitui envio Resend/Z-API).

```json
{
  "charge_id": "uuid",
  "event_type": "pos_vencimento_3d",
  "days_offset": 3,
  "channel": "email"
}
```

`channel` só aparece se `forceChannel` foi passado no enqueue.

### `subscription.past_due`

Disparado quando webhook Asaas da assinatura SaaS mapeia `past_due`.

```json
{
  "subscription_id": "uuid-assinatura",
  "plano_slug": "profissional",
  "gateway_subscription_id": "sub_xxx"
}
```

## n8n — exemplo de trigger

1. Nó **Webhook** (POST), path único.
2. Validar `X-Webhook-Secret` com IF node (opcional).
3. Switch em `$json.event`:
   - `charge.paid` → CRM / pós-pagamento
   - `charge.overdue` → cobrança / recuperação
   - `charge.cancelled` → encerrar sequências
   - `notification.regua_enqueued` → log ou métrica
   - `subscription.past_due` → retenção SaaS

## Idempotência

O n8n deve tratar `charge_id` + `event` como chave de deduplicação. A API pode reenviar em retries de jobs; o workflow deve ser idempotente.

## Relação com inbox

| Direção | Rota | Uso |
|---------|------|-----|
| **Entrada** | `POST /v1/inbox/webhooks` | n8n / Asaas → API. Idempotência: [INBOX_WEBHOOK_IDEMPOTENCIA.md](./INBOX_WEBHOOK_IDEMPOTENCIA.md). |
| **Saída** | `N8N_PLATFORM_WEBHOOK_URL` | API → n8n (este documento). |

Não confundir com `WEBHOOK_INBOX_SECRET` (entrada). Use secret dedicado para outbound.
