# 📦 PACOTE DE DEMANDAS — Sprint 1 Encerramento + Sprint 2 Completa
## SaaS de Cobranças · Emitido por: PO + Tech Manager + Engenheiro de Prompt IA
### Data: Maio 2026 · Referência: pós-merge PR #1

> **Status: CONCLUÍDO** (merge `b2dfd1e` em `main`). Não usar para novas tarefas.
> Retomada operacional: [RETOMADA_FABRICA.md](./RETOMADA_FABRICA.md) · Sprint atual: [DEMANDA_SPRINT4.md](./DEMANDA_SPRINT4.md).

---

> **Como usar este documento no Cursor**
> Cole o bloco de cada TAREFA no chat (`Ctrl+L`) uma por vez.
> Aguarde a entrega, valide os critérios de aceite e só então avance para a próxima.
> A ordem importa — tarefas de banco vêm antes dos workers.

---

## CONTEXTO PARA O AGENTE

```
Você está dando continuidade ao projeto cobranca-saas-api.

Estado atual confirmado (pós-merge PR #1):
✅ Fase 0 completa (saneamento, segurança, migrations 013/014, rate-limit, audit_log)
✅ Sprint 1 entregue e mergeada:
   - payment-gateway.interface.ts + AsaasAdapter (createCustomer/createBoleto/createPix/cancelCharge/getCharge)
   - asaas-status-map.ts com ASAAS_TO_CANONICAL
   - payment-gateway-error.ts + UnrecoverableError pattern
   - redis-connection.ts + queues.ts (paymentEmission, webhookProcess, chargeSync, notificationSend)
   - payment-emission.worker.ts + payment-emission-processor.ts (fluxo 7 passos)
   - src/platform/crypto/decrypt.ts (AES-256-GCM)
   - Migration 015 (payment_transactions + portal.cliente)
   - GET /v1/portal/cobrancas/:id com payment{} e events[]
   - POST /v1/portal/cobrancas enfileirando job imediatamente (201, status='rascunho')
   - InboxProcessor processando webhooks Asaas com ASAAS_TO_CANONICAL
   - Seed idempotente + Redis como serviço no GitHub Actions CI
   - 19/19 testes passando no CI

Ainda FALTAM para fechar Sprint 1 + completar Sprint 2:
- TAREFA 1.6: charge-status-sync (worker de reconciliação cron 15min)
- Migration 016 (communication_events + notification_templates + charging_rules)
- Webhook processing COMPLETO (todos os 6 eventos Asaas + enfileiramento de régua)
- Módulo notifications (ResendAdapter + ZapiAdapter + renderTemplate)
- Worker notification-send
- Scheduler charging-rule (cron 07h diário)
- CRUD escritorio_config com criptografia JSONB multi-gateway + mascaramento
- CRUD charging_rules
- CRUD notification_templates com preview

Stack: Node.js 20 + TypeScript 5.7 + Express + pg (raw SQL) + BullMQ + Redis
Regras absolutas:
  - multi-tenant obrigatório (tenant_id em todas as tabelas + RLS)
  - writeAuditLog em toda mutação crítica (dentro da mesma pg transaction)
  - idempotência nos webhooks (webhook_inbox.processed_at NOT NULL = já processado)
  - inbox pattern (salvar antes de processar)
  - estados terminais 'paga' e 'cancelada' são irreversíveis
  - AES-256-GCM para criptografar API keys (ENCRYPTION_KEY env var)
  - src/platform/crypto/encrypt.ts e decrypt.ts para crypto
```

---

---

# ══════════════════════════════════════
# TAREFA 1.6 — Job charge-status-sync (reconciliação)
# ══════════════════════════════════════

```
Crie src/platform/jobs/workers/charge-status-sync.worker.ts

Propósito: cobranças que não receberam webhook do Asaas em 24h devem ser
reconciliadas consultando o gateway diretamente (failsafe).

Lógica completa:

PASSO 1 — Registrar como job recorrente ao iniciar workers:
  queues.chargeSync.add(
    'sync-job',
    {},
    { repeat: { pattern: '*/15 * * * *' }, jobId: 'charge-sync-recurring' }
  )

PASSO 2 — Buscar cobranças candidatas:
  SELECT
    c.id AS charge_id,
    c.tenant_id,
    c.canonical_status,
    pt.gateway_transaction_id,
    ec.gateway_provider,
    ec.gateway_credentials_encrypted,
    ec.gateway_credentials_iv
  FROM charges c
  JOIN payment_transactions pt ON pt.charge_id = c.id
  JOIN escritorio_config ec ON ec.tenant_id = c.tenant_id
  WHERE c.canonical_status IN ('emitida', 'enviada', 'pendente_pagamento')
    AND c.updated_at < now() - interval '24 hours'
  ORDER BY c.updated_at ASC
  LIMIT 50

PASSO 3 — Para cada cobrança (try/catch individual — falha não para o lote):
  a. Obter adapter via factory (já resolve provider + credenciais internamente):
       const adapter = await getGatewayForTenant(row.tenant_id)
       import { getGatewayForTenant } from '@/platform/payment-gateway/payment-gateway.factory'
  b. const gatewayCharge = await adapter.getCharge(row.gateway_transaction_id)
  c. const newCanonical = mapGatewayStatus(gatewayCharge.status, row.gateway_provider)
  d. Se newCanonical === row.canonical_status → pular (sem mudança)
  e. Verificar máquina de estados: só avançar, nunca retroceder
     Ordem de progressão: rascunho < emitida < enviada < pendente_pagamento < paga
     Nunca transicionar de 'paga' ou 'cancelada' (estados terminais)
  f. Se transição válida:
       BEGIN pg transaction
         UPDATE charges SET canonical_status = newCanonical, updated_at = now()
           WHERE id = row.charge_id AND tenant_id = row.tenant_id
         INSERT INTO charge_events (charge_id, tenant_id, event_type, old_status, new_status,
           payload_json) VALUES ($1, $2, 'sync_reconciliation', $3, $4, '{"source":"charge-status-sync"}')
         writeAuditLog({ action: 'status_change', resource_type: 'charge', ... })
       COMMIT

PASSO 4 — Ao final logar:
  logger.info(`charge-status-sync: processadas=${total} atualizadas=${updated} erros=${errors}`)

Adicionar em src/platform/jobs/start-workers.ts:
  import { registerChargeSyncWorker } from './workers/charge-status-sync.worker'
  registerChargeSyncWorker()

Critérios de aceite:
  ✅ Cobrança 'emitida' há 25h com status 'CONFIRMED' no Asaas → sincroniza para 'paga'
  ✅ Cobrança já 'paga' → NÃO aparece no SELECT (filtro de status)
  ✅ Falha de API em 1 cobrança → demais continuam (try/catch por item)
  ✅ Transição inválida (retroceder status) → ignorada com log de aviso
  ✅ npm run build sem erros
  ✅ Mínimo 3 testes unitários (stub em pg + AsaasAdapter)
```

