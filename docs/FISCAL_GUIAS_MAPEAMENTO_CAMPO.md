# Mapeamento campo a campo — Guia Fiscal (Fase 0)

**ADR:** [ADR_FISCAL_GUIAS_FASE0.md](./ADR_FISCAL_GUIAS_FASE0.md)  
**Migration:** `db/migrations/028_fiscal_guias_fase0.sql`  
**Schemas Zod:** `src/modules/fiscal-guias/domain/schemas/`

---

## 1. Entidades reutilizadas (sem duplicar)

| Spec original | Tabela/API existente | Regra |
|---------------|---------------------|-------|
| `tenant` | `automacao.tenants` + claim JWT portal `tid` | `tenant_id TEXT` em todas as tabelas `fiscal.*` |
| `empresa` | `portal.cliente` | FK `portal_cliente_id`; CNPJ em `portal.cliente.documento` (14 dígitos) |
| `usuario` | `portal.app_user` + `portal.membership` | `uploaded_by_user_id`, `created_by_user_id` opcionais UUID |
| `audit_log` (genérico) | `public.audit_log` | **Não alterar** — usar `fiscal.audit_log` |
| `workflow_execution` | BullMQ job id + `correlation_id` HTTP | Coluna `capture_job_id TEXT`; n8n execution id em `metadata JSONB` |

---

## 2. `fiscal.guia_fiscal`

### 2.1 Mapeamento spec → SQL → API JSON

| Campo spec | Coluna SQL | Tipo SQL | JSON API (snake_case) | Zod / validação | Notas contábeis |
|------------|------------|----------|----------------------|-----------------|-----------------|
| `id` | `id` | `UUID PK` | `id` | `z.string().uuid()` | — |
| `tenant_id` | `tenant_id` | `TEXT NOT NULL` | *(header JWT — não no body)* | middleware | Escritório contábil |
| `empresa_id` | `portal_cliente_id` | `UUID NOT NULL` | `portal_cliente_id` | `z.string().uuid()` | Empresa = cliente portal (CNPJ) |
| `tipo_guia` | `tipo_guia` | `TEXT CHECK` | `tipo_guia` | `z.enum(['DAS','DARF'])` | Fase 1: só `DAS` |
| `competencia` | `competencia` | `TEXT CHECK` | `competencia` | `competenciaSchema` | Formato `YYYY-MM` (PA DAS) |
| — | `data_vencimento` | `DATE` | `data_vencimento` | `z.string().date()` | Obrigatório p/ disponibilizar |
| `valor_principal` | `valor_principal` | `NUMERIC(14,2)` | `valor_principal` | `valorMonetarioSchema` | Valor devido principal |
| `valor_multa` | `valor_multa` | `NUMERIC(14,2) DEFAULT 0` | `valor_multa` | `valorMonetarioSchema.optional()` | Multa Mora |
| `valor_juros` | `valor_juros` | `NUMERIC(14,2) DEFAULT 0` | `valor_juros` | `valorMonetarioSchema.optional()` | Juros |
| — | `valor_total` | `NUMERIC(14,2) GENERATED` | `valor_total` | read-only | `principal + multa + juros` |
| `linha_digitavel` | `linha_digitavel` | `TEXT` | `linha_digitavel` | `linhaDigitavelSchema.nullable()` | 47 ou 48 dígitos |
| `pix_copia_cola` | `pix_copia_cola` | `TEXT` | `pix_copia_cola` | `z.string().max(512).nullable()` | EMV PIX |
| `status` | `status` | `TEXT CHECK` | `status` | `guiaFiscalStatusSchema` | Ver §4 |
| `pdf_url` | `pdf_url` | `TEXT` | `pdf_url` | read-only | URL presigned ou pública |
| — | `pdf_storage_key` | `TEXT` | — | internal | Chave S3 |
| — | `compliance_status` | `TEXT CHECK` | `compliance_status` | `complianceStatusSchema` | Gate aceite |
| — | `compliance_motivo` | `TEXT` | `compliance_motivo` | read-only | Motivo bloqueio |
| — | `versao_atual` | `INT DEFAULT 1` | `versao_atual` | read-only | Incrementa em retificação |
| — | `idempotency_key` | `TEXT NOT NULL` | — | inbox | `UNIQUE (tenant_id, idempotency_key)` |
| — | `created_at` / `updated_at` | `TIMESTAMPTZ` | `created_at`, `updated_at` | ISO8601 | — |

