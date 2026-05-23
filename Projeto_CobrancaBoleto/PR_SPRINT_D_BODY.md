## Summary

- Documenta contrato de idempotência de `POST /v1/inbox/webhooks` (`docs/INBOX_WEBHOOK_IDEMPOTENCIA.md`, §2.2 em `API_CONTRATO_E_SMOKE.md`).
- Adiciona testes de integração (sequência, pós-`process-pending`, 8 POSTs concorrentes) e caso unitário de duplicata pendente.
- Atualiza `DEPLOY_CHECKLIST.md` (migration 024, produção sem mocks, secrets) e checklist de evidências Sprint 1.

## Test plan

- [ ] `npm run build`
- [ ] `npm test`
- [ ] `npm run portal:test`
- [ ] Com `DATABASE_URL`: `npx vitest run tests/inbox/webhook-inbox-idempotency.integration.test.ts`
- [ ] (Opcional homolog) `npm run e2e:asaas:evidence` + preencher `docs/evidencias/SPRINT1_ACEITE_CHECKLIST.md`
