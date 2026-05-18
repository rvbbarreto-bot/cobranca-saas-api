# 📦 PACOTE DE DEMANDAS — Sprint 1 Final + Sprint 2 Completa
## SaaS de Cobranças · Emitido por: PO + Tech Manager + Engenheiro de Prompt IA
### Data: Maio 2026 · Estimativa total: 8–10 semanas de desenvolvimento sênior

---

> **Como usar este documento no Cursor**
> Cole o bloco de cada TAREFA no chat (`Ctrl+L`) uma por vez.
> Aguarde a entrega, valide os critérios de aceite e só então avance para a próxima.
> A ordem importa — tarefas com dependência de banco vêm antes dos workers.

---

## CONTEXTO PARA O AGENTE

```
Você está dando continuidade ao projeto cobranca-saas-api.

Estado atual confirmado:
✅ Fase 0 completa (saneamento, segurança, migrations 013/014, rate-limit, audit_log)
✅ Sprint 1 parcial: domínio payment-gateway entregue
   - payment-gateway.interface.ts com todos os contratos
   - AsaasAdapter com createCustomer/createBoleto/createPix/cancelCharge/getCharge
   - asaas-status-map.ts com ASAAS_TO_CANONICAL
   - payment-gateway-error.ts
   - 5 testes passando com fetch mockado

Ainda FALTAM para fechar Sprint 1 + completar Sprint 2:
- Migration 015 (payment_transactions + portal.cliente)
- Redis/BullMQ setup
- Workers: payment-emission, webhook-process, charge-status-sync
- Job wiring no create-charge
- Módulo notifications (Resend + Z-API)
- Régua de cobrança (charging_rules + scheduler)
- Endpoints atualizados (GET /cobrancas/:id com QR Code, escritorio_config CRUD)
- Migration 016 (communication_events + notification_templates + charging_rules)

Stack: Node.js 20 + TypeScript 5.7 + Express + pg (raw SQL) + BullMQ + Redis
Regras absolutas: multi-tenant obrigatório, audit_log em toda mutação,
idempotência nos webhooks, inbox pattern, estado terminal paga/cancelada irreversível.
```

---

---

# ══════════════════════════════════════
# BLOCO 1 — SPRINT 1: FECHAR O CICLO DE PAGAMENTO
# ══════════════════════════════════════

---

## TAREFA 1.1 — Migration 015: tabelas de pagamento

```
Crie db/migrations/015_payment_gateway_fase1.sql

-- TABELA 1: payment_transactions
CREATE TABLE IF NOT EXISTS payment_transactions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              TEXT NOT NULL,
  charge_id              UUID NOT NULL REFERENCES charges(id) ON DELETE RESTRICT,
  gateway                TEXT NOT NULL CHECK (gateway IN ('asaas','pagarme')),
  gateway_transaction_id TEXT UNIQUE,
  type                   TEXT NOT NULL CHECK (type IN ('boleto','pix')),
  status                 TEXT NOT NULL DEFAULT 'pending',
  amount                 NUMERIC(14,2) NOT NULL,
  boleto_url             TEXT,
  boleto_pdf_url         TEXT,
  boleto_barcode         TEXT,
  pix_qrcode_base64      TEXT,
  pix_emv                TEXT,
  pix_link               TEXT,
  expires_at             TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ptx_charge
  ON payment_transactions(charge_id);
CREATE INDEX IF NOT EXISTS idx_ptx_tenant
  ON payment_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ptx_gateway
  ON payment_transactions(gateway_transaction_id)
  WHERE gateway_transaction_id IS NOT NULL;

-- TABELA 2: portal.cliente
CREATE TABLE IF NOT EXISTS portal.cliente (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           TEXT NOT NULL,
  documento           TEXT NOT NULL,
  tipo_documento      TEXT NOT NULL CHECK (tipo_documento IN ('cpf','cnpj')),
  nome                TEXT NOT NULL,
  email               TEXT NOT NULL,
  telefone            TEXT,
  opt_in_email        BOOLEAN NOT NULL DEFAULT true,
  opt_in_whatsapp     BOOLEAN NOT NULL DEFAULT false,
  gateway_customer_id TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_portal_cliente_doc UNIQUE (tenant_id, documento)
);
ALTER TABLE portal.cliente ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS tenant_isolation ON portal.cliente
  USING (tenant_id = current_setting('app.tenant_id', true));
CREATE INDEX IF NOT EXISTS idx_portal_cliente_tenant
  ON portal.cliente(tenant_id);

Critérios de aceite:
- npm run migrate sem erros em banco limpo
- Migration é idempotente (rodar 2x não gera erro)
- SELECT * FROM payment_transactions LIMIT 0 funciona
- SELECT * FROM portal.cliente LIMIT 0 funciona
```

