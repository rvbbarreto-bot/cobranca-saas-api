# Pacote Jira — Automação Fiscal SERPRO (PGDAS-D + DAS)

**Projeto Jira sugerido:** `EXEQ-FISC` ou `EXEQ`  
**Programa:** Evolução Plataforma Exeq — Automação Fiscal SERPRO  
**Origem:** [`ANALISE_TECNICA_ARQUITETURAL_SERPRO_MVP.md`](./ANALISE_TECNICA_ARQUITETURAL_SERPRO_MVP.md)  
**Versão:** 1.0 | **Data:** 2026-06-06

---

## 1. Configuração do projeto Jira

### 1.1 Issue types

| Tipo | Uso |
|------|-----|
| **Epic** | Fase ou domínio (Fundação, SERPRO, UX…) |
| **Story** | Entrega de valor testável |
| **Task** | Tarefa técnica sem story standalone |
| **Sub-task** | Decomposição de Story |
| **Spike** | Investigação time-boxed (S0) |

### 1.2 Components

| Component | Responsável típico |
|-----------|-------------------|
| `backend` | Node/Express |
| `frontend` | portal-web |
| `database` | Migrations PG |
| `devops` | CI/CD, secrets, infra |
| `ux-ui` | Design, wireframes |
| `qa` | Testes, homolog |
| `architecture` | ADR, revisões |
| `pm` | Gestão, PO |

### 1.3 Labels

| Label | Significado |
|-------|-------------|
| `fase-1-mvp` | Escopo MVP obrigatório |
| `fase-2-erp` | APIs ERP |
| `fase-3-dctfweb` | DCTFWeb |
| `fase-4-future` | Backlog evolutivo |
| `serpro` | Integração SERPRO |
| `pgdasd` | Simples Nacional |
| `blocker-externo` | Depende SERPRO/contrato/PO |
| `reuse` | Reaproveita código existente |
| `refactor` | Refatoração |
| `new` | Desenvolvimento novo |
| `mobile-first` | UX responsivo |
| `security` | Segurança/criptografia |

### 1.4 Prioridades

| Prioridade | Critério |
|------------|----------|
| **Highest** | Bloqueia MVP ou integração SERPRO |
| **High** | Caminho crítico Fase 1 |
| **Medium** | Importante, não bloqueia demo |
| **Low** | P1 pós-MVP ou Fase 2+ |

### 1.5 Story Points (referência)

| SP | Horas indicativas |
|----|-------------------|
| 1 | 2–4 h |
| 2 | 4–8 h |
| 3 | 8–12 h |
| 5 | 12–20 h |
| 8 | 20–32 h |
| 13 | 32–48 h |

### 1.6 Sprints (Fase 1 — 2 semanas cada)

| Sprint | Nome | Semanas calendário |
|--------|------|-------------------|
| S0 | Discovery & Kickoff | 1–2 |
| S1 | Organização & Config SERPRO | 3–4 |
| S2 | Certificate Vault | 5–6 |
| S3 | Ingestão CSV | 7–8 |
| S4 | SERPRO Client Spike | 7–8 (paralelo S3) |
| S5 | Apuração & Transmissão | 9–10 |
| S6 | Recibo & Storage | 11–12 |
| S7 | Emissão DAS | 13–14 |
| S8 | Portal UX MVP | 11–14 (paralelo) |
| S9 | Homolog E2E & QA | 15–16 |
| S10 | Hardening & Go-live | 17–18 |

---

## 2. Epics

| Epic Key | Nome | Fase | SP total | Horas |
|----------|------|------|----------|-------|
| **EXEQ-FISC-E00** | S0 — Discovery SERPRO & Kickoff | 1 | 21 | 48–64 |
| **EXEQ-FISC-E01** | Fundação — Organização Multi-Tenant | 1 | 34 | 72–96 |
| **EXEQ-FISC-E02** | Certificate Vault & Procuração SERPRO | 1 | 42 | 88–120 |
| **EXEQ-FISC-E03** | Motor de Ingestão CSV (modelo canônico) | 1 | 39 | 80–108 |
| **EXEQ-FISC-E04** | Cliente SERPRO Integra Contador | 1 | 47 | 96–128 |
| **EXEQ-FISC-E05** | Pipeline Apuração PGDAS-D | 1 | 55 | 112–152 |
| **EXEQ-FISC-E06** | Recibo & Emissão DAS | 1 | 42 | 88–120 |
| **EXEQ-FISC-E07** | Portal UX Fiscal MVP (Mobile First) | 1 | 89 | 180–260 |
| **EXEQ-FISC-E08** | QA, Homologação & DevOps Fiscal | 1 | 55 | 112–160 |
| **EXEQ-FISC-E09** | Fase 2 — APIs ERP & Webhooks | 2 | 34 | 120–180 |
| **EXEQ-FISC-E10** | Fase 3 — DCTFWeb SERPRO | 3 | 55 | 200–300 |
| **EXEQ-FISC-E11** | Fase 4 — Evoluções (franquia, MIT, analytics) | 4 | 42 | 160–280 |