---

---

# ══════════════════════════════════════
# BLOCO 2 — SPRINT 2: WEBHOOK COMPLETO + NOTIFICAÇÕES
# ══════════════════════════════════════

---

## TAREFA 2.1 — Migration 016: tabelas de notificação e régua

```
Crie db/migrations/016_notifications_regua.sql

-- 1. communication_events: histórico de cada mensagem enviada
CREATE TABLE IF NOT EXISTS communication_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           TEXT NOT NULL,
  charge_id           UUID REFERENCES charges(id),
  channel             TEXT NOT NULL CHECK (channel IN ('email','whatsapp','sms')),
  event_type          TEXT NOT NULL,
  recipient           TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','processing','sent','failed','delivered','cancelled')),
  provider_message_id TEXT,
  error_message       TEXT,
  attempts            INT NOT NULL DEFAULT 0,
  sent_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comm_tenant ON communication_events(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_comm_charge ON communication_events(charge_id);

-- 2. notification_templates: templates editáveis por tenant
CREATE TABLE IF NOT EXISTS notification_templates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      TEXT,   -- NULL = template do sistema (padrão)
  event_type     TEXT NOT NULL,
  channel        TEXT NOT NULL CHECK (channel IN ('email','whatsapp')),
  subject        TEXT,
  body_template  TEXT NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_template UNIQUE (tenant_id, event_type, channel)
);

-- 3. charging_rules: régua de cobrança configurável por tenant
CREATE TABLE IF NOT EXISTS charging_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL,
  days_offset INT NOT NULL,       -- negativo = antes; positivo = após vencimento
  channel     TEXT NOT NULL CHECK (channel IN ('email','whatsapp','both')),
  template_id UUID REFERENCES notification_templates(id),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_rule UNIQUE (tenant_id, days_offset, channel)
);
CREATE INDEX IF NOT EXISTS idx_rules_tenant ON charging_rules(tenant_id, is_active);

-- 4. Seed: templates padrão do sistema (tenant_id IS NULL)
INSERT INTO notification_templates (tenant_id, event_type, channel, subject, body_template)
VALUES
  (NULL, 'lembrete_pre_3d',      'whatsapp', NULL,
   'Olá {{nome}}, seu boleto de {{valor}} vence em 3 dias ({{data_vencimento}}). Pague com PIX: {{link_pix}}'),
  (NULL, 'lembrete_pre_1d',      'whatsapp', NULL,
   'Último lembrete: seu boleto de {{valor}} vence amanhã ({{data_vencimento}}). PIX: {{link_pix}}'),
  (NULL, 'vencimento_hoje',      'email',    '[Aviso] Boleto vencendo hoje — {{escritorio_nome}}',
   'Olá {{nome}}, seu boleto de {{valor}} vence hoje. Multa de {{multa_percentual}}% aplicada após hoje.'),
  (NULL, 'pos_vencimento_3d',    'whatsapp', NULL,
   'Boleto vencido há 3 dias. Regularize agora: {{link_boleto}}'),
  (NULL, 'pos_vencimento_7d',    'email',    '[Último Aviso] Pendência — {{escritorio_nome}}',
   'Olá {{nome}}, você possui um boleto vencido há 7 dias no valor de {{valor}}. Regularize em 48h para evitar negativação.'),
  (NULL, 'pagamento_confirmado', 'email',    'Pagamento confirmado — {{escritorio_nome}}',
   'Olá {{nome}}, seu pagamento de {{valor}} foi confirmado em {{data_pagamento}}. Obrigado!')
ON CONFLICT (tenant_id, event_type, channel) DO NOTHING;

Critérios:
  ✅ npm run migrate sem erros em banco limpo
  ✅ Migration é idempotente (rodar 2x não gera erro)
  ✅ SELECT * FROM communication_events LIMIT 0 funciona
  ✅ SELECT * FROM notification_templates LIMIT 0 funciona
  ✅ SELECT * FROM charging_rules LIMIT 0 funciona
  ✅ 6 templates padrão inseridos com tenant_id IS NULL
```

