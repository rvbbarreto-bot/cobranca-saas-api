## Summary

- Runbook operacional: `docs/RUNBOOK_AUTH_PRODUCAO.md` (JWT, mocks, smoke, rotação).
- `jwt-secret-policy.ts` + `check:prod-env` rejeita placeholders.
- Testes: `jwt-secret-policy.test.ts`, `production-mock-auth-gate.integration.test.ts`.
- CI: step `check:prod-env --strict` em modo produção.
- Links em deploy checklist, contrato API e portal ajuda.

## Test plan

- [x] `npm run build`
- [x] `npm test`
- [x] `npm run portal:test`
- [ ] `npm run quality:gate` (CI com Postgres)
- [x] `NODE_ENV=production ENABLE_MOCK_AUTH=false` + JWT forte → `check:prod-env --strict` OK
- [x] JWT placeholder → `check:prod-env --strict` falha
- [x] `production-mock-auth-gate.integration.test.ts`

## Handoff Tech Lead

- Revisar runbook com ops antes do primeiro deploy real.
- Validar procedimento de rotação JWT com PO.
- Merge quando CI verde.
