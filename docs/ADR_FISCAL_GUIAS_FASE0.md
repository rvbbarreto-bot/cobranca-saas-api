# ADR — Módulo Fiscal Guias (DAS/DARF) — Fase 0

**Status:** Aprovado (Versão alinhada Exeq) — autorização gerência/coordenação  
**Data:** 2026-05-29  
**Decisores:** Gerência, coordenação de projeto, tech lead  
**Implementadores:** Fábrica full stack (cobranca-saas-api + portal-web)

---

## 1. Contexto

A Exeq vai estender a plataforma multi-escritório (`cobranca-saas-api` + `apps/portal-web`) com captura, compliance, armazenamento e disponibilização de **guias fiscais** (Fase 1: DAS; Fase 2: DARF).

**Premissas aprovadas:**

- Mesmo **PostgreSQL 16** multi-tenant (schema isolado, sem segundo banco).
- Mesmo **portal** (SPA Vite/React), novas rotas/menus — não Next.js separado.
- **Container/processo distinto** para worker de captura fiscal (mesma imagem Docker, `CMD` diferente).
- **Não** introduzir NestJS nem alterar metodologia da fábrica (Express modular, Vitest, `quality:gate`).

**Referências homologadas que não podem regredir:**

- Contrato HTTP baseline: [API_CONTRATO_E_SMOKE.md](./API_CONTRATO_E_SMOKE.md)
- Escopo fase 2: [MVP_ESCOPO_CONGELADO.md](./MVP_ESCOPO_CONGELADO.md)
- Especificação cliente cobrança: [ESPECIFICACAO_BAIXO_NIVEL_CLIENTE.md](./ESPECIFICACAO_BAIXO_NIVEL_CLIENTE.md)
- Mapeamento campo a campo: [FISCAL_GUIAS_MAPEAMENTO_CAMPO.md](./FISCAL_GUIAS_MAPEAMENTO_CAMPO.md)
- Migration Fase 0: `db/migrations/028_fiscal_guias_fase0.sql`

---

## 2. Decisão

### 2.1 Arquitetura

| Camada | Decisão |
|--------|---------|
| Backend | Novo módulo `src/modules/fiscal-guias/` (domain / application / infrastructure / interfaces/http) |
| Rotas portal | Prefixo **`/v1/portal/fiscal/*`** — montagem atrás de flag `FISCAL_GUIAS_ENABLED` até Fase 0 completa |
| Worker | `src/platform/jobs/workers/fiscal-capture.worker.ts` + fila BullMQ `fiscal-capture` |
| Frontend | Novas páginas em `apps/portal-web` (`/guias-fiscais`, etc.) — menu oculto até flag |
| Orquestração | n8n dispara captura via **`POST /v1/inbox/webhooks`** (`event_type: fiscal.capture.requested`) — padrão inbox existente |
| PDF | S3 compatível (Fase 0: colunas `pdf_url` + `pdf_storage_key`; upload na Fase 1) |
| WhatsApp | Adapter existente (`notification-send`); evento `guia.disponivel` via n8n outbound |

### 2.2 Modelo de dados

- **Schema novo:** `fiscal` — **somente `CREATE`**, zero `ALTER` em tabelas homologadas (`public.*`, `portal.*`, `automacao.*`).
- **`tenant_id`:** `TEXT` — alinhado a `portal.cliente.tenant_id` e `portal.membership.tenant_id` (id do escritório em `automacao.tenants`), **não** UUID de `public.tenants`.
- **`empresa`:** reutiliza **`portal.cliente`** (CNPJ do tomador/devedor). Coluna `portal_cliente_id UUID` nas tabelas fiscais; sem tabela `fiscal.empresa` duplicada na Fase 0.
- **`usuario`:** reutiliza **`portal.app_user`** + `membership` — sem auth paralela.
- **Auditoria fiscal:** tabela **`fiscal.audit_log`** dedicada — **não** alterar `CHECK` de `public.audit_log` (evita regressão em homologação).
- **NFS-e legado:** `automacao.fiscal_audit_log` e `/internal/fiscal` (repo EmissaoNF) permanecem **intocados**.

### 2.3 Critério de aceite (negócio → técnico)

