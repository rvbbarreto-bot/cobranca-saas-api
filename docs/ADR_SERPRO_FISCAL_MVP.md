# ADR-SERPRO-001 — Arquitetura MVP Automação Fiscal SERPRO

**Status:** Proposed (Sprint 0 — EXEQ-FISC-004)  
**Data:** 2026-06-06  
**Decisores:** PO Exeq, Tech Lead, Arquitetura  
**Contexto:** [`ANALISE_TECNICA_ARQUITETURAL_SERPRO_MVP.md`](./ANALISE_TECNICA_ARQUITETURAL_SERPRO_MVP.md)  
**Referência externa:** [Integra Contador SERPRO](https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/)

---

## 1. Contexto

A Exeq possui módulo `fiscal-guias` (captura DAS/DARF via gateway HTTP customizado), certificados A1, BullMQ e portal multi-escritório. **Não há** integração nativa SERPRO, apuração PGDAS-D (`TRANSDECLARACAO11`), consulta de recibo nem ingestão CSV.

**Objetivo MVP Fase 1:** ciclo completo CSV → validação → transmissão SERPRO → recibo → DAS PDF → histórico auditável.

---

## 2. Decisões

### D1 — Adapter SERPRO in-process (Opção C híbrida)

**Decisão:** Novo módulo `src/modules/serpro-integra-contador/` na API existente; **não** microserviço separado na Fase 1.

**Motivo:** Reuso de cert vault, BullMQ, audit, portal BFF; time-to-market menor.

**Seam:** `SerproIntegraContadorClient` + factory `RECEITA_GATEWAY_PROVIDER=serpro|exeq|mock`.

### D2 — Processamento 100% assíncrono

**Decisão:** Portal **nunca** chama SERPRO de forma síncrona. Fluxo: HTTP → persistência → fila BullMQ → worker → SERPRO.

**Filas novas:**

| Fila | Responsabilidade |
|------|------------------|
| `fiscal-ingest-validate` | Parser CSV → modelo canônico |
| `fiscal-serpro-transmit` | `PGDASD/TRANSDECLARACAO11` |
| `fiscal-serpro-recibo` | `CONSDECREC15` / `CONSULTIMADECREC14` |
| `fiscal-serpro-emit-das` | `PGDASD/GERARDAS12` → `fiscal.guia_fiscal` |

**Reuso:** padrão DLQ, idempotency, `fiscal-capture-processor.ts`.

### D3 — Modelo organizacional (`portal.organization`)

**Decisão:** Introduzir `portal.organization` + `organization_membership`; escritórios atuais backfill `type=escritorio`.

**Motivo:** Suportar Exeq, BPO, franqueado sem “conta pai” limitada.

**Compatibilidade:** `tenant_id TEXT` (automacao) permanece; `organization_id` eixo comercial novo.

### D4 — Certificate Vault dedicado

**Decisão:** `fiscal.certificate_vault` separado de tabelas de negócio; deprecar `fiscal.certificado_digital` após migração.

**Motivo:** Pilar segurança; rotação e owner_type (empresa | escritório | exeq).

### D5 — Ingestão com modelo canônico

**Decisão:** Interface `IngestionAdapter`; MVP só `CsvIngestionAdapter`; saída `CanonicalApuracao` (Zod).

**Motivo:** CSV, Excel, API ERP convergem no mesmo motor fiscal.

Spec CSV: [`templates/PGDASD_CSV_SPEC.md`](./templates/PGDASD_CSV_SPEC.md).

### D6 — Rastreabilidade `fiscal.processamento_fiscal`

**Decisão:** Entidade central com status machine, protocolo SERPRO, recibo, link `guia_fiscal_id`, timeline em `processamento_evento`.

**Audit:** estender `fiscal.audit_log` (apuracao_iniciada, transmitida, erro_serpro, etc.).

### D7 — Config SERPRO por organização

