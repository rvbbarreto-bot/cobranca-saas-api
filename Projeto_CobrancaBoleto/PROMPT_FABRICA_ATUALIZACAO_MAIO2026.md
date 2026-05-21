# Briefing fábrica — SaaS Cobranças API · Maio 2026

Você atua no repositório **cobranca-saas-api** (Node 20, TS 5.7, Express, `pg` raw, BullMQ, Vitest). Leia primeiro: `Projeto_CobrancaBoleto/RETOMADA_FABRICA.md`.

## Estado atual (fonte da verdade)

- **main** (`1f4c328`): Sprints B, C, D mergeados (PR #6, #8, #9).
- **Próxima entrega:** Sprint E — [DEMANDA_SPRINT_E_N8N_ORQUESTRACAO.md](./DEMANDA_SPRINT_E_N8N_ORQUESTRACAO.md) (P3 n8n).
- **Testes:** `npm test` → 194+ unitários; `npm run portal:test` → 29; CI: `npm run quality:gate` (Postgres + migrate).

## NÃO refazer (já implementado)

- Migrations até **024**; inbox idempotência; portal `/configuracoes`; activate assinatura; paginação cursor.
- Módulos: payment-gateway, inbox, notifications (Resend/Z-API + régua diária), saas-billing, portal-read completo.
- n8n outbound parcial: `charge.paid`, `subscription.past_due` — **estender**, não reescrever do zero.
- NFS-e e `/internal/fiscal` — **fora de escopo**.

## Entrega imediata — Sprint E (P3 n8n) **← ATUAL**

**Pacote:** [DEMANDA_SPRINT_E_N8N_ORQUESTRACAO.md](./DEMANDA_SPRINT_E_N8N_ORQUESTRACAO.md)

1. Branch `feat/sprint-e-n8n-orquestracao` a partir de `main` atualizado.
2. Eventos outbound: `charge.overdue`, `charge.cancelled`, `notification.regua_enqueued`.
3. Docs: `N8N_WEBHOOKS.md`, `N8N_REGUA_WORKFLOW_EXEMPLO.md`, `DEPLOY_CHECKLIST.md`.
4. Testes unitários (n8n-outbound + side-effects/enqueue).
5. PR + handoff Tech Lead — **sem merge**.

### Sprints concluídas (referência)

| Sprint | PR | Conteúdo |
|--------|-----|----------|
| B | #6 | Activate assinatura + paginação portal |
| C | #8 | `/configuracoes` gateway + régua + templates |
| D | #9 | Inbox idempotência + deploy checklist + rate-limit CI |

## Regras absolutas

1. Multi-tenant: `tenant_id` + RLS / `SET LOCAL app.tenant_id`.
2. Webhooks entrada: inbox pattern; dedup `external_event_id` ([INBOX_WEBHOOK_IDEMPOTENCIA.md](../docs/INBOX_WEBHOOK_IDEMPOTENCIA.md)).
3. n8n saída: fire-and-forget; noop sem URL.
4. Estados `paga` e `cancelada` não retrocedem.
5. Secrets só em `.env`; nunca no git.
6. DoD PR: `docs/FASE2_KICKOFF_QUALIDADE.md` — build, coverage ≥82%, portal:test se tocar SPA, integração se API+DB.
7. PRs < 400 linhas úteis quando possível.

## Gates diários

```bash
git fetch origin
git checkout main && git pull origin main
git checkout -b feat/sprint-e-n8n-orquestracao
npm ci && cp .env.example .env
npm run migrate && npm run seed:dev
npm run build && npm test && npm run portal:test
npm run quality:gate
```

## Commit e PR (governança)

| Quem | Faz |
|------|-----|
| **IA (tu)** | `feat/*` → testes → commit → push → **`gh pr create`** → **handoff Tech Lead** |
| **IA** | **Nunca** `gh pr merge` nem merge em `main` |
| **Tech Lead** | Review → approve → **merge** |

Detalhe: [GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md).

## Definition of Done por PR

- [ ] Contrato HTTP / N8N atualizado se mudou eventos ou rotas
- [ ] Testes novos (unitário; integração só se tocar Postgres)
- [ ] `npm run quality:gate` verde no CI
- [ ] Handoff no PR (secção 5 governança)

## Perguntas para o PO (Sprint E)

1. `N8N_PLATFORM_WEBHOOK_URL` de staging já definida?
2. n8n substitui canal interno e-mail/WhatsApp? (default: **não**)
3. Incluir `charge.emitted` neste PR ou seguinte?

Referências: `DEMANDA_SPRINT_E_N8N_ORQUESTRACAO.md`, `docs/N8N_WEBHOOKS.md`, `docs/ASAAS_SANDBOX_E2E.md`.
