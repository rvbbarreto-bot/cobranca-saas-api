# Webhooks outbound — integração n8n (Sprint 4.6)

A API pode notificar um workflow n8n quando eventos de negócio ocorrem. O envio é **opcional** e **assíncrono** (não bloqueia cobrança nem inbox).

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

### `charge.paid`

Disparado após webhook Asaas confirmar pagamento e a API enfileirar notificação de confirmação.

**Origem:** `applyWebhookSideEffectPlan` (`payment_confirmed`).

**Payload:**

```json
{
  "charge_id": "uuid-da-cobranca"
}
```

### `subscription.past_due`

Disparado quando webhook Asaas de cobrança da **assinatura SaaS** mapeia status `past_due` (ex.: `PAYMENT_OVERDUE` com `payment.subscription`).

**Origem:** `applyAsaasPlatformSubscriptionWebhook`.

**Payload:**

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
   - `charge.paid` → fluxo pós-pagamento (CRM, e-mail interno, etc.).
   - `subscription.past_due` → fluxo de retenção.

## Idempotência

O n8n deve tratar `charge_id` + `event` como chave de deduplicação. A API pode reenviar em retries de jobs; o workflow deve ser idempotente.

## Relação com inbox

| Direção | Rota | Uso |
|---------|------|-----|
| **Entrada** | `POST /v1/inbox/webhooks` | n8n / Asaas → API (já existente). |
| **Saída** | `N8N_PLATFORM_WEBHOOK_URL` | API → n8n (este documento). |

Não confundir com `WEBHOOK_INBOX_SECRET` (entrada). Use secret dedicado para outbound.