Nenhuma guia pode transicionar para `DISPONIVEL` sem, **na mesma transação**:

1. `compliance_status = 'aprovado'`
2. registro em `fiscal.audit_log` (`action = 'guia_disponibilizada'`)
3. `tenant_id` válido (membership portal ativa)
4. `portal_cliente_id` existente no tenant

---

## 3. Isolamento — o que NÃO quebra homologação

| Área homologada | Estratégia Fase 0 |
|-----------------|-------------------|
| Rotas `/v1/portal/cobrancas`, `/clientes`, auth | **Inalteradas** — fiscal em sub-router novo |
| `GET /health`, `GET /health/ready` | **Inalterados** — probe fiscal opcional em Fase 1 (`FISCAL_SCHEMA_CHECK=1`) |
| `npm run check:db` / probe atual | **Inalterado** — novos checks só com flag |
| `audit_log` public | **Sem ALTER** — auditoria fiscal em `fiscal.audit_log` |
| `automacao.*` (NFS-e n8n) | **Sem ALTER** |
| `charges`, RLS UUID | **Sem ALTER** |
| Portal RBAC existente | Estender menu via flag; guards novos só em rotas `/fiscal/*` |
| Testes integração existentes | **Todos devem continuar verdes** — novos testes em arquivos separados |
| Migrações 000–027 | **Preservadas** — próxima: `028_fiscal_guias_fase0.sql` (aditiva) |

### 3.1 Feature flag

```env
# default ausente/false = módulo fiscal invisível em runtime
FISCAL_GUIAS_ENABLED=false
```

- `false`: router fiscal **não montado**; worker fiscal **não registra** consumer.
- `true`: habilita rotas, worker e itens de menu (após UI pronta).

### 3.2 Deploy container worker

```yaml
# docker-compose (homolog) — adição futura, não altera serviço api existente
fiscal-worker:
  image: cobranca-saas-api:latest  # mesma build
  command: ["node", "dist/platform/jobs/workers/fiscal-capture.worker.js"]
  env_file: .env
  depends_on: [postgres, redis, migrate]
```

---

## 4. Contrato HTTP (Fase 0 — esqueleto documentado)

Montagem prevista em `createPortalRouter()` **somente se** `FISCAL_GUIAS_ENABLED=true`:

| Método | Caminho | Papel | Fase |
|--------|---------|-------|------|
| GET | `/v1/portal/fiscal/guias` | admin, operador | 0 (list vazia) / 1 |
| GET | `/v1/portal/fiscal/guias/:guiaId` | admin, operador | 1 |
| GET | `/v1/portal/fiscal/guias/:guiaId/pdf` | admin, operador | 1 |
| POST | `/v1/portal/fiscal/certificados` | admin | 1 |
| GET | `/v1/portal/fiscal/certificados` | admin | 1 |
| POST | `/v1/portal/fiscal/procuracoes` | admin | 1 |
| GET | `/v1/portal/fiscal/procuracoes` | admin | 1 |

**Inbox (n8n → API):** reutilizar `POST /v1/inbox/webhooks` com payload:

```json
{
  "event_type": "fiscal.capture.requested",
  "portal_cliente_id": "uuid",
  "tipo_guia": "DAS",
  "competencia": "2026-04",
  "idempotency_key": "tenant:cliente:competencia:tipo"
}
```

**DARF (Fase 2.2)** — campos adicionais obrigatórios:

```json
{
  "event_type": "fiscal.capture.requested",
  "portal_cliente_id": "uuid",
  "tipo_guia": "DARF",
  "competencia": "2026-06",
  "codigo_receita": "0561",
  "periodo_apuracao": "2026-06-30",
  "idempotency_key": "tenant:cliente:2026-06:DARF"
}
```

Processamento **assíncrono** (job BullMQ) — nunca síncrono no handler HTTP.

Atualizar [API_CONTRATO_E_SMOKE.md](./API_CONTRATO_E_SMOKE.md) **antes do merge** de cada endpoint implementado.

---

## 5. Máquina de estados (`guia_fiscal.status`)

Estados canônicos (UPPER_SNAKE — domínio fiscal; distinto de cobrança lowercase):