### 2.2 Unicidade de negócio

```text
UNIQUE (tenant_id, portal_cliente_id, tipo_guia, competencia, versao_atual)
```

Evita duas guias DAS ativas mesma competência; retificação incrementa `versao_atual` e insere linha em `guia_fiscal_versao`.

---

## 3. `fiscal.guia_fiscal_versao`

| Campo | Coluna SQL | JSON API | Zod |
|-------|------------|----------|-----|
| id | `id UUID` | `id` | uuid |
| guia | `guia_fiscal_id UUID FK` | `guia_fiscal_id` | uuid |
| versão | `versao_numero INT` | `versao_numero` | int ≥ 1 |
| motivo | `motivo TEXT` | `motivo` | `z.enum(['retificacao','correcao_sistema','contestacao'])` |
| snapshot | `snapshot JSONB` | `snapshot` | objeto com campos da guia na época |
| auditoria | `created_at` | `created_at` | ISO8601 |

---

## 4. `fiscal.guia_fiscal.status` ↔ Zod

| Status spec | SQL CHECK | Terminal? |
|-------------|-----------|-----------|
| `PROCESSANDO` | ✅ | Não |
| `DISPONIVEL` | ✅ | Não |
| `PAGO` | ✅ | **Sim** |
| `CANCELADO` | ✅ | **Sim** |
| `RETIFICADO` | ✅ | Transição → nova versão |
| `VENCIDO` | ✅ | Não |
| `EM_CONTESTACAO` | ✅ | Não |

```typescript
// src/modules/fiscal-guias/domain/schemas/guia-fiscal-status.schema.ts
export const guiaFiscalStatusSchema = z.enum([
  "PROCESSANDO",
  "DISPONIVEL",
  "PAGO",
  "CANCELADO",
  "RETIFICADO",
  "VENCIDO",
  "EM_CONTESTACAO"
]);
```

---

## 5. `fiscal.compliance_status`

| Valor | Significado | Pode ir a DISPONIVEL? |
|-------|-------------|------------------------|
| `pendente` | Aguardando validação | Não |
| `aprovado` | Compliance OK | **Sim** |
| `bloqueado` | Regra fiscal falhou | Não |
| `dispensado` | Admin override auditado | Sim (com audit) |

---

## 6. `fiscal.certificado_digital`

| Campo spec | Coluna SQL | JSON POST body | Zod |
|------------|------------|----------------|-----|
| id | `id UUID` | — | — |
| tenant | `tenant_id TEXT` | — | middleware |
| empresa | `portal_cliente_id UUID` | `portal_cliente_id` | uuid |
| — | `label TEXT` | `label` | `z.string().min(1).max(80)` |
| — | `valid_from DATE` | `valid_from` | date |
| — | `valid_until DATE` | `valid_until` | date |
| cert A1 | `cert_encrypted TEXT` | `certificado_pem` | `z.string().min(100)` → cifrar antes persistir |
| chave | `key_encrypted TEXT` | `chave_privada_pem` | idem |
| IV | `encryption_iv TEXT` | — | gerado server-side |
| — | `uploaded_by_user_id UUID` | — | JWT `sub` |

**Regra:** body recebe PEM em HTTPS; persistência **sempre** cifrada (`platform/crypto/encrypt`).

---

## 7. `fiscal.procuracao`

