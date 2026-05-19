# 🏭 PROMPT DE KICKOFF — FÁBRICA DE SOFTWARE
## SaaS de Cobranças Recorrentes · Versão 2.0 · Maio 2026

> **Como usar este documento**
> Este prompt foi engenheirado para uso duplo:
> - **Agente de IA (Claude Code, Cursor, Copilot Workspace):** cole a seção `SYSTEM PROMPT` diretamente na janela de contexto do agente antes de iniciar qualquer tarefa.
> - **Equipe humana da fábrica:** use como briefing completo de kickoff. Cada seção é autocontida e referenciável durante o desenvolvimento.
>
> **Autoria:** Engenheiro de Requisitos + Tech Lead + Product Owner + Time Multidisciplinar Sênior  
> **Data de emissão:** Maio 2026  
> **Versão da spec:** `Especificacao_Requisitos_SaaS_Cobrancas_v2.docx`

---

---

# ═══════════════════════════════════════════════════
# SYSTEM PROMPT  ←  COLE AQUI PARA AGENTE DE IA
# ═══════════════════════════════════════════════════

```
Você é um engenheiro full stack sênior especializado em Node.js/TypeScript,
PostgreSQL, Redis, BullMQ e integrações com gateways de pagamento brasileiros.

Você está trabalhando no repositório `cobranca-saas-api` — um SaaS de cobranças
recorrentes multi-tenant (Boleto, PIX, WhatsApp/e-mail) para o mercado brasileiro.
(NFS-e é projeto separado e futuro — não implementar neste repositório.)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRAS ABSOLUTAS — NUNCA VIOLE ESTAS REGRAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. STACK IMUTÁVEL: Node.js 20 LTS + TypeScript 5.7+ + Express 4.x + pg (driver
   raw). NÃO migre para NestJS, Prisma, Fastify ou qualquer outro framework sem
   aprovação explícita do Tech Lead.

2. MULTI-TENANT OBRIGATÓRIO: Toda tabela nova DEVE ter `tenant_id TEXT NOT NULL`.
   Toda query DEVE usar RLS via `SET LOCAL app.tenant_id = ?`. Jamais faça uma
   query sem filtro de tenant.

3. SECRETS NUNCA NO CÓDIGO: Zero secrets hardcoded, zero .env commitado, zero
   token em log. Use process.env. Qualquer violação bloqueia o PR.

4. IDEMPOTÊNCIA: Toda operação de criação de cobrança, envio de webhook e baixa
   manual DEVE suportar Idempotency-Key. ON CONFLICT DO NOTHING no banco.

5. INBOX PATTERN para webhooks: Salvar PRIMEIRO no webhook_inbox (com dedup por
   external_event_id), processar DEPOIS via job BullMQ. Jamais processar webhook
   síncronamente na requisição HTTP.

6. CANONICAL STATUS é imutável para o terminal: `paga` e `cancelada` não
   retrocedem. Qualquer transição fora da máquina de estados dispara exceção.

7. MIGRAÇÕES VERSIONADAS: Todo DDL vai em db/migrations/NNN_descricao.sql.
   Nunca altere schema via ORM automático ou script ad-hoc.

8. AUDIT LOG: Toda mutação em charge, cliente, membership e escritorio_config
   DEVE gerar registro em audit_log com old_value/new_value JSONB.

9. COBERTURA MÍNIMA: application/ e domain/ devem ter ≥ 85% de cobertura.
   PRs que reduzam cobertura abaixo desse limite são rejeitados.

10. FASE 0 É BLOQUEANTE: Não inicie código de negócio (gateway, notificações,
    portal) antes que todos os 8 critérios da Fase 0 estejam verdes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESTADO ATUAL DO REPOSITÓRIO (AS-IS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPLEMENTADO E FUNCIONAL:
  ✅ identity-access   → /v1/auth (JWT login, bcrypt, mock dev)
  ✅ billing-core      → /v1/billing (CRUD cobranças, state machine, idempotência)
  ✅ inbox             → /v1/inbox (webhook queue, dedup, job process-pending)
  ✅ platform/health   → /health e /health/ready (liveness + readiness)

PARCIAL — PRECISA COMPLETAR:
  ⚠  portal-read       → /v1/portal (clientes OK; cobranças parcial)
  ⚠  tenant-provisioning → /v1/tenants (45% cobertura — ponto cego crítico)

AUSENTE — PRECISA CRIAR:
  ❌ payment-gateway   (Asaas adapter — Boleto e PIX)
  ❌ notifications     (Resend e-mail + Z-API WhatsApp)
  ❌ reporting         (relatórios + export CSV)
  ❌ saas-billing      (planos + assinaturas)

FORA DE ESCOPO DESTE PROJETO:
  🚫 nfse / nota fiscal — será implementado em projeto separado (futuro)

PROBLEMAS CRÍTICOS HERDADOS:
  🔴 .env com credenciais reais foi commitado — rotacionar TODOS os secrets
  🔴 schema `automacao` do monolito externo — produto não é autônomo;
     desacoplar (remover dependência) é o primeiro trabalho da Fase 0
  🔴 Sem Dockerfile / docker-compose
  🔴 Sem rate limiting em nenhuma rota
  🔴 provision-public-tenant.ts com 45% de cobertura

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MÁQUINA DE ESTADOS OFICIAL DE COBRANÇA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  rascunho ──→ emitida ──→ enviada ──→ pendente_pagamento ──→ paga (TERMINAL)
     │              │          │               │
     └──→ cancelada  └──→ erro_emissao ──→ emitida (retry)
                    └──→ cancelada      └──→ vencida ──→ cancelada (TERMINAL)

REGRA: Qualquer tentativa de transição inválida lança InvalidStatusTransitionError.
REGRA: Toda transição registra charge_events com old_status, new_status, payload_json.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONVENÇÕES DE CÓDIGO OBRIGATÓRIAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Estrutura de módulo:
    src/modules/{nome}/
      domain/        → tipos, entidades, interfaces puras (sem I/O)
      application/   → casos de uso (testáveis sem banco)
      infrastructure/→ repositórios SQL, adapters externos
      interfaces/http/→ routers Express, middlewares

  Nomenclatura:
    - Arquivos: kebab-case         → create-charge.ts
    - Classes: PascalCase          → CreateChargeUseCase
    - Interfaces: IPascalCase      → IChargeRepository
    - Variáveis/funções: camelCase → createCharge()
    - Tabelas SQL: snake_case      → charge_events
    - Status: snake_case em inglês → canonical_status

  Erros:
    - Lançar erros tipados, nunca string pura
    - Mapear para HTTP no router (domain error → HTTP status)
    - Sempre incluir request_id no envelope de erro

  Testes:
    - Unit: src/modules/{nome}/application/__tests__/
    - Integration: tests/integration/{nome}/
    - Usar Vitest; mocks via vi.fn(); banco real para integração
```