---

## TAREFA 2.2 — Webhook processing completo (todos os eventos Asaas)

```
Atualize o InboxProcessor (src/modules/inbox/) para processar
TODOS os 6 eventos Asaas mapeados em ASAAS_TO_CANONICAL.

Regra geral para todos os eventos:
  - Verificar webhook_inbox.processed_at IS NOT NULL → 200 silencioso (já processado)
  - Toda mutação em pg transaction
  - writeAuditLog em toda mudança de status
  - Atualizar webhook_inbox.processed_at = now() ao final da transaction

────────────────────────────────────────────
EVENTO: PAYMENT_CONFIRMED / PAYMENT_RECEIVED → canonical_status = 'paga'
────────────────────────────────────────────
  1. UPDATE charges SET canonical_status='paga', paid_at=now(), updated_at=now()
     WHERE id = charge_id AND tenant_id = tenantId
     AND canonical_status NOT IN ('paga','cancelada')  ← não sobrescrever terminal
  2. INSERT charge_events (event_type='webhook_payment_confirmed',
       old_status={anterior}, new_status='paga',
       payload_json={ asaas_event, valor_pago, data_pagamento })
  3. writeAuditLog
  4. queues.notificationSend.add('payment-confirmed',
       { chargeId, tenantId, eventType: 'pagamento_confirmado' }, JOB_OPTS.notification)
  5. Cancelar jobs de régua pendentes desta cobrança:
     Para daysOffset em [-3, -1, 0, 3, 7]:
       const job = await queues.notificationSend.getJob(`regua-${chargeId}-${daysOffset}`)
       if (job) await job.remove()

────────────────────────────────────────────
EVENTO: PAYMENT_OVERDUE → canonical_status = 'vencida'
────────────────────────────────────────────
  1. UPDATE charges SET canonical_status='vencida', updated_at=now()
  2. INSERT charge_events (event_type='webhook_payment_overdue')
  3. writeAuditLog
  4. Enfileirar régua pós-vencimento com jobIds para dedup:
     await queues.notificationSend.add(
       'regua',
       { chargeId, tenantId, eventType: 'pos_vencimento_3d', daysOffset: 3 },
       { ...JOB_OPTS.notification, jobId: `regua-${chargeId}-3` }
     )
     await queues.notificationSend.add(
       'regua',
       { chargeId, tenantId, eventType: 'pos_vencimento_7d', daysOffset: 7 },
       { ...JOB_OPTS.notification, jobId: `regua-${chargeId}-7` }
     )

────────────────────────────────────────────
EVENTO: PAYMENT_DELETED / PAYMENT_REFUNDED → canonical_status = 'cancelada'
────────────────────────────────────────────
  1. UPDATE charges SET canonical_status='cancelada', cancelled_at=now(), updated_at=now()
     WHERE canonical_status NOT IN ('paga','cancelada')
  2. INSERT charge_events (event_type='webhook_payment_cancelled')
  3. writeAuditLog
  4. Cancelar TODOS os jobs de régua pendentes (mesmo loop do PAYMENT_CONFIRMED)

────────────────────────────────────────────
EVENTO: PAYMENT_RESTORED → canonical_status = 'emitida'
────────────────────────────────────────────
  1. UPDATE charges SET canonical_status='emitida', cancelled_at=NULL, updated_at=now()
     WHERE canonical_status = 'cancelada'  ← só se estava cancelada
  2. INSERT charge_events (event_type='webhook_payment_restored')
  3. writeAuditLog

Testes obrigatórios (1 por evento = 6 mínimos):
  ✅ PAYMENT_CONFIRMED → status='paga', notificação enfileirada, régua cancelada
  ✅ PAYMENT_RECEIVED  → mesma lógica de PAYMENT_CONFIRMED
  ✅ PAYMENT_OVERDUE   → status='vencida', D+3 e D+7 enfileirados com jobId
  ✅ PAYMENT_DELETED   → status='cancelada', jobs de régua removidos
  ✅ PAYMENT_RESTORED  → status='emitida' (apenas se era 'cancelada')
  ✅ Webhook duplicado → 200 silencioso, sem mutação (processed_at NOT NULL)
  ✅ PAYMENT_CONFIRMED em cobrança já 'paga' → sem UPDATE (idempotente)
```

---

## TAREFA 2.3 — Módulo notifications: adapters Resend + Z-API