---

## TAREFA 1.2 — Platform: Redis + BullMQ + Workers bootstrap

```
1. Instale: npm install bullmq ioredis

2. Crie src/platform/jobs/redis-connection.ts:
   import { ConnectionOptions } from 'bullmq';
   export const redisConnection: ConnectionOptions = {
     url: process.env.REDIS_URL ?? 'redis://localhost:6379',
   };

3. Crie src/platform/jobs/queues.ts:
   import { Queue } from 'bullmq';
   import { redisConnection } from './redis-connection';

   export const queues = {
     paymentEmission: new Queue('charges:emission', { connection: redisConnection }),
     webhookProcess:  new Queue('inbox:process',    { connection: redisConnection }),
     chargeSync:      new Queue('charges:sync',     { connection: redisConnection }),
     notificationSend:new Queue('notifications:send',{ connection: redisConnection }),
     nfseEmit:        new Queue('nfse:emit',        { connection: redisConnection }),
   };

   export const JOB_OPTS = {
     emission:     { attempts: 3, backoff: { type: 'exponential', delay: 30_000 },
                     removeOnComplete: { count: 100 }, removeOnFail: { count: 50 } },
     notification: { attempts: 3, backoff: { type: 'exponential', delay: 120_000 } },
     nfse:         { attempts: 5, backoff: { type: 'exponential', delay: 60_000 } },
     sync:         { attempts: 1 },
   } as const;

4. Crie src/platform/jobs/start-workers.ts que importa e inicia todos os
   workers (arquivo cresce conforme workers são criados).
   Exportar startAllWorkers(): void.

5. Chamar startAllWorkers() no src/server.ts após o app.listen().

Critérios de aceite:
- npm run build sem erros
- Redis offline → API sobe mesmo assim (workers falham graciosamente com log de aviso,
  não derrubam o processo)
```

---

## TAREFA 1.3 — Worker: payment-emission