**Total Fase 1:** ~424 SP | ~860 h

---

## 3. Backlog detalhado — Fase 1 (MVP)

### Epic EXEQ-FISC-E00 — S0 Discovery

---

#### EXEQ-FISC-001 [Spike] Credenciais Loja SERPRO & ambiente demo

| Campo | Valor |
|-------|-------|
| **Tipo** | Spike |
| **Sprint** | S0 |
| **Prioridade** | Highest |
| **Component** | pm, architecture |
| **Labels** | `fase-1-mvp`, `serpro`, `blocker-externo` |
| **SP** | 3 |
| **Horas** | 8–12 |
| **Depende de** | — |
| **Responsável** | PO + Arquiteto |

**Descrição:**  
Obter contrato Loja SERPRO, consumer key/secret demo, CNPJ contratante Exeq, documentar URLs base e limites operacionais.

**Critérios de aceite:**
- [ ] Credenciais demo armazenadas em vault (não repo)
- [ ] Documento `docs/SERPRO_CREDENCIAIS_HOMOLOG.md` (sem secrets) com checklist acesso
- [ ] Chamada manual bem-sucedida ao swagger demo SERPRO
- [ ] PO confirma CNPJ contratante e modelo comercial (Exeq centralizado vs por escritório)

---

#### EXEQ-FISC-002 [Story] Layout CSV PGDASD MVP — especificação contábil

| Campo | Valor |
|-------|-------|
| **Sprint** | S0 |
| **Prioridade** | Highest |
| **Component** | architecture, pm |
| **Labels** | `fase-1-mvp`, `pgdasd`, `blocker-externo` |
| **SP** | 5 |
| **Horas** | 12–16 |

**Critérios de aceite:**
- [ ] Template CSV v1 com colunas, tipos e exemplos
- [ ] Mapeamento coluna CSV → `CanonicalApuracao` documentado
- [ ] Validação contábil assinada por PO/contabilidade
- [ ] Arquivo exemplo em `docs/templates/pgdasd-import-v1.csv`

---

#### EXEQ-FISC-003 [Story] Wireframes UX — fluxo CSV → DAS

| Campo | Valor |
|-------|-------|
| **Sprint** | S0 |
| **Prioridade** | High |
| **Component** | ux-ui |
| **Labels** | `fase-1-mvp`, `mobile-first` |
| **SP** | 8 |
| **Horas** | 16–24 |

**Critérios de aceite:**
- [ ] Wireframes: Dashboard, Upload, Stepper transmissão, Histórico, Central Erros
- [ ] Versões mobile + desktop
- [ ] Aprovação PO registrada (comentário Jira ou doc)
- [ ] Link Figma/arquivo anexo na issue

---

#### EXEQ-FISC-004 [Task] ADR — Arquitetura SERPRO MVP

| Campo | Valor |
|-------|-------|
| **Sprint** | S0 |
| **Component** | architecture |
| **SP** | 3 |
| **Horas** | 8–12 |

**Critérios de aceite:**
- [ ] ADR publicado em `docs/ADR_SERPRO_FISCAL_MVP.md`
- [ ] Decisões: adapter in-process, filas, org model, vault, feature flags
- [ ] Revisão tech lead concluída

---

### Epic EXEQ-FISC-E01 — Fundação Organização

---

#### EXEQ-FISC-010 [Story] Migration `portal.organization` + backfill escritórios

| Campo | Valor |
|-------|-------|
| **Sprint** | S1 |
| **Prioridade** | High |
| **Component** | database, backend |
| **Labels** | `fase-1-mvp`, `new` |
| **SP** | 8 |
| **Horas** | 16–24 |
| **Depende de** | EXEQ-FISC-004 |

**Sub-tasks:**
- EXEQ-FISC-010a — SQL migration `032_organization.sql`
- EXEQ-FISC-010b — Script backfill `scripts/backfill-organization-from-tenants.ts`
- EXEQ-FISC-010c — Testes integração isolamento org