```
Crie src/modules/notifications/ com a estrutura abaixo:

── src/modules/notifications/
   ├── domain/
   │   ├── notification.interface.ts
   │   └── notification-error.ts
   ├── infrastructure/
   │   ├── resend/
   │   │   └── resend-adapter.ts
   │   └── zapi/
   │       └── zapi-adapter.ts
   └── application/
       └── render-template.ts

─────────────────────────────────────────
1. domain/notification.interface.ts
─────────────────────────────────────────
export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
}
export interface SendWhatsAppInput {
  phone: string;     // apenas dígitos, sem +55
  message: string;   // máx 1024 chars
}
export interface NotificationResult {
  messageId: string;
}
export interface NotificationAdapter {
  sendEmail(input: SendEmailInput): Promise<NotificationResult>;
  sendWhatsApp(input: SendWhatsAppInput): Promise<NotificationResult>;
}

─────────────────────────────────────────
2. domain/notification-error.ts
─────────────────────────────────────────
export class NotificationError extends Error {
  constructor(
    message: string,
    public readonly channel: 'email' | 'whatsapp',
    public readonly provider: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'NotificationError';
  }
}

─────────────────────────────────────────
3. infrastructure/resend/resend-adapter.ts
─────────────────────────────────────────
Endpoint: POST https://api.resend.com/emails
Header: Authorization: Bearer ${process.env.RESEND_API_KEY}
Body:
  {
    from: process.env.RESEND_FROM_EMAIL ?? 'cobrancas@suaempresa.com.br',
    to: [input.to],
    subject: input.subject,
    html: input.html
  }
Em caso de erro HTTP: lançar NotificationError(message, 'email', 'resend', status)
Timeout: 10 segundos (usando AbortController + fetch)

─────────────────────────────────────────
4. infrastructure/zapi/zapi-adapter.ts
─────────────────────────────────────────
Endpoint: POST https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text
Header: Client-Token: ${ZAPI_CLIENT_TOKEN}   ← obrigatório para Z-API v2
Body:
  {
    phone: '55' + input.phone,   // sempre prefixar 55
    message: input.message,
    delayMessage: 2
  }
Em caso de erro: lançar NotificationError(message, 'whatsapp', 'zapi', status)
Timeout: 15 segundos

─────────────────────────────────────────
5. application/render-template.ts
─────────────────────────────────────────
export function renderTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

Variáveis disponíveis (passadas pelo worker):
  nome, valor, data_vencimento, link_boleto,
  link_pix, pix_emv, escritorio_nome, multa_percentual, data_pagamento

─────────────────────────────────────────
Instalação:
  npm install --save-dev @types/node   (já deve existir)
  # Resend SDK é opcional — usar fetch nativo do Node 20
  # Z-API é REST puro — sem SDK

Testes obrigatórios (4 mínimos):
  ✅ ResendAdapter.sendEmail → POST correto + retorna messageId
  ✅ ZapiAdapter.sendWhatsApp → prefixo 55 aplicado + retorna messageId
  ✅ ResendAdapter com erro HTTP 422 → lança NotificationError
  ✅ renderTemplate → substitui {{nome}} e {{valor}} corretamente
  ✅ renderTemplate com variável ausente → substitui por string vazia (sem erro)
```

---

## TAREFA 2.4 — Worker: notification-send

```
Crie src/platform/jobs/workers/notification-send.worker.ts

Payload do job:
  {
    chargeId: string;
    tenantId: string;
    eventType: string;       // ex: 'lembrete_pre_3d', 'pagamento_confirmado'
    daysOffset?: number;
    forceChannel?: 'email' | 'whatsapp' | 'both';
  }

Fluxo completo:

PASSO 1 — Verificar cobrança
  SELECT c.*, cli.*, ec.*
  FROM charges c
  JOIN portal.cliente cli ON cli.id = c.customer_id AND cli.tenant_id = c.tenant_id
  JOIN escritorio_config ec ON ec.tenant_id = c.tenant_id
  WHERE c.id = chargeId AND c.tenant_id = tenantId
  → Se não encontrado: UnrecoverableError('charge_not_found')

PASSO 2 — Guard: estados terminais
  Se canonical_status IN ('paga', 'cancelada'):
    logger.info(`Notificação ignorada: cobrança ${chargeId} já em estado terminal`)
    return  ← retorno early, sem erro (job completa normalmente)

PASSO 3 — Determinar canal
  const channel = forceChannel ?? (charging_rules do tenant para este eventType)
  Se não houver charging_rules específica, usar 'both' como fallback

PASSO 4 — Buscar template
  SELECT * FROM notification_templates
  WHERE event_type = eventType
    AND channel IN (channel determinado)
    AND (tenant_id = tenantId OR tenant_id IS NULL)
  ORDER BY tenant_id NULLS LAST  ← tenant-specific tem prioridade sobre padrão
  LIMIT 1

PASSO 5 — Montar variáveis do template
  Buscar payment_transactions (último) para link_boleto, link_pix, pix_emv
  const vars = {
    nome: cliente.nome,
    valor: formatCurrency(charge.amount),          // 'R$ 1.234,56'
    data_vencimento: formatDate(charge.due_date),  // 'DD/MM/YYYY'
    link_boleto: payment?.boleto_url ?? '',
    link_pix: payment?.pix_link ?? '',
    pix_emv: payment?.pix_emv ?? '',
    escritorio_nome: ec.razao_social ?? 'Escritório',
    multa_percentual: String(ec.multa_percentual ?? 2),
    data_pagamento: formatDate(charge.paid_at),
  }

PASSO 6 — Verificar opt-in e enviar
  const body = renderTemplate(template.body_template, vars)

  Se canal inclui 'email' AND cliente.opt_in_email:
    await resendAdapter.sendEmail({ to: cliente.email, subject: template.subject, html: body })
    INSERT communication_events (channel='email', status='sent', ...)

  Se canal inclui 'whatsapp' AND cliente.opt_in_whatsapp AND cliente.telefone:
    await zapiAdapter.sendWhatsApp({ phone: limparTelefone(cliente.telefone), message: body })
    INSERT communication_events (channel='whatsapp', status='sent', ...)

PASSO 7 — Em caso de NotificationError por adapter:
  INSERT communication_events (status='failed', error_message=e.message, attempts=1)
  Re-throw para BullMQ retry (JOB_OPTS.notification = 3 tentativas)

Adicionar em start-workers.ts:
  import { registerNotificationSendWorker } from './workers/notification-send.worker'
  registerNotificationSendWorker()

Testes obrigatórios (5 mínimos):
  ✅ lembrete email enviado → communication_events status='sent'
  ✅ WhatsApp enviado → prefixo 55 + communication_events status='sent'
  ✅ Cliente opt_in_whatsapp=false → WhatsApp não enviado, sem erro
  ✅ Cobrança canonical_status='paga' → retorno early, zero envios
  ✅ ResendAdapter lança NotificationError → communication_events status='failed', re-throw para retry
```