```
Crie src/platform/jobs/workers/payment-emission.worker.ts

Payload do job: { chargeId: string; tenantId: string }

Fluxo obrigatório (executar em sequência, toda exceção propaga para retry do BullMQ):

PASSO 1 — Carregar dados
  a. SELECT charges WHERE id = chargeId AND tenant_id = tenantId
     → Se não encontrado: lançar Error('charge_not_found') — não fazer retry
  b. Se canonical_status !== 'rascunho': lançar Error('invalid_status_for_emission')
  c. SELECT escritorio_config WHERE tenant_id = tenantId
     → Se não encontrado: lançar Error('escritorio_config_not_found')

PASSO 2 — Descriptografar API key
  Usar AES-256-GCM com process.env.ENCRYPTION_KEY
  Função utilitária: src/platform/crypto/decrypt.ts
  → decrypt(encryptedText: string, iv: string): string

PASSO 3 — Instanciar adapter
  const adapter = new AsaasAdapter(apiKey, process.env.ASAAS_API_URL)

PASSO 4 — Garantir cliente no gateway
  a. SELECT portal.cliente WHERE id = charge.customer_id AND tenant_id = tenantId
  b. Se gateway_customer_id IS NULL:
       gatewayCustomerId = await adapter.createCustomer({ name, cpfCnpj, email,
         phone, externalReference: clienteId })
       UPDATE portal.cliente SET gateway_customer_id = gatewayCustomerId
  c. Senão: usar gateway_customer_id existente

PASSO 5 — Emitir no gateway
  Se charge.type === 'boleto': result = await adapter.createBoleto(...)
  Se charge.type === 'pix':    result = await adapter.createPix(...)

PASSO 6 — Persistir resultado (dentro de uma transaction pg)
  a. INSERT INTO payment_transactions (todos os campos do result)
  b. UPDATE charges SET canonical_status = 'emitida', updated_at = now()
  c. INSERT INTO charge_events (event_type='emissao_gateway',
       old_status='rascunho', new_status='emitida',
       payload_json={ gateway_transaction_id, type })
  d. CALL writeAuditLog (action='status_change', resource_type='charge')

PASSO 7 — Em caso de falha permanente (após todos retries)
  UPDATE charges SET canonical_status = 'erro_emissao'
  INSERT INTO charge_events (event_type='erro_emissao', payload_json={error})

Testes obrigatórios (mínimo 6 casos):
  ✅ boleto emitido → canonical_status = 'emitida', payment_transactions criado
  ✅ pix emitido → pix_qrcode_base64 salvo, canonical_status = 'emitida'
  ✅ cliente sem gateway_customer_id → createCustomer chamado antes
  ✅ cliente já tem gateway_customer_id → createCustomer NÃO chamado
  ✅ adapter lança erro → charge fica em 'erro_emissao' após retries
  ✅ charge de outro tenant → Error, não processa
```

---

## TAREFA 1.4 — Wiring: enfileirar job ao criar cobrança

```
Localize o caso de uso de criação de cobrança via portal
(provavelmente create-portal-charge.ts ou create-charge.ts).

Após o INSERT bem-sucedido da cobrança com canonical_status = 'rascunho',
adicione:

  await queues.paymentEmission.add(
    'emit-charge',
    { chargeId: newCharge.id, tenantId: newCharge.tenant_id },
    JOB_OPTS.emission
  );

REGRA: o endpoint POST /v1/portal/cobrancas deve retornar 201 com a cobrança
em status 'rascunho' IMEDIATAMENTE, sem aguardar o job.

Adicionar campo 'type' ('boleto' ou 'pix') ao payload de criação de cobrança
se ainda não existir. Validar com Zod: z.enum(['boleto','pix']).

Testes:
  ✅ POST /cobrancas → 201, status='rascunho', job enfileirado
  ✅ POST sem campo type → 422 com mensagem descritiva
  ✅ Idempotência: mesmo idempotency_key → 200 com idempotent: true
```

---

## TAREFA 1.5 — Atualizar GET /v1/portal/cobrancas/:id

```
Atualize o repositório/handler de detalhe da cobrança para incluir
dados de payment_transactions e charge_events na resposta.

Query SQL:
  SELECT
    c.*,
    row_to_json(pt.*) AS payment,
    COALESCE(
      json_agg(ce.* ORDER BY ce.created_at ASC) FILTER (WHERE ce.id IS NOT NULL),
      '[]'
    ) AS events
  FROM charges c
  LEFT JOIN payment_transactions pt
    ON pt.charge_id = c.id
  LEFT JOIN charge_events ce
    ON ce.charge_id = c.id
  WHERE c.id = $1 AND c.tenant_id = $2
  GROUP BY c.id, pt.id;

Formato da resposta JSON:
{
  id, canonical_status, amount, due_date, description, type,
  payment: {
    type: 'boleto' | 'pix' | null,
    boleto_url, boleto_pdf_url, boleto_barcode,
    pix_qrcode_base64, pix_emv, pix_link,
    expires_at, status
  } | null,
  events: [{ event_type, old_status, new_status, payload_json, created_at }]
}

Critério: GET /cobrancas/:id de uma cobrança PIX emitida deve retornar
pix_qrcode_base64 não nulo para o frontend renderizar o QR Code.
```