```
PROCESSANDO → DISPONIVEL | CANCELADO
DISPONIVEL → PAGO | VENCIDO | EM_CONTESTACAO | CANCELADO
VENCIDO → PAGO | EM_CONTESTACAO | CANCELADO
EM_CONTESTACAO → DISPONIVEL | CANCELADO | RETIFICADO
RETIFICADO → (nova versão em guia_fiscal_versao; guia pai → PROCESSANDO ou DISPONIVEL)
PAGO → (terminal)
CANCELADO → (terminal)
```

Implementação espelha `charge-status-transition.ts`: função pura `evaluateGuiaFiscalStatusTransition`.

---

## 6. Segurança (Fase 0 vs backlog)

| Requisito | Fase 0 | Backlog transversal |
|-----------|--------|---------------------|
| JWT portal existente | ✅ Reutilizar | — |
| MFA obrigatório | — | Épico identity-access |
| AES-256 certificados A1 | ✅ Padrão `encrypt`/`decrypt` platform | — |
| Rate limit | ✅ Mesmo middleware portal | — |
| Refresh token | — | Épico auth |

Certificados A1: **somente admin_escritorio** pode POST; blob cifrado; nunca logar PEM.

---

## 7. Plano Fase 0 (fábrica)

| # | Entrega | DoD | Status |
|---|---------|-----|--------|
| 0.1 | Migration `028_fiscal_guias_fase0.sql` | `npm run migrate` verde; zero ALTER legado | ✅ DDL pronto |
| 0.2 | Schemas Zod + domain types | Testes unitários parsers | ✅ |
| 0.3 | `evaluateGuiaFiscalStatusTransition` + testes | Cobertura domain | ✅ |
| 0.4 | Repositório read-only + `GET /v1/portal/fiscal/guias` | Integração cross-tenant | ✅ |
| 0.5 | Flag + worker esqueleto BullMQ | Flag off = sem rotas/worker | ✅ |
| 0.6 | Worker esqueleto + fila | Não consome se flag off | ✅ (mesmo PR que 0.5) |
| 0.7 | Doc contrato + PORTAL_WEB.md (menu futuro) | PR review PO | 🟡 contrato HTTP; menu UI pendente |
| 0.8 | `quality:gate` completo | Baseline homologação verde | 🟡 rodar após migrate |

**Fora Fase 0:** captura Receita real, S3 upload, MFA, conciliação bancária.

---

## 11. Fase 1.1 — entregue (autorização PO)

| # | Entrega | Status |
|---|---------|--------|
| 1.1 | Inbox `fiscal.capture.requested` → fila `fiscal-capture` | ✅ |
| 1.2 | Worker persiste `fiscal.guia_fiscal` + `fiscal.audit_log` | ✅ |
| 1.3 | `GET /v1/portal/fiscal/guias/:guiaId` | ✅ |
| 1.4 | Portal `/guias-fiscais` + detalhe (`VITE_FISCAL_GUIAS_ENABLED`) | ✅ |
| 1.5 | Stub homolog `FISCAL_CAPTURE_STUB=true` (sem Receita) | ✅ |
| 1.6 | Teste integração inbox → guia | ✅ |

**Próximo (Fase 1.2):** gateway Receita real, S3 PDF, POST certificados/procurações, notificação WhatsApp `guia.disponivel`.

---

## 12. Fase 1.2 — entregue

| # | Entrega | Status |
|---|---------|--------|
| 1.2.1 | Gateway Receita DAS HTTP/mTLS (`RECEITA_DAS_CAPTURE_URL`) | ✅ |
| 1.2.2 | Upload PDF → S3 compatível ou storage local | ✅ |
| 1.2.3 | `POST /v1/portal/fiscal/certificados` e `/procuracoes` (admin) | ✅ |
| 1.2.4 | WhatsApp `guia.disponivel` via fila `notifications-send` + n8n outbound | ✅ |
| 1.2.5 | Compliance pós-captura + audit `capture_failed` / `compliance_bloqueio` | ✅ |

**Env (captura real):**

```env
FISCAL_GUIAS_ENABLED=true
FISCAL_CAPTURE_STUB=false
RECEITA_DAS_CAPTURE_URL=https://gateway-receita.exemplo/v1
ENCRYPTION_KEY=<64 hex chars>
S3_BUCKET=exeq-fiscal-pdfs
S3_REGION=sa-east-1
# opcional: S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, FISCAL_PDF_PUBLIC_BASE_URL
# homolog sem S3: FISCAL_PDF_STORAGE=local
```

