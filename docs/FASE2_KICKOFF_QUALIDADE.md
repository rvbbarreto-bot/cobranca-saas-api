# Fase 2 — kickoff (mesmo time, homologação fase 1 adiada)

**Contexto:** a equipa de homologação **não** atuará na fase 1 neste momento. O **mesmo time de desenvolvimento** avança para a **fase 2** com barra de qualidade elevada: cada micro-entrega deve sair com **testes**, **contrato alinhado** e **CI verde**.

**Referência de escopo A/B:** [MVP_ESCOPO_CONGELADO.md](./MVP_ESCOPO_CONGELADO.md) (secção 3 — já não é “escolher só uma” por exclusão de homologação; o time pode **intercalar** A e B em PRs pequenos, mantendo revisão estrita).

---

## 1. Definição de pronto (DoD) por PR — qualidade “até à lua”

| Critério | Obrigatório |
|-----------|-------------|
| `npm run build` + `npm run test:coverage` (≥ **82%** linhas no escopo `application`/`domain` definido em `vitest.config.ts`) + `npm run portal:test` | Sim |
| Se tocar API + Postgres: casos novos em **integração** ou extensão da bateria funcional | Sim |
| Se tocar `POST /v1/portal/clientes` ou concorrência: considerar `npm run test:stress:portal-clientes` local antes de merge | Recomendado |
| Contrato HTTP: atualizar [API_CONTRATO_E_SMOKE.md](./API_CONTRATO_E_SMOKE.md) quando mudar paths/códigos | Sim |
| Front: atualizar [PORTAL_WEB.md](./PORTAL_WEB.md) quando mudar rotas ou env | Sim |

---

## 2. Primeiras frentes (ordem sugerida, ajustável)

1. **B — Portal (foco do utilizador)** — *entregue neste ciclo de código*  
   - Nova cobrança (`/cobrancas/nova` → `POST /v1/portal/cobrancas`), filtro por status na lista, cobranças por cliente no detalhe, export CSV em `/relatorios`.  
   - **P0 entregue:** `PATCH /v1/portal/clientes/:id` e `PATCH /v1/portal/cobrancas/:id` (retificar sem duplicar; cobrança bloqueada se `paga`/`cancelada`).

2. **A — Endurecimento auth / tenants** — *parcial*  
   - Página **Escritório** (`/escritorio`) + **Ajuda core** (`/ajuda/provisionamento-core`) com passos para `POST /v1/tenants/provision`.  
   - Próximo: revisão formal `ENABLE_MOCK_AUTH` / rotação `JWT_SECRET` por runbook de deploy.

3. **Observabilidade**  
   - Fluxos novos reutilizam middleware existente (`x-correlation-id` + log de acesso JSON).

4. **Inbox / webhooks** (quando a fase 2 incluir automação externa)  
   - Contratos de idempotência documentados antes de integrar n8n.

---

## 3. Comando único de verificação local

```bash
npm run migrate
npm run seed:dev    # se o ambiente for novo
npm run quality:gate
```

Inclui `build`, `test:coverage` (meta **82%** no escopo de cobertura da API), `portal:test` e `test:integration` (requer `DATABASE_URL` e schema migrado). Ver `package.json`.

---

## 4. Homologação futura

Quando a equipa de homologação voltar à fase 1 ou à fase 2, usar [PORTAL_WEB_TEST_BATTERY.md](./PORTAL_WEB_TEST_BATTERY.md) + evidências de CI como base de aceite.

---

## 5. Priorização seguinte (proposta **time** — validar com PO em sessão curta)

Ordem sugerida após análise do que já está no ar e do risco de produto. A PO confirma ou reordena **uma** linha de cada vez.