---

## TAREFA 1.6 — Job charge-status-sync (reconciliação)

```
Crie src/platform/jobs/workers/charge-status-sync.worker.ts

Propósito: cobranças que não receberam webhook do Asaas em 24h devem ser
reconciliadas consultando o gateway diretamente (failsafe).

Lógica:
  1. Registrar como job recorrente (cron a cada 15 minutos):
     queues.chargeSync.add('sync', {}, { repeat: { pattern: '*/15 * * * *' } })

  2. Buscar cobranças candidatas:
     SELECT c.id, c.tenant_id, pt.gateway_transaction_id, ec.config
     FROM charges c
     JOIN payment_transactions pt ON pt.charge_id = c.id
     JOIN escritorio_config ec ON ec.tenant_id = c.tenant_id
     WHERE c.canonical_status IN ('emitida','enviada','pendente_pagamento')
       AND c.updated_at < now() - interval '24 hours'
     LIMIT 50

  3. Para cada cobrança:
     a. Descriptografar API key do escritorio_config
     b. adapter.getCharge(gateway_transaction_id)
     c. Mapear status via mapAsaasPaymentStatus()
     d. Se status divergir do canonical_status atual → aplicar transição
        (respeitando a máquina de estados — não retroceder)
     e. Registrar charge_events se houve mudança

  4. Logar total processadas/atualizadas/erros ao final

Critérios de aceite:
  ✅ Cobrança 'emitida' há 25h com webhook perdido → sincroniza status
  ✅ Cobrança já 'paga' → não é consultada (filtro de status)
  ✅ Falha em 1 cobrança não interrompe as demais (try/catch por item)
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
CREATE INDEX IF NOT EXISTS idx_comm_tenant   ON communication_events(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_comm_charge   ON communication_events(charge_id);

CREATE TABLE IF NOT EXISTS notification_templates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      TEXT NOT NULL,
  event_type     TEXT NOT NULL,
  channel        TEXT NOT NULL CHECK (channel IN ('email','whatsapp')),
  subject        TEXT,
  body_template  TEXT NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_template UNIQUE (tenant_id, event_type, channel)
);

CREATE TABLE IF NOT EXISTS charging_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL,
  days_offset INT NOT NULL,
  channel     TEXT NOT NULL CHECK (channel IN ('email','whatsapp','both')),
  template_id UUID REFERENCES notification_templates(id),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_rule UNIQUE (tenant_id, days_offset, channel)
);
CREATE INDEX IF NOT EXISTS idx_rules_tenant ON charging_rules(tenant_id, is_active);

Critérios: migration idempotente, npm run build OK, npm run migrate OK.
```

---

## TAREFA 2.2 — Webhook processing completo (todos os eventos Asaas)