**Próximo (Fase 2):** sec. 15 — DARF + conciliação guia fiscal (autorizado PO).

**Homolog E2E:** [FISCAL_HOMOLOG_E2E.md](./FISCAL_HOMOLOG_E2E.md) — `npm run receita:mock:gateway` + `RUN_FISCAL_HOMOLOG_E2E=1 npm run fiscal:homolog:e2e`.

**Contrato gateway Receita DAS** — `POST {RECEITA_DAS_CAPTURE_URL}/das/capture` (mTLS):

```json
{ "cnpj": "11222333000181", "competencia": "2026-06", "tipo_guia": "DAS", "procurador_documento": "12345678901" }
```

Resposta:

```json
{
  "valor_principal": 250.00,
  "valor_multa": 0,
  "valor_juros": 0,
  "data_vencimento": "2026-06-20",
  "linha_digitavel": "...",
  "pix_copia_cola": "...",
  "pdf_base64": "...",
  "compliance_status": "aprovado"
}
```


---

## 8. Riscos mitigados

| Risco | Mitigação |
|-------|-----------|
| Regressão homologação cobrança | Schema isolado; flag; testes existentes no gate |
| Colisão com NFS-e `automacao.fiscal_audit_log` | Schema `fiscal.*` separado |
| Confusão tenant UUID vs TEXT | ADR + FK lógica via TEXT; docs no mapeamento |
| Certificado A1 vazamento | Worker dedicado; criptografia; RBAC admin-only |

---

## 9. Consequências

**Positivas:** time único, gate único, portal unificado, reuso inbox/n8n/WhatsApp/audit patterns.

**Negativas:** monólito cresce (aceitável para time atual); MFA e refresh token ficam para épico transversal.

---

## 13. Autorização PO — desenvolvimento paralelo (2026-05-30)

**Decisão PO + gestores + tech lead:** a fábrica **segue** com entregas que **não dependem** da config Receita/S3/Z-API do cliente piloto.

| Entrega | Status |
|---------|--------|
| UI portal Config. fiscal (certificado + procuração) | ✅ |
| n8n workflow stub `fiscal-capture-stub-homolog` (DAS) | ✅ |
| n8n workflow stub `fiscal-capture-darf-stub-homolog` (DARF) | ✅ |
| Runbook treinamento escritório | ✅ [FISCAL_TREINAMENTO_ESCRITORIO.md](./FISCAL_TREINAMENTO_ESCRITORIO.md) |
| Homolog real Receita | ⏸ Aguardando cliente |
| DARF + conciliação guia fiscal | 🟡 **Autorizado Fase 2** — sec. 15 |
| MFA / refresh token | 📋 Backlog épico transversal |

**Ambiente interno enquanto aguarda cliente:** `FISCAL_CAPTURE_STUB=true` ou mock `http://127.0.0.1:19443`.

---

## 14. Fase 1.3 — entregue (autorização PO sequencial 2026-05-30)

**Decisão PO:** próxima demanda sequencial após 1.2 — operação portal na guia **sem** depender de Receita real (DARF permanece Fase 2).

| # | Entrega | Status |
|---|---------|--------|
| 1.3.1 | `GET /v1/portal/fiscal/guias/:guiaId/pdf-url` (URL assinada S3/local + audit `download_pdf`) | ✅ |
| 1.3.2 | `POST /v1/portal/fiscal/guias/:guiaId/pagamentos` (baixa manual → status `PAGO`) | ✅ |
| 1.3.3 | Portal detalhe guia — botão PDF + formulário pagamento (admin) | ✅ |
| 1.3.4 | Testes integração cross-tenant PDF/pagamento | ✅ |

**Próximo (Fase 2):** ver sec. 15 — autorização PO registrada.

---

## 15. Fase 2 — autorizada (PO sequencial 2026-05-29)

**Decisão PO + gestores + tech lead:** a fábrica **inicia** a Fase 2 — captura **DARF** e **conciliação bancária** de guias fiscais — reutilizando o trilho DAS (inbox, worker, portal, S3, compliance, notificação).