---

## TAREFA 2.5 — Régua de cobrança: scheduler automático

```
Crie src/platform/jobs/schedulers/charging-rule.scheduler.ts

Propósito: a cada dia às 07h00 (BRT = UTC-3 → cron '0 10 * * *' em UTC),
verificar cobranças que se encaixam na régua configurada por tenant
e enfileirar notificações evitando duplicatas.

Função principal: runChargingRuleScheduler(): Promise<void>

PASSO 1 — Buscar tenants com charging_rules ativas
  SELECT DISTINCT tenant_id
  FROM charging_rules
  WHERE is_active = true

PASSO 2 — Para cada tenant, buscar regras ativas
  SELECT * FROM charging_rules WHERE tenant_id = tenantId AND is_active = true

PASSO 3 — Para cada regra (days_offset, channel):
  a. Calcular data alvo:
       const targetDate = new Date()
       targetDate.setDate(targetDate.getDate() + days_offset)
       // days_offset=-3 → 3 dias no futuro a partir de hoje (vence em 3 dias)
       // days_offset=+3 → 3 dias no passado (venceu há 3 dias)

  b. Determinar status elegível:
       days_offset <= 0 → canonical_status IN ('emitida','enviada','pendente_pagamento')
       days_offset > 0  → canonical_status = 'vencida'

  c. Buscar cobranças candidatas (sem notification já enviada):
       SELECT c.id
       FROM charges c
       WHERE c.tenant_id = tenantId
         AND c.due_date::date = targetDate::date
         AND c.canonical_status = ANY($statusList)
         AND NOT EXISTS (
           SELECT 1 FROM communication_events ce
           WHERE ce.charge_id = c.id
             AND ce.event_type = $eventType
             AND ce.status IN ('sent','processing')
         )

  d. Para cada cobrança encontrada:
       const eventType = mapDaysOffsetToEventType(days_offset)
       await queues.notificationSend.add(
         'regua',
         { chargeId: charge.id, tenantId, eventType, daysOffset: days_offset },
         { ...JOB_OPTS.notification, jobId: `regua-${charge.id}-${days_offset}` }
       )
       // jobId garante que a mesma cobrança+offset = apenas 1 job na fila

PASSO 4 — Log final
  logger.info(`Régua: tenant=${tenantId} offset=${days_offset} enfileiradas=${count}`)

Função helper (exportar para reuso):
  export function mapDaysOffsetToEventType(offset: number): string {
    const map: Record<number, string> = {
      [-3]: 'lembrete_pre_3d',
      [-1]: 'lembrete_pre_1d',
      [0]:  'vencimento_hoje',
      [3]:  'pos_vencimento_3d',
      [7]:  'pos_vencimento_7d',
    };
    return map[offset] ?? `regua_d${offset > 0 ? '+' : ''}${offset}`;
  }

Registrar no start-workers.ts como job recorrente:
  queues.chargeSync.add(
    'daily-regua',
    {},
    { repeat: { pattern: '0 10 * * *' }, jobId: 'daily-regua-recurring' }
  )
  // O worker chargeSync.process deve chamar runChargingRuleScheduler() quando
  // o jobName === 'daily-regua'

Testes obrigatórios (4 mínimos):
  ✅ Cobrança com due_date = hoje+3 → lembrete_pre_3d enfileirado
  ✅ Cobrança canonical_status='paga' → NÃO aparece no SELECT
  ✅ communication_events já existe para esse charge+eventType → NÃO reenfileira
  ✅ Tenant sem charging_rules ativas → zero jobs criados
```

---

## TAREFA 2.6 — CRUD escritorio_config (configuração do escritório) + Migration 022