```
Atualize o InboxProcessor (src/modules/inbox/) para processar
todos os 6 eventos Asaas usando o ASAAS_TO_CANONICAL já existente.

Fluxo por evento (dentro de transaction pg):

PAYMENT_CONFIRMED / PAYMENT_RECEIVED → canonical_status = 'paga'
  1. UPDATE charges SET canonical_status='paga', paid_at=now()
  2. INSERT charge_events (old→new status, payload com valor pago)
  3. writeAuditLog
  4. queues.notificationSend.add('payment-confirmed', { chargeId, tenantId })
  5. queues.nfseEmit.add('emit', { chargeId, tenantId }, JOB_OPTS.nfse)
  6. Cancelar jobs pendentes de régua para esta cobrança:
     await queues.notificationSend.obliterate() — NÃO, usar jobId para cancelar
     Estratégia: ao enfileirar régua, usar jobId = 'regua-{chargeId}-{daysOffset}'
     Ao pagar: remover jobs com getJob('regua-{chargeId}-*') e job.remove()

PAYMENT_OVERDUE → canonical_status = 'vencida'
  1. UPDATE charges SET canonical_status='vencida'
  2. INSERT charge_events
  3. Enfileirar régua pós-vencimento: D+3 e D+7
     queues.notificationSend.add('regua', { chargeId, tenantId, daysOffset: 3 },
       { delay: 0, jobId: 'regua-{chargeId}-3' })
     queues.notificationSend.add('regua', { chargeId, tenantId, daysOffset: 7 },
       { delay: 0, jobId: 'regua-{chargeId}-7' })

PAYMENT_DELETED / PAYMENT_REFUNDED → canonical_status = 'cancelada'
  1. UPDATE charges SET canonical_status='cancelada', cancelled_at=now()
  2. INSERT charge_events
  3. Cancelar todos os jobs de régua pendentes para esta cobrança

PAYMENT_RESTORED → canonical_status = 'emitida'
  1. Só transicionar se status atual for 'cancelada' (verificar máquina de estados)

Deduplicação (já implementada): webhook_inbox.processed_at NOT NULL = já processado → 200 silencioso

Testes obrigatórios (1 por evento = 6 testes mínimos):
  ✅ PAYMENT_CONFIRMED → paga, nfse-emit enfileirado, notificação enfileirada
  ✅ PAYMENT_OVERDUE → vencida, D+3 e D+7 enfileirados
  ✅ PAYMENT_DELETED → cancelada, jobs de régua removidos
  ✅ PAYMENT_REFUNDED → cancelada
  ✅ PAYMENT_RESTORED → emitida (só se era cancelada)
  ✅ Webhook duplicado → 200 silencioso, sem mutação
```

---

## TAREFA 2.3 — Módulo notifications: adapters Resend + Z-API

```
Crie src/modules/notifications/ com a seguinte estrutura:

domain/notification.interface.ts:
  interface SendEmailInput {
    to: string; subject: string; html: string; attachments?: Attachment[]
  }
  interface SendWhatsAppInput {
    phone: string; message: string; // max 1024 chars
  }
  interface NotificationAdapter {
    sendEmail(input: SendEmailInput): Promise<{ messageId: string }>;
    sendWhatsApp(input: SendWhatsAppInput): Promise<{ messageId: string }>;
  }

infrastructure/resend/resend-adapter.ts:
  POST https://api.resend.com/emails
  Header: Authorization: Bearer {process.env.RESEND_API_KEY}
  from: process.env.RESEND_FROM_EMAIL ?? 'cobrancas@suaempresa.com.br'
  Lançar NotificationError tipado em caso de falha

infrastructure/zapi/zapi-adapter.ts:
  POST https://api.z-api.io/instances/{ZAPI_INSTANCE}/token/{ZAPI_TOKEN}/send-text
  Body: { phone: '55'+phone (só dígitos), message, delayMessage: 2 }
  Lançar NotificationError tipado em caso de falha

application/render-template.ts:
  Função renderTemplate(template: string, vars: Record<string,string>): string
  Substituir {{variavel}} pelos valores do objeto vars
  Variáveis disponíveis: nome, valor, data_vencimento, link_boleto,
    link_pix, pix_emv, escritorio_nome, multa_percentual, data_pagamento

Templates padrão (inserir via seed ou migration):
  Evento              Canal       Template
  lembrete_pre_3d     whatsapp    Olá {{nome}}, seu boleto de {{valor}} vence em 3 dias ({{data_vencimento}}). Pague com PIX: {{link_pix}}
  lembrete_pre_1d     whatsapp    Último lembrete: boleto vence amanhã. PIX: {{link_pix}}
  vencimento_hoje     email       [Aviso] Seu boleto de {{valor}} venceu hoje. Multa de {{multa_percentual}}% aplicada.
  pos_vencimento_3d   whatsapp    Boleto vencido há 3 dias. Regularize: {{link_boleto}}
  pos_vencimento_7d   email       Último aviso. Regularize em 48h para evitar negativação.
  pagamento_confirmado email      Pagamento de {{valor}} confirmado em {{data_pagamento}}. Obrigado!

npm install resend (para tipos opcionais)
Testes: 4 casos mínimos (email OK, whatsapp OK, email falha → NotificationError, template render correto)
```