**Critérios de aceite:**
- [ ] Tabelas `portal.organization`, `portal.organization_membership`
- [ ] Todo `automacao.tenant` existente → org `type=escritorio`
- [ ] Migration idempotente; só CREATE/INSERT backfill
- [ ] Teste cross-org negativo passando

---

#### EXEQ-FISC-011 [Story] API gestão organização (EXEQ console)

| Campo | Valor |
|-------|-------|
| **Sprint** | S1 |
| **Component** | backend, frontend |
| **Labels** | `fase-1-mvp`, `reuse` |
| **SP** | 5 |
| **Horas** | 12–16 |
| **Depende de** | EXEQ-FISC-010 |

**Critérios de aceite:**
- [ ] `GET/POST/PATCH /v1/exeq/organizations` (ou extensão escritórios)
- [ ] Tipos: exeq, escritorio, bpo (franqueado/parceiro read-only Fase 1)
- [ ] Console EXEQ lista orgs com tipo e status
- [ ] OpenAPI/contrato atualizado

---

#### EXEQ-FISC-012 [Story] Configuração SERPRO por organização

| Campo | Valor |
|-------|-------|
| **Sprint** | S1 |
| **Component** | backend, database |
| **Labels** | `fase-1-mvp`, `serpro`, `security` |
| **SP** | 8 |
| **Horas** | 16–24 |
| **Depende de** | EXEQ-FISC-001, EXEQ-FISC-010 |

**Critérios de aceite:**
- [ ] Tabela `fiscal.serpro_config` (org_id, contratante_cnpj, credenciais cifradas, ambiente demo/prod)
- [ ] API `GET/PATCH /v1/portal/fiscal/serpro-config` (admin only)
- [ ] Feature flag `FISCAL_SERPRO_ENABLED` por org
- [ ] Secrets nunca retornados em GET (máscara)

---

### Epic EXEQ-FISC-E02 — Certificate Vault

---

#### EXEQ-FISC-020 [Story] Migration `fiscal.certificate_vault`

| Campo | Valor |
|-------|-------|
| **Sprint** | S2 |
| **Component** | database |
| **SP** | 5 |
| **Horas** | 8–12 |
| **Depende de** | EXEQ-FISC-010 |

**Critérios de aceite:**
- [ ] Migration `033_certificate_vault.sql`
- [ ] FK org + portal_cliente opcional; owner_type enum
- [ ] Índices validade e status

---

#### EXEQ-FISC-021 [Story] Migrar certificados existentes → vault

| Campo | Valor |
|-------|-------|
| **Sprint** | S2 |
| **Component** | backend, database |
| **Labels** | `refactor`, `security` |
| **SP** | 5 |
| **Horas** | 12–16 |
| **Depende de** | EXEQ-FISC-020 |

**Critérios de aceite:**
- [ ] Script idempotente decrypt → re-insert vault
- [ ] APIs fiscal passam a usar `certificate_vault_id`
- [ ] `fiscal.certificado_digital` deprecated (leitura 1 release)
- [ ] Testes regressão upload PEM existentes passando

---

#### EXEQ-FISC-022 [Story] Alertas expiração certificado (30/15/7 dias)

| Campo | Valor |
|-------|-------|
| **Sprint** | S2 |
| **Prioridade** | Medium |
| **Component** | backend |
| **SP** | 3 |
| **Horas** | 8–12 |

**Critérios de aceite:**
- [ ] Job repeatable diário ou query dashboard
- [ ] Status `expiring` automático
- [ ] Evento audit `certificado_expirando`

---

#### EXEQ-FISC-023 [Story] Procuração — consulta SERPRO `OBTERPROCURACAO41`

| Campo | Valor |
|-------|-------|
| **Sprint** | S2 |
| **Component** | backend |
| **Labels** | `serpro`, `reuse` |
| **SP** | 8 |
| **Horas** | 16–24 |
| **Depende de** | EXEQ-FISC-012, EXEQ-FISC-030 (parcial) |

**Critérios de aceite:**
- [ ] Endpoint `POST /v1/portal/fiscal/procuracoes/validar-serpro`
- [ ] Persiste situação: válida, expirada, inexistente, erro SERPRO
- [ ] Bloqueio transmissão se procuração inválida (configurável)
- [ ] Mensagem amigável para suporte (central erros)

---

### Epic EXEQ-FISC-E03 — Ingestão CSV

---

#### EXEQ-FISC-030 [Story] Modelo canônico `CanonicalApuracao` + Zod

| Campo | Valor |
|-------|-------|
| **Sprint** | S3 |
| **Component** | backend |
| **Labels** | `pgdasd`, `new` |
| **SP** | 5 |
| **Horas** | 12–16 |
| **Depende de** | EXEQ-FISC-002 |