| Ordem | Item | Motivo |
|-------|------|--------|
| **P0** | ~~PATCH API~~ **Entregue** · **UI editar cobrança** → **Sprint F:** [DEMANDA_SPRINT_F_PORTAL_EDITAR_COBRANCA.md](../Projeto_CobrancaBoleto/DEMANDA_SPRINT_F_PORTAL_EDITAR_COBRANCA.md) (cliente já tem `/clientes/:id/editar`) | Retificar sem duplicar. |
| **P1** | ~~Paginação / cursor~~ **Entregue:** `limit` + `cursor` nos `GET` portal (cobranças, clientes, NFs, cobranças por cliente); contrato em [API_CONTRATO_E_SMOKE.md](./API_CONTRATO_E_SMOKE.md) secção 2.1; migração `012` para `id` na view de NFs | Evita listas lentas; próximo: botões “Carregar mais” no SPA. |
| **P2** | ~~**Inbox + job** — idempotência webhook~~ **Entregue (Sprint D):** [INBOX_WEBHOOK_IDEMPOTENCIA.md](./INBOX_WEBHOOK_IDEMPOTENCIA.md) + `tests/inbox/webhook-inbox-idempotency.integration.test.ts` | Pré-requisito estável antes de n8n. |
| **P3** | ~~**Orquestração n8n**~~ **Entregue (Sprint E, PR #10):** [N8N_WEBHOOKS.md](./N8N_WEBHOOKS.md) | — |

**Ritual sugerido (30 min):** PO traz 2–3 histórias priorizadas; engenharia estima e aponta dependências (BD, segurança, UX); saída = ordem P0–P3 atualizada nesta secção com data.

---

## 6. Rastreabilidade — regras desenvolvidas ↔ requisitos ↔ validação (revisão PO + engenharia)

Use esta tabela em **review conjunto**: a PO confirma se a regra de negócio cobre o intent; engenharia aponta para testes ou gap.

| Regra de negócio (resumo) | Onde está | Como validar |
|----------------------------|-----------|----------------|
| Só **admin_escritorio** / **operador** criam clientes e cobranças no portal | `portal-router.ts` (`isEscritorioStaff`) | Integração + 403 se papel `cliente_cnpj` (quando existir teste dedicado). |
| Cobrança portal exige **vínculo** `portal.billing_tenant_link` | `createPortalChargeHttp`, listagens | Bateria `B2`/`B4`; UI aviso em `/escritorio` e listas. |
| **Idempotência** de cobrança por `idempotency_key` no tenant público | `insertCharge` (`ON CONFLICT`), `create-portal-charge` | `POST` duplicado → `200` + `idempotent: true` (teste a acrescentar se PO pedir evidência explícita). |
| **Unicidade** de cliente por `(tenant_id, documento)` | `createCliente` + `23505` → 409 | `portal-clientes-post.integration.test.ts`. |
| **Validação** CPF/CNPJ e e-mail em clientes | `portal-cliente-input.ts` | Testes unitários `portal-cliente-input.test.ts` + integração 422. |
| **JWT** alinhado ao `x-tenant-id` do portal | `auth-jwt-middleware` + `portalAutomacaoTenantMiddleware` | `api-battery` + `cross-tenant`. |
| **Stress** concorrente em `POST` clientes | `portal-clientes-post` + script carga | `npm run test:stress:portal-clientes`, `test:load:portal-clientes`. |
| **Retificação** cliente (nome/e-mail/opt-in), sem mudar documento | `parsePortalClientePatchBody`, `updateClienteForTenant`, `PATCH /v1/portal/clientes/:id` | Unitário `portal-cliente-patch-input.test.ts`; bateria **B5**. |
| **Retificação** cobrança (valor, vencimento, metadata); bloqueio se **paga/cancelada** | `patch-portal-charge.ts`, `patchChargeEditableFields` | Unitário `patch-portal-charge*.test.ts`; bateria **B6**. |
| **Paginação** portal (`limit` 1–200, `cursor` opaco, `next_cursor` na resposta) | `portal-list-cursor.ts`, `listChargesPage`, `listClientesByTenantPage`, `listNotasFiscaisResumoByTenantPage`, `portal-router` | Unitário `portal-list-cursor.test.ts`; bateria **B2** + **B2b** (cursor inválido → 400). |

**PRD de produto (visão larga):** no monólito origem, `Projeto_EmissaoNF/PRD_Automacao_Boletos_WhatsApp_MVP.md` — alinhar RFs (emitir, duplicidade, webhook, régua) à medida que cada P0–P3 for implementado; atualizar esta tabela com novas linhas.

---

*Documento vivo: atualizar secções 5–6 após cada alinhamento PO + engenharia.*