**Premissas (mesmas da sec. 13):**

- Desenvolvimento **paralelo** permitido com `FISCAL_CAPTURE_STUB=true` / mock gateway — **não** bloqueia homolog Receita real do cliente piloto.
- Schema `fiscal.*` já prevê `tipo_guia = 'DARF'` (migration 028); novas migrations só se campos/constraints exigirem.
- Contrato HTTP e portal: atualizar [API_CONTRATO_E_SMOKE.md](./API_CONTRATO_E_SMOKE.md) e [PORTAL_WEB.md](./PORTAL_WEB.md) **antes do merge** de cada endpoint/tela.
- `quality:gate` verde; testes cross-tenant em arquivos separados; zero regressão cobrança/portal baseline.

| # | Entrega | DoD | Status |
|---|---------|-----|--------|
| 2.1 | Gateway Receita **DARF** HTTP/mTLS (`POST …/darf/capture`, espelho DAS) | Stub homolog + testes unitários parser resposta | ✅ |
| 2.2 | Inbox `tipo_guia: DARF` → worker `fiscal-capture` → `fiscal.guia_fiscal` | Integração inbox → guia DARF; idempotência por tenant/cliente/competencia/tipo | ✅ |
| 2.3 | Stub homolog DARF (`FISCAL_CAPTURE_STUB` ou mock gateway `:19443`) | E2E script estendido ou caso dedicado em [FISCAL_HOMOLOG_E2E.md](./FISCAL_HOMOLOG_E2E.md) | ✅ |
| 2.4 | Portal — lista/detalhe/filtros **DAS + DARF** (`tipo_guia`, labels, competência) | `portal:test` + flag `VITE_FISCAL_GUIAS_ENABLED` | ✅ |
| 2.5 | n8n workflow captura DARF (stub homolog) | JSON em `docs/n8n/workflows/` | ✅ |
| 2.6 | **Conciliação bancária guia fiscal** — matching pagamento externo → `guia_pagamento` (`meio: conciliacao`) → status `PAGO` | Regra de matching documentada; audit `status_change`; testes integração | ✅ |
| 2.7 | WhatsApp `guia.disponivel` para DARF (mesmo template/evento) | Job notifications-send; opt-in cliente | ✅ |

**Fora de escopo Fase 2 (permanece backlog):**

- MFA obrigatório portal, refresh token (épico identity-access).
- Homolog **Receita real** DARF no cliente piloto — ⏸ até credenciais/URL gateway (mesmo gate da sec. 13).
- Retificação/contestação avançada (`EM_CONTESTACAO`, `RETIFICADO`) além do que a máquina de estados já suporta.
- NFS-e / `/internal/fiscal` (repo EmissaoNF).

**Contrato gateway Receita DARF (proposto, alinhar com fornecedor):**

`POST {RECEITA_DAS_CAPTURE_URL}/darf/capture` (mTLS — mesma base URL env):

```json
{
  "cnpj": "11222333000181",
  "competencia": "2026-06",
  "tipo_guia": "DARF",
  "codigo_receita": "0561",
  "periodo_apuracao": "2026-06-20",
  "procurador_documento": "12345678901"
}
```

Resposta: mesmo shape da sec. 12 (valores, vencimento, linha digitável, PIX, `pdf_base64`, `compliance_status`).

**Ordem sugerida fábrica:** 2.1 → 2.2 → 2.3 → 2.4 → 2.7 → 2.6 (conciliação por último — depende de regra PO/contábil de matching).

---

## 16. Autorização PO — Fase 2.4 portal (sequencial 2026-05-31)

**Decisão PO + gestores + tech lead:** a fábrica **segue** com a próxima demanda sequencial da Fase 2 — **portal lista/detalhe/filtros DAS + DARF** — sem depender de homolog Receita real do cliente piloto.