**Critérios de aceite:**
- [ ] Schema em `src/modules/fiscal-ingestion/domain/canonical-apuracao.schema.ts`
- [ ] Testes unitários cobertura >90% regras SN MVP
- [ ] Documentação mapeamento CSV → canônico

---

#### EXEQ-FISC-031 [Story] `CsvIngestionAdapter` + parser

| Campo | Valor |
|-------|-------|
| **Sprint** | S3 |
| **Component** | backend |
| **SP** | 8 |
| **Horas** | 16–24 |
| **Depende de** | EXEQ-FISC-030 |

**Critérios de aceite:**
- [ ] Interface `IngestionAdapter` extensível (CSV MVP)
- [ ] Parser UTF-8, delimiter configurável, header obrigatório
- [ ] Erros linha a linha com número da linha e campo

---

#### EXEQ-FISC-032 [Story] API upload CSV + validação assíncrona

| Campo | Valor |
|-------|-------|
| **Sprint** | S3 |
| **Component** | backend |
| **SP** | 8 |
| **Horas** | 16–24 |
| **Depende de** | EXEQ-FISC-031 |

**Critérios de aceite:**
- [ ] `POST /v1/portal/fiscal/ingest/csv` (multipart, rate limit)
- [ ] Fila `fiscal-ingest-validate` BullMQ
- [ ] `GET /v1/portal/fiscal/ingest/:id` status VALIDANDO|VALIDADO|ERRO
- [ ] Relatório erros JSON downloadável

---

#### EXEQ-FISC-033 [Story] Interface futura Excel/API/ERP (stub)

| Campo | Valor |
|-------|-------|
| **Sprint** | S3 |
| **Prioridade** | Low |
| **Component** | architecture, backend |
| **SP** | 2 |
| **Horas** | 4–8 |

**Critérios de aceite:**
- [ ] Interfaces documentadas; adapters retornam `not_implemented`
- [ ] ADR ingestion menciona extensão Fase 2

---

### Epic EXEQ-FISC-E04 — Cliente SERPRO

---

#### EXEQ-FISC-040 [Story] Módulo `serpro-integra-contador` — client HTTP base

| Campo | Valor |
|-------|-------|
| **Sprint** | S4 |
| **Prioridade** | Highest |
| **Component** | backend |
| **Labels** | `serpro`, `new` |
| **SP** | 13 |
| **Horas** | 24–40 |
| **Depende de** | EXEQ-FISC-001, EXEQ-FISC-012 |

**Sub-tasks:**
- EXEQ-FISC-040a — OAuth2 token cache Redis
- EXEQ-FISC-040b — Request builder (contratante/autor/contribuinte/pedidoDados)
- EXEQ-FISC-040c — mTLS com cert vault
- EXEQ-FISC-040d — Error mapper SERPRO → domínio

**Critérios de aceite:**
- [ ] `SerproIntegraContadorClient` com paths Apoiar/Consultar/Declarar/Emitir
- [ ] Retry idempotente + circuit breaker
- [ ] Testes contrato com fixtures JSON (sem prod em CI)
- [ ] Spike demo: `CONSULTIMADECREC14` homolog OK

---

#### EXEQ-FISC-041 [Story] Implementar `SerproFiscalGateway` (interface existente)

| Campo | Valor |
|-------|-------|
| **Sprint** | S4 |
| **Component** | backend |
| **Labels** | `serpro`, `reuse` |
| **SP** | 5 |
| **Horas** | 12–16 |
| **Depende de** | EXEQ-FISC-040 |

**Critérios de aceite:**
- [ ] Factory `RECEITA_GATEWAY_PROVIDER=serpro|exeq|mock`
- [ ] Implementa `ReceitaFiscalGateway` ou gateway paralelo documentado
- [ ] Testes unitários mapper resposta → `ReceitaCaptureResult`

---

### Epic EXEQ-FISC-E05 — Pipeline Apuração

---

#### EXEQ-FISC-050 [Story] Migration `fiscal.processamento_fiscal` + eventos

| Campo | Valor |
|-------|-------|
| **Sprint** | S5 |
| **Component** | database |
| **SP** | 5 |
| **Horas** | 8–12 |

**Critérios de aceite:**
- [ ] Migration `034_processamento_fiscal.sql`
- [ ] Status machine documentada
- [ ] `fiscal.processamento_evento` timeline

---

#### EXEQ-FISC-051 [Story] Worker `fiscal-serpro-transmit` — TRANSDECLARACAO11

