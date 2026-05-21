# Sprint 4.7 — Asaas Subscriptions (cobrança recorrente do plano SaaS)

**Branch:** `feat/asaas-subscriptions`  
**Pré-requisito:** Sprint 4 mergeada (planos, assinaturas, metering).

## Entregue

- Migration `024_asaas_platform_subscription_billing.sql` (`billing_email`, `gateway_customer_id`)
- `POST /v1/portal/escritorio/assinatura/activate` — cria customer + subscription no Asaas
- Webhooks Asaas de assinatura (`SUBSCRIPTION_*`, `payment.subscription`) → atualiza `assinaturas`
- Outbound n8n `subscription.past_due` em `PAYMENT_OVERDUE`
- Env: `ASAAS_PLATFORM_API_KEY`, `ASAAS_PLATFORM_BILLING_TYPE`, `PLATFORM_BILLING_EMAIL_DOMAIN`

## Fluxo

1. `POST /v1/tenants/provision` com `billing_email` opcional → trial local
2. Fim do trial (ou quando PO decidir) → `POST /v1/portal/escritorio/assinatura/activate`
3. Asaas cobra mensalmente; webhooks no inbox do tenant público atualizam status

## Smoke

```bash
# .env com ASAAS_PLATFORM_API_KEY (sandbox)
POST /v1/portal/escritorio/assinatura/activate
Authorization: Bearer <portal admin>
x-tenant-id: <automacao tenant id>

GET /v1/portal/escritorio/assinatura
# gateway_subscription_id preenchido após activate
```