```
────────────────────────────────────────────────────────
SUBTAREFA A — Migration 022 (expansão multi-gateway)
────────────────────────────────────────────────────────
Crie db/migrations/022_escritorio_config_multi_gateway.sql:

-- Renomear colunas legadas (caso existam de entrega anterior)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='escritorio_config' AND column_name='gateway_api_key_encrypted'
  ) THEN
    ALTER TABLE escritorio_config
      RENAME COLUMN gateway_api_key_encrypted TO gateway_credentials_encrypted;
    ALTER TABLE escritorio_config
      RENAME COLUMN gateway_api_key_iv TO gateway_credentials_iv;
  END IF;
END $$;

-- Adicionar colunas se não existirem (criação limpa em ambiente virgem)
ALTER TABLE escritorio_config
  ADD COLUMN IF NOT EXISTS gateway_credentials_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS gateway_credentials_iv        TEXT;

-- Expandir CHECK do gateway_provider para suportar todos os providers
ALTER TABLE escritorio_config
  DROP CONSTRAINT IF EXISTS escritorio_config_gateway_provider_check;

ALTER TABLE escritorio_config
  ADD CONSTRAINT escritorio_config_gateway_provider_check
    CHECK (gateway_provider IN ('asaas','pagarme','cora','inter','c6bank'));

COMMENT ON COLUMN escritorio_config.gateway_credentials_encrypted IS
  'JSONB encriptado com AES-256-GCM. Estrutura por provider:
   asaas/pagarme/cora: {"api_key":"..."}
   inter: {"client_id":"...","client_secret":"...","cnpj":"..."}
   c6bank: {"api_key":"...","cnpj":"..."}';

────────────────────────────────────────────────────────
SUBTAREFA B — Endpoints REST
────────────────────────────────────────────────────────
Crie ou atualize src/modules/portal-admin/ para expor:

GET    /v1/portal/escritorio/config
PATCH  /v1/portal/escritorio/config

─────────────────────────────────────────
Schema Zod para PATCH:
─────────────────────────────────────────
import { z } from 'zod'

// Credenciais variam por provider — usar union discriminada
const gatewayCredentialsSchema = z.discriminatedUnion('gateway_provider', [
  z.object({
    gateway_provider:    z.enum(['asaas','pagarme','cora']),
    gateway_credentials: z.object({ api_key: z.string().min(10) }),
  }),
  z.object({
    gateway_provider:    z.literal('inter'),
    gateway_credentials: z.object({
      client_id:     z.string().min(1),
      client_secret: z.string().min(1),
      cnpj:          z.string().regex(/^\d{14}$/, 'CNPJ deve ter 14 dígitos'),
    }),
  }),
  z.object({
    gateway_provider:    z.literal('c6bank'),
    gateway_credentials: z.object({
      api_key: z.string().min(10),
      cnpj:    z.string().regex(/^\d{14}$/, 'CNPJ deve ter 14 dígitos'),
    }),
  }),
])

const patchEscritorioSchema = z.object({
  razao_social:         z.string().min(3).max(200).optional(),
  multa_percentual:     z.number().min(0).max(10).optional(),
  juros_percentual:     z.number().min(0).max(5).optional(),
  // gateway_provider + gateway_credentials são sempre enviados juntos
  gateway_config:       gatewayCredentialsSchema.optional(),
  whatsapp_provider:    z.enum(['zapi','twilio']).optional(),
  whatsapp_instance_id: z.string().optional(),
  whatsapp_token:       z.string().optional(),      // ← CRIPTOGRAFAR
  zapi_client_token:    z.string().optional(),      // ← CRIPTOGRAFAR
}).refine(
  data => !data.gateway_config || (data.gateway_config.gateway_provider !== undefined),
  { message: 'gateway_config requer gateway_provider' }
)

─────────────────────────────────────────
Lógica de PATCH — gateway:
─────────────────────────────────────────
Se body.gateway_config enviado:
  const credentialsJson = JSON.stringify(body.gateway_config.gateway_credentials)
  const { encrypted, iv } = encrypt(credentialsJson)
  salvar:
    gateway_provider              = body.gateway_config.gateway_provider
    gateway_credentials_encrypted = encrypted
    gateway_credentials_iv        = iv

Para demais credenciais (whatsapp_token, zapi_client_token):
  const { encrypted, iv } = encrypt(plainValue)
  salvar: campo_encrypted = encrypted, campo_iv = iv

Usar: import { encrypt } from '../../../platform/crypto/encrypt'

─────────────────────────────────────────
Lógica de GET — mascarar credenciais:
─────────────────────────────────────────
// Extrai só a "chave principal" para mascarar (para exibição)
function maskGatewayCredentials(
  encrypted: string | null,
  iv: string | null,
  provider: string
): string | null {
  if (!encrypted || !iv) return null;
  const creds = JSON.parse(decrypt(encrypted, iv));
  // Mostrar apenas os últimos 4 chars do campo mais identificador
  const keyField = creds.api_key ?? creds.client_id ?? creds.cnpj ?? '';
  return '****' + String(keyField).slice(-4);
}

Resposta GET:
{
  razao_social,
  multa_percentual, juros_percentual,
  gateway_provider,
  gateway_credentials_masked: '****abcd',   ← últimos 4 chars do campo principal
  whatsapp_provider,
  whatsapp_instance_id,
  whatsapp_token_masked: '****ijkl',        ← mascarado
  zapi_client_token_masked: '****mnop',     ← mascarado
}
// NUNCA retornar gateway_credentials_encrypted, _iv, ou o JSONB completo

─────────────────────────────────────────
RBAC e Audit:
─────────────────────────────────────────
Middleware de autorização: apenas roles 'tenant_owner' e 'admin_escritorio'
  → 403 para 'operador', 'cliente_cnpj', 'viewer'
writeAuditLog no PATCH (dentro da mesma pg transaction):
  action: 'update_escritorio_config'
  payload_json: { gateway_provider, has_gateway_credentials: true/false }
  // NUNCA incluir as credenciais no audit_log

─────────────────────────────────────────
Testes obrigatórios (6 mínimos):
─────────────────────────────────────────
  ✅ PATCH com gateway_config Asaas → salva criptografada, GET retorna '****xxxx'
  ✅ PATCH com gateway_config Inter (client_id+secret+cnpj) → salva JSON encriptado
  ✅ GET → gateway_credentials_masked contém exatamente os últimos 4 chars do api_key/client_id
  ✅ PATCH gateway_config sem gateway_provider → 422 Unprocessable Entity
  ✅ Role 'operador' faz PATCH → 403 Forbidden
  ✅ writeAuditLog chamado com action='update_escritorio_config' (sem expor credenciais)
```