| Campo | Valor |
|-------|-------|
| **Sprint** | S5 |
| **Prioridade** | Highest |
| **Component** | backend |
| **Labels** | `pgdasd`, `serpro` |
| **SP** | 13 |
| **Horas** | 24–40 |
| **Depende de** | EXEQ-FISC-032, EXEQ-FISC-040, EXEQ-FISC-050 |

**Critérios de aceite:**
- [ ] Fila BullMQ dedicada; concorrência configurável
- [ ] Idempotency key por org+cliente+competência
- [ ] Persiste protocolo SERPRO e resposta bruta auditável
- [ ] Pré-checks: cert, procuração, config SERPRO
- [ ] **Nunca** sync HTTP portal → SERPRO (sempre fila)

---

#### EXEQ-FISC-052 [Story] API iniciar/listar/detalhe processamento fiscal

| Campo | Valor |
|-------|-------|
| **Sprint** | S5 |
| **Component** | backend |
| **SP** | 8 |
| **Horas** | 16–24 |
| **Depende de** | EXEQ-FISC-051 |

**Critérios de aceite:**
- [ ] `POST /v1/portal/fiscal/processamentos` (from ingest validado)
- [ ] `GET /v1/portal/fiscal/processamentos` paginado + filtros
- [ ] `GET /v1/portal/fiscal/processamentos/:id` com timeline eventos
- [ ] RBAC: operador vê; admin configura

---

#### EXEQ-FISC-053 [Story] Audit trail apuração SERPRO

| Campo | Valor |
|-------|-------|
| **Sprint** | S5 |
| **Component** | backend |
| **Labels** | `reuse` |
| **SP** | 3 |
| **Horas** | 6–10 |

**Critérios de aceite:**
- [ ] Ações em `fiscal.audit_log`: apuracao_iniciada, transmitida, erro_serpro
- [ ] correlation_id propagado do HTTP ao worker

---

### Epic EXEQ-FISC-E06 — Recibo & DAS

---

#### EXEQ-FISC-060 [Story] Worker recibo — CONSDECREC15 / CONSULTIMADECREC14

| Campo | Valor |
|-------|-------|
| **Sprint** | S6 |
| **Component** | backend |
| **Labels** | `serpro`, `pgdasd` |
| **SP** | 8 |
| **Horas** | 16–24 |
| **Depende de** | EXEQ-FISC-051 |

**Critérios de aceite:**
- [ ] Após TRANSMITIDA → job recibo automático
- [ ] PDF recibo em object storage; `recibo_storage_key` preenchido
- [ ] Status RECIBO_OK ou ERRO com detalhe

---

#### EXEQ-FISC-061 [Story] Worker emissão DAS — GERARDAS12 → guia_fiscal

| Campo | Valor |
|-------|-------|
| **Sprint** | S7 |
| **Prioridade** | Highest |
| **Component** | backend |
| **Labels** | `serpro`, `reuse` |
| **SP** | 13 |
| **Horas** | 24–40 |
| **Depende de** | EXEQ-FISC-060 |

**Critérios de aceite:**
- [ ] Fila `fiscal-serpro-emit-das`
- [ ] Cria/atualiza `fiscal.guia_fiscal` com PDF, linha digitável, valores
- [ ] Status processamento CONCLUIDO; link guia_fiscal_id
- [ ] Notificação WhatsApp opcional (reuse enqueue existente)

---

#### EXEQ-FISC-062 [Story] Download DAS + recibo (API presigned)

| Campo | Valor |
|-------|-------|
| **Sprint** | S7 |
| **Component** | backend |
| **Labels** | `reuse` |
| **SP** | 3 |
| **Horas** | 6–10 |

**Critérios de aceite:**
- [ ] `GET .../processamentos/:id/recibo/url`
- [ ] Reuse padrão `get-portal-guia-fiscal-pdf-url.ts` para DAS
- [ ] Audit download_pdf

---

### Epic EXEQ-FISC-E07 — Portal UX MVP

---

#### EXEQ-FISC-070 [Story] Design system fiscal + shell mobile-first

| Campo | Valor |
|-------|-------|
| **Sprint** | S8 (início S1 UX) |
| **Component** | ux-ui, frontend |
| **Labels** | `mobile-first`, `refactor` |
| **SP** | 13 |
| **Horas** | 24–40 |

**Critérios de aceite:**
- [ ] Sidebar colapsável / drawer mobile
- [ ] Tokens CSS fiscal; cards responsivos
- [ ] AppShell refatorado sem regressão cobrança

---

