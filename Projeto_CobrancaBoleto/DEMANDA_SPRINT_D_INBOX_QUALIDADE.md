# Demanda — Sprint D (inbox + qualidade produção)

**Branch:** `feat/sprint-d-inbox-qualidade`  
**Base:** `main` (após Sprint C mergeada)

## Objetivo

Fechar FASE2 **P2** (idempotência inbox), checklist de deploy para produção e instruções de evidências Sprint 1 — sem alterar comportamento já implementado em `webhook-inbox-repository` / `inbox-router`.

## Entregas

| ID | Item | Artefato |
|----|------|----------|
| D.1 | Contrato + testes idempotência | `docs/INBOX_WEBHOOK_IDEMPOTENCIA.md`, `tests/inbox/webhook-inbox-idempotency.integration.test.ts`, +1 caso unitário em `webhook-inbox-repository.test.ts` |
| D.2 | Evidências aceite | `docs/evidencias/SPRINT1_ACEITE_CHECKLIST.md` (passos `e2e:asaas:evidence`) |
| D.3 | Deploy produção | `docs/DEPLOY_CHECKLIST.md` (024, mocks off, secrets, `quality:gate`) |
| D.4 | Contrato API | `docs/API_CONTRATO_E_SMOKE.md` §2.2 |

## DoD

```bash
npm run build
npm test
npm run portal:test
# com DATABASE_URL + migrate:
npx vitest run tests/inbox/webhook-inbox-idempotency.integration.test.ts
npm run quality:gate   # opcional completo
```

## Fora de escopo

- Integração n8n outbound (P3)
- Preencher JSON de evidências Asaas no repositório (só homolog local)
- Merge em `main` (Tech Lead)

## Handoff

Seguir [GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md) §5 no PR.