| # | Entrega | DoD | Status |
|---|---------|-----|--------|
| 2.4.1 | Filtro `tipo_guia` (Todos / DAS / DARF) na lista `/guias-fiscais` | Query `GET …/guias?tipo_guia=`; `portal:test` | ✅ |
| 2.4.2 | Labels e badges legíveis (tipo, status, compliance) | UI alinhada ao contrato API | ✅ |
| 2.4.3 | Detalhe guia — distinção visual DAS vs DARF | `GuiaFiscalDetalhePage` + tipos `api.ts` | ✅ |
| 2.4.4 | Filtro opcional por competência (`YYYY-MM`) | Query param documentado | ✅ |
| 2.4.5 | Docs `PORTAL_WEB.md` + smoke manual | Sem breaking change em rotas existentes | ✅ |

**Premissas:**

- Backend 2.1–2.3 já entregue; **não** exige nova migration para 2.4.
- Flag `VITE_FISCAL_GUIAS_ENABLED=true` + `FISCAL_GUIAS_ENABLED=true` na API.
- Fora deste item: n8n DARF (2.5), conciliação (2.6), homolog Receita real — permanecem conforme sec. 15.

**Próximo após 2.4:** item 2.5 (workflow n8n captura DARF stub).

**Status sec. 16:** ✅ entregue (2026-05-31).

---

## 17. Entregas Fase 2.6 + 2.7 (2026-05-29)

### 2.7 — WhatsApp `guia.disponivel` DAS + DARF

- Template global `guia.disponivel` (migration **`030_fiscal_guia_disponivel_tipo_guia_template.sql`**) usa variável `{{tipo_guia}}` (rótulo legível DAS/DARF).
- Job `notifications-send` já enfileirado pelo worker `fiscal-capture` para qualquer `tipo_guia`; opt-in `portal.cliente.opt_in_whatsapp` respeitado.
- Testes: `tests/platform/jobs/notification-send-processor.test.ts` (casos DAS e DARF).

### 2.6 — Conciliação bancária guia fiscal

Inbox **`POST /v1/inbox/webhooks`** com `event_type: fiscal.guia.reconciliation.requested`:

```json
{
  "event_type": "fiscal.guia.reconciliation.requested",
  "idempotency_key": "tenant:bank-tx-001",
  "valor_pago": 250.00,
  "data_pagamento": "2026-06-20",
  "guia_fiscal_id": "550e8400-e29b-41d4-a716-446655440000",
  "linha_digitavel": "34191.79001 01043.510047 91020.150008 8 84410026000",
  "referencia_externa": "extrato-banco-123",
  "comprovante_url": "https://storage/comprovante.pdf"
}
```

**Regra de matching (PO/contábil MVP):**

1. Informe **`guia_fiscal_id`** **ou** **`linha_digitavel`** (normalizada — só dígitos).
2. Guia deve estar em `DISPONIVEL` ou `VENCIDO` no tenant (automacao via `billing_tenant_link`).
3. `valor_pago` deve coincidir com `valor_total` (tolerância ± R$ 0,01).
4. Idempotência por `idempotency_key` em `guia_pagamento.metadata.reconciliation_idempotency_key`.
5. Efeito: `guia_pagamento` com `meio: conciliacao` + status guia `PAGO` + audit `status_change`.

Erros inbox (dead letter): `FISCAL_GUIA_NOT_FOUND`, `FISCAL_GUIA_AMBIGUOUS`, `FISCAL_VALOR_MISMATCH`, `FISCAL_TRANSITION_DENIED`.

Testes: `tests/fiscal-guias/fiscal-guia-reconciliation.integration.test.ts`, `match-guia-for-reconciliation.test.ts`.

**Status sec. 17:** ✅ entregue (2026-05-29).

---

## 10. Aprovação

| Papel | Status | Data |
|-------|--------|------|
| Gerência / Coordenação | **Aprovado — Versão alinhada Exeq** | 2026-05-29 |
| Tech Lead | Implementação autorizada Fase 0 | 2026-05-29 |
| PO | Critérios aceite guia vinculados | 2026-05-29 |
| PO | **Implementação Fase 2 autorizada** (sec. 15 — DARF + conciliação guia) | 2026-05-29 |
| PO | **Fase 2.4 portal DAS+DARF autorizada** (sec. 16) | 2026-05-31 |

---

*Próximo passo imediato da fábrica: homolog Receita real DARF/DAS no cliente piloto (sec. 13 — on hold) ou retificação/contestação avançada (backlog sec. 15).*