---

---

# ═══════════════════════════════════════════════════
# BRIEFING HUMANO — LEIA ANTES DE ESCREVER QUALQUER CÓDIGO
# ═══════════════════════════════════════════════════

## 1. O QUE ESTAMOS CONSTRUINDO

Um SaaS B2B multi-tenant que resolve cobranças recorrentes para escritórios contábeis, consultorias e prestadores de serviço. O cliente do SaaS (escritório) cadastra seus clientes finais, emite boletos e PIX, e a plataforma cuida de toda a comunicação (régua de cobrança via WhatsApp/e-mail) e confirmação de pagamento (via webhook do gateway).

> **Escopo deste projeto:** Boleto, PIX, régua de cobrança, portal do cliente e relatórios.
> Emissão de NFS-e (nota fiscal) é um projeto separado — **não implementar aqui**.

**Produto final:** API Node.js/Express + React (2 portais) + n8n (orquestração) + PostgreSQL + Redis/BullMQ.

---

## 2. SPRINT 0 — SANEAMENTO (BLOQUEANTE)

> ⛔ **A fábrica NÃO deve escrever código de negócio antes que os 8 itens abaixo estejam 100% verdes. Esta é a condição de entrada para a Sprint 1.**

### TAREFA 0.1 — Remover secrets expostos

```bash
# 1. Remover .env do histórico git
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env' \
  --prune-empty --tag-name-filter cat -- --all

# 2. Adicionar ao .gitignore
echo ".env" >> .gitignore
echo ".env.*" >> .gitignore
echo "!.env.example" >> .gitignore

# 3. Criar .env.example com todos os placeholders
```

**Variáveis que DEVEM ser rotacionadas imediatamente:**
- `JWT_SECRET` → `openssl rand -base64 64`
- `WEBHOOK_INBOX_SECRET` → `openssl rand -hex 32` (atualizar também no Asaas)
- `DATABASE_URL` → nova connection string com nova senha
- Qualquer `API_KEY` de terceiros exposta no zip

**Critério de aceite:** `git log --all -p -- .env` não retorna nenhuma linha com valor real.

---

### TAREFA 0.2 — Desacoplar schema `automacao`