#### EXEQ-FISC-071 [Story] Tela Dashboard Operacional Fiscal

| Campo | Valor |
|-------|-------|
| **Sprint** | S8 |
| **Component** | frontend |
| **SP** | 8 |
| **Horas** | 16–24 |

**Critérios de aceite:**
- [ ] KPIs: processamentos mês, erros abertos, certs expirando
- [ ] Mobile: cards empilhados
- [ ] Link rápido upload CSV

---

#### EXEQ-FISC-072 [Story] Tela Upload CSV + relatório validação

| Campo | Valor |
|-------|-------|
| **Sprint** | S8 |
| **Component** | frontend |
| **SP** | 8 |
| **Horas** | 16–24 |
| **Depende de** | EXEQ-FISC-032 |

**Critérios de aceite:**
- [ ] Drag-drop CSV; feedback progresso
- [ ] Lista erros por linha; botão corrigir e reenviar
- [ ] Botão "Iniciar transmissão" só se VALIDADO

---

#### EXEQ-FISC-073 [Story] Stepper fluxo transmissão (tempo real)

| Campo | Valor |
|-------|-------|
| **Sprint** | S8 |
| **Component** | frontend |
| **SP** | 8 |
| **Horas** | 16–24 |
| **Depende de** | EXEQ-FISC-052 |

**Critérios de aceite:**
- [ ] Steps: Validado → Transmitindo → Recibo → Emitindo DAS → Concluído
- [ ] Polling 3s ou SSE; mensagens em linguagem não técnica
- [ ] Mobile: stepper vertical

---

#### EXEQ-FISC-074 [Story] Histórico Processamentos + Central Erros

| Campo | Valor |
|-------|-------|
| **Sprint** | S8 |
| **Component** | frontend |
| **SP** | 8 |
| **Horas** | 16–24 |

**Critérios de aceite:**
- [ ] Filtros: competência, empresa, status, erro
- [ ] Central erros agrupa por código SERPRO traduzido
- [ ] Ação sugerida por tipo erro (ex.: renovar procuração)

---

#### EXEQ-FISC-075 [Story] Gestão Certificados (refator ConfigFiscal)

| Campo | Valor |
|-------|-------|
| **Sprint** | S8 |
| **Component** | frontend |
| **Labels** | `refactor`, `reuse` |
| **SP** | 5 |
| **Horas** | 12–16 |
| **Depende de** | EXEQ-FISC-021 |

**Critérios de aceite:**
- [ ] Lista certs por empresa/escritório; badges expiração
- [ ] Upload PEM reuse PemCertificatePairUploader
- [ ] Rota `/fiscal/certificados`

---

#### EXEQ-FISC-076 [Story] Gestão Procurações + diagnóstico SERPRO

| Campo | Valor |
|-------|-------|
| **Sprint** | S8 |
| **Component** | frontend |
| **SP** | 5 |
| **Horas** | 12–16 |
| **Depende de** | EXEQ-FISC-023 |

**Critérios de aceite:**
- [ ] Botão "Validar no SERPRO"
- [ ] Indicador visual semáforo (verde/amarelo/vermelho)

---

#### EXEQ-FISC-077 [Story] Tela Configuração SERPRO

| Campo | Valor |
|-------|-------|
| **Sprint** | S8 |
| **Component** | frontend |
| **SP** | 5 |
| **Horas** | 12–16 |
| **Depende de** | EXEQ-FISC-012 |

**Critérios de aceite:**
- [ ] Form ambiente demo/prod; contratante CNPJ
- [ ] Admin only; operador não acessa

---

#### EXEQ-FISC-078 [Story] Download DAS — extensão GuiaFiscalDetalhe

| Campo | Valor |
|-------|-------|
| **Sprint** | S8 |
| **Component** | frontend |
| **Labels** | `reuse` |
| **SP** | 3 |
| **Horas** | 6–10 |

**Critérios de aceite:**
- [ ] Link processamento → guia → PDF
- [ ] Botão download mobile friendly

---

#### EXEQ-FISC-079 [Story] Gestão Empresas — extensão ClientesPage

| Campo | Valor |
|-------|-------|
| **Sprint** | S8 |
| **Prioridade** | Medium |
| **Component** | frontend |
| **Labels** | `reuse` |
| **SP** | 5 |
| **Horas** | 10–14 |

**Critérios de aceite:**
- [ ] Indicadores fiscal por cliente: cert, procuração, último processamento
- [ ] Atalho "Nova apuração"

---

#### EXEQ-FISC-080 [Story] Auditoria fiscal (admin)