---

## TAREFA 2.7 — CRUD charging_rules (régua configurável)

```
Crie endpoints em src/modules/portal-admin/interfaces/http/:

GET    /v1/portal/escritorio/regua         → lista regras do tenant
POST   /v1/portal/escritorio/regua         → cria nova regra
PATCH  /v1/portal/escritorio/regua/:id     → ativa/desativa ou muda canal
DELETE /v1/portal/escritorio/regua/:id     → remove regra

─────────────────────────────────────────
Schema Zod para POST:
─────────────────────────────────────────
const createRuleSchema = z.object({
  days_offset: z.number().int().min(-30).max(30),
  channel: z.enum(['email','whatsapp','both']),
  template_id: z.string().uuid().optional(),
})

Schema Zod para PATCH:
const patchRuleSchema = z.object({
  is_active: z.boolean().optional(),
  channel: z.enum(['email','whatsapp','both']).optional(),
  template_id: z.string().uuid().nullable().optional(),
})

─────────────────────────────────────────
Lógica de negócio:
─────────────────────────────────────────
POST:
  INSERT INTO charging_rules (tenant_id, days_offset, channel, template_id)
  VALUES ($1, $2, $3, $4)
  ON CONFLICT (tenant_id, days_offset, channel) DO NOTHING
  RETURNING *
  → Se nenhuma linha retornada (conflito): responder 409 Conflict
  → Se template_id informado mas pertence a outro tenant → 422

DELETE:
  Antes de deletar, tentar cancelar jobs BullMQ pendentes com jobId prefix:
    `regua-*-${rule.days_offset}`
  (best-effort, não falhar se job não encontrado)

GET response format:
  [
    {
      id, days_offset, channel, is_active,
      template: {
        id, event_type, subject,
        body_preview: template.body_template.substring(0, 80) + '...'
      } | null
    }
  ]

RBAC: apenas tenant_owner e admin_escritorio
writeAuditLog em POST, PATCH e DELETE

Testes obrigatórios (4 mínimos):
  ✅ POST → regra criada com days_offset=-3, channel='whatsapp'
  ✅ POST duplicado (mesmo tenant+offset+channel) → 409 Conflict
  ✅ PATCH is_active=false → regra desativada sem ser deletada
  ✅ DELETE → regra removida, GET não retorna mais
```

---

## TAREFA 2.8 — CRUD notification_templates (templates editáveis)

```
Crie endpoints em src/modules/portal-admin/interfaces/http/:

GET    /v1/portal/escritorio/templates              → lista templates do tenant
PATCH  /v1/portal/escritorio/templates/:id          → edita template
GET    /v1/portal/escritorio/templates/:id/preview  → preview com dados reais

─────────────────────────────────────────
Schema Zod para PATCH:
─────────────────────────────────────────
const patchTemplateSchema = z.object({
  subject: z.string().max(200).optional(),
  body_template: z.string().min(10).max(1024),
})

─────────────────────────────────────────
Lógica GET /templates:
─────────────────────────────────────────
  SELECT * FROM notification_templates
  WHERE tenant_id = $tenantId
     OR tenant_id IS NULL
  ORDER BY event_type, channel
  → Retornar todos (padrão do sistema + personalizados do tenant)
  → Campo "is_custom": true se tenant_id = tenantId, false se padrão

─────────────────────────────────────────
Lógica PATCH /templates/:id:
─────────────────────────────────────────
  Verificar: SELECT tenant_id FROM notification_templates WHERE id = $id
  Se tenant_id IS NULL (template do sistema) → 422 Unprocessable
    { error: 'system_template_readonly', message: 'Templates do sistema são somente leitura. Crie uma cópia para o seu tenant.' }
  Se tenant_id != tenantId → 404 (cross-tenant)

  UPDATE notification_templates SET subject = $subject, body_template = $body, updated_at = now()
  WHERE id = $id AND tenant_id = $tenantId

  writeAuditLog({ action: 'update_notification_template', ... })

─────────────────────────────────────────
Lógica GET /templates/:id/preview?charge_id=xxx:
─────────────────────────────────────────
  1. Buscar template por id (tenant próprio ou sistema)
  2. Se charge_id fornecido:
       Buscar charge + cliente + payment_transactions + escritorio_config
       Montar vars reais
  3. Senão: usar vars de exemplo (nome='João Silva', valor='R$ 1.500,00', etc.)
  4. const rendered = renderTemplate(template.body_template, vars)
  5. Retornar: { subject: renderTemplate(template.subject ?? '', vars), body_rendered: rendered }

─────────────────────────────────────────
Provisioning: copiar templates padrão ao criar novo tenant
─────────────────────────────────────────
Localizar provision-public-tenant.ts e adicionar após INSERT do tenant:
  INSERT INTO notification_templates
    (tenant_id, event_type, channel, subject, body_template)
  SELECT $newTenantId, event_type, channel, subject, body_template
  FROM notification_templates
  WHERE tenant_id IS NULL
  ON CONFLICT (tenant_id, event_type, channel) DO NOTHING

RBAC: apenas tenant_owner e admin_escritorio podem PATCH
      GET e preview: qualquer role autenticado do tenant

Testes obrigatórios (4 mínimos):
  ✅ PATCH body_template → salvo, GET confirma novo conteúdo
  ✅ PATCH template do sistema (tenant_id IS NULL) → 422
  ✅ Preview com charge_id real → {{nome}} e {{valor}} substituídos
  ✅ GET templates → retorna padrão do sistema + personalizados do tenant sem duplicatas
```