O produto atual depende do schema `automacao` do monolito externo. Isso impede que a API rode de forma autônoma. O objetivo é remover essa dependência.

> **Nota de escopo:** NFS-e / nota fiscal é um projeto separado e futuro.
> A tabela `nfse_emissions` **não deve ser criada** neste repositório.
> A tabela `escritorio_config` é criada apenas com campos de gateway de pagamento
> e comunicação (WhatsApp/e-mail) — sem campos fiscais.

**Criar no schema próprio (migration `013_desacoplamento_monolito.sql`):**

```sql
CREATE TABLE IF NOT EXISTS escritorio_config (
  id                               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                        TEXT NOT NULL UNIQUE,
  razao_social                     TEXT,
  multa_percentual                 NUMERIC(5,2) DEFAULT 2.00,
  juros_percentual                 NUMERIC(5,2) DEFAULT 0.033,

  -- Gateway de pagamento — suporta múltiplos providers
  -- Sub-adquirentes (simples, só API key): asaas | pagarme | cora
  -- Bancos diretos (OAuth2 / credenciais compostas): inter | c6bank
  gateway_provider                 TEXT DEFAULT 'asaas'
                                   CHECK (gateway_provider IN
                                     ('asaas','pagarme','cora','inter','c6bank')),

  -- Credenciais encriptadas como JSONB (estrutura varia por provider):
  --   asaas/pagarme/cora: { "api_key": "..." }
  --   inter:              { "client_id": "...", "client_secret": "...", "cnpj": "..." }
  --   c6bank:             { "api_key": "...", "cnpj": "..." }
  gateway_credentials_encrypted    TEXT,
  gateway_credentials_iv           TEXT,

  -- Comunicação WhatsApp
  whatsapp_provider                TEXT DEFAULT 'zapi',
  whatsapp_token_encrypted         TEXT,
  whatsapp_token_iv                TEXT,
  whatsapp_instance_id             TEXT,
  zapi_client_token_encrypted      TEXT,
  zapi_client_token_iv             TEXT,

  created_at                       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

> **Decisão de arquitetura — credenciais como JSONB encriptado:**
> Cada provider de pagamento tem um esquema de credenciais diferente. Em vez de
> adicionar colunas individuais para cada provider (que geraria dezenas de NULLs),
> usamos um único JSONB encriptado com AES-256-GCM. O campo é opaco no banco
> e só descriptografado no worker/processador no momento do uso.
> Nunca expor o JSONB decriptografado em logs ou respostas de API.

**Critério de aceite:** `GET /health/ready` retorna 200 sem o schema `automacao` disponível.

---

### TAREFA 0.3 — Cobertura do tenant-provisioning (45% → ≥ 85%)

Arquivo crítico: `src/modules/tenant-provisioning/application/provision-public-tenant.ts`

Cenários de teste obrigatórios:
- Provisionar tenant com dados válidos → status=trial, e-mail de boas-vindas enfileirado
- CNPJ duplicado → lança `TenantAlreadyExistsError`
- CNPJ inválido (dígito verificador) → lança `InvalidDocumentError`
- Falha no banco durante provisão → rollback, nenhum tenant criado parcialmente
- Provisão com plano específico → `plano_id` correto vinculado

---

### TAREFA 0.4 — Dockerfile multi-stage + docker-compose

```dockerfile
# Dockerfile (multi-stage)
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM base AS builder
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY db/migrations ./db/migrations
ENV NODE_ENV=production
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s \
  CMD wget -qO- http://localhost:3333/health || exit 1
CMD ["node", "dist/server.js"]
```

```yaml
# docker-compose.yml
version: '3.9'
services:
  api:
    build: .
    ports: ["3333:3333"]
    env_file: .env
    depends_on:
      postgres: { condition: service_healthy }
      redis:    { condition: service_healthy }
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3333/health/ready"]
      interval: 10s
      timeout: 5s
      retries: 5

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: cobranca_saas
      POSTGRES_USER: app
      POSTGRES_PASSWORD: ${DB_PASSWORD:-dev_only}
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d cobranca_saas"]
      interval: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes: [redisdata:/data]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      retries: 10

volumes:
  pgdata:
  redisdata:
```

**Critério de aceite:** `docker-compose up` → `GET /health/ready` retorna `{"status":"ready"}`.

---

### TAREFA 0.5 — Sentry + Observabilidade

```typescript
// src/platform/monitoring/sentry.ts
import * as Sentry from '@sentry/node';