| Campo | Valor |
|-------|-------|
| **Sprint** | S8 |
| **Prioridade** | Low (P1) |
| **Component** | frontend, backend |
| **SP** | 5 |
| **Horas** | 12–16 |

**Critérios de aceite:**
- [ ] `GET /v1/portal/fiscal/audit` paginado
- [ ] Tela read-only filtros data/ação/usuário

---

### Epic EXEQ-FISC-E08 — QA & DevOps

---

#### EXEQ-FISC-090 [Story] Script E2E homolog SERPRO demo

| Campo | Valor |
|-------|-------|
| **Sprint** | S9 |
| **Component** | qa, backend |
| **SP** | 8 |
| **Horas** | 16–24 |

**Critérios de aceite:**
- [ ] `scripts/fiscal-serpro-homolog-e2e.ts`
- [ ] Evidência JSON em `docs/evidencias/`
- [ ] Fluxo completo CSV mock → transmit → recibo → DAS (demo)

---

#### EXEQ-FISC-091 [Story] Testes integração cross-tenant processamento

| Campo | Valor |
|-------|-------|
| **Sprint** | S9 |
| **Component** | qa, backend |
| **SP** | 5 |
| **Horas** | 12–16 |

**Critérios de aceite:**
- [ ] `tests/fiscal-serpro/cross-tenant-processamento.integration.test.ts`
- [ ] CI verde

---

#### EXEQ-FISC-092 [Story] Playwright E2E portal fiscal

| Campo | Valor |
|-------|-------|
| **Sprint** | S9 |
| **Component** | qa, frontend |
| **SP** | 8 |
| **Horas** | 16–24 |

**Critérios de aceite:**
- [ ] Fluxo upload → stepper → download (mock API ou stub)
- [ ] Job CI opcional `fiscal-portal-e2e`

---

#### EXEQ-FISC-093 [Story] DevOps — secrets SERPRO + CI job fiscal

| Campo | Valor |
|-------|-------|
| **Sprint** | S9–S10 |
| **Component** | devops |
| **SP** | 5 |
| **Horas** | 12–16 |

**Critérios de aceite:**
- [ ] `.env.example` atualizado; check-prod-env valida SERPRO prod
- [ ] GitHub Actions step testes fiscal-serpro (fixtures)
- [ ] Runbook deploy feature flag

---

#### EXEQ-FISC-094 [Story] Observabilidade SLI fiscal

| Campo | Valor |
|-------|-------|
| **Sprint** | S10 |
| **Component** | devops, backend |
| **SP** | 5 |
| **Horas** | 12–16 |

**Critérios de aceite:**
- [ ] Métricas: fila depth, p95 transmit, taxa erro SERPRO
- [ ] Doc `docs/observability/sli-fiscal-definitions.md`

---

#### EXEQ-FISC-095 [Story] Hardening segurança + checklist go-live

| Campo | Valor |
|-------|-------|
| **Sprint** | S10 |
| **Component** | architecture, devops, qa |
| **Labels** | `security` |
| **SP** | 5 |
| **Horas** | 12–16 |

**Critérios de aceite:**
- [ ] Checklist go-live assinado PO/Tech
- [ ] Rate limits upload; revisão ENCRYPTION_KEY
- [ ] Rollback feature flag testado

---

#### EXEQ-FISC-096 [Task] Gestão projeto — marcos e riscos (contínuo)

| Campo | Valor |
|-------|-------|
| **Sprint** | S0–S10 |
| **Component** | pm |
| **SP** | 13 |
| **Horas** | 48–64 |

**Critérios de aceite:**
- [ ] Dashboard Jira atualizado por sprint
- [ ] Riscos R1–R8 com owner e status
- [ ] Retrospectivas documentadas

---

## 4. Backlog resumido — Fases 2, 3 e 4

### Epic EXEQ-FISC-E09 — Fase 2 ERP (120–180 h)

| Key | Story | SP |
|-----|-------|-----|
| EXEQ-FISC-100 | `WebhookIngestionAdapter` — receber apuração ERP | 8 |
| EXEQ-FISC-101 | `RestIngestionAdapter` — API parceiro documentada OpenAPI | 8 |
| EXEQ-FISC-102 | Autenticação API key por organização + rate limit | 5 |
| EXEQ-FISC-103 | Portal — credenciais API + logs webhook | 5 |
| EXEQ-FISC-104 | Testes contrato + sandbox ERP mock | 5 |

### Epic EXEQ-FISC-E10 — Fase 3 DCTFWeb (200–300 h)

