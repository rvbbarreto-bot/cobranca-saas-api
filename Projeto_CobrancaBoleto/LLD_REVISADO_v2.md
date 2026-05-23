# LLD REVISADO — v2.0.0
## Motor de Faturamento Recorrente · Gateway Universal Parametrizado · Anti-Spam · Faturamento em Lote

**Status:** Pronto para Discussão Técnica / Aprovação  
**Versão:** 2.0.0 (Maio 2026)  
**Baseado em:** LLD v1.0.0 (Tech Lead) × Código implementado Sprints A–J  
**Emitido por:** Time Multidisciplinar Sênior — PO · Arquiteto · Analista de Requisitos  
**Repositório:** `cobranca-saas-api` · branch `main` (Sprint I #16 consolidado)

---

## SUMÁRIO EXECUTIVO

Este documento é a síntese da análise cruzada entre o LLD v1.0.0 proposto pelo Tech Lead e a arquitetura já implementada no repositório. Ele não substitui o LLD original — ele o **evolui**, resolve os conflitos identificados e incorpora a decisão estratégica mais importante da revisão: o **Gateway Universal Parametrizado**, que elimina o hardcode de bancos específicos e permite que qualquer tenant configure e troque seu gateway de pagamento a qualquer momento, sem deploy.

Três decisões centrais guiam este documento:

1. **Manter e evoluir** o que já existe — nenhuma tabela ou estado implementado será removido.
2. **Gateway totalmente parametrizado** — o sistema não conhece bancos específicos em tempo de compilação; conhece apenas um contrato de adapter e um registry de providers configurável.
3. **Discardado por não agregar:** a proposta de nova tabela `tenant_gateway_configs` (duplica `escritorio_config`), os enums em uppercase (quebram convenção e dados existentes), e a sintaxe Prisma/axios nos exemplos de código.

---

## PARTE 1 — ANÁLISE DE CONFLITOS E DECISÕES

### 1.1 Tabela de Decisões por Conflito

| # | Conflito Identificado | Origem | Decisão | Justificativa |
|---|----------------------|--------|---------|---------------|
| C1 | LLD propõe `tenant_gateway_configs` (tabela nova) | LLD v1 | **Descartar** | `escritorio_config` já existe em produção com JSONB criptografado. Criar segunda tabela fragmenta responsabilidade sem ganho. |
| C2 | Enums em uppercase (`ASAAS`, `BANCO_INTER`) | LLD v1 | **Descartar** | Sistema usa lowercase snake_case em todas as tabelas e código. Mudança causaria migration destrutiva em dados existentes. |
| C3 | Colunas individuais por credencial (`client_id`, `agencia`, `convenio`) | LLD v1 | **Descartar** | JSONB criptografado é superior: schema flexível por provider sem adicionar colunas a cada novo banco. Já implementado. |
| C4 | Estado `ESTORNADA` em uppercase | LLD v1 | **Adaptar** | Conceito válido. Implementar como `estornada` (lowercase), adicionado como extensão da máquina existente, sem remover estados atuais. |
| C5 | LLD remove estados `enviada`, `pendente_pagamento`, `vencida`, `erro_emissao` | LLD v1 | **Descartar** | Esses estados existem em registros reais no banco. Remoção é breaking change crítico. |
| C6 | Exemplos de código com `axios` | LLD v1 | **Descartar** | Projeto usa `fetch` nativo (Node 20). Mistura de bibliotecas HTTP não aprovada. |
| C7 | Sintaxe Prisma nos exemplos (`db.table.update({where...})`) | LLD v1 | **Descartar** | Projeto usa pg raw SQL. Violação da regra absoluta de stack imutável. |
| C8 | Tabela `tenant_notification_settings` sem CREATE TABLE | LLD v1 | **Completar** | Conceito aprovado. Tabela precisa de migration completa (não apenas ALTER). |
| C9 | `IBoletoRequest` com `endereco` não mapeado | LLD v1 | **Incorporar** | Adição válida. Alguns providers exigem endereço do sacado. Adicionar à interface existente como campo opcional. |

### 1.2 O que o LLD v1 Acerta e Mantemos

- ✅ Padrão Abstract Factory para gateways (já implementado, expandir)
- ✅ Jitter randômico anti-spam no WhatsApp (conceito correto, código a corrigir)
- ✅ Janela de disparo configurável 07h–20h (LGPD + boa prática)
- ✅ Cron dia 25 para faturamento em lote recorrente (novo épico, aprovado)
- ✅ Estado `estornada` como terminal após `paga` (extensão válida)
- ✅ Soft delete obrigatório — sem `DELETE` físico em cobranças emitidas
- ✅ Certificados mTLS do Banco Inter em memória, nunca em disco

---

## PARTE 2 — GATEWAY UNIVERSAL PARAMETRIZADO

### 2.1 Decisão Arquitetural Central

O sistema **não deve conhecer bancos específicos em tempo de compilação** além do contrato de interface. O que muda por provider é: como autenticar, quais campos de credencial são necessários, e qual adapter implementa o contrato. Isso é resolvido com um **Provider Registry** — um catálogo de metadados consultado em runtime.

**Benefício direto para o cliente:** o escritório pode entrar no portal de configurações, selecionar "Banco Inter", preencher os campos que o sistema apresenta dinamicamente para aquele banco, salvar e o próximo boleto já será emitido pelo Inter — sem nenhum deploy, sem contato com suporte técnico.

### 2.2 Provider Registry — Estrutura de Metadados

O registry é um arquivo TypeScript versionado no repositório que define, para cada provider suportado, quais campos de credencial ele requer e como esses campos devem ser apresentados na UI.

```typescript
// src/platform/payment-gateway/provider-registry.ts

export type AuthScheme = 'api_key' | 'oauth2_client_credentials' | 'mtls_oauth2' | 'api_key_plus_account';

export interface CredentialFieldDefinition {
  key: string;          // nome da chave no JSONB encriptado
  label: string;        // label exibido no portal
  type: 'text' | 'password' | 'textarea' | 'select';
  required: boolean;
  hint?: string;        // texto de ajuda para o usuário
  mask?: string;        // ex: '****-****' para formatação visual
}

export interface GatewayProviderMeta {
  provider: string;               // chave interna lowercase: 'asaas', 'inter', 'bb', etc.
  label: string;                  // nome exibido: 'Asaas', 'Banco Inter', etc.
  authScheme: AuthScheme;
  supportsPixHybrid: boolean;     // boleto com QR Code embutido
  supportsMtls: boolean;          // requer certificado digital
  sandboxBaseUrl: string;
  productionBaseUrl: string;
  credentialFields: CredentialFieldDefinition[];
  docUrl?: string;                // link para documentação da API do banco
}

export const GATEWAY_REGISTRY: GatewayProviderMeta[] = [
  {
    provider: 'asaas',
    label: 'Asaas',
    authScheme: 'api_key',
    supportsPixHybrid: true,
    supportsMtls: false,
    sandboxBaseUrl: 'https://sandbox.asaas.com/api/v3',
    productionBaseUrl: 'https://api.asaas.com/api/v3',
    credentialFields: [
      { key: 'api_key', label: 'Chave de API', type: 'password', required: true,
        hint: 'Encontrada em Configurações → Integrações no painel Asaas' }
    ]
  },
  {
    provider: 'inter',
    label: 'Banco Inter Empresas',
    authScheme: 'mtls_oauth2',
    supportsPixHybrid: true,
    supportsMtls: true,
    sandboxBaseUrl: 'https://cdpj-sandbox.partners.uatinter.co',
    productionBaseUrl: 'https://cdpj.partners.inter.co',
    credentialFields: [
      { key: 'client_id',     label: 'Client ID',       type: 'text',     required: true },
      { key: 'client_secret', label: 'Client Secret',   type: 'password', required: true },
      { key: 'cnpj',          label: 'CNPJ da empresa', type: 'text',     required: true, mask: '00.000.000/0000-00' },
      { key: 'cert_crt',      label: 'Certificado .crt (conteúdo PEM)', type: 'textarea', required: true,
        hint: 'Cole o conteúdo do arquivo .crt gerado no portal Inter' },
      { key: 'cert_key',      label: 'Chave privada .key (conteúdo PEM)', type: 'textarea', required: true,
        hint: 'Cole o conteúdo do arquivo .key. Nunca compartilhe este valor.' }
    ]
  },
  {
    provider: 'c6bank',
    label: 'C6 Bank Empresas',
    authScheme: 'oauth2_client_credentials',
    supportsPixHybrid: false,
    supportsMtls: false,
    sandboxBaseUrl: 'https://sandbox.c6bank.com.br',
    productionBaseUrl: 'https://api.c6bank.com.br',
    credentialFields: [
      { key: 'client_id',     label: 'Client ID',     type: 'text',     required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
      { key: 'cnpj',          label: 'CNPJ da empresa', type: 'text',   required: true }
    ]
  },
  {
    provider: 'bb',
    label: 'Banco do Brasil',
    authScheme: 'api_key_plus_account',
    supportsPixHybrid: true,
    supportsMtls: false,
    sandboxBaseUrl: 'https://api.hm.bb.com.br/cobrancas/v2',
    productionBaseUrl: 'https://api.bb.com.br/cobrancas/v2',
    credentialFields: [
      { key: 'client_id',       label: 'Client ID',          type: 'text',     required: true },
      { key: 'client_secret',   label: 'Client Secret',      type: 'password', required: true },
      { key: 'gw_app_key',      label: 'Developer App Key',  type: 'password', required: true,
        hint: 'Chave gerada no Portal Developers do Banco do Brasil' },
      { key: 'agencia',         label: 'Agência (sem dígito)', type: 'text',   required: true },
      { key: 'conta_corrente',  label: 'Conta Corrente',     type: 'text',     required: true },
      { key: 'convenio',        label: 'Número do Convênio', type: 'text',     required: true },
      { key: 'variacao_carteira', label: 'Variação da Carteira', type: 'text', required: true }
    ]
  },
  {
    provider: 'cora',
    label: 'Cora',
    authScheme: 'mtls_oauth2',
    supportsPixHybrid: true,
    supportsMtls: true,
    sandboxBaseUrl: 'https://matls-clients.sandbox.cora.com.br',
    productionBaseUrl: 'https://matls-clients.cora.com.br',
    credentialFields: [
      { key: 'client_id',  label: 'Client ID',  type: 'text',     required: true },
      { key: 'cert_crt',   label: 'Certificado .crt (PEM)', type: 'textarea', required: true },
      { key: 'cert_key',   label: 'Chave privada .key (PEM)', type: 'textarea', required: true }
    ]
  },
  {
    provider: 'pagarme',
    label: 'Pagar.me',
    authScheme: 'api_key',
    supportsPixHybrid: true,
    supportsMtls: false,
    sandboxBaseUrl: 'https://sandbox.pagar.me/core/v5',
    productionBaseUrl: 'https://api.pagar.me/core/v5',
    credentialFields: [
      { key: 'api_key', label: 'Secret Key', type: 'password', required: true,
        hint: 'Encontrada no Dashboard Pagar.me → Configurações → Chaves de API' }
    ]
  }
  // Novos providers: adicionar aqui + implementar adapter.
  // Nenhuma alteração de banco ou factory é necessária.
];

export function getProviderMeta(provider: string): GatewayProviderMeta {
  const meta = GATEWAY_REGISTRY.find(p => p.provider === provider);
  if (!meta) throw new Error(`Provider '${provider}' não registrado no GATEWAY_REGISTRY`);
  return meta;
}

export function listAvailableProviders(): Pick<GatewayProviderMeta, 'provider' | 'label' | 'authScheme' | 'supportsPixHybrid'>[] {
  return GATEWAY_REGISTRY.map(({ provider, label, authScheme, supportsPixHybrid }) =>
    ({ provider, label, authScheme, supportsPixHybrid })
  );
}
```

### 2.3 Interface Universal de Adapter (Contrato Imutável)

A interface já existe no projeto. Adicionamos `endereco` como campo opcional (válido para BB e Inter) e `estorno`.

```typescript
// src/platform/payment-gateway/payment-gateway.interface.ts

export interface CreateCustomerInput {
  name: string;
  cpfCnpj: string;
  email: string;
  phone?: string;
  externalReference: string;
  endereco?: {               // NOVO — obrigatório apenas para BB e Inter
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
  };
}

export interface CreateBoletoInput {
  gatewayCustomerId: string;
  value: number;
  dueDate: string;
  description: string;
  externalReference: string;
  finePercent?: number;
  interestPercent?: number;
  // Campos adicionais usados por BB e Inter:
  agencia?: string;
  contaCorrente?: string;
  convenio?: string;
  variacaoCarteira?: string;
}

export interface BoletoResult {
  gatewayTransactionId: string;
  boletoUrl: string;
  boletoPdfUrl?: string;
  barCode: string;
  identificationField: string;
  nossoNumero?: string;
  expiresAt: Date;
  pixQrcodeBase64?: string;  // boleto híbrido (quando suportado)
  pixEmv?: string;
}

export interface EstornoResult {           // NOVO
  success: boolean;
  gatewayEstornoId?: string;
  estimatedRefundDate?: Date;
}

export interface PaymentGatewayAdapter {
  createCustomer(input: CreateCustomerInput): Promise<string>;
  createBoleto(input: CreateBoletoInput): Promise<BoletoResult>;
  createPix(input: CreatePixInput): Promise<PixResult>;
  cancelCharge(gatewayTransactionId: string): Promise<void>;
  getCharge(gatewayTransactionId: string): Promise<{ status: string; paidAt?: Date }>;
  estornarCobranca?(gatewayTransactionId: string, motivo: string): Promise<EstornoResult>; // opcional — nem todo banco suporta
}
```

### 2.4 Factory Parametrizado — Carregamento Dinâmico por Registry

```typescript
// src/platform/payment-gateway/payment-gateway.factory.ts

import { db } from '@/platform/db';
import { decrypt } from '@/platform/crypto/decrypt';
import { getProviderMeta } from './provider-registry';
import type { PaymentGatewayAdapter } from './payment-gateway.interface';

// Importação dinâmica — cada adapter é carregado apenas quando necessário
const ADAPTER_LOADERS: Record<string, () => Promise<{ default: new (credentials: any, meta: any) => PaymentGatewayAdapter }>> = {
  asaas:   () => import('./adapters/asaas.adapter'),
  inter:   () => import('./adapters/inter.adapter'),
  c6bank:  () => import('./adapters/c6bank.adapter'),
  bb:      () => import('./adapters/bb.adapter'),
  cora:    () => import('./adapters/cora.adapter'),
  pagarme: () => import('./adapters/pagarme.adapter'),
};

export async function getGatewayForTenant(tenantId: string): Promise<PaymentGatewayAdapter> {
  const { rows } = await db.query<{
    gateway_provider: string;
    gateway_credentials_encrypted: string;
    gateway_credentials_iv: string;
  }>(
    `SELECT gateway_provider, gateway_credentials_encrypted, gateway_credentials_iv
     FROM escritorio_config WHERE tenant_id = $1`,
    [tenantId]
  );

  const config = rows[0];
  if (!config) throw new GatewayNotConfiguredError(tenantId);
  if (!config.gateway_credentials_encrypted) throw new GatewayCredentialsMissingError(tenantId);

  const provider = config.gateway_provider;
  const meta = getProviderMeta(provider);  // valida que o provider existe no registry

  const credentialsJson = decrypt(config.gateway_credentials_encrypted, config.gateway_credentials_iv);
  const credentials = JSON.parse(credentialsJson);

  const loaderFn = ADAPTER_LOADERS[provider];
  if (!loaderFn) throw new Error(`Loader não registrado para provider '${provider}'. Adicione em ADAPTER_LOADERS.`);

  const { default: AdapterClass } = await loaderFn();
  return new AdapterClass(credentials, meta);
}

// Para uso no portal: retorna lista de providers disponíveis sem instanciar adapters
export { listAvailableProviders, getProviderMeta } from './provider-registry';
```

> **Regra de extensão:** Para adicionar um novo banco, o desenvolvedor faz dois passos:
> 1. Adiciona o provider no `GATEWAY_REGISTRY` (provider-registry.ts)
> 2. Implementa o adapter em `adapters/{provider}.adapter.ts`
>
> Nenhuma alteração em factory, banco de dados, migration ou portal é necessária.
> O portal lê o registry via endpoint e renderiza o formulário dinamicamente.

### 2.5 Endpoint do Portal — Formulário Dinâmico de Configuração

```
GET /v1/portal/escritorio/gateway/providers
→ Retorna listAvailableProviders() para popular o <select> no frontend

GET /v1/portal/escritorio/gateway/providers/:provider/schema
→ Retorna credentialFields[] para renderizar o formulário dinamicamente

PATCH /v1/portal/escritorio/config
Body: { gateway_provider: 'inter', gateway_credentials: { client_id, client_secret, cnpj, cert_crt, cert_key } }
→ Valida campos obrigatórios conforme credentialFields do provider
→ Criptografa o JSONB completo
→ Salva em escritorio_config.gateway_credentials_encrypted
```

### 2.6 Token Cache para Providers OAuth2

Para providers que usam OAuth2 (C6 Bank, BB, Inter), o token de acesso tem validade limitada. Reemitir token a cada boleto é ineficiente e pode gerar rate-limit. O cache deve ser no Redis com TTL seguro.

```typescript
// src/platform/payment-gateway/oauth-token-cache.ts

const TOKEN_CACHE_KEY = (tenantId: string, provider: string) =>
  `gw_token:${provider}:${tenantId}`;

export async function getCachedToken(tenantId: string, provider: string): Promise<string | null> {
  return redis.get(TOKEN_CACHE_KEY(tenantId, provider));
}

export async function setCachedToken(
  tenantId: string,
  provider: string,
  token: string,
  expiresInSeconds: number
): Promise<void> {
  // TTL com 60s de margem de segurança
  await redis.set(TOKEN_CACHE_KEY(tenantId, provider), token, 'EX', expiresInSeconds - 60);
}
```

### 2.7 Certificados mTLS — Banco Inter e Cora

Para providers que exigem mTLS, o certificado fica criptografado no JSONB das credenciais e é carregado **em memória** durante o handshake. Nunca é escrito em arquivo temporário.

```typescript
// Dentro do InterAdapter / CoraAdapter
import https from 'https';

async function buildMtlsAgent(credentials: { cert_crt: string; cert_key: string }) {
  // Usa PEM diretamente em memória — sem escrita em disco
  return new https.Agent({
    cert: credentials.cert_crt,  // string PEM descriptografada
    key:  credentials.cert_key,
    rejectUnauthorized: true,
  });
}

// Uso no adapter:
const agent = await buildMtlsAgent(credentials);
const response = await fetch(url, { ...options, dispatcher: new Agent({ connect: { cert, key } }) });
// OU via https.request com o agente acima
```

### 2.8 Migration de Extensão — `escritorio_config`

A tabela `escritorio_config` já existe. Esta migration a estende para suportar a nova coluna de modo do gateway e mantém total retrocompatibilidade.

```sql
-- db/migrations/025_gateway_universal_parametrizado.sql

-- Adiciona coluna para indicar se as credenciais foram validadas
ALTER TABLE escritorio_config
  ADD COLUMN IF NOT EXISTS gateway_validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gateway_validation_error TEXT;

-- Expande o CHECK para incluir novos providers
-- Estratégia: remover a constraint antiga e recriar com valores estendidos
ALTER TABLE escritorio_config
  DROP CONSTRAINT IF EXISTS escritorio_config_gateway_provider_check;

ALTER TABLE escritorio_config
  ADD CONSTRAINT escritorio_config_gateway_provider_check
  CHECK (gateway_provider IN ('asaas', 'pagarme', 'cora', 'inter', 'c6bank', 'bb'));

-- Tabela de audit de trocas de gateway (rastreabilidade)
CREATE TABLE IF NOT EXISTS gateway_change_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL,
  old_provider TEXT,
  new_provider TEXT NOT NULL,
  changed_by  TEXT,          -- user_id do admin que fez a troca
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address  TEXT
);
CREATE INDEX IF NOT EXISTS idx_gateway_change_tenant ON gateway_change_log(tenant_id, changed_at DESC);

-- ROLLBACK:
-- ALTER TABLE escritorio_config DROP COLUMN IF EXISTS gateway_validated_at;
-- ALTER TABLE escritorio_config DROP COLUMN IF EXISTS gateway_validation_error;
-- DROP TABLE IF EXISTS gateway_change_log;
```

---

## PARTE 3 — ANTI-SPAM WHATSAPP (MÓDULO CORRIGIDO)

### 3.1 Migration Completa — `tenant_notification_settings`

O LLD v1 propunha `ALTER TABLE` numa tabela inexistente. A migration correta é:

```sql
-- db/migrations/026_tenant_notification_settings.sql

CREATE TABLE IF NOT EXISTS tenant_notification_settings (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                       TEXT NOT NULL UNIQUE,

  -- Configurações anti-spam WhatsApp
  whatsapp_min_delay_seconds      INT  NOT NULL DEFAULT 15
                                       CHECK (whatsapp_min_delay_seconds >= 5),
  whatsapp_max_delay_seconds      INT  NOT NULL DEFAULT 45
                                       CHECK (whatsapp_max_delay_seconds <= 120),
  whatsapp_concurrency            INT  NOT NULL DEFAULT 1
                                       CHECK (whatsapp_concurrency BETWEEN 1 AND 3),

  -- Janela de disparo (horário permitido)
  daily_window_start              TIME NOT NULL DEFAULT '07:00:00',
  daily_window_end                TIME NOT NULL DEFAULT '20:00:00',

  -- Comportamento fora da janela
  -- 'delay'   → reagenda para o início da próxima janela
  -- 'discard' → descarta (usar apenas para lembretes de vencimento que perderam a data)
  out_of_window_behavior          TEXT NOT NULL DEFAULT 'delay'
                                       CHECK (out_of_window_behavior IN ('delay', 'discard')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_notif_settings_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Seed: inserir configuração padrão para todos os tenants existentes
INSERT INTO tenant_notification_settings (tenant_id)
SELECT id FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- ROLLBACK:
-- DROP TABLE IF EXISTS tenant_notification_settings;
```

### 3.2 Worker Corrigido — Jitter + Janela Horária + Retry

O worker `notification-send` já existe no projeto. O código abaixo é a extensão correta, seguindo as convenções do projeto (fetch nativo, SQL raw, sem Prisma, sem axios):

```typescript
// Extensão de: src/platform/jobs/workers/notification-send.worker.ts
// Adicionar ANTES da chamada HTTP ao Z-API

import { db } from '@/platform/db';
import { logger } from '@/platform/logger';

interface NotificationSettings {
  whatsappMinDelaySeconds: number;
  whatsappMaxDelaySeconds: number;
  dailyWindowStart: string;  // 'HH:MM:SS'
  dailyWindowEnd: string;
  outOfWindowBehavior: 'delay' | 'discard';
}

async function getNotificationSettings(tenantId: string): Promise<NotificationSettings> {
  const { rows } = await db.query<{
    whatsapp_min_delay_seconds: number;
    whatsapp_max_delay_seconds: number;
    daily_window_start: string;
    daily_window_end: string;
    out_of_window_behavior: 'delay' | 'discard';
  }>(
    `SELECT whatsapp_min_delay_seconds, whatsapp_max_delay_seconds,
            daily_window_start, daily_window_end, out_of_window_behavior
     FROM tenant_notification_settings
     WHERE tenant_id = $1`,
    [tenantId]
  );

  // Fallback para defaults caso o tenant não tenha settings (migração parcial)
  const row = rows[0];
  return {
    whatsappMinDelaySeconds: row?.whatsapp_min_delay_seconds ?? 15,
    whatsappMaxDelaySeconds: row?.whatsapp_max_delay_seconds ?? 45,
    dailyWindowStart: row?.daily_window_start ?? '07:00:00',
    dailyWindowEnd:   row?.daily_window_end   ?? '20:00:00',
    outOfWindowBehavior: row?.out_of_window_behavior ?? 'delay',
  };
}

function isWithinWindow(windowStart: string, windowEnd: string): boolean {
  const now = new Date();
  const [sh, sm] = windowStart.split(':').map(Number);
  const [eh, em] = windowEnd.split(':').map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes   = sh * 60 + sm;
  const endMinutes     = eh * 60 + em;
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

function msUntilNextWindowOpen(windowStart: string): number {
  const now = new Date();
  const [sh, sm] = windowStart.split(':').map(Number);
  const openToday = new Date(now);
  openToday.setHours(sh, sm, 0, 0);
  if (openToday > now) return openToday.getTime() - now.getTime();
  // Próxima abertura é amanhã
  openToday.setDate(openToday.getDate() + 1);
  return openToday.getTime() - now.getTime();
}

// Função principal a chamar no worker antes do envio Z-API:
export async function applyWhatsAppThrottle(tenantId: string): Promise<'proceed' | 'discard'> {
  const settings = await getNotificationSettings(tenantId);

  if (!isWithinWindow(settings.dailyWindowStart, settings.dailyWindowEnd)) {
    if (settings.outOfWindowBehavior === 'discard') {
      logger.warn({ tenantId }, 'WhatsApp fora da janela — descartando job (comportamento: discard)');
      return 'discard';
    }
    const msToWait = msUntilNextWindowOpen(settings.dailyWindowStart);
    logger.info({ tenantId, msToWait }, 'WhatsApp fora da janela — aguardando abertura');
    await new Promise(resolve => setTimeout(resolve, msToWait));
  }

  // Jitter randômico dentro da janela
  const minMs = settings.whatsappMinDelaySeconds * 1000;
  const maxMs = settings.whatsappMaxDelaySeconds * 1000;
  const jitter = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  logger.debug({ tenantId, jitter }, 'WhatsApp jitter aplicado');
  await new Promise(resolve => setTimeout(resolve, jitter));

  return 'proceed';
}

// No worker, uso:
// const action = await applyWhatsAppThrottle(tenantId);
// if (action === 'discard') return; // job concluído sem envio
// await sendZApiMessage(...);
```

### 3.3 Alerta de Instância Desconectada

O LLD v1 detecta erro 405 do Z-API (instância offline). Implementar via `tenant_alerts` (tabela a criar junto com este módulo ou como campo em `escritorio_config`):

```sql
-- Adicionar à migration 026 ou criar migration 027:
CREATE TABLE IF NOT EXISTS tenant_alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL,
  code        TEXT NOT NULL,   -- ex: 'ZAPI_INSTANCE_OFFLINE', 'GATEWAY_CREDENTIAL_INVALID'
  message     TEXT NOT NULL,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alerts_tenant ON tenant_alerts(tenant_id, resolved_at NULLS FIRST);
```

---

## PARTE 4 — MÁQUINA DE ESTADOS ESTENDIDA

### 4.1 Decisão

A máquina de estados existente **não é alterada**. O estado `estornada` é adicionado como novo terminal após `paga`. Todos os estados atuais permanecem.

### 4.2 Máquina Completa (Existente + Extensão)

```
rascunho ──→ emitida ──→ enviada ──→ pendente_pagamento ──→ paga ──→ estornada (NOVO TERMINAL)
   │              │           │               │               │
   └──→ cancelada └──→ erro_emissao       cancelada       [imutável
                  └──→ cancelada      └──→ vencida          exceto
                                           │               estorno]
                                       cancelada
```

### 4.3 Regras do Estado `estornada`

- Única transição permitida: `paga → estornada`
- Requer: `justificativa` (texto obrigatório, mínimo 20 caracteres), `user_id` do admin, registro em `audit_log` e em `charge_events`
- Nem todo gateway suporta estorno via API. O adapter implementa `estornarCobranca?()` como método opcional. Se não implementado, o sistema registra o estorno apenas internamente (marcação manual) e orienta o operador a realizar o estorno direto no painel do gateway.
- `DELETE` físico de cobranças em qualquer status é bloqueado por trigger no banco.

### 4.4 Migration — Estado `estornada` + Trigger Anti-Delete

```sql
-- db/migrations/028_estado_estornada_soft_delete.sql

-- 1. Expandir o CHECK de canonical_status (se existir constraint)
ALTER TABLE charges
  DROP CONSTRAINT IF EXISTS charges_canonical_status_check;
ALTER TABLE charges
  ADD CONSTRAINT charges_canonical_status_check
  CHECK (canonical_status IN (
    'rascunho', 'emitida', 'enviada', 'pendente_pagamento',
    'paga', 'cancelada', 'vencida', 'erro_emissao', 'estornada'
  ));

-- 2. Trigger que bloqueia DELETE físico em cobranças emitidas
CREATE OR REPLACE FUNCTION prevent_charge_hard_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.canonical_status NOT IN ('rascunho') THEN
    RAISE EXCEPTION 'Exclusão física de cobrança não permitida. Use cancelada ou estornada. (charge_id: %)', OLD.id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_charge_delete ON charges;
CREATE TRIGGER trg_prevent_charge_delete
  BEFORE DELETE ON charges
  FOR EACH ROW EXECUTE FUNCTION prevent_charge_hard_delete();

-- 3. Coluna para justificativa de estorno
ALTER TABLE charges
  ADD COLUMN IF NOT EXISTS estorno_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS estornada_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS estornada_by TEXT; -- user_id

-- ROLLBACK:
-- DROP TRIGGER IF EXISTS trg_prevent_charge_delete ON charges;
-- DROP FUNCTION IF EXISTS prevent_charge_hard_delete();
-- ALTER TABLE charges DROP COLUMN IF EXISTS estorno_justificativa, DROP COLUMN IF EXISTS estornada_at, DROP COLUMN IF EXISTS estornada_by;
```

---

## PARTE 5 — FATURAMENTO EM LOTE (ÉPICO)

### 5.1 Definição do Épico

Esta funcionalidade elimina a digitação manual de cobranças mensais para carteiras recorrentes. É o maior ganho de produtividade para os escritórios com clientes fixos.

**Entidade central: Contrato Recorrente**

Um contrato define: qual cliente, qual valor, qual periodicidade (mensal, bimestral, etc.), qual dia de vencimento, qual canal de emissão (Boleto ou PIX), e por quanto tempo é válido. A partir do contrato, o sistema gera cobranças automaticamente.

### 5.2 Migration — `contratos_recorrentes` e `lotes_faturamento`

```sql
-- db/migrations/029_contratos_e_lotes.sql

-- Contrato: define o que gerar automaticamente
CREATE TABLE IF NOT EXISTS contratos_recorrentes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           TEXT NOT NULL,
  cliente_id          UUID NOT NULL,        -- referência ao portal.cliente
  descricao           TEXT NOT NULL,
  valor               NUMERIC(14,2) NOT NULL CHECK (valor > 0),
  tipo_emissao        TEXT NOT NULL CHECK (tipo_emissao IN ('boleto', 'pix')),
  periodicidade       TEXT NOT NULL CHECK (periodicidade IN ('mensal', 'bimestral', 'trimestral', 'semestral', 'anual')),
  dia_vencimento      INT  NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 28), -- máx 28 para segurança em fevereiro
  data_inicio         DATE NOT NULL,
  data_fim            DATE,                 -- NULL = contrato sem prazo de encerramento
  is_active           BOOLEAN NOT NULL DEFAULT true,
  -- Configurações opcionais por contrato (sobrepõem padrão do tenant)
  multa_percentual    NUMERIC(5,2),
  juros_percentual    NUMERIC(5,2),
  -- Controle de geração
  proxima_geracao     DATE,                 -- calculada automaticamente após cada lote
  ultima_geracao_at   TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_contrato_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_contratos_tenant   ON contratos_recorrentes(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_contratos_geracao  ON contratos_recorrentes(proxima_geracao)
  WHERE is_active = true;

-- Lote: registro de cada execução de geração em massa
CREATE TABLE IF NOT EXISTS lotes_faturamento (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         TEXT NOT NULL,
  referencia        TEXT NOT NULL,          -- ex: '2026-06' (mês de competência)
  total_contratos   INT  NOT NULL DEFAULT 0,
  total_geradas     INT  NOT NULL DEFAULT 0,
  total_erros       INT  NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'processando'
                         CHECK (status IN ('processando', 'concluido', 'concluido_com_erros', 'falhou')),
  iniciado_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  concluido_at      TIMESTAMPTZ,
  erro_log          TEXT
);
CREATE INDEX IF NOT EXISTS idx_lotes_tenant ON lotes_faturamento(tenant_id, iniciado_at DESC);

-- ROLLBACK:
-- DROP TABLE IF EXISTS lotes_faturamento;
-- DROP TABLE IF EXISTS contratos_recorrentes;
```

### 5.3 Cron e Worker de Geração em Lote

```
Trigger: Todo dia 25 do mês às 01:00 AM (cron: '0 1 25 * *')

Passo 1: Cron job cria registro em lotes_faturamento (status='processando')

Passo 2: Seleciona contratos ativos com proxima_geracao <= hoje + 7 dias
         ORDER BY tenant_id, cliente_id

Passo 3: Para cada contrato (em batch de 100):
         a. Calcula data de vencimento (dia_vencimento do próximo mês)
         b. Cria registro em charges com canonical_status='rascunho'
         c. Enfileira job de emissão no BullMQ (paymentEmissionQueue)
         d. Atualiza proxima_geracao do contrato para o próximo período
         e. Registra em audit_log

Passo 4: Atualiza lotes_faturamento com totais e status='concluido'

Passo 5: Emite evento n8n: 'lote.gerado' com { lote_id, tenant_id, total_geradas }
```

### 5.4 Endpoints de Gestão de Contratos

```
POST   /v1/portal/contratos               → cria contrato recorrente (admin_escritorio)
GET    /v1/portal/contratos               → lista contratos ativos com paginação
GET    /v1/portal/contratos/:id           → detalhe + histórico de lotes gerados
PATCH  /v1/portal/contratos/:id           → editar valor, vencimento, periodicidade
DELETE /v1/portal/contratos/:id           → desativa (soft: is_active = false)
POST   /v1/portal/contratos/:id/gerar-agora → geração manual fora do ciclo automático (admin)
GET    /v1/portal/lotes                   → histórico de lotes com status e totais
```

---

## PARTE 6 — DESCARTADO E POR QUÊ

| Item do LLD v1 | Decisão | Motivo |
|----------------|---------|--------|
| Tabela `tenant_gateway_configs` | Descartado | Duplica `escritorio_config`. Resolve-se com extensão da tabela existente. |
| Enums TypeScript em uppercase | Descartado | Convenção do projeto é lowercase. Dados existentes no banco usam lowercase. Migração desnecessária e destrutiva. |
| Colunas individuais por credencial bancária | Descartado | JSONB criptografado é superior: flexível, sem migration a cada novo banco, já implementado. |
| `import axios from 'axios'` | Descartado | Stack usa `fetch` nativo (Node 20 LTS). |
| Sintaxe Prisma nos exemplos | Descartado | Stack usa pg raw SQL. Violação de regra absoluta. |
| Remoção de estados existentes da máquina | Descartado | Breaking change crítico. Estados existem em dados reais. |
| `ALTER TABLE tenant_notification_settings` (sem CREATE) | Corrigido | Migration completa incluída neste documento (migration 026). |

---

## PARTE 7 — ROADMAP DE IMPLEMENTAÇÃO

### Sprint K — Anti-Spam WhatsApp (Prioridade Alta)
- Migration 026 (`tenant_notification_settings` + `tenant_alerts`)
- Extensão do worker `notification-send` com `applyWhatsAppThrottle`
- Endpoint PATCH settings no portal de configurações
- Testes unitários da função de jitter e janela horária

### Sprint L — Gateway Universal Parametrizado (Prioridade Média-Alta)
- `provider-registry.ts` com os 6 providers mapeados
- Migration 025 (extensão `escritorio_config`)
- Adapters: Inter (mTLS + OAuth2) + BB (gw-app-key + convênio) + Cora (mTLS)
- `oauth-token-cache.ts` para providers OAuth2
- Endpoint `GET /providers` e `GET /providers/:provider/schema`
- UI dinâmica no portal `/configuracoes` — formulário gerado pelo schema
- `gateway_change_log` auditando trocas de provider

### Sprint M — Estorno e Soft Delete (Prioridade Média)
- Migration 028 (estado `estornada` + trigger anti-delete)
- Endpoint `POST /v1/portal/cobrancas/:id/estornar`
- Extensão da máquina de estados no domain layer
- Testes da transição `paga → estornada` e bloqueio de outras transições

### Sprint N — Faturamento em Lote (Épico — Prioridade Média)
- Migration 029 (`contratos_recorrentes` + `lotes_faturamento`)
- Cron `lote-faturamento` (dia 25, 01h)
- Worker de geração em batch com BullMQ
- Endpoints CRUD de contratos
- Tela `/contratos` no portal do escritório
- Evento n8n `lote.gerado`

---

## PARTE 8 — PERGUNTAS EM ABERTO PARA O PO

As questões abaixo precisam de resposta antes de implementar as respectivas sprints:

**Gateway (Sprint L):**
- O escritório pode ter múltiplos gateways ativos simultaneamente (ex: Asaas para PIX e Inter para Boleto) ou apenas um ativo por vez?
- Quando um escritório troca de gateway, as cobranças já emitidas no gateway anterior continuam sendo reconciliadas?

**Estorno (Sprint M):**
- O estorno é sempre iniciado pelo operador manualmente, ou deve existir estorno automático via webhook do gateway?
- O cliente final deve receber notificação de estorno (e-mail/WhatsApp)?

**Contratos Recorrentes (Sprint N):**
- O valor do contrato pode ser reajustado anualmente (índice IGPM, IPCA)? Se sim, como o escritório configura isso?
- O que acontece se o cron rodar e a emissão de um contrato falhar? Retenta no dia seguinte? Gera alerta imediato?
- Contratos têm aprovação do cliente final ou são gerados sem confirmação?

---

*Documento gerado em Maio 2026 — Time Multidisciplinar Sênior · cobranca-saas-api*
*Próxima revisão: após alinhamento das Perguntas em Aberto (Parte 8)*
