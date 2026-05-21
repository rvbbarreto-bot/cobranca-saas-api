# Briefing fábrica — SaaS Cobranças API · Maio 2026

Você atua no repositório **cobranca-saas-api** (Node 20, TS 5.7, Express, `pg` raw, BullMQ, Vitest). Leia primeiro: `Projeto_CobrancaBoleto/RETOMADA_FABRICA.md` (atualizar após cada merge).

## Estado atual (fonte da verdade)

- **main** (`36f3a42`): até Sprint B (PR #6) mergeado.
- **Branch ativa:** `feat/sprint-c-portal-configuracoes` — ver [DEMANDA_SPRINT_C_PORTAL_CONFIGURACOES.md](./DEMANDA_SPRINT_C_PORTAL_CONFIGURACOES.md).
- **Testes:** `npm test` → 185 unitários; `npm run portal:test` → 22. Meta CI: `npm run quality:gate` (requer `DATABASE_URL` + migrate).

## NÃO refazer (já implementado)

- Migrations até `023` em main; `024` só na branch 4.7.
- Módulos: payment-gateway, inbox (6 eventos), notifications, saas-billing (planos, metering, metrics), portal-read (dashboard, export, magic link).
- Front: login, dashboard, cobranças/clientes, portal cliente, bloco assinatura em `/escritorio`.
- NFS-e e `/internal/fiscal` — **fora de escopo**.

## Entregas imediatas (ordem)

### Sprint A — Aceite PR #5 (merge já feito em `main`)

1. `git checkout main && git pull origin main`
2. Garantir CI verde: `npm ci && npm run migrate && npm run quality:gate`
3. Rodar `bash Projeto_CobrancaBoleto/validacao_sprint4.sh` (6/6)
4. Smoke manual (sandbox Asaas):
   - `POST /v1/tenants/provision` com `billing_email`
   - `POST /v1/portal/escritorio/assinatura/activate` (admin_escritorio)
   - `GET /v1/portal/escritorio/assinatura` → `gateway_subscription_id` preenchido
5. Demo PO: trial → activate → webhook `subscription.past_due` (opcional sandbox)

### Sprint B — concluído (PR #6)

### Sprint C — Portal `/configuracoes` (**ATUAL**)

Ver [DEMANDA_SPRINT_C_PORTAL_CONFIGURACOES.md](./DEMANDA_SPRINT_C_PORTAL_CONFIGURACOES.md): UI config + régua + templates; testes API router; PR + handoff TL.

### Sprint C — Configurações escritório (5–8 dias)

1. Tela `/configuracoes` substituindo placeholder:
   - Gateway Asaas (PATCH config com credenciais mascaradas)
   - Lista/CRUD régua (`/escritorio/regua`)
   - Templates + preview (`/escritorio/templates/:id/preview`)
2. Testes: router ou integração mínima para config/regua; Vitest no front para formulários críticos.

### Sprint D — Qualidade e produção (contínuo)

1. FASE2 P2: testes idempotência webhook/inbox (carga leve).
2. Preencher `docs/evidencias/SPRINT1_ACEITE_CHECKLIST.md` com `npm run e2e:asaas:evidence`.
3. Checklist deploy: `DEPLOY_CHECKLIST.md`, `ENABLE_MOCK_AUTH=false`, secrets em cofre.

## Regras absolutas

1. Multi-tenant: `tenant_id` + RLS / `SET LOCAL app.tenant_id`.
2. Webhooks: inbox pattern (persistir → job → 202); dedup `external_event_id`.
3. Estados `paga` e `cancelada` não retrocedem.
4. Secrets só em `.env`; nunca no git.
5. Migrations: `db/migrations/NNN_descricao.sql`, idempotentes.
6. `writeAuditLog` na mesma transação de mutações críticas.
7. DoD PR: `docs/FASE2_KICKOFF_QUALIDADE.md` — build, coverage ≥82% (application/domain), portal:test, integração se tocar API+DB.
8. PRs < 400 linhas úteis quando possível.

## Gates diários

```bash
git fetch origin
git checkout main && git pull origin main
npm ci && cp .env.example .env            # preencher DATABASE_URL, JWT_SECRET, etc.
npm run migrate && npm run seed:dev
npm run build && npm test && npm run portal:test
npm run quality:gate                      # antes de abrir/atualizar PR
```

## Commit e PR (autorização PO — IA vs Tech Lead)

| Quem | Faz |
|------|-----|
| **IA (tu)** | `feat/*` → testes → commit → push → **`gh pr create`** → **handoff ao Tech Lead** |
| **IA** | **Nunca** `gh pr merge` nem merge em `main` |
| **Tech Lead** | Review → approve → **merge** (CI + critérios G1–G7) |
| **PO** | Aceite produto (demo) em P0/P1 |

Detalhe: [GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md). Após abrir o PR, colar o bloco **Handoff** (secção 5 do doc) e pedir revisão ao Tech Lead.

## Definition of Done por PR

- [ ] Contrato HTTP atualizado se mudou rota/código HTTP
- [ ] Testes novos (unitário + integração se Postgres)
- [ ] Sem regressão `validacao_fase_0.sh` / sprint do escopo
- [ ] PO pode demonstrar fluxo em 5 min (curl ou portal)
- [ ] Nenhum secret/log de PII

## Perguntas para o PO (bloquear se ambíguo)

1. Aceite PO do smoke Asaas (activate) antes de iniciar Sprint C em produção?
2. Prioridade pós-merge: UI activate vs configurações/regua vs paginação?
3. n8n: URL de staging já existe (`N8N_PLATFORM_WEBHOOK_URL`)?

Referências: `DEMANDA_SPRINT4_ASAAS_SUBSCRIPTIONS.md`, `docs/N8N_WEBHOOKS.md`, `docs/ASAAS_SANDBOX_E2E.md`, `DEMO_SPRINT3_FLUXO_11_PASSOS.md`.