---

## TAREFA 2.4 — Worker: notification-send

```
Crie src/platform/jobs/workers/notification-send.worker.ts

Payload do job: {
  chargeId: string;
  tenantId: string;
  eventType: string;       // ex: 'lembrete_pre_3d'
  daysOffset?: number;     // para régua
  forceChannel?: 'email' | 'whatsapp' | 'both';
}

Fluxo:
  1. Buscar cobrança + dados do cliente + escritorio_config
  2. Verificar se cliente tem opt_in para o canal (opt_in_email / opt_in_whatsapp)
  3. Buscar notification_templates WHERE tenant_id = tenantId AND event_type = eventType
     → Se não encontrar: usar template padrão do sistema (fallback)
  4. Montar variáveis de template:
     { nome, valor: 'R$ X.XXX,XX', data_vencimento: 'DD/MM/YYYY',
       link_boleto, link_pix, pix_emv, escritorio_nome }
  5. Renderizar corpo com renderTemplate()
  6. Enviar via ResendAdapter (email) e/ou ZapiAdapter (whatsapp)
     conforme charging_rules.channel do tenant
  7. INSERT communication_events (status='sent' ou 'failed')
  8. Em caso de falha: UPDATE communication_events SET status='failed',
     error_message = e.message

NUNCA enviar se canonical_status = 'paga' ou 'cancelada'
  → Checar no início do worker antes de qualquer envio

Testes (mínimo 5 casos):
  ✅ Lembrete email enviado → communication_events status='sent'
  ✅ WhatsApp enviado → communication_events status='sent'
  ✅ Cliente sem opt_in_whatsapp → não envia WhatsApp, sem erro
  ✅ Cobrança já paga → worker retorna early sem enviar nada
  ✅ Adapter falha → communication_events status='failed', erro registrado
```

---

## TAREFA 2.5 — Régua de cobrança: scheduler automático

```
Crie src/platform/jobs/schedulers/charging-rule.scheduler.ts

Propósito: a cada dia às 07h (cron '0 7 * * *'), para cada tenant ativo,
verificar cobranças que se encaixam nas regras da régua e enfileirar notificações.

Lógica principal:
  1. Buscar todos tenants com status='active' ou 'trial' que têm charging_rules ativas
  2. Para cada tenant, buscar charging_rules WHERE is_active = true
  3. Para cada regra (days_offset pode ser negativo=antes, positivo=depois):
     a. Calcular data alvo:
        SE days_offset <= 0: due_date = CURRENT_DATE - days_offset (antes do vencimento)
        SE days_offset > 0:  due_date = CURRENT_DATE - days_offset (após vencimento)
     b. Buscar cobranças WHERE:
        - tenant_id = tenantId
        - due_date = data_alvo calculada
        - canonical_status = 'enviada' ou 'pendente_pagamento' (pré-vencimento)
          OU canonical_status = 'vencida' (pós-vencimento)
        - NÃO existe communication_events com mesmo charge_id + event_type
          (evitar reenvio)
     c. Para cada cobrança encontrada:
        await queues.notificationSend.add('regua', {
          chargeId: charge.id, tenantId, eventType: mapDaysOffsetToEventType(days_offset)
        }, { jobId: 'regua-{charge.id}-{days_offset}' })
        // jobId garante dedup: mesma cobrança + mesmo offset = 1 job

  4. Log: total de cobranças agendadas por tenant

Registrar o cron no start-workers.ts:
  queues.chargeSync.add('daily-regua', {}, { repeat: { pattern: '0 7 * * *' } })

Função helper mapDaysOffsetToEventType:
  -3 → 'lembrete_pre_3d'
  -1 → 'lembrete_pre_1d'
   0 → 'vencimento_hoje'
  +3 → 'pos_vencimento_3d'
  +7 → 'pos_vencimento_7d'

Testes (4 casos mínimos):
  ✅ Cobrança vence em 3 dias → job lembrete_pre_3d enfileirado
  ✅ Cobrança já paga → não enfileira
  ✅ Lembrete já enviado hoje (communication_events existe) → não reenvia
  ✅ Tenant sem charging_rules → nenhum job criado
```