| Campo spec | Coluna SQL | JSON body | Zod |
|------------|------------|-----------|-----|
| id | `id UUID` | — | — |
| tenant | `tenant_id TEXT` | — | middleware |
| empresa | `portal_cliente_id UUID` | `portal_cliente_id` | uuid |
| — | `tipo TEXT` | `tipo` | `z.enum(['ecac','receita_federal','outro'])` |
| — | `procurador_documento TEXT` | `procurador_documento` | CPF/CNPJ 11 ou 14 dígitos |
| — | `validade_inicio DATE` | `validade_inicio` | date |
| — | `validade_fim DATE` | `valididade_fim` | date |
| — | `ativa BOOLEAN` | `ativa` | boolean default true |
| — | `metadata JSONB` | `metadata` | `z.record(z.unknown()).optional()` |

---

## 8. `fiscal.guia_pagamento`

Rastreio de pagamento da guia (distinto de `public.charges` — não misturar domínios na Fase 0).

| Coluna | Tipo | JSON | Notas |
|--------|------|------|-------|
| `id` | UUID | `id` | — |
| `guia_fiscal_id` | UUID FK | `guia_fiscal_id` | — |
| `tenant_id` | TEXT | — | — |
| `valor_pago` | NUMERIC(14,2) | `valor_pago` | — |
| `data_pagamento` | DATE | `data_pagamento` | — |
| `meio` | TEXT | `meio` | `pix`, `boleto`, `manual`, `conciliacao` |
| `comprovante_url` | TEXT | `comprovante_url` | opcional |
| `created_at` | TIMESTAMPTZ | `created_at` | — |

Transição guia → `PAGO` exige ≥1 pagamento ou confirmação manual admin (audit).

---

## 9. `fiscal.audit_log`

| Ação spec | `action` SQL | `resource_type` |
|-----------|--------------|-----------------|
| Login fiscal | — | *(usar public audit login existente)* |
| Download PDF | `download_pdf` | `guia_fiscal` |
| Consulta guia | `consulta_guia` | `guia_fiscal` |
| Alteração status | `status_change` | `guia_fiscal` |
| Upload certificado | `upload_certificado` | `certificado_digital` |
| Acesso admin | `admin_access` | `fiscal` |
| Guia disponibilizada | `guia_disponibilizada` | `guia_fiscal` |
| Compliance bloqueio | `compliance_bloqueio` | `guia_fiscal` |

Campos: `tenant_id`, `user_id`, `resource_id`, `old_value JSONB`, `new_value JSONB`, `ip_address`, `user_agent`, `created_at`.

---

## 10. Payloads HTTP — Zod entrypoints

| Operação | Parser | Arquivo |
|----------|--------|---------|
| Inbox captura | `parseFiscalCaptureInboxPayload` | `fiscal-capture-inbox.schema.ts` |
| Inbox conciliação | `parseFiscalGuiaReconciliationInboxPayload` | `fiscal-guia-reconciliation.schema.ts` |
| POST pagamento guia | `parsePostGuiaPagamentoBody` | `guia-pagamento.schema.ts` |
| POST certificado | `postCertificadoDigitalBodySchema` | `certificado-digital.schema.ts` |
| POST procuração | `postProcuracaoBodySchema` | `procuracao.schema.ts` |
| List guias query | `listGuiasFiscaisQuerySchema` | `guia-fiscal-query.schema.ts` |
| Resposta guia | `guiaFiscalResponseSchema` | `guia-fiscal.schema.ts` |

---

## 11. Checklist anti-regressão (PR Fase 0)

- [ ] Nenhum `ALTER` em `charges`, `portal.cliente`, `escritorio_config`, `automacao.*`
- [ ] Router fiscal montado só com `FISCAL_GUIAS_ENABLED=true`
- [ ] `npm run quality:gate` verde sem pular testes legados
- [ ] Novo teste `tests/fiscal-guias/cross-tenant-fiscal.integration.test.ts`
- [ ] Contrato documentado antes de expor endpoint além de GET lista vazia