export function initSentry() {
  if (!process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    beforeSend(event) {
      // LGPD: remover dados pessoais dos eventos
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['x-api-key'];
      }
      return event;
    }
  });
}
```

Adicionar ao middleware chain (ANTES de qualquer rota):
```typescript
app.use(Sentry.Handlers.requestHandler());
// ... suas rotas aqui ...
app.use(Sentry.Handlers.errorHandler()); // DEPOIS das rotas
```

---

### TAREFA 0.6 — Rate Limiting (Redis-backed)

```typescript
// src/platform/http/middleware/rate-limit.middleware.ts
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisClient } from '../../persistence/redis';

export const authRateLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) }),
  keyGenerator: (req) => req.ip,
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Muitas tentativas. Tente novamente em 1 minuto.' } }
});

export const webhookRateLimit = rateLimit({
  windowMs: 60_000,
  max: 100,
  store: new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) }),
  keyGenerator: (req) => req.headers['x-tenant-id'] as string ?? req.ip,
});

export const portalRateLimit = rateLimit({
  windowMs: 60_000,
  max: 300,
  store: new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) }),
  keyGenerator: (req) => (req as any).ctx?.userId ?? req.ip,
});
```

Aplicar nas rotas:
```typescript
router.post('/v1/portal/auth/login', authRateLimit, loginHandler);
router.post('/v1/inbox/webhooks',    webhookRateLimit, inboxHandler);
router.use('/v1/portal',             portalRateLimit);
```

---

### TAREFA 0.7 — Tabela audit_log + Middleware de Auditoria

```sql
-- db/migrations/014_audit_log.sql
CREATE TABLE IF NOT EXISTS audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     TEXT NOT NULL,
  user_id       TEXT,
  action        TEXT NOT NULL
                CHECK (action IN ('create','update','delete','cancel','status_change','login','manual_payment')),
  resource_type TEXT NOT NULL,
  resource_id   TEXT NOT NULL,
  old_value     JSONB,
  new_value     JSONB,
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_tenant_resource ON audit_log(tenant_id, resource_type, resource_id);
CREATE INDEX idx_audit_tenant_date     ON audit_log(tenant_id, created_at DESC);
```

```typescript
// src/platform/audit/audit.service.ts
export interface AuditEntry {
  tenantId: string;
  userId?: string;
  action: 'create'|'update'|'delete'|'cancel'|'status_change'|'login'|'manual_payment';
  resourceType: string;
  resourceId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function writeAuditLog(entry: AuditEntry, client: PoolClient): Promise<void> {
  await client.query(
    `INSERT INTO audit_log
     (tenant_id, user_id, action, resource_type, resource_id, old_value, new_value, ip_address, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [entry.tenantId, entry.userId, entry.action, entry.resourceType, entry.resourceId,
     entry.oldValue ? JSON.stringify(entry.oldValue) : null,
     entry.newValue ? JSON.stringify(entry.newValue) : null,
     entry.ipAddress, entry.userAgent]
  );
}
```

Chamar `writeAuditLog` dentro da MESMA transação de banco de toda mutação crítica.

---

### TAREFA 0.8 — Checklist de Validação da Fase 0

Execute este script antes de abrir o PR da Fase 0:

```bash
#!/bin/bash
set -e
echo "=== VALIDAÇÃO FASE 0 ==="

echo "[1/8] Verificando .env no histórico git..."
if git log --all -p -- .env | grep -q "JWT_SECRET=\|DATABASE_URL=\|API_KEY="; then
  echo "FALHOU: secrets encontrados no histórico git"; exit 1
fi; echo "OK"

echo "[2/8] Subindo ambiente Docker..."
docker-compose up -d --wait
sleep 5
STATUS=$(curl -sf http://localhost:3333/health/ready | jq -r '.status')
[ "$STATUS" = "ready" ] || { echo "FALHOU: /health/ready não retornou 'ready'"; exit 1 }; echo "OK"

echo "[3/8] Rodando migrations..."
npm run migrate; echo "OK"

echo "[4/8] Verificando cobertura tenant-provisioning..."
COVERAGE=$(npm run coverage -- --reporter=json 2>/dev/null | \
  node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); \
  const f=Object.keys(d).find(k=>k.includes('provision-public-tenant')); \
  console.log(d[f]?.lines?.pct ?? 0)")
[ $(echo "$COVERAGE >= 85" | bc) -eq 1 ] || \
  { echo "FALHOU: cobertura ${COVERAGE}% < 85%"; exit 1 }; echo "OK ($COVERAGE%)"

echo "[5/8] Verificando mock auth desligado em produção..."
NODE_ENV=production node -e "require('./dist/server')" &
sleep 3
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3334/v1/auth/token/mock)
kill %1
[ "$CODE" = "404" ] || { echo "FALHOU: mock auth ativo em produção (HTTP $CODE)"; exit 1 }; echo "OK"

echo "[6/8] Webhook sem secret retorna 401..."
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3333/v1/inbox/webhooks)
[ "$CODE" = "401" ] || { echo "FALHOU: webhook sem secret retornou $CODE"; exit 1 }; echo "OK"

echo "[7/8] Sentry configurado..."
[ -n "$SENTRY_DSN" ] || { echo "AVISO: SENTRY_DSN não configurado (recomendado)"; }; echo "OK"

echo "[8/8] audit_log existe no banco..."
docker-compose exec postgres psql -U app -d cobranca_saas -c \
  "SELECT COUNT(*) FROM audit_log LIMIT 1;" > /dev/null || \
  { echo "FALHOU: tabela audit_log não existe"; exit 1 }; echo "OK"

echo ""
echo "✅ FASE 0 COMPLETA — A fábrica está autorizada a iniciar a Sprint 1"
docker-compose down
```

---

## 3. SPRINT 1 — GATEWAY DE PAGAMENTO (Fase 1)

> ✅ Só inicia após validação_fase_0.sh retornar verde.

### 3.1 Novo módulo: `payment-gateway`

**Interface do adapter (não violar — permite troca de gateway futura):**

```typescript
// src/modules/payment-gateway/domain/payment-gateway.interface.ts
export interface CreateCustomerInput {
  name: string;
  cpfCnpj: string;
  email: string;
  phone?: string;
  externalReference: string; // portal_cliente_id
}

export interface CreateBoletoInput {
  gatewayCustomerId: string;
  value: number;
  dueDate: string;          // YYYY-MM-DD
  description: string;
  externalReference: string; // idempotency_key
  finePercent?: number;      // default 2
  interestPercent?: number;  // default 0.033
}

export interface BoletoResult {
  gatewayTransactionId: string;
  boletoUrl: string;
  boletoPdfUrl: string;
  barCode: string;
  identificationField: string;
  nossoNumero: string;
  expiresAt: Date;
}

export interface CreatePixInput {
  gatewayCustomerId: string;
  value: number;
  dueDate: string;
  description: string;
  externalReference: string;
}

export interface PixResult {
  gatewayTransactionId: string;
  pixQrcodeBase64: string;
  pixEmv: string;            // payload EMV para copiar e colar
  pixLink: string;
  expiresAt: Date;
}

export interface PaymentGatewayAdapter {
  createCustomer(input: CreateCustomerInput): Promise<string>; // retorna gatewayCustomerId
  createBoleto(input: CreateBoletoInput): Promise<BoletoResult>;
  createPix(input: CreatePixInput): Promise<PixResult>;
  cancelCharge(gatewayTransactionId: string): Promise<void>;
  getCharge(gatewayTransactionId: string): Promise<{ status: string; paidAt?: Date }>;
}
```

**PaymentGatewayFactory — padrão obrigatório:**

O factory é o único ponto de criação de adapters. Nenhum módulo instancia um adapter diretamente.

```typescript
// src/platform/payment-gateway/payment-gateway.factory.ts
import { db } from '@/platform/db';
import { decrypt } from '@/platform/crypto/encrypt';
import { PaymentGatewayAdapter } from './payment-gateway.adapter';
import { AsaasAdapter }  from './adapters/asaas.adapter';
import { PagarmeAdapter } from './adapters/pagarme.adapter';
import { CoraAdapter }   from './adapters/cora.adapter';
import { InterAdapter }  from './adapters/inter.adapter';
import { C6BankAdapter } from './adapters/c6bank.adapter';

type GatewayProvider = 'asaas' | 'pagarme' | 'cora' | 'inter' | 'c6bank';

export async function getGatewayForTenant(tenantId: string): Promise<PaymentGatewayAdapter> {
  const row = await db.query<{
    gateway_provider: GatewayProvider;
    gateway_credentials_encrypted: string;
    gateway_credentials_iv: string;
  }>(
    `SELECT gateway_provider, gateway_credentials_encrypted, gateway_credentials_iv
     FROM escritorio_config
     WHERE tenant_id = $1`,
    [tenantId]
  );

  if (!row.rows[0]) {
    throw new Error(`escritorio_config não encontrado para tenant ${tenantId}`);
  }

  const { gateway_provider, gateway_credentials_encrypted, gateway_credentials_iv } = row.rows[0];

  if (!gateway_credentials_encrypted || !gateway_credentials_iv) {
    throw new Error(`Credenciais de gateway não configuradas para tenant ${tenantId}`);
  }

  // Decrypt: decrypt(encrypted, iv) → plaintext JSON string
  const credentialsJson = decrypt(gateway_credentials_encrypted, gateway_credentials_iv);
  const credentials = JSON.parse(credentialsJson);

  switch (gateway_provider) {
    case 'asaas':
      return new AsaasAdapter({ apiKey: credentials.api_key });
    case 'pagarme':
      return new PagarmeAdapter({ apiKey: credentials.api_key });
    case 'cora':
      return new CoraAdapter({ apiKey: credentials.api_key });
    case 'inter':
      return new InterAdapter({
        clientId: credentials.client_id,
        clientSecret: credentials.client_secret,
        cnpj: credentials.cnpj,
      });
    case 'c6bank':
      return new C6BankAdapter({
        apiKey: credentials.api_key,
        cnpj: credentials.cnpj,
      });
    default:
      throw new Error(`Provider desconhecido: ${gateway_provider satisfies never}`);
  }
}
```

> **Regra:** Todos os workers que emitem cobranças chamam `getGatewayForTenant(tenantId)`
> e recebem o adapter já configurado. O worker não conhece o provider nem as credenciais.
> Nunca faça `new AsaasAdapter(...)` fora do factory.

**Estrutura de credenciais por provider (JSONB pré-encriptação):**
```
asaas / pagarme / cora  →  { "api_key": "..." }
inter                   →  { "client_id": "...", "client_secret": "...", "cnpj": "12345678000199" }
c6bank                  →  { "api_key": "...", "cnpj": "12345678000199" }
```

**AsaasAdapter — mapeamento de status:**
```typescript
const ASAAS_TO_CANONICAL: Record<string, string> = {
  PAYMENT_CONFIRMED: 'paga',
  PAYMENT_RECEIVED:  'paga',
  PAYMENT_OVERDUE:   'vencida',
  PAYMENT_DELETED:   'cancelada',
  PAYMENT_RESTORED:  'emitida',
  PAYMENT_REFUNDED:  'cancelada',
};
```

**URLs Asaas:**
```
Sandbox:  https://sandbox.asaas.com/api/v3
Produção: https://api.asaas.com/api/v3
Header:   access_token: {process.env.ASAAS_API_KEY}
```

### 3.2 Migration — Tabelas da Fase 1

```sql
-- db/migrations/015_payment_gateway_fase1.sql

-- Transações de pagamento (1 por tentativa no gateway)
CREATE TABLE payment_transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             TEXT NOT NULL,
  charge_id             UUID NOT NULL REFERENCES charges(id),
  gateway               TEXT NOT NULL CHECK (gateway IN ('asaas','pagarme','cora','inter','c6bank')),
  gateway_transaction_id TEXT UNIQUE,
  type                  TEXT NOT NULL CHECK (type IN ('boleto','pix')),
  status                TEXT NOT NULL DEFAULT 'pending',
  amount                NUMERIC(14,2) NOT NULL,
  boleto_url            TEXT,
  boleto_pdf_url        TEXT,
  boleto_barcode        TEXT,
  pix_qrcode_base64     TEXT,
  pix_emv               TEXT,
  pix_link              TEXT,
  expires_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_tx_charge    ON payment_transactions(charge_id);
CREATE INDEX idx_payment_tx_tenant    ON payment_transactions(tenant_id);
CREATE INDEX idx_payment_tx_gateway   ON payment_transactions(gateway_transaction_id)
  WHERE gateway_transaction_id IS NOT NULL;

-- Cliente no portal com RLS
CREATE TABLE portal.cliente (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        TEXT NOT NULL,
  documento        TEXT NOT NULL,
  tipo_documento   TEXT NOT NULL CHECK (tipo_documento IN ('cpf','cnpj')),
  nome             TEXT NOT NULL,
  email            TEXT NOT NULL,
  telefone         TEXT,
  opt_in_email     BOOLEAN NOT NULL DEFAULT true,
  opt_in_whatsapp  BOOLEAN NOT NULL DEFAULT false,
  gateway_customer_id TEXT,          -- ID do cliente no gateway (Asaas cus_xxx)
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_portal_cliente_doc UNIQUE (tenant_id, documento)
);
ALTER TABLE portal.cliente ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON portal.cliente
  USING (tenant_id = current_setting('app.tenant_id', true));
```

### 3.3 Jobs BullMQ — Fase 1

**Setup da fila:**
```typescript
// src/platform/jobs/queues.ts
import { Queue, Worker, QueueEvents } from 'bullmq';
import { redisConnection } from '../persistence/redis';

export const paymentEmissionQueue = new Queue('charges:emission', { connection: redisConnection });
export const webhookProcessQueue   = new Queue('inbox:process',   { connection: redisConnection });
export const chargeSyncQueue       = new Queue('charges:sync',    { connection: redisConnection });

// Retry padrão para emissão de cobrança
export const EMISSION_JOB_OPTS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 30_000 },
  removeOnComplete: { count: 100 },
  removeOnFail:     { count: 50 },
};
```

**Worker de emissão:**
```typescript
// src/platform/jobs/workers/payment-emission.worker.ts
// Ao processar o job:
// 1. Buscar charge + escritorio_config do tenant
// 2. Verificar se portal.cliente já tem gateway_customer_id
//    - Se não: AsaasAdapter.createCustomer() → salvar gateway_customer_id
// 3. Chamar AsaasAdapter.createBoleto() ou createPix() conforme charge.type
// 4. Salvar resultado em payment_transactions
// 5. Atualizar charges.canonical_status = 'emitida'
// 6. Registrar em charge_events
// 7. Enfileirar job de notificação
// Em qualquer erro: registrar charge_events com status erro_emissao
```

### 3.4 Fluxo completo de webhook Asaas

```
POST /v1/inbox/webhooks
  ↓ Valida X-Webhook-Secret (401 se inválido)
  ↓ Salva em webhook_inbox com dedup external_event_id (409 se duplicado → retornar 200 silencioso)
  ↓ Enfileira job webhook-process no BullMQ
  ↓ Retorna 202 Accepted imediatamente

Job webhook-process:
  ↓ Busca webhook_inbox pelo id
  ↓ Parseia payload Asaas
  ↓ Mapeia event → canonical_status via ASAAS_TO_CANONICAL
  ↓ Aplica transição na máquina de estados
  ↓ Atualiza charges.canonical_status + charges.paid_at (se paga)
  ↓ Registra charge_events
  ↓ Se paga → enfileira notification-send
  ↓ Se vencida → enfileira régua pós-vencimento
  ↓ Marca webhook_inbox.processed_at = now()
```

### 3.5 Endpoint de detalhe da cobrança — resposta esperada

```typescript
// GET /v1/portal/cobrancas/:id
// Resposta deve incluir payment_transactions para o frontend exibir QR Code:
{
  id: string;
  canonical_status: string;
  amount: number;
  due_date: string;
  description: string;
  payment: {
    type: 'boleto' | 'pix' | null;
    boleto_url?: string;
    boleto_pdf_url?: string;
    boleto_barcode?: string;
    pix_qrcode_base64?: string; // base64 da imagem PNG do QR Code
    pix_emv?: string;           // payload EMV para copiar e colar
    pix_link?: string;
    expires_at?: string;
  } | null;
  events: Array<{
    event_type: string;
    old_status: string;
    new_status: string;
    created_at: string;
  }>;
}
```

---

## 4. CONVENÇÕES DE ENTREGA POR PR

### Checklist obrigatório (copiar para a descrição de todo PR)

```markdown
## PR Checklist

### Código
- [ ] `npm run build` sem erros TypeScript
- [ ] `npm test` sem falhas
- [ ] Cobertura ≥ 85% no escopo application/domain deste PR
- [ ] Sem `console.log` ou `console.error` direto (usar logger estruturado)
- [ ] Sem `any` explícito (exceto adaptadores de terceiros com justificativa)

### Banco
- [ ] Nova migration versionada em db/migrations/NNN_descricao.sql
- [ ] Migration é idempotente (usa IF NOT EXISTS / ON CONFLICT)
- [ ] Migration possui rollback comentado ao final

### Segurança
- [ ] Nenhum secret hardcoded
- [ ] Nenhum dado pessoal (CPF, e-mail, telefone) em logs
- [ ] Rate limiting aplicado em rotas novas que aceitam entrada externa
- [ ] Autenticação e RBAC verificados nas rotas novas

### API
- [ ] Novos endpoints documentados em docs/API_CONTRATO.md
- [ ] Envelope de erro padrão usado: `{ error: { code, message, request_id } }`
- [ ] Idempotency-Key implementado onde aplicável

### Multi-tenant
- [ ] Toda tabela nova tem tenant_id TEXT NOT NULL
- [ ] Toda query filtra por tenant_id
- [ ] Teste cross-tenant (usuário de tenant A não acessa dados do tenant B)

### Auditoria
- [ ] writeAuditLog chamado na mesma transação de toda mutação crítica
```

---

## 5. VARIÁVEIS DE AMBIENTE (.env.example)

```dotenv
# ── OBRIGATÓRIAS (todas as fases) ──────────────────────────
NODE_ENV=development          # production | development | test
PORT=3333
DATABASE_URL=postgres://app:SENHA@localhost:5432/cobranca_saas?sslmode=disable
JWT_SECRET=TROCAR_openssl_rand_base64_64
WEBHOOK_INBOX_SECRET=TROCAR_openssl_rand_hex_32
CORS_ORIGIN=http://localhost:5173

# ── FASE 0 (saneamento) ────────────────────────────────────
SENTRY_DSN=                   # recomendado; deixar vazio para desabilitar
PG_POOL_MAX=20

# ── FASE 1 (gateway de pagamento) ─────────────────────────
REDIS_URL=redis://localhost:6379
ENCRYPTION_KEY=TROCAR_32_bytes_hex_para_AES256GCM
ASAAS_API_KEY=TROCAR_sua_asaas_api_key
ASAAS_API_URL=https://sandbox.asaas.com/api/v3

# ── FASE 2 (notificações) ──────────────────────────────────
RESEND_API_KEY=TROCAR_resend_api_key
ZAPI_INSTANCE=TROCAR_zapi_instance_id
ZAPI_TOKEN=TROCAR_zapi_token

# ── APENAS DEV/STAGING CONTROLADO ─────────────────────────
ENABLE_MOCK_AUTH=false        # NUNCA true em produção
ALLOW_INSECURE_DATABASE_URL=1 # NUNCA 1 em produção
```

---

## 6. CONTATOS E REFERÊNCIAS

| Papel | Responsabilidade | Ponto de contato |
|-------|-----------------|------------------|
| Tech Lead | Aprovação de arquitetura, decisões de stack | Consultar antes de qualquer alteração estrutural |
| Product Owner | Priorização, escopo, critérios de aceite | Consultar antes de marcar história como concluída |
| QA Sênior | Revisão de testes, cobertura, smoke tests | Aprovar PR antes do merge em main |

### Documentação de referência

| Recurso | URL |
|---------|-----|
| Especificação completa (docx) | `Especificacao_Requisitos_SaaS_Cobrancas_v2.docx` |
| Asaas API v3 | https://docs.asaas.com |
| PIX BACEN | https://bacen.github.io/pix-api |
| Resend | https://resend.com/docs |
| BullMQ | https://docs.bullmq.io |
| Shadcn/ui | https://ui.shadcn.com |
| LGPD | https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm |

---

## 7. ORDEM DE EXECUÇÃO RECOMENDADA PARA DIA 1

```
HORA 1-2 │ Clone do repositório + leitura deste prompt + leitura da spec v2
HORA 2-3 │ TAREFA 0.1: Remover .env, rotacionar secrets, .gitignore
HORA 3-5 │ TAREFA 0.4: Dockerfile + docker-compose (ambiente sobe local)
HORA 5-6 │ TAREFA 0.2: Migration 013 (desacoplar schema automacao)
DIA 2    │ TAREFA 0.3: Testes do tenant-provisioning (até ≥ 85%)
DIA 3    │ TAREFA 0.5: Sentry + TAREFA 0.6: Rate limiting
DIA 4    │ TAREFA 0.7: audit_log + middleware de auditoria
DIA 5    │ Rodar validacao_fase_0.sh → abrir PR da Fase 0 → code review
DIA 6+   │ ✅ Fase 0 verde → iniciar Sprint 1 (payment-gateway)
```

---

> **Nota final do Engenheiro de Requisitos**
>
> Este prompt foi construído para eliminar ambiguidade. Cada decisão aqui — de stack, de schema, de fluxo, de naming — foi tomada deliberadamente com base na análise do código existente, na visão de produto e nas restrições operacionais do negócio brasileiro (FEBRABAN, BACEN, LGPD).
>
> A fábrica tem autonomia para implementar **como** quer resolver cada tarefa dentro das restrições declaradas. Não tem autonomia para mudar **o que** está sendo construído nem as **regras absolutas** da Seção 2 sem aprovação formal.
>
> Dúvidas? Abra uma issue no repositório com a tag `[REQUISITO]` descrevendo o ponto de ambiguidade. Não assuma — pergunte.

---
*Versão do prompt: 1.0 | Gerado em: Maio 2026 | Válido para: Fases 0 e 1*