---

## TAREFA 2.6 — CRUD escritorio_config (configuração do escritório)

```
Crie ou atualize src/modules/portal-read/interfaces/http/ para expor:

GET    /v1/portal/escritorio/config
PATCH  /v1/portal/escritorio/config

Schema Zod para PATCH:
  cnpj_emissor?:          z.string().length(14) (só dígitos, validar DV)
  razao_social?:          z.string().min(3)
  inscricao_municipal?:   z.string()
  regime_tributario?:     z.enum(['simples','presumido','real'])
  codigo_municipio?:      z.string().length(7)
  aliquota_iss?:          z.number().min(0).max(10)
  gateway_provider?:      z.enum(['asaas','pagarme'])
  gateway_api_key?:       z.string().min(10)  ← criptografar antes de salvar
  focus_nfe_token?:       z.string().min(10)  ← criptografar antes de salvar
  whatsapp_provider?:     z.enum(['zapi','twilio'])
  whatsapp_token?:        z.string()          ← criptografar antes de salvar

REGRAS DE SEGURANÇA:
  - gateway_api_key, focus_nfe_token, whatsapp_token: criptografar com AES-256-GCM
    antes de salvar (usar src/platform/crypto/encrypt.ts)
  - Na resposta GET: mascarar chaves → mostrar apenas últimos 4 chars: '****abcd'
  - Nunca retornar o valor completo das chaves em nenhum endpoint

RBAC: apenas tenant_owner e admin_escritorio podem acessar

Testes:
  ✅ PATCH com gateway_api_key → salva criptografada
  ✅ GET → retorna api_key mascarada (não o valor real)
  ✅ Operador tenta PATCH → 403
  ✅ writeAuditLog chamado no PATCH
```

---

## TAREFA 2.7 — CRUD charging_rules (configuração da régua)

```
Crie endpoints para o admin configurar a régua do tenant:

GET    /v1/portal/escritorio/regua         → lista todas as regras do tenant
POST   /v1/portal/escritorio/regua         → cria nova regra
PATCH  /v1/portal/escritorio/regua/:id     → ativa/desativa ou muda canal
DELETE /v1/portal/escritorio/regua/:id     → remove regra

Schema Zod para POST:
  days_offset: z.number().int().min(-30).max(30)
  channel: z.enum(['email','whatsapp','both'])
  template_id?: z.string().uuid()  ← opcional; usa padrão se omitido

REGRAS:
  - UNIQUE (tenant_id, days_offset, channel) — 409 se duplicar
  - Só tenant_owner e admin_escritorio podem gerenciar régua
  - writeAuditLog em create, update e delete

GET /v1/portal/escritorio/regua response:
  [{ id, days_offset, channel, is_active, template: { event_type, body_preview } }]

Testes:
  ✅ POST → regra criada com days_offset=-3, channel='whatsapp'
  ✅ POST duplicado → 409
  ✅ PATCH is_active=false → desativa sem deletar
  ✅ DELETE → remove regra e jobs pendentes associados
```

---

## TAREFA 2.8 — CRUD notification_templates (templates editáveis)

