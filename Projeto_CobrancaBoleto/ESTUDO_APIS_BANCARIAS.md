# ESTUDO TÉCNICO: APIs Bancárias — Guia de Implementação de Adaptadores

**Projeto:** cobranca-saas-api  
**Responsável:** Equipe Exeq Tecnologia  
**Data:** 2026-05-22  
**Versão:** 1.0.0  
**Bancos cobertos:** Banco Inter · Cora · C6 Bank · Banco do Brasil

> **Para a fábrica (implementação):** este ficheiro é **pesquisa técnica** (URLs, payloads, mTLS).  
> **Spec executável:** [DEMANDA_SPRINT_L_UNIVERSAL_GATEWAY.md](./DEMANDA_SPRINT_L_UNIVERSAL_GATEWAY.md) + [LLD_REVISADO_v2.md](./LLD_REVISADO_v2.md).  
> Os skeletons com `emitCharge()` / paths `src/platform/payment-gateway/adapters/` são **aspiracionais** — o código real usa `PaymentGatewayAdapter` em `src/modules/payment-gateway/` e `runEmission` no worker.

---

## Sumário

1. [Visão Geral e Padrão de Adapter](#1-visão-geral-e-padrão-de-adapter)
2. [Banco Inter](#2-banco-inter)
3. [Cora](#3-cora)
4. [C6 Bank](#4-c6-bank)
5. [Banco do Brasil](#5-banco-do-brasil)
6. [Matriz Comparativa](#6-matriz-comparativa)
7. [Padrão de Cache de Token (Redis)](#7-padrão-de-cache-de-token-redis)
8. [Tratamento de mTLS](#8-tratamento-de-mtls)
9. [Convenções de Credenciais Criptografadas](#9-convenções-de-credenciais-criptografadas)
10. [Roadmap de Sprints](#10-roadmap-de-sprints)

---

## 1. Visão Geral e Padrão de Adapter

Todos os adaptadores devem implementar a interface `PaymentGatewayAdapter` já definida no projeto:

```typescript
// src/platform/payment-gateway/adapter.interface.ts
export interface PaymentGatewayAdapter {
  /** Emite boleto/cobrança. Retorna ID externo do banco. */
  emitCharge(charge: ChargeEmissionPayload): Promise<GatewayChargeResult>;
  /** Cancela uma cobrança ativa. */
  cancelCharge(externalId: string, tenantId: string): Promise<void>;
  /** Consulta status de uma cobrança. */
  getChargeStatus(externalId: string, tenantId: string): Promise<GatewayStatusResult>;
}
```

### Estrutura de arquivos de adaptadores

```
src/platform/payment-gateway/adapters/
  inter.adapter.ts
  cora.adapter.ts
  c6bank.adapter.ts
  bb.adapter.ts
  asaas.adapter.ts        ← já implementado
  pagarme.adapter.ts      ← já implementado

src/platform/payment-gateway/
  mtls-agent.ts           ← NOVO: cria https.Agent com cert + key
  token-cache.ts          ← NOVO: Redis cache para OAuth tokens
  provider-registry.ts    ← EXISTENTE: GATEWAY_REGISTRY
  factory.ts              ← EXISTENTE: getGatewayForTenant()
```

### Campos obrigatórios em `escritorio_config.gateway_credentials_encrypted` por banco

| Campo JSON (desencriptado) | Inter | Cora | C6 Bank | BB |
|---|---|---|---|---|
| `client_id` | ✅ | ✅ | ✅ | ✅ |
| `client_secret` | ✅ | ❌ (não usa) | ✅ | ✅ |
| `certificate_pem` | ✅ (mTLS) | ✅ (mTLS) | ✅ (pfx/pem) | ❌ |
| `private_key_pem` | ✅ (mTLS) | ✅ (mTLS) | ✅ | ❌ |
| `convenio` | ❌ | ❌ | ❌ | ✅ |
| `carteira` | ❌ | ❌ | ❌ | ✅ |
| `variacao_carteira` | ❌ | ❌ | ❌ | ✅ |
| `gw_app_key` | ❌ | ❌ | ❌ | ✅ |
| `conta_corrente` | ❌ | ❌ | ✅ | ✅ |

---

## 2. Banco Inter

**ISPB:** 77654119 | **Código COMPE:** 077  
**Documentação oficial:** https://developers.inter.co/

### 2.1 Autenticação

**Esquema:** OAuth2 Client Credentials + **mTLS obrigatório** (certificado X.509 emitido pelo Inter)

#### URLs de Token

| Ambiente | URL |
|---|---|
| **Sandbox** | `POST https://cdpj-sandbox.partners.uatinter.co/oauth/v2/token` |
| **Produção** | `POST https://cdpj.partners.bancointer.com.br/oauth/v2/token` |

#### Request

```
POST /oauth/v2/token
Content-Type: application/x-www-form-urlencoded
(certificado mTLS no TLS handshake)

grant_type=client_credentials
&client_id=<client_id>
&client_secret=<client_secret>
&scope=boleto-cobranca.write boleto-cobranca.read
```

#### Response

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "boleto-cobranca.write boleto-cobranca.read"
}
```

> **TTL:** 3600 segundos (1 hora). Cache no Redis com margem de 60s.

### 2.2 Emissão de Boleto

**URL de base:**
- Sandbox: `https://cdpj-sandbox.partners.uatinter.co`
- Produção: `https://cdpj.partners.bancointer.com.br`

#### Endpoint

```
POST /cobrancas/v2
Authorization: Bearer <access_token>
Content-Type: application/json
(certificado mTLS ativo)
```

#### Request Payload

```json
{
  "seuNumero": "NF-001",
  "valorNominal": 250.00,
  "dataVencimento": "2026-06-30",
  "numDiasAgenda": 60,
  "pagador": {
    "cpfCnpj": "11122233344",
    "tipoPessoa": "FISICA",
    "nome": "João da Silva",
    "endereco": "Rua das Flores, 123",
    "bairro": "Centro",
    "cidade": "Belo Horizonte",
    "uf": "MG",
    "cep": "30140071",
    "email": "joao@email.com",
    "ddd": "31",
    "telefone": "991234567"
  },
  "desconto": {
    "codigoDesconto": "PERCENTUALDATAINFORMADA",
    "taxaPercentual": 5.00,
    "quantidadeDias": 10
  },
  "multa": {
    "codigoMulta": "PERCENTUAL",
    "taxa": 2.00
  },
  "mora": {
    "codigoMora": "TAXAMENSAL",
    "taxa": 1.00
  },
  "mensagem": {
    "linha1": "Referência: Contrato #001",
    "linha2": "Serviço prestado em maio/2026"
  }
}
```

**Campos obrigatórios:** `seuNumero`, `valorNominal`, `dataVencimento`, `numDiasAgenda`, `pagador.*`  
**`seuNumero`:** seu identificador interno (max 15 chars) — use o `id` da charge UUID truncado/prefixado  
**`numDiasAgenda`:** dias que o boleto fica disponível para pagamento após o vencimento (max 60)

#### Response

```json
{
  "codigoSolicitacao": "2ccdf47c-e3b5-4967-b7b8-a5c7c9a2e9f4",
  "situacao": "EM_ABERTO",
  "nossoNumero": "00123456789",
  "codigoBarras": "07790.00000 00000.000000 00000.000000 1 00000000025000",
  "linhaDigitavel": "07790000000000000000000000000000000000000000000000",
  "dataVencimento": "2026-06-30"
}
```

> ⚠️ **ATENÇÃO:** O campo `codigoSolicitacao` (UUID) é o **identificador principal** para todas as operações subsequentes. Armazene em `charges.external_id`.
>
> Pode retornar `"situacao": "EM_PROCESSAMENTO"` — neste caso, faça polling em `GET /cobrancas/v2/{codigoSolicitacao}` após 30-60 segundos.

### 2.3 Consulta de Boleto

```
GET /cobrancas/v2/{codigoSolicitacao}
Authorization: Bearer <access_token>
```

**Response:** mesmo schema da emissão + campo `situacao` atualizado.

**Situações possíveis:** `EM_ABERTO`, `EM_PROCESSAMENTO`, `PAGO`, `CANCELADO`, `VENCIDO`, `EXPIRADO`

**Mapeamento para estado interno:**

| Inter `situacao` | `canonical_status` interno |
|---|---|
| `EM_ABERTO` | `pendente_pagamento` |
| `EM_PROCESSAMENTO` | `emitida` |
| `PAGO` | `paga` |
| `CANCELADO` | `cancelada` |
| `VENCIDO` | `vencida` |

### 2.4 Cancelamento

```
POST /cobrancas/v2/{codigoSolicitacao}/cancelar
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "motivoCancelamento": "ACERTOS"
}
```

**Motivos válidos:** `ACERTOS`, `PAGODIRETOAOFORNECEDOR`, `SUBSTITUICAO`

**Response:** HTTP 204 No Content

### 2.5 Download PDF do Boleto

```
GET /cobrancas/v2/{codigoSolicitacao}/pdf
Authorization: Bearer <access_token>
Accept: application/pdf
```

**Response:** `Content-Type: application/pdf` — binário do PDF

### 2.6 Webhooks

O Inter envia notificações de pagamento. Registre a URL no portal developers.

**Payload de webhook (pagamento):**
```json
{
  "codigoSolicitacao": "2ccdf47c-...",
  "seuNumero": "NF-001",
  "situacao": "PAGO",
  "valorNominal": 250.00,
  "valorPago": 250.00,
  "dataPagamento": "2026-06-15",
  "horaRecebimentoTransacao": "14:32:00",
  "nossoNumero": "00123456789"
}
```

### 2.7 PIX — AVISO IMPORTANTE

> ⚠️ **A API PIX do Banco Inter está temporariamente desabilitada para NOVAS integrações desde dezembro de 2025.**
>
> O Inter ainda suporta **boleto híbrido (BoletoPix)** — ou seja, o boleto é emitido via API de Cobrança normal e o QR Code PIX é gerado automaticamente pelo banco como parte do boleto impresso. **Não há endpoint PIX separado para registro.**
>
> Para fins de implementação no `cobranca-saas-api`: use apenas o endpoint de cobrança `/cobrancas/v2`. O QR Code PIX virá no PDF do boleto automaticamente (se o cliente tiver essa feature ativada na conta Inter).

### 2.8 TypeScript Adapter Skeleton

```typescript
// src/platform/payment-gateway/adapters/inter.adapter.ts
import https from 'https';
import { getDecryptedCredentials } from '../credentials';
import { getCachedToken, setCachedToken } from '../token-cache';
import { buildMtlsAgent } from '../mtls-agent';
import type { PaymentGatewayAdapter, ChargeEmissionPayload, GatewayChargeResult } from '../adapter.interface';

const BASE_URLS = {
  sandbox: 'https://cdpj-sandbox.partners.uatinter.co',
  production: 'https://cdpj.partners.bancointer.com.br',
} as const;

export class InterAdapter implements PaymentGatewayAdapter {
  private baseUrl: string;

  constructor(private tenantId: string, private creds: InterCredentials) {
    this.baseUrl = process.env.NODE_ENV === 'production'
      ? BASE_URLS.production
      : BASE_URLS.sandbox;
  }

  private async getToken(): Promise<string> {
    const cacheKey = `gateway:inter:token:${this.tenantId}`;
    const cached = await getCachedToken(cacheKey);
    if (cached) return cached;

    const agent = buildMtlsAgent(this.creds.certificate_pem, this.creds.private_key_pem);
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.creds.client_id,
      client_secret: this.creds.client_secret,
      scope: 'boleto-cobranca.write boleto-cobranca.read',
    });

    const resp = await fetch(`${this.baseUrl}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      // @ts-ignore — Node 18+ fetch aceita dispatcher
      dispatcher: agent,
    });

    if (!resp.ok) throw new Error(`Inter token error: ${resp.status} ${await resp.text()}`);
    const data = await resp.json() as { access_token: string; expires_in: number };

    await setCachedToken(cacheKey, data.access_token, data.expires_in - 60);
    return data.access_token;
  }

  async emitCharge(charge: ChargeEmissionPayload): Promise<GatewayChargeResult> {
    const token = await this.getToken();
    const agent = buildMtlsAgent(this.creds.certificate_pem, this.creds.private_key_pem);

    const payload = {
      seuNumero: charge.externalRef.slice(0, 15),
      valorNominal: Number(charge.amount),
      dataVencimento: charge.dueDate,
      numDiasAgenda: 60,
      pagador: {
        cpfCnpj: charge.payer.document.replace(/\D/g, ''),
        tipoPessoa: charge.payer.document.length <= 11 ? 'FISICA' : 'JURIDICA',
        nome: charge.payer.name,
        endereco: charge.payer.address,
        bairro: charge.payer.neighborhood,
        cidade: charge.payer.city,
        uf: charge.payer.state,
        cep: charge.payer.zipCode.replace(/\D/g, ''),
        email: charge.payer.email ?? '',
        ddd: charge.payer.phone?.slice(0, 2) ?? '',
        telefone: charge.payer.phone?.slice(2) ?? '',
      },
    };

    const resp = await fetch(`${this.baseUrl}/cobrancas/v2`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      // @ts-ignore
      dispatcher: agent,
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Inter emit error: ${resp.status} ${err}`);
    }

    const data = await resp.json() as InterBoletoResponse;
    return {
      externalId: data.codigoSolicitacao,
      barCode: data.codigoBarras,
      digitableLine: data.linhaDigitavel,
      status: data.situacao === 'EM_PROCESSAMENTO' ? 'processing' : 'issued',
    };
  }

  async cancelCharge(externalId: string): Promise<void> {
    const token = await this.getToken();
    const agent = buildMtlsAgent(this.creds.certificate_pem, this.creds.private_key_pem);

    const resp = await fetch(`${this.baseUrl}/cobrancas/v2/${externalId}/cancelar`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ motivoCancelamento: 'ACERTOS' }),
      // @ts-ignore
      dispatcher: agent,
    });

    if (!resp.ok && resp.status !== 204) {
      throw new Error(`Inter cancel error: ${resp.status} ${await resp.text()}`);
    }
  }

  async getChargeStatus(externalId: string): Promise<GatewayStatusResult> {
    const token = await this.getToken();
    const agent = buildMtlsAgent(this.creds.certificate_pem, this.creds.private_key_pem);

    const resp = await fetch(`${this.baseUrl}/cobrancas/v2/${externalId}`, {
      headers: { Authorization: `Bearer ${token}` },
      // @ts-ignore
      dispatcher: agent,
    });

    if (!resp.ok) throw new Error(`Inter status error: ${resp.status}`);
    const data = await resp.json() as InterBoletoResponse;

    return {
      externalId,
      status: mapInterStatus(data.situacao),
      paidAmount: data.valorPago,
      paidAt: data.dataPagamento,
    };
  }
}

function mapInterStatus(s: string): string {
  const map: Record<string, string> = {
    EM_ABERTO: 'pendente_pagamento',
    EM_PROCESSAMENTO: 'emitida',
    PAGO: 'paga',
    CANCELADO: 'cancelada',
    VENCIDO: 'vencida',
    EXPIRADO: 'vencida',
  };
  return map[s] ?? 'emitida';
}
```

---

## 3. Cora

**Código ISPB:** 37880206 | **Código COMPE:** 403  
**Documentação oficial:** https://developers.cora.com.br/

### 3.1 Autenticação

**Esquema:** OAuth2 Client Credentials + **mTLS obrigatório** (certificado gerado no portal Cora)

> ⚠️ **Diferença crítica em relação ao Inter:** A Cora utiliza **apenas `client_id`** (sem `client_secret`). O certificado mTLS **é** o segredo de autenticação.

#### URLs de Token

| Ambiente | URL |
|---|---|
| **Stage (Sandbox)** | `POST https://matls-clients.api.stage.cora.com.br/token` |
| **Produção** | `POST https://matls-clients.api.cora.com.br/token` |

#### Request

```
POST /token
Content-Type: application/x-www-form-urlencoded
(certificado mTLS + chave privada no TLS handshake)

grant_type=client_credentials
&client_id=<client_id>
```

**Sem `client_secret`** — o certificado mTLS serve como autenticação.

#### Response

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "scope": "invoices.write invoices.read"
}
```

> **TTL:** 86400 segundos (24 horas). Cache no Redis com margem de 300s (5 min).

### 3.2 Emissão de Boleto / Fatura

**URL de base:**
- Stage: `https://matls-clients.api.stage.cora.com.br`
- Produção: `https://matls-clients.api.cora.com.br`

#### Endpoint

```
POST /v2/invoices
Authorization: Bearer <access_token>
Content-Type: application/json
Idempotency-Key: <UUID v4>        ← OBRIGATÓRIO
(certificado mTLS ativo)
```

> ⚠️ **`Idempotency-Key`** é obrigatório. Use `uuidv4()` único por emissão. Reenvio da mesma key com mesmo payload retorna a resposta original (idempotente).

#### Request Payload

```json
{
  "code": "meu_id_interno_da_cobranca",
  "customer": {
    "name": "Empresa ABC Ltda",
    "email": "financeiro@empresa.com",
    "document": {
      "identity": "34052649000178",
      "type": "CNPJ"
    },
    "address": {
      "street": "Rua das Acácias",
      "number": "456",
      "district": "Jardim Paulista",
      "city": "São Paulo",
      "state": "SP",
      "complement": "Sala 301",
      "zip_code": "01310100"
    }
  },
  "services": [
    {
      "name": "Mensalidade SaaS",
      "description": "Serviço de cobrança - maio/2026",
      "amount": 25000
    }
  ],
  "payment_terms": {
    "due_date": "2026-06-15",
    "fine": {
      "amount": 500
    },
    "interest": {
      "rate": 1.00
    },
    "discount": {
      "type": "PERCENT",
      "value": 5.0,
      "limit_date": "2026-06-10"
    }
  },
  "payment_forms": ["BANK_SLIP", "PIX"],
  "notifications": {
    "channels": ["EMAIL", "WHATSAPP"]
  }
}
```

**Atenção sobre valores:**
- **Todos os valores monetários são em centavos como inteiros** (integer, não float)
- `"amount": 25000` = R$ 250,00
- `fine.amount: 500` = R$ 5,00 de multa fixa
- `interest.rate: 1.00` = 1% ao mês de juros
- `discount.value: 5.0` com `type: "PERCENT"` = 5% de desconto

**`payment_forms`:** `"BANK_SLIP"` (boleto) | `"PIX"` | `["BANK_SLIP", "PIX"]` (híbrido)

#### Response (201 Created)

```json
{
  "id": "8f14e45f-ceea-467a-a866-051f8f4c3a63",
  "code": "meu_id_interno_da_cobranca",
  "status": "PENDING",
  "created_at": "2026-05-22T10:00:00Z",
  "customer": { ... },
  "services": [ ... ],
  "payment_terms": { ... },
  "bank_slip": {
    "our_number": "0000123456",
    "type_full_code": "0000.00000 00000.000000 00000.000000 1 00000000025000",
    "barcode": "03398.99999 99999.999999 99999.999999 9 99990000025000",
    "url": "https://boleto.cora.com.br/b/8f14e45f..."
  },
  "pix": {
    "qr_code": "00020101021226890014BR.GOV.BCB...",
    "qr_code_url": "https://api.cora.com.br/pix/qrcode/8f14e45f.png"
  }
}
```

> O campo `id` (UUID) é o `external_id` a ser armazenado em `charges.external_id`.

### 3.3 Consulta de Fatura

```
GET /v2/invoices/{id}
Authorization: Bearer <access_token>
(mTLS ativo)
```

**Status possíveis:** `PENDING`, `PAID`, `CANCELLED`, `OVERDUE`, `DRAFT`

**Mapeamento:**

| Cora `status` | `canonical_status` interno |
|---|---|
| `PENDING` | `pendente_pagamento` |
| `PAID` | `paga` |
| `CANCELLED` | `cancelada` |
| `OVERDUE` | `vencida` |

### 3.4 Cancelamento

```
DELETE /v2/invoices/{id}
Authorization: Bearer <access_token>
Content-Type: application/json
(mTLS ativo)

{
  "reason": "CANCELLED_BY_ISSUER"
}
```

**Response:** HTTP 200 com `{ "status": "CANCELLED" }`

### 3.5 Webhooks

A Cora suporta webhooks configurados no portal. Eventos disponíveis:
- `invoice.paid` — fatura paga
- `invoice.overdue` — fatura vencida
- `invoice.cancelled` — fatura cancelada
- `pix.received` — pagamento PIX recebido

**Payload de webhook:**
```json
{
  "id": "evt-uuid",
  "type": "invoice.paid",
  "created_at": "2026-06-15T14:32:00Z",
  "data": {
    "invoice_id": "8f14e45f-...",
    "code": "meu_id_interno",
    "amount_paid": 25000,
    "paid_at": "2026-06-15T14:31:00Z"
  }
}
```

### 3.6 Formato de Erros

```json
{
  "code": "invalid_request",
  "message": "Descrição do erro",
  "errors": [
    {
      "id": "customer.document.identity",
      "message": "CPF/CNPJ inválido"
    }
  ]
}
```

### 3.7 TypeScript Adapter Skeleton

```typescript
// src/platform/payment-gateway/adapters/cora.adapter.ts
import { randomUUID } from 'crypto';
import { buildMtlsAgent } from '../mtls-agent';
import { getCachedToken, setCachedToken } from '../token-cache';
import type { PaymentGatewayAdapter, ChargeEmissionPayload, GatewayChargeResult } from '../adapter.interface';

const BASE_URLS = {
  sandbox: 'https://matls-clients.api.stage.cora.com.br',
  production: 'https://matls-clients.api.cora.com.br',
} as const;

export class CoraAdapter implements PaymentGatewayAdapter {
  private baseUrl: string;

  constructor(private tenantId: string, private creds: CoraCredentials) {
    this.baseUrl = process.env.NODE_ENV === 'production'
      ? BASE_URLS.production
      : BASE_URLS.sandbox;
  }

  private async getToken(): Promise<string> {
    const cacheKey = `gateway:cora:token:${this.tenantId}`;
    const cached = await getCachedToken(cacheKey);
    if (cached) return cached;

    const agent = buildMtlsAgent(this.creds.certificate_pem, this.creds.private_key_pem);
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.creds.client_id,
      // ⚠️ SEM client_secret — mTLS é a autenticação
    });

    const resp = await fetch(`${this.baseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      // @ts-ignore
      dispatcher: agent,
    });

    if (!resp.ok) throw new Error(`Cora token error: ${resp.status} ${await resp.text()}`);
    const data = await resp.json() as { access_token: string; expires_in: number };

    // TTL 24h com margem de 5 min
    await setCachedToken(cacheKey, data.access_token, data.expires_in - 300);
    return data.access_token;
  }

  async emitCharge(charge: ChargeEmissionPayload): Promise<GatewayChargeResult> {
    const token = await this.getToken();
    const agent = buildMtlsAgent(this.creds.certificate_pem, this.creds.private_key_pem);

    // Cora usa centavos como inteiros
    const amountCents = Math.round(Number(charge.amount) * 100);

    const payload = {
      code: charge.externalRef,
      customer: {
        name: charge.payer.name,
        email: charge.payer.email,
        document: {
          identity: charge.payer.document.replace(/\D/g, ''),
          type: charge.payer.document.replace(/\D/g, '').length <= 11 ? 'CPF' : 'CNPJ',
        },
        address: {
          street: charge.payer.address,
          number: charge.payer.addressNumber ?? 'S/N',
          district: charge.payer.neighborhood,
          city: charge.payer.city,
          state: charge.payer.state,
          zip_code: charge.payer.zipCode.replace(/\D/g, ''),
        },
      },
      services: [
        {
          name: charge.description ?? 'Cobrança',
          description: charge.description ?? 'Serviço',
          amount: amountCents,
        },
      ],
      payment_terms: {
        due_date: charge.dueDate,
      },
      payment_forms: ['BANK_SLIP', 'PIX'],
    };

    const resp = await fetch(`${this.baseUrl}/v2/invoices`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify(payload),
      // @ts-ignore
      dispatcher: agent,
    });

    if (!resp.ok) {
      const err = await resp.json() as { code: string; message: string };
      throw new Error(`Cora emit error [${err.code}]: ${err.message}`);
    }

    const data = await resp.json() as CoraInvoiceResponse;
    return {
      externalId: data.id,
      barCode: data.bank_slip?.barcode,
      digitableLine: data.bank_slip?.type_full_code,
      pixQrCode: data.pix?.qr_code,
      status: 'issued',
    };
  }

  async cancelCharge(externalId: string): Promise<void> {
    const token = await this.getToken();
    const agent = buildMtlsAgent(this.creds.certificate_pem, this.creds.private_key_pem);

    const resp = await fetch(`${this.baseUrl}/v2/invoices/${externalId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'CANCELLED_BY_ISSUER' }),
      // @ts-ignore
      dispatcher: agent,
    });

    if (!resp.ok) throw new Error(`Cora cancel error: ${resp.status}`);
  }

  async getChargeStatus(externalId: string): Promise<GatewayStatusResult> {
    const token = await this.getToken();
    const agent = buildMtlsAgent(this.creds.certificate_pem, this.creds.private_key_pem);

    const resp = await fetch(`${this.baseUrl}/v2/invoices/${externalId}`, {
      headers: { Authorization: `Bearer ${token}` },
      // @ts-ignore
      dispatcher: agent,
    });

    if (!resp.ok) throw new Error(`Cora status error: ${resp.status}`);
    const data = await resp.json() as CoraInvoiceResponse;

    const statusMap: Record<string, string> = {
      PENDING: 'pendente_pagamento',
      PAID: 'paga',
      CANCELLED: 'cancelada',
      OVERDUE: 'vencida',
    };

    return {
      externalId,
      status: statusMap[data.status] ?? 'emitida',
    };
  }
}
```

---

## 4. C6 Bank

**Código COMPE:** 336  
**Documentação oficial:** https://developers.c6bank.com.br *(requer cadastro e aprovação)*

### 4.1 Status da Documentação Pública

> ⚠️ **AVISO IMPORTANTE:** O portal de desenvolvedores do C6 Bank (`developers.c6bank.com.br`) é **fechado** — requer cadastro, aprovação de conta e assinatura de NDA antes de fornecer acesso à documentação técnica completa. Toda a documentação oficial é disponibilizada após a homologação.

Com base em fontes públicas (comunidade ACBr, integradores, relatórios de ERP), foi possível mapear o seguinte:

### 4.2 Autenticação

**Esquema:** OAuth2 Client Credentials com `Authorization: Basic` (base64 de `client_id:client_secret`)

> Diferentemente do Inter e Cora, o C6 Bank **não usa mTLS para a autenticação OAuth**. O certificado digital é usado para **assinar/registrar o boleto** em si (conforme relatos de integração da comunidade).

#### URLs de Token (não confirmado oficialmente — baseado em implementações de terceiros)

| Ambiente | URL (inferida) |
|---|---|
| **Sandbox/Homologação** | `POST https://auth.hm.c6bank.com.br/oauth/token` |
| **Produção** | `POST https://auth.c6bank.com.br/oauth/token` |

#### Request

```
POST /oauth/token
Authorization: Basic <base64(client_id:client_secret)>
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&scope=cobranca
```

> Geração do header Basic:
> ```bash
> echo -n "meu_client_id:meu_client_secret" | base64
> # → bWV1X2NsaWVudF9pZDptZXVfY2xpZW50X3NlY3JldA==
> ```

#### Response

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiJ9...",
  "token_type": "Bearer",
  "expires_in": 1800
}
```

> **TTL estimado:** 1800 segundos (30 min). Use cache Redis com margem de 60s.

### 4.3 Emissão de Boleto

> ⚠️ **Endpoint não confirmado publicamente.** A integração do C6 Bank requer aprovação no portal developers. As informações abaixo são baseadas em relatos de integradores e patterns de mercado.

#### Campos do cedente necessários (confirmados pela comunidade ACBr)

| Campo | Descrição |
|---|---|
| `codigoCedente` | Código do cedente fornecido pelo C6 Bank |
| `modalidade` | Modalidade de cobrança (fornecido pelo banco) |
| `responEmissao` | Quem emite o boleto: `CLIENTE_EMITE` ou `BANCO_EMITE` |
| `conta` | Número da conta corrente |
| `agencia` | Número da agência |

#### Request Payload (estrutura inferida)

```json
{
  "conta": "123456",
  "agencia": "0001",
  "codigoCedente": "123456",
  "modalidade": "1",
  "numeroTitulo": "00001",
  "dataVencimento": "2026-06-30",
  "valor": 250.00,
  "pagador": {
    "nome": "João da Silva",
    "cpfCnpj": "11122233344",
    "tipoPessoa": "FISICA",
    "endereco": "Rua das Flores, 123",
    "bairro": "Centro",
    "cidade": "São Paulo",
    "uf": "SP",
    "cep": "01310100"
  },
  "instrucoes": [
    "Após vencimento cobrar juros de 1% ao mês",
    "Multa de 2% após o vencimento"
  ]
}
```

### 4.4 Processo de Integração (Passos Obrigatórios)

1. **Criar conta** em https://developers.c6bank.com.br
2. **Registrar aplicação** informando CNPJ e dados da empresa
3. **Aguardar aprovação** (processo pode levar dias úteis)
4. **Obter credenciais de sandbox** (client_id, client_secret)
5. **Solicitar homologação** com testes no ambiente sandbox
6. **Após aprovação**, receber credenciais de produção
7. **Implementar adaptador** com base na documentação recebida

### 4.5 Credenciais Necessárias

Para cadastro em `escritorio_config.gateway_credentials_encrypted`:

```json
{
  "client_id": "obter no portal",
  "client_secret": "obter no portal",
  "conta": "número da conta corrente",
  "agencia": "número da agência",
  "codigo_cedente": "fornecido pelo banco",
  "modalidade": "fornecida pelo banco",
  "certificate_pem": "certificado .pfx convertido para PEM (se necessário)",
  "private_key_pem": "chave privada (se necessário)"
}
```

### 4.6 TypeScript Adapter Skeleton (Parcial)

```typescript
// src/platform/payment-gateway/adapters/c6bank.adapter.ts
// ⚠️ SKELETON INCOMPLETO — requer documentação oficial do C6 Bank
// Implementar após obter acesso ao portal developers.c6bank.com.br

import { getCachedToken, setCachedToken } from '../token-cache';
import type { PaymentGatewayAdapter, ChargeEmissionPayload, GatewayChargeResult } from '../adapter.interface';

const BASE_URLS = {
  sandbox: 'https://auth.hm.c6bank.com.br',  // ⚠️ URL não confirmada
  production: 'https://auth.c6bank.com.br',   // ⚠️ URL não confirmada
  api_sandbox: 'https://api.hm.c6bank.com.br', // ⚠️ URL não confirmada
  api_production: 'https://api.c6bank.com.br', // ⚠️ URL não confirmada
} as const;

export class C6BankAdapter implements PaymentGatewayAdapter {
  constructor(private tenantId: string, private creds: C6BankCredentials) {}

  private async getToken(): Promise<string> {
    const cacheKey = `gateway:c6bank:token:${this.tenantId}`;
    const cached = await getCachedToken(cacheKey);
    if (cached) return cached;

    const baseAuth = Buffer.from(`${this.creds.client_id}:${this.creds.client_secret}`).toString('base64');
    const tokenUrl = process.env.NODE_ENV === 'production'
      ? BASE_URLS.production
      : BASE_URLS.sandbox;

    const resp = await fetch(`${tokenUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${baseAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'cobranca',
      }).toString(),
    });

    if (!resp.ok) throw new Error(`C6Bank token error: ${resp.status} ${await resp.text()}`);
    const data = await resp.json() as { access_token: string; expires_in: number };

    await setCachedToken(cacheKey, data.access_token, (data.expires_in ?? 1800) - 60);
    return data.access_token;
  }

  async emitCharge(_charge: ChargeEmissionPayload): Promise<GatewayChargeResult> {
    // TODO: implementar após obter documentação oficial do C6 Bank
    throw new Error('C6Bank adapter: implementação pendente — aguardando acesso ao portal developers');
  }

  async cancelCharge(_externalId: string): Promise<void> {
    throw new Error('C6Bank adapter: implementação pendente');
  }

  async getChargeStatus(_externalId: string): Promise<GatewayStatusResult> {
    throw new Error('C6Bank adapter: implementação pendente');
  }
}
```

### 4.7 Plano de Ação para C6 Bank

| Passo | Responsável | Prazo sugerido |
|---|---|---|
| 1. Criar conta no portal developers.c6bank.com.br | PO / Financeiro Exeq | Sprint L (início) |
| 2. Aguardar aprovação e obter sandbox credentials | PO | Sprint L |
| 3. Estudar documentação oficial disponibilizada | Dev | Sprint L |
| 4. Implementar e testar adapter no sandbox | Dev | Sprint L (final) |
| 5. Solicitar homologação e produção | PO | Sprint M |

---

## 5. Banco do Brasil

**Código COMPE:** 001 | **ISPB:** 00000000  
**Documentação oficial:** https://developers.bb.com.br  
**API Reference:** https://apoio.developers.bb.com.br/referency/post/5f4fb7f5b71fb5001268ca44

### 5.1 Autenticação

**Esquema:** OAuth2 Client Credentials com `Authorization: Basic` (base64 de `client_id:client_secret`)

> O BB **não usa mTLS** para autenticação OAuth2. Entretanto, para algumas operações (especialmente PIX), pode exigir certificado digital ICP-Brasil A1.

#### URLs de Token

| Ambiente | URL |
|---|---|
| **Sandbox** | `POST https://oauth.sandbox.bb.com.br/oauth/token` |
| **Homologação** | `POST https://oauth.hm.bb.com.br/oauth/token` |
| **Produção** | `POST https://oauth.bb.com.br/oauth/token` |

#### Request

```
POST /oauth/token?grant_type=client_credentials&scope=cobranca.registro-boletos
Authorization: Basic <base64(client_id:client_secret)>
Content-Type: application/x-www-form-urlencoded
cache-control: no-cache
```

> Os parâmetros `grant_type` e `scope` podem ser enviados como **query string** ou **no body** — ambos funcionam.

#### Scopes necessários

| Operação | Scope |
|---|---|
| Registrar boleto | `cobranca.registro-boletos` |
| Consultar boleto | `cobranca.registro-boletos-consultar` |
| PIX + boleto híbrido | `cobrancas-requisicao cobranças-info` |

#### Response

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiJ9...",
  "token_type": "Bearer",
  "expires_in": 600
}
```

> **TTL:** 600 segundos (10 minutos). Cache no Redis com margem de 60s.  
> ⚠️ TTL curto — o cache é essencial para performance.

### 5.2 Credenciais do Portal Developers BB

O portal disponibiliza **3 chaves** necessárias:

| Chave | Campo em `gateway_credentials_encrypted` | Uso |
|---|---|---|
| **Client ID** | `client_id` | Token OAuth |
| **Client Secret** | `client_secret` | Token OAuth |
| **App Key (gw-app-key)** | `gw_app_key` | Header obrigatório em todas as chamadas de API |

> ⚠️ **`gw-app-key`** é um header obrigatório em **TODAS** as chamadas de API (não só o token). Sem ele, as chamadas retornam 401/403.
>
> Em ambiente sandbox: use `gw-dev-app-key` como nome do header.
> Em produção: use `gw-app-key`.

### 5.3 Emissão de Boleto

#### URL de base

| Ambiente | URL de base |
|---|---|
| **Sandbox** | `https://api.sandbox.bb.com.br` |
| **Homologação** | `https://api.hm.bb.com.br` |
| **Produção** | `https://api.bb.com.br` |

#### Endpoint

```
POST /cobrancas/v2/boletos
Authorization: Bearer <access_token>
Content-Type: application/json
gw-app-key: <developer_app_key>
```

#### Request Payload

```json
{
  "numeroConvenio": 3128557,
  "numeroCarteira": 17,
  "numeroVariacaoCarteira": 35,
  "codigoModalidade": 1,
  "dataEmissao": "19.05.2026",
  "dataVencimento": "30.06.2026",
  "valorOriginal": 250.00,
  "codigoAceite": "A",
  "codigoTipoTitulo": 2,
  "descricaoTipoTitulo": "DUPLICATA MERCANTIL",
  "indicadorPermissaoRecebimentoParcial": "N",
  "numeroTituloBeneficiario": "1",
  "campoUtilizacaoBeneficiario": "REF: Contrato #001",
  "numeroTituloCliente": "00031285570000000001",
  "mensagemBloquetoOcorrencia": "",
  "pagador": {
    "tipoInscricao": 1,
    "numeroInscricao": "11122233344",
    "nome": "João da Silva",
    "endereco": "Rua das Flores, 123",
    "cep": "30140071",
    "cidade": "Belo Horizonte",
    "bairro": "Centro",
    "uf": "MG",
    "telefone": "31991234567"
  },
  "indicadorPix": "S"
}
```

**Campos críticos:**

| Campo | Descrição |
|---|---|
| `numeroConvenio` | Número do convênio de cobrança (fornecido pelo gerente) |
| `numeroCarteira` | Número da carteira (ex: `17`) |
| `numeroVariacaoCarteira` | Variação da carteira (ex: `35`) |
| `codigoModalidade` | `1` = simples, `4` = vinculada |
| `numeroTituloCliente` | **Nosso número** — 20 dígitos, formato: `000 + convenio(7) + seq(10)` |
| `pagador.tipoInscricao` | `1` = CPF, `2` = CNPJ |
| `indicadorPix` | `"S"` = gerar QR Code PIX junto com o boleto |

#### Geração do `numeroTituloCliente`

```typescript
// Nosso número = 20 dígitos: '000' + convenio (7 dígitos, 0-padded) + sequencial (10 dígitos)
function gerarNossoNumero(convenio: number, sequencial: number): string {
  const conv = String(convenio).padStart(7, '0');
  const seq = String(sequencial).padStart(10, '0');
  return `000${conv}${seq}`;
}

// Exemplo: convenio=3128557, seq=1 → "00031285570000000001"
```

#### Response (200 OK)

```json
{
  "numero": "00031285570000000001",
  "numeroBoletoBB": "000/00031285570000000001-X",
  "linhaDigitavel": "00190.00009 03128.557000 00000.000194 1 99999999999999",
  "codigoBarraNumerico": "00199999999999990000000000000000000003128557000000000",
  "qrCode": {
    "url": "https://api.bb.com.br/pix/v1/cobqrs/...",
    "txId": "T00031285570000000001",
    "emv": "00020101021226890014BR.GOV.BCB.PIX..."
  }
}
```

> O campo `numero` = `numeroTituloCliente` enviado. Use-o como `external_id` em `charges.external_id`.

### 5.4 Consulta de Boleto

```
GET /cobrancas/v2/boletos/{numeroBoletoBB}?numeroConvenio=3128557
Authorization: Bearer <access_token>
gw-app-key: <app_key>
```

**Ou por `numeroTituloCliente`:**
```
GET /cobrancas/v2/boletos?numeroConvenio=3128557&numeroTituloCliente=00031285570000000001
```

### 5.5 Cancelamento (Baixa)

```
POST /cobrancas/v2/boletos/{numeroBoletoBB}/baixar
Authorization: Bearer <access_token>
Content-Type: application/json
gw-app-key: <app_key>

{
  "numeroConvenio": 3128557
}
```

**Response:** HTTP 200 com confirmação de baixa.

### 5.6 Atualização de Boleto

```
PATCH /cobrancas/v2/boletos/{numeroBoletoBB}
Authorization: Bearer <access_token>
Content-Type: application/json
gw-app-key: <app_key>

{
  "numeroConvenio": 3128557,
  "indicadorNovaDataVencimento": "S",
  "alteracaoData": {
    "novaDataVencimento": "01.07.2026"
  }
}
```

### 5.7 Webhooks / Notificações

O BB suporta webhook de **BAIXA OPERACIONAL** (quando o boleto é pago). Configuração no portal Developers BB:

- Selecione sua aplicação → **Webhook** → **Cadastrar Evento**
- Evento: `BAIXA OPERACIONAL`
- Convênio: número do convênio
- URL: endpoint do seu servidor

**Payload recebido:**
```json
{
  "convenio": "3128557",
  "nossoNumero": "00031285570000000001",
  "dataCredito": "2026-06-16",
  "valorPago": 250.00,
  "dataHoraPagamento": "2026-06-15T14:30:00",
  "tipoPagamento": "PIX"
}
```

> Apenas notificações de **PIX** chegam via webhook em tempo real. Pagamentos via boleto tradicional chegam no dia seguinte via retorno.

### 5.8 PIX Híbrido (Boleto + PIX)

Para gerar boleto híbrido (boleto + QR Code PIX):

1. Inclua `"indicadorPix": "S"` no payload de emissão
2. A resposta conterá o objeto `qrCode` com o EMV e URL do QR Code
3. Verifique com o gerente BB se o convênio tem essa funcionalidade habilitada
4. Configure webhook para receber pagamentos PIX em tempo real

### 5.9 TypeScript Adapter Skeleton

```typescript
// src/platform/payment-gateway/adapters/bb.adapter.ts
import { getCachedToken, setCachedToken } from '../token-cache';
import type { PaymentGatewayAdapter, ChargeEmissionPayload, GatewayChargeResult } from '../adapter.interface';

const TOKEN_URLS = {
  sandbox: 'https://oauth.sandbox.bb.com.br/oauth/token',
  homologacao: 'https://oauth.hm.bb.com.br/oauth/token',
  production: 'https://oauth.bb.com.br/oauth/token',
} as const;

const API_BASE_URLS = {
  sandbox: 'https://api.sandbox.bb.com.br',
  homologacao: 'https://api.hm.bb.com.br',
  production: 'https://api.bb.com.br',
} as const;

export class BancoDoBrasilAdapter implements PaymentGatewayAdapter {
  private tokenUrl: string;
  private apiBaseUrl: string;
  private gwHeader: string;

  constructor(private tenantId: string, private creds: BBCredentials) {
    const env = process.env.NODE_ENV === 'production' ? 'production' : 'sandbox';
    this.tokenUrl = TOKEN_URLS[env];
    this.apiBaseUrl = API_BASE_URLS[env];
    this.gwHeader = env === 'production' ? 'gw-app-key' : 'gw-dev-app-key';
  }

  private async getToken(): Promise<string> {
    const cacheKey = `gateway:bb:token:${this.tenantId}`;
    const cached = await getCachedToken(cacheKey);
    if (cached) return cached;

    const baseAuth = Buffer.from(`${this.creds.client_id}:${this.creds.client_secret}`).toString('base64');
    const url = `${this.tokenUrl}?grant_type=client_credentials&scope=cobranca.registro-boletos`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${baseAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'cache-control': 'no-cache',
      },
    });

    if (!resp.ok) throw new Error(`BB token error: ${resp.status} ${await resp.text()}`);
    const data = await resp.json() as { access_token: string; expires_in: number };

    // TTL curto — 10min com margem de 60s
    await setCachedToken(cacheKey, data.access_token, (data.expires_in ?? 600) - 60);
    return data.access_token;
  }

  async emitCharge(charge: ChargeEmissionPayload): Promise<GatewayChargeResult> {
    const token = await this.getToken();

    // Nosso número: 20 dígitos = '000' + convenio(7) + sequencial(10)
    const seq = charge.sequentialNumber ?? Date.now() % 10000000000;
    const nossoNumero = gerarNossoNumero(this.creds.convenio, seq);

    // BB usa formato dd.MM.yyyy
    const formatDate = (iso: string) => {
      const [y, m, d] = iso.split('-');
      return `${d}.${m}.${y}`;
    };

    const payload = {
      numeroConvenio: Number(this.creds.convenio),
      numeroCarteira: Number(this.creds.carteira),
      numeroVariacaoCarteira: Number(this.creds.variacao_carteira),
      codigoModalidade: 1,
      dataEmissao: formatDate(new Date().toISOString().split('T')[0]),
      dataVencimento: formatDate(charge.dueDate),
      valorOriginal: Number(charge.amount),
      codigoAceite: 'A',
      codigoTipoTitulo: 2,
      descricaoTipoTitulo: 'DUPLICATA MERCANTIL',
      indicadorPermissaoRecebimentoParcial: 'N',
      numeroTituloBeneficiario: '1',
      campoUtilizacaoBeneficiario: charge.description?.slice(0, 25) ?? '',
      numeroTituloCliente: nossoNumero,
      mensagemBloquetoOcorrencia: '',
      pagador: {
        tipoInscricao: charge.payer.document.replace(/\D/g, '').length <= 11 ? 1 : 2,
        numeroInscricao: charge.payer.document.replace(/\D/g, ''),
        nome: charge.payer.name.slice(0, 40),
        endereco: charge.payer.address,
        cep: charge.payer.zipCode.replace(/\D/g, ''),
        cidade: charge.payer.city,
        bairro: charge.payer.neighborhood,
        uf: charge.payer.state,
        telefone: charge.payer.phone?.replace(/\D/g, '') ?? '',
      },
      indicadorPix: 'S',
    };

    const resp = await fetch(`${this.apiBaseUrl}/cobrancas/v2/boletos`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        [this.gwHeader]: this.creds.gw_app_key,
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`BB emit error: ${resp.status} ${err}`);
    }

    const data = await resp.json() as BBBoletoResponse;
    return {
      externalId: nossoNumero,
      barCode: data.codigoBarraNumerico,
      digitableLine: data.linhaDigitavel,
      pixQrCode: data.qrCode?.emv,
      status: 'issued',
    };
  }

  async cancelCharge(externalId: string): Promise<void> {
    const token = await this.getToken();

    const resp = await fetch(`${this.apiBaseUrl}/cobrancas/v2/boletos/${externalId}/baixar`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        [this.gwHeader]: this.creds.gw_app_key,
      },
      body: JSON.stringify({ numeroConvenio: Number(this.creds.convenio) }),
    });

    if (!resp.ok) throw new Error(`BB cancel error: ${resp.status} ${await resp.text()}`);
  }

  async getChargeStatus(externalId: string): Promise<GatewayStatusResult> {
    const token = await this.getToken();

    const resp = await fetch(
      `${this.apiBaseUrl}/cobrancas/v2/boletos?numeroConvenio=${this.creds.convenio}&numeroTituloCliente=${externalId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          [this.gwHeader]: this.creds.gw_app_key,
        },
      }
    );

    if (!resp.ok) throw new Error(`BB status error: ${resp.status}`);
    const data = await resp.json() as BBBoletoListResponse;
    const boleto = data.boletos?.[0];
    if (!boleto) return { externalId, status: 'emitida' };

    const statusMap: Record<string, string> = {
      NORMAL: 'pendente_pagamento',
      PAGO: 'paga',
      BAIXADO: 'cancelada',
      VENCIDO: 'vencida',
    };

    return {
      externalId,
      status: statusMap[boleto.situacaoTitulo] ?? 'emitida',
      paidAmount: boleto.valorPago,
    };
  }
}

function gerarNossoNumero(convenio: number | string, sequencial: number): string {
  const conv = String(convenio).padStart(7, '0');
  const seq = String(sequencial).padStart(10, '0');
  return `000${conv}${seq}`;
}
```

---

## 6. Matriz Comparativa

| Característica | Banco Inter | Cora | C6 Bank | Banco do Brasil |
|---|---|---|---|---|
| **Código COMPE** | 077 | 403 | 336 | 001 |
| **Autenticação** | mTLS + OAuth2 | mTLS + OAuth2 | OAuth2 Basic | OAuth2 Basic |
| **client_secret** | ✅ | ❌ (só cert) | ✅ | ✅ |
| **Certificado mTLS** | ✅ Obrigatório | ✅ Obrigatório | ⚠️ Para boleto | ❌ |
| **Header extra** | ❌ | ❌ | ❌ | `gw-app-key` ✅ |
| **Token TTL** | 3600s (1h) | 86400s (24h) | ~1800s (30min) | 600s (10min) |
| **Boleto** | ✅ | ✅ | ✅ | ✅ |
| **PIX standalone** | ⚠️ Desabilitado | ✅ | ⚠️ Não confirmado | ✅ (via webhook) |
| **Boleto + PIX** | ✅ (automático) | ✅ payment_forms | ⚠️ Não confirmado | ✅ indicadorPix=S |
| **Idempotency Key** | ❌ | ✅ Obrigatório | ❌ | ❌ |
| **Convênio** | ❌ | ❌ | ❌ | ✅ Obrigatório |
| **Valores em centavos** | ❌ (float R$) | ✅ (int centavos) | ❌ (float R$) | ❌ (float R$) |
| **Status retorno** | `codigoSolicitacao` | UUID `id` | A confirmar | `numeroTituloCliente` |
| **Sandbox disponível** | ✅ | ✅ | ✅ (requer aprovação) | ✅ |
| **Doc pública** | ✅ | ✅ | ⚠️ Fechada | ✅ |
| **Webhook pagamento** | ✅ | ✅ | A confirmar | ✅ (PIX only real-time) |

---

## 7. Padrão de Cache de Token (Redis)

```typescript
// src/platform/payment-gateway/token-cache.ts
import { getRedisClient } from '../../infra/redis';

export async function getCachedToken(key: string): Promise<string | null> {
  const redis = getRedisClient();
  return redis.get(key);
}

export async function setCachedToken(key: string, token: string, ttlSeconds: number): Promise<void> {
  const redis = getRedisClient();
  await redis.set(key, token, { EX: ttlSeconds });
}
```

**Estratégia de TTL por banco:**

| Banco | TTL do banco | TTL no cache (com margem) |
|---|---|---|
| Inter | 3600s | 3540s (−60s) |
| Cora | 86400s | 86100s (−300s) |
| C6 Bank | ~1800s | 1740s (−60s) |
| BB | 600s | 540s (−60s) |

---

## 8. Tratamento de mTLS

```typescript
// src/platform/payment-gateway/mtls-agent.ts
// Para Node.js 18+ com undici (fetch nativo)
import { Agent } from 'undici';

export function buildMtlsAgent(certPem: string, keyPem: string): Agent {
  return new Agent({
    connect: {
      cert: certPem,
      key: keyPem,
      rejectUnauthorized: true,
    },
  });
}
```

**Como usar com `fetch` nativo do Node.js 18+:**

```typescript
import { buildMtlsAgent } from '../mtls-agent';

const agent = buildMtlsAgent(creds.certificate_pem, creds.private_key_pem);

const resp = await fetch(url, {
  method: 'POST',
  headers: { ... },
  body: '...',
  // @ts-ignore — dispatcher é propriedade undici, válida no Node 18+
  dispatcher: agent,
});
```

**Preparação dos certificados:**

O certificado e a chave privada devem ser armazenados como strings PEM no campo `gateway_credentials_encrypted` (criptografados com AES-256-GCM conforme definido no projeto).

```bash
# Converter .p12/.pfx para PEM
openssl pkcs12 -in certificado.pfx -nokeys -out cert.pem
openssl pkcs12 -in certificado.pfx -nocerts -nodes -out key.pem
```

---

## 9. Convenções de Credenciais Criptografadas

Para cada banco, o JSON armazenado (após criptografia AES-256-GCM) em `escritorio_config.gateway_credentials_encrypted`:

### Inter
```json
{
  "client_id": "...",
  "client_secret": "...",
  "certificate_pem": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
  "private_key_pem": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
}
```

### Cora
```json
{
  "client_id": "...",
  "certificate_pem": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
  "private_key_pem": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
}
```

### C6 Bank
```json
{
  "client_id": "...",
  "client_secret": "...",
  "conta": "123456",
  "agencia": "0001",
  "codigo_cedente": "..."
}
```

### Banco do Brasil
```json
{
  "client_id": "...",
  "client_secret": "...",
  "gw_app_key": "...",
  "convenio": "3128557",
  "carteira": "17",
  "variacao_carteira": "35"
}
```

---

## 10. Roadmap de Sprints

### Sprint K — Anti-spam WhatsApp (já planejado)
*(sem mudanças)*

### Sprint L — Universal Gateway (Primeira Fase)

**Objetivos:**
- Implementar `mtls-agent.ts` e `token-cache.ts`
- Implementar e testar `inter.adapter.ts` (sandbox)
- Implementar e testar `cora.adapter.ts` (sandbox)
- Criar migration 025 (extensão `escritorio_config` para todos os gateways)
- Criar interface no portal para configuração parametrizada do gateway
- Formulários dinâmicos via `GATEWAY_REGISTRY` (campos por banco)
- **Iniciar processo de cadastro no C6 Bank developers portal**

### Sprint M — Universal Gateway (Segunda Fase)

**Objetivos:**
- Implementar `bb.adapter.ts` (testar com sandbox BB)
- Implementar `c6bank.adapter.ts` (após obter credenciais do portal)
- Migration 026 para log de troca de gateway (`gateway_change_log`)
- Endpoint `PATCH /escritorio/gateway` para troca parametrizada
- Testes de smoke em sandbox para todos os adapters

### Sprint N — Estorno + Reconciliação

**Objetivos:**
- Implementar estado `estornada` na máquina de estados
- Webhook normalization layer (mapear eventos dos 4 bancos → eventos internos)
- Job de polling periódico para status (para cobranças sem webhook configurado)
- Migration 028 (estado estornada)

---

## Referências

- **Banco Inter:** https://developers.inter.co/
- **Cora:** https://developers.cora.com.br/
- **C6 Bank Portal:** https://developers.c6bank.com.br (acesso restrito)
- **Banco do Brasil:** https://developers.bb.com.br
- **BB API Reference:** https://apoio.developers.bb.com.br/referency/post/5f4fb7f5b71fb5001268ca44
- **ACBr Particularidades Bancos:** https://acbr.sourceforge.io/ACBrLib/Particularidades.html
- **BoletoNet C6 Bank PR:** https://github.com/BoletoNet/boletonet/pull/918
- **BB OAuth gist:** https://gist.github.com/hudsantos/73700d33060068cfa9f1c336bf6d41bc

---

*Documento gerado por análise técnica das documentações oficiais e fontes da comunidade de integração bancária. Versão 1.0.0 — Mai/2026.*
