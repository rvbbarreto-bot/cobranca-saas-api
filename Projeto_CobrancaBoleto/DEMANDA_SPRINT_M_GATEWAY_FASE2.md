# Pacote de demandas — Sprint M: Gateway fase 2 (BB + C6 + portal dinâmico + troca de gateway)

**Emitido por:** Tech Lead · PO · Arquiteto  
**Para:** Fábrica (IA + dev)  
**Data:** Maio 2026 · **Base:** `main` (pós Sprint L — PR #20 docs, PR #21 código)  
**Prioridade:** P1 · **Estimativa:** 8–12 dias · **Branch sugerida:** `feat/sprint-m-gateway-fase2`  
**Pré-requisito:** [DEMANDA_SPRINT_L_UNIVERSAL_GATEWAY.md](./DEMANDA_SPRINT_L_UNIVERSAL_GATEWAY.md) mergeado (#21)  
**Pesquisa HTTP:** [ESTUDO_APIS_BANCARIAS.md](./ESTUDO_APIS_BANCARIAS.md) §4 (C6), §5 (BB)  
**Arquitetura:** [LLD_REVISADO_v2.md](./LLD_REVISADO_v2.md) · [docs/GATEWAY_UNIVERSAL.md](../docs/GATEWAY_UNIVERSAL.md)

---

## Gate de entrada

```bash
git fetch origin && git checkout main && git pull origin main
git checkout -b feat/sprint-m-gateway-fase2
npm ci && npm run migrate && npm run seed:dev
npm run build && npm test && npm run portal:test
npm run quality:gate
```

**Governança:** [GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md)

---

## Decisões PO (Maio 2026) — vigentes

| Pergunta | Decisão |
|----------|---------|
| Credenciais sandbox **BB** | **Outra sprint** (pacote futuro `DEMANDA_SPRINT_O_BB` ou similar) — **não** bloquear merge de M |
| **C6 Bank** | **Implementar** nesta sprint (`GATEWAY_C6_ENABLED` default **true** em dev; homolog quando houver credenciais) |
| Troca de gateway com cobranças já **emitidas** | **Permitir**, com `gateway_change_log` + `writeAuditLog` (não bloquear por cobranças antigas) |

**Escopo M ajustado:** C6 + portal dinâmico + troca com log. **BB fora** deste PR.

**Inter (Sprint L):** ver secção [Auditoria Inter pós-L](#auditoria-inter-pós-l) — gaps opcionais M.9.

---

## Contexto — o que já existe (Sprint L)

| Item | Caminho | Estado |
|------|---------|--------|
| Factory | `get-gateway-for-tenant.ts` | ✅ Asaas, Inter, Cora |
| Registry | `provider-registry.ts` | BB/C6 com `enabled: false`, campos vazios |
| Migration 025 | `gateway_credentials_encrypted`, CHECK `inter`/`cora` | ✅ |
| Worker emissão | `payment-emission-processor.ts` | ✅ usa factory |
| Portal API | `GET .../gateway/providers`, `PATCH /config` + `gateway_credentials` | ✅ |
| Portal UI | `ConfiguracoesPage.tsx` | ⚠️ só `asaas` \| `pagarme` + api_key fixa |

**Regra:** não duplicar L.0–L.5; **estender** registry, factory loaders, migration 026, portal.

---

## Objetivo Sprint M (PO)

1. **C6 Bank:** adapter + registry + factory loader + testes mock (URLs conforme ESTUDO §4; ajustar quando doc oficial divergir).  
2. **Portal:** formulário de credenciais **dinâmico** (`GATEWAY_REGISTRY`) — Asaas, Inter, Cora, C6 (BB só no registry `enabled: false` até sprint BB).  
3. **Troca de gateway** permitida com `gateway_change_log` + audit (cobranças já emitidas **não** impedem troca).

**Fora de escopo Sprint M:** adapter **BB** sandbox (outra sprint); estorno `estornada` (Sprint N); webhooks normalizados (Sprint N).

---

## M.0 — Registry e tipos (ajustes)

### M.0.1 — `provider-registry.ts`

| Provider | `authType` (corrigir) | `enabled` | Campos obrigatórios (JSON) |
|----------|----------------------|-----------|----------------------------|
| `bb` | `oauth_basic` (sem mTLS no token) | `GATEWAY_BB_ENABLED` | `client_id`, `client_secret`, `gw_app_key`, `numero_convenio`, `numero_carteira`, `numero_variacao_carteira` |
| `c6` | `oauth_basic` (sem mTLS no token; ver ESTUDO §4) | `GATEWAY_C6_ENABLED` (default **true**) | `client_id`, `client_secret`, `codigo_cedente`, `agencia`, `conta`, `modalidade` |

- Corrigir `authType` de BB/C6: **não** usar `mtls_oauth` se o ESTUDO indicar OAuth sem mTLS no token.
- Expor `authType` na API `GET .../providers` para o portal renderizar UX (textarea PEM vs inputs texto).

### M.0.2 — Factory

**Modificar:** `get-gateway-for-tenant.ts`

```typescript
ADAPTER_LOADERS.c6 = (ctx) => new C6BankAdapter(ctx);
// BB: sprint futura (PO) — não registar loader neste PR
```

---

## M.1 — Migration `026_gateway_change_log.sql`

**Criar:** `db/migrations/026_gateway_change_log.sql`

```sql
CREATE TABLE IF NOT EXISTS gateway_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  old_provider TEXT,
  new_provider TEXT NOT NULL,
  changed_by_user_id TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_gateway_change_log_tenant
  ON gateway_change_log (tenant_id, changed_at DESC);

-- CHECK escritorio_config: incluir bb, c6
ALTER TABLE escritorio_config DROP CONSTRAINT IF EXISTS escritorio_config_gateway_provider_check;
ALTER TABLE escritorio_config
  ADD CONSTRAINT escritorio_config_gateway_provider_check
  CHECK (gateway_provider IN ('asaas','pagarme','inter','cora','bb','c6'));

ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_gateway_check;
ALTER TABLE payment_transactions
  ADD CONSTRAINT payment_transactions_gateway_check
  CHECK (gateway IN ('asaas','pagarme','inter','cora','bb','c6'));
```

---

## M.2 — Adapter Banco do Brasil — **ADIADO (outra sprint)**

> PO: credenciais sandbox BB ficam para sprint dedicada. Manter apenas metadata `bb` no registry (`enabled: false`).

**Pasta (futura):** `src/modules/payment-gateway/infrastructure/bb/`

| Arquivo | Função |
|---------|--------|
| `bb-types.ts` | Payloads §5 ESTUDO |
| `bb-oauth.ts` | `Authorization: Basic`, scope `cobranca.registro-boletos`, TTL 600s, cache Redis margem 60s |
| `bb-http-client.ts` | Header `gw-dev-app-key` (sandbox) / `gw-app-key` (prod) em **todas** as chamadas |
| `bb-adapter.ts` | `PaymentGatewayAdapter` — `createCustomer` sintético; `createBoleto` → `POST /cobrancas/v2/boletos` |
| `bb-status-map.ts` | Mapear status BB → `mapGatewayChargeStatus` em `gateway-status-map.ts` |

**Persistir:** `charges.provider_charge_id` = identificador retornado pelo BB (campo conforme resposta sandbox).

**Testes:** `tests/payment-gateway/bb-adapter.test.ts` (mock HTTP, sem rede).

**Script:** `npm run gateway:smoke:bb` + `scripts/gateway-smoke-bb-sandbox.ts` (`RUN_BB_SANDBOX=1`).

---

## M.3 — Adapter C6 Bank (**obrigatório nesta sprint**)

**Pasta:** `src/modules/payment-gateway/infrastructure/c6/`

| Item | Ação |
|------|------|
| OAuth | `Authorization: Basic` + `grant_type=client_credentials` (ESTUDO §4.2) — **sem** mTLS no token |
| HTTP | `fetch` padrão (não `mtls-fetch`) para token e API |
| Emissão | Implementar contra URLs inferidas no ESTUDO; documentar incerteza no PR |
| Testes | `c6-adapter.test.ts` mock HTTP |
| Smoke | `npm run gateway:smoke:c6` (`RUN_CORA_SANDBOX=1` já existe para Cora; criar `RUN_C6_SANDBOX=1`) |

PO autorizou implementar mesmo sem portal developers fechado — homologação real quando credenciais existirem.

---

## M.4 — Troca de gateway (API)

**Criar:** `src/modules/portal-read/application/change-gateway-provider.ts`

| Regra | Detalhe |
|-------|---------|
| Quem | `admin_escritorio` |
| Validação | `validateGatewayCredentials` antes de gravar |
| Efeito | `UPDATE escritorio_config.gateway_provider` + credenciais cifradas |
| Auditoria | `INSERT gateway_change_log` + `writeAuditLog` |
| Bloqueio | **Não bloquear** por cobranças já `emitida` / `paga` — apenas registrar log (decisão PO) |

**Rotas:**

| Método | Caminho | Função |
|--------|---------|--------|
| `PATCH` | `/v1/portal/escritorio/gateway` | Troca provider + `gateway_credentials` (body dedicado) |
| `GET` | `/v1/portal/escritorio/gateway/history` | Últimas N trocas (paginação simples) |

Manter `PATCH /config` compatível (legado).

---

## M.5 — Portal web (formulário dinâmico)

**Modificar:** `apps/portal-web/src/pages/ConfiguracoesPage.tsx` + `apps/portal-web/src/lib/api.ts`

| UX | Implementação |
|----|----------------|
| Select provider | `GET /v1/portal/escritorio/gateway/providers` |
| Campos dinâmicos | `GET .../providers/:id/schema` → render por `credentialFields` (`secret` → password/textarea) |
| Gravar | `PATCH /config` ou `PATCH /gateway` com `gateway_credentials: Record<string,string>` |
| Providers | asaas, inter, cora, c6 (bb oculto até sprint BB) |

**Testes:** atualizar `ConfiguracoesPage.test.tsx` — mock providers schema, submit com credentials.

**Não** commitar PEM reais nos testes.

---

## M.6 — Testes e DoD

```bash
npm run build
npm test
npm run portal:test
npm run quality:gate
```

### Matriz sprint done

| Provider | Unit adapter | Factory loader | Sandbox E2E (opt-in) |
|----------|--------------|----------------|----------------------|
| Asaas/Inter/Cora | regressão verde | — | — |
| **C6** | `c6-adapter.test.ts` | `provider=c6` | `RUN_C6_SANDBOX=1` |
| **BB** | — | — | sprint futura |

### Critérios de aceite (PO)

- [ ] Admin escolhe C6 (ou Inter/Cora) no portal dinâmico e salva credenciais cifradas.
- [ ] Troca Asaas → Inter **permitida** com linha em `gateway_change_log` + audit (cobranças emitidas permanecem no gateway antigo).
- [ ] `gateway_provider=c6` emite em mock/sandbox quando credenciais configuradas.
- [ ] Inter/Cora/Asaas regressão sem alteração de `.env` de produção.
- [ ] Credenciais/certificados nunca em log claro.

---

## M.7 — Documentação

| Arquivo | Ação |
|---------|------|
| [docs/GATEWAY_UNIVERSAL.md](../docs/GATEWAY_UNIVERSAL.md) | BB, C6, troca gateway, diagrama |
| [RETOMADA_FABRICA.md](./RETOMADA_FABRICA.md) | Sprint M → concluído após PR |
| `.env.example` | `GATEWAY_BB_ENABLED`, `GATEWAY_C6_ENABLED`, comentários sandbox BB |

---

## M.8 — PR + handoff

- **Título:** `feat(gateway): BB adapter + portal dinâmico + gateway change log (Sprint M)`
- **Handoff Tech Lead:** credenciais sandbox BB no GitHub Secrets ou 1Password; C6 pendente de PO.

---

## M.9 — Gaps Inter (opcional, não bloquear M)

| Gap | Prioridade | Ação sugerida |
|-----|------------|----------------|
| URL PDF real (`GET .../pdf`) | P2 | Buscar PDF e gravar URL assinada ou proxy interno |
| Portal UI Inter/Cora | **M.5** | Formulário dinâmico cobre |
| `endereco` do `portal.cliente` no worker | P2 | Passar metadata/endereço em `createCustomer` |
| Smoke Inter real | P2 | Evoluir `gateway-smoke-inter-sandbox.ts` |
| Webhook Inter → inbox | Sprint N | Normalização multi-banco |

---

## Auditoria Inter pós-L

Ver tabela em [RETOMADA_FABRICA.md](./RETOMADA_FABRICA.md) secção Inter — resumo: **emissão core OK** via API/worker; **homologação portal + PDF + E2E** incompletos.

---

## Perguntas PO — respondidas

Ver secção **Decisões PO** no topo.

---

## Sprint N (não implementar agora)

- Estado `estornada`, webhooks normalizados, polling agressivo — ver ESTUDO §10 e LLD Sprint N.

---

## Referências código (pós #21)

| Responsabilidade | Caminho |
|------------------|---------|
| Factory | `src/modules/payment-gateway/application/get-gateway-for-tenant.ts` |
| Registry | `src/platform/payment-gateway/provider-registry.ts` |
| Status sync | `src/modules/payment-gateway/domain/gateway-status-map.ts` |
| Portal router | `src/modules/portal-read/interfaces/http/escritorio-router.ts` |
| Config UI | `apps/portal-web/src/pages/ConfiguracoesPage.tsx` |

---

*Documento executável pela fábrica. Payloads HTTP → ESTUDO; ficheiros e fluxo → este documento.*