```
GET    /v1/portal/escritorio/templates          → lista templates do tenant
PATCH  /v1/portal/escritorio/templates/:id      → edita subject e body_template

Schema Zod para PATCH:
  subject?:        z.string().max(200)
  body_template:   z.string().min(10).max(1024)  ← máx 1024 por limite do WhatsApp

Endpoint especial:
GET /v1/portal/escritorio/templates/:id/preview?charge_id=xxx
  → renderizar body_template com dados reais da cobrança informada
  → retornar { subject, body_rendered } para preview no frontend

REGRAS:
  - tenant_id isolado — tenant A não vê templates do tenant B (RLS)
  - Templates do sistema (tenant_id IS NULL) são read-only → 422 se tentar editar
  - Ao criar tenant novo (provisioning): copiar templates padrão do sistema para o tenant

Testes:
  ✅ PATCH body_template → salvo e preview funciona
  ✅ PATCH template do sistema → 422
  ✅ Preview com charge_id real → variáveis substituídas corretamente
  ✅ Cross-tenant: tenant A não acessa templates do tenant B
```

---

---

# ══════════════════════════════════════
# BLOCO 3 — EVIDÊNCIA E CRITÉRIO DE ACEITE GLOBAL
# ══════════════════════════════════════

## Fluxo ponta a ponta que DEVE funcionar ao final desta entrega

```
1. Admin configura escritorio_config com API key do Asaas (sandbox)
2. Admin configura 2 charging_rules: D-3 whatsapp + D+3 whatsapp
3. Operador cria cobrança PIX (POST /v1/portal/cobrancas type='pix')
   → Retorna 201, canonical_status='rascunho'
4. Worker payment-emission executa
   → payment_transactions criado com pix_qrcode_base64
   → canonical_status='emitida'
5. GET /v1/portal/cobrancas/:id retorna o QR Code PIX
6. Scheduler (ou teste manual) enfileira lembrete D-3
7. Worker notification-send envia WhatsApp via Z-API sandbox
   → communication_events status='sent'
8. Webhook Asaas PAYMENT_CONFIRMED chega em POST /v1/inbox/webhooks
   → canonical_status='paga', nfse-emit enfileirado (sem processar ainda — Fase 3)
   → Jobs de régua cancelados
9. GET /v1/portal/cobrancas/:id mostra canonical_status='paga'

Evidência obrigatória da fábrica:
  □ npm run build sem erros TypeScript
  □ npm test — todos os testes passando (cobertura ≥ 85% em application/domain)
  □ Teste de integração end-to-end documentado no PR com sandbox Asaas
  □ bash Projeto_CobrancaBoleto/validacao_fase_0.sh ainda verde (regressão)
  □ Nenhum secret exposto no código ou logs
```

---

## Checklist de entrega por PR

```markdown
SPRINT 1 FINAL + SPRINT 2
[ ] Migration 015 (payment_transactions + portal.cliente) — idempotente
[ ] Migration 016 (communication_events + notification_templates + charging_rules)
[ ] Redis + BullMQ platform: redis-connection.ts + queues.ts
[ ] Worker payment-emission com 6 testes
[ ] Wiring: POST /cobrancas enfileira job, retorna 201 imediato
[ ] GET /cobrancas/:id retorna payment{} com QR Code
[ ] Worker charge-status-sync (cron 15min)
[ ] Webhook processing: 6 eventos Asaas mapeados + dedup
[ ] Adapter Resend (email) com testes
[ ] Adapter Z-API (WhatsApp) com testes
[ ] Worker notification-send com 5 testes
[ ] Scheduler charging-rule (cron 07h)
[ ] CRUD escritorio_config (GET + PATCH com criptografia)
[ ] CRUD charging_rules (GET + POST + PATCH + DELETE)
[ ] CRUD notification_templates (GET + PATCH + preview)
[ ] Todos os novos endpoints com RBAC correto
[ ] writeAuditLog em todas as mutações novas
[ ] npm run build ✅ + npm test ✅ + cobertura ≥ 85%
```

---

*Pacote emitido por: PO + Tech Manager + Engenheiro de Prompt IA · Maio 2026*
*Próxima fase após esta entrega: Sprint 3 — NFS-e via Focus NFe*