**Decisão:** `fiscal.serpro_config` cifrado; feature flag `FISCAL_SERPRO_ENABLED` por org.

**Contratante:** CNPJ Exeq na Loja SERPRO (PO); escritórios operam via procuração.

### D8 — UX mobile-first (refator AppShell)

**Decisão:** Redesign shell fiscal (drawer mobile, stepper transmissão); não patch visual pontual.

Wireframes S0: [`ux/FISCAL_MVP_WIREFRAMES.md`](./ux/FISCAL_MVP_WIREFRAMES.md).

### D9 — Homologação em camadas

| Nível | Ferramenta |
|-------|------------|
| L0 | Mock gateway existente + fixtures JSON |
| L1 | SERPRO swagger demo |
| L2 | `scripts/serpro-demo-spike.mjs` → evidência |
| L3 | Piloto 1 CNPJ homolog |

**CI:** fixtures SERPRO; sem chamada prod em PR.

### D10 — Fora do escopo MVP

- DCTFWeb (Fase 3)
- APIs ERP (Fase 2)
- Cobrança/payment-gateway (sem alteração)
- KMS por org (roadmap pós-MVP)

---

## 3. Fluxo MVP (sequência)

```text
Upload CSV → fiscal-ingest-validate → CanonicalApuracao VALIDADO
    → POST processamentos → fiscal-serpro-transmit (TRANSDECLARACAO11)
    → fiscal-serpro-recibo (CONSDECREC15)
    → fiscal-serpro-emit-das (GERARDAS12)
    → fiscal.guia_fiscal + PDF storage
    → Portal download + histórico
```

---

## 4. Migrations planejadas (S1+)

| Migration | Conteúdo |
|-----------|----------|
| `032_organization.sql` | `portal.organization`, membership |
| `033_certificate_vault.sql` | vault + backfill script |
| `034_processamento_fiscal.sql` | processamento + eventos |
| `035_serpro_config.sql` | config org cifrada |

**Regra:** schema `fiscal` — somente CREATE; anti-regressão ADR fiscal Fase 0.

---

## 5. APIs portal (novas — resumo)

| Método | Path | Sprint alvo |
|--------|------|-------------|
| POST | `/v1/portal/fiscal/ingest/csv` | S3 |
| GET | `/v1/portal/fiscal/ingest/:id` | S3 |
| POST | `/v1/portal/fiscal/processamentos` | S5 |
| GET | `/v1/portal/fiscal/processamentos` | S5 |
| GET | `/v1/portal/fiscal/processamentos/:id` | S5 |
| GET | `/v1/portal/fiscal/processamentos/:id/recibo/url` | S6 |
| PATCH | `/v1/portal/fiscal/serpro-config` | S1 |
| POST | `/v1/portal/fiscal/procuracoes/validar-serpro` | S2 |

---

## 6. Riscos aceitos (Sprint 0)

| Risco | Mitigação |
|-------|-----------|
| Credenciais SERPRO atrasadas | Mocks + spike stub; S1–S3 não dependem |
| Payload PGDASD complexo | CSV layout v1 mínimo; evoluir v2 |
| Dual tenant UUID/TEXT | Testes cross-tenant; org bridge explícito |
| Jira indisponível | Backlog Git + prefixo EXEQ-FISC-XXX |

---

## 7. Consequências

**Positivas:** Reuso ~40–60% infra fiscal; MVP demonstrável em homolog demo SERPRO.

**Negativas:** Workers co-located até Fase 4; refator org + vault toca migrations e portal.

---

## 8. Aprovação Sprint 0

| Papel | Nome | Data | Status |
|-------|------|------|--------|
| PO | Ricardo / Exeq | 2026-06-06 | Autorizado início S0 |
| Tech Lead | _pendente_ | | |
| Arquitetura | _pendente_ | | |

---

*ADR gerado na Sprint 0 — revisar antes de merge migrations S1.*