| Key | Story | SP |
|-----|-------|-----|
| EXEQ-FISC-110 | Cliente DCTFWeb SERPRO (TRANSDECLARACAO310) | 13 |
| EXEQ-FISC-111 | Consulta recibo CONSRECIBO32 | 8 |
| EXEQ-FISC-112 | Emissão guia GERARGUIA31 / DARF MAED | 13 |
| EXEQ-FISC-113 | Modelo canônico DCTF + validação | 8 |
| EXEQ-FISC-114 | Portal fluxo DCTFWeb + UX | 13 |
| EXEQ-FISC-115 | Homolog E2E DCTFWeb | 8 |

### Epic EXEQ-FISC-E11 — Fase 4 Evoluções (160–280 h)

| Key | Story | SP |
|-----|-------|-----|
| EXEQ-FISC-120 | Billing franquia/parceiro por org | 8 |
| EXEQ-FISC-121 | MIT apuração (ENCAPURACAO314) | 13 |
| EXEQ-FISC-122 | Parcelamentos SN (PARCSN) | 8 |
| EXEQ-FISC-123 | Analytics fiscal dashboard avançado | 8 |
| EXEQ-FISC-124 | Workers fiscal serviço separado (scale) | 8 |

---

## 5. Mapa de dependências (caminho crítico MVP)

```text
EXEQ-FISC-001 (credenciais SERPRO)
    ├── EXEQ-FISC-012 (config SERPRO)
    └── EXEQ-FISC-040 (client SERPRO)
EXEQ-FISC-002 (layout CSV)
    └── EXEQ-FISC-030 → 031 → 032 (ingestão)
EXEQ-FISC-010 (organization)
    ├── EXEQ-FISC-012
    └── EXEQ-FISC-020 → 021 (vault)
EXEQ-FISC-032 + EXEQ-FISC-040 + EXEQ-FISC-050
    └── EXEQ-FISC-051 (transmit)
        └── EXEQ-FISC-060 (recibo)
            └── EXEQ-FISC-061 (DAS)
EXEQ-FISC-052 + UX 072/073 (portal)
EXEQ-FISC-061 → EXEQ-FISC-090 (E2E homolog)
```

---

## 6. Definition of Done (DoD) — programa

Toda Story Fase 1 só fecha se:

- [ ] Código mergeado em `develop` com PR revisado
- [ ] Testes unitários/integração pertinentes verdes no CI
- [ ] Sem secrets no repositório
- [ ] Migration forward-only (schema fiscal: só CREATE)
- [ ] Audit log em mutações fiscais
- [ ] Documentação mínima (OpenAPI ou README módulo)
- [ ] Feature flag quando integração externa
- [ ] PO aceita critérios em homolog ou demo gravada

**DoD Epic MVP (E00–E08):**  
Empresa piloto executa **CSV → SERPRO → recibo → DAS PDF → histórico** em ambiente demo/homolog com evidência anexada.

---

## 7. Importação no Jira

### Opção A — CSV bulk import

Arquivo: [`docs/jira-import/JIRA_SERPRO_FISCAL_BACKLOG.csv`](./jira-import/JIRA_SERPRO_FISCAL_BACKLOG.csv)

Colunas: Epic Name, Issue Type, Summary, Description, Story Points, Priority, Labels, Components, Sprint Target

**Passos Jira Cloud:**
1. Project Settings → Import → CSV
2. Mapear Epic Name → Epic Link (criar epics primeiro se necessário)
3. Importar Stories; depois Sub-tasks manualmente ou segundo CSV

### Opção B — Criação manual por Epic

1. Criar 12 Epics (E00–E11)
2. Copiar Stories deste doc (seção 3 e 4)
3. Colar critérios de aceite na descrição como checklist
4. Configurar board Kanban/Scrum com swimlanes por Epic

### Opção C — Jira Automation (futuro)

Webhook GitHub PR → transição "Em Review" → merge → "Done" vinculando branch `EXEQ-FISC-XXX`.

---

## 8. Resumo executivo para PO

| Métrica | Valor |
|---------|-------|
| Epics Fase 1 | 9 (E00–E08) |
| Stories/Tasks Fase 1 | 38 issues numeradas |
| Story Points Fase 1 | ~424 SP |
| Horas Fase 1 | ~860 h |
| Sprints Fase 1 | 11 (S0–S10) |
| Issues blocker externo | 001, 002 (+ credenciais) |
| Critério aceite programa | Ciclo CSV→DAS completo auditável |

---

*Pacote gerado a partir da análise técnica v1.0. Ajustar keys (`EXEQ-FISC-XXX`) ao projeto Jira real.*