---

---

# ══════════════════════════════════════
# BLOCO 3 — CRITÉRIO DE ACEITE GLOBAL
# ══════════════════════════════════════

## Fluxo ponta a ponta que DEVE funcionar ao final desta entrega

```
1. PATCH /v1/portal/escritorio/config com gateway_config { gateway_provider:'asaas', gateway_credentials:{ api_key:'...' } }
   → salva criptografada, GET retorna gateway_credentials_masked: '****xxxx'

2. POST /v1/portal/escritorio/regua
   body: { days_offset: -3, channel: 'whatsapp' }
   → regra criada

3. POST /v1/portal/cobrancas body: { ..., type: 'pix' }
   → 201, canonical_status='rascunho', job enfileirado em charges:emission

4. Worker payment-emission executa
   → payment_transactions criado com pix_qrcode_base64
   → canonical_status='emitida'

5. GET /v1/portal/cobrancas/:id
   → payment.pix_qrcode_base64 não nulo ← frontend renderiza QR Code

6. Scheduler 07h dispara (ou chamada manual ao runChargingRuleScheduler())
   → Para cobrança com due_date=hoje+3 → job 'regua-{chargeId}-(-3)' enfileirado

7. Worker notification-send executa
   → ZapiAdapter.sendWhatsApp chamado
   → communication_events INSERT status='sent'

8. POST /v1/inbox/webhooks body: { event: 'PAYMENT_CONFIRMED', ... }
   → canonical_status='paga', notificação de pagamento enfileirada, jobs de régua removidos

9. GET /v1/portal/cobrancas/:id → canonical_status='paga'

10. Worker charge-status-sync (cron 15min)
    → cobrança 'emitida' há 25h consultada no Asaas, status sincronizado
```

---

## Checklist de entrega obrigatório no PR

```markdown
### Sprint 1 Encerramento + Sprint 2
[ ] TAREFA 1.6: charge-status-sync.worker.ts (cron 15min, reconciliação)
[ ] TAREFA 2.1: Migration 016 (communication_events + notification_templates + charging_rules + seed)
[ ] TAREFA 2.2: InboxProcessor completo — 6 eventos Asaas mapeados + dedup + régua
[ ] TAREFA 2.3: ResendAdapter + ZapiAdapter + renderTemplate (com testes)
[ ] TAREFA 2.4: notification-send.worker.ts (opt-in, early return, audit)
[ ] TAREFA 2.5: charging-rule.scheduler.ts (cron 07h, dedup por jobId)
[ ] TAREFA 2.6: Migration 022 + GET + PATCH /v1/portal/escritorio/config (JSONB multi-gateway + crypto + mascaramento + RBAC)
[ ] TAREFA 2.7: CRUD /v1/portal/escritorio/regua (409 no conflito, audit)
[ ] TAREFA 2.8: CRUD /v1/portal/escritorio/templates + preview endpoint
[ ] start-workers.ts atualizado com todos os workers e schedulers
[ ] src/platform/crypto/encrypt.ts criado (espelho de decrypt.ts)
[ ] Todos os endpoints novos com RBAC correto (403 para roles não autorizados)
[ ] writeAuditLog em TODAS as mutações novas
[ ] npm run build ✅ (zero erros TypeScript)
[ ] npm test ✅ (cobertura ≥ 85% em application/ e domain/)
[ ] bash Projeto_CobrancaBoleto/validacao_fase_0.sh ainda verde (sem regressão)
[ ] Nenhum secret, API key ou token exposto em código, logs ou git
```

---

## Ordem de execução recomendada

```
Cursor: cole uma TAREFA por vez, na seguinte ordem:

1. TAREFA 1.6  → charge-status-sync (worker simples, sem dependências novas)
2. TAREFA 2.1  → Migration 016 (pré-requisito para tudo que segue)
3. TAREFA 2.3  → Módulo notifications (adapters + renderTemplate, sem DB)
4. TAREFA 2.4  → Worker notification-send (depende de 2.3 + 2.1)
5. TAREFA 2.2  → Webhook processing completo (depende de 2.4 para enfileirar)
6. TAREFA 2.5  → Scheduler charging-rule (depende de 2.1 + 2.4)
7. TAREFA 2.6  → CRUD escritorio_config (lógica de criptografia)
8. TAREFA 2.7  → CRUD charging_rules (depende de 2.1)
9. TAREFA 2.8  → CRUD notification_templates + preview (depende de 2.1 + 2.3)
```

---

*Pacote emitido por: PO + Tech Manager + Engenheiro de Prompt IA · Maio 2026*
*Próxima fase após esta entrega: Sprint 3 — Portal do Cliente + Relatórios*
