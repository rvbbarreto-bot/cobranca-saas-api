## Summary

- Alinha `asaas-sandbox-e2e-runner` aos **14 assertions** nomeadas do checklist Sprint 1 (`asaas-e2e-evidence-utils.ts`).
- `.gitignore` para JSON real; template `asaas-e2e-EXAMPLE.redacted.json` + `docs/evidencias/README.md`.
- **Unit:** `tests/dev/asaas-e2e-evidence.test.ts` · **Funcional:** script sem `DATABASE_URL` → exit 1.
- Checklist, `ASAAS_SANDBOX_E2E.md` (homolog PO) e `DEPLOY_CHECKLIST.md` atualizados.

## Test plan

- [x] `npm run build`
- [x] `npm test`
- [x] `npm run portal:test`
- [ ] `npm run quality:gate` (CI com `DATABASE_URL`)
- [ ] Homolog manual: `npm run e2e:asaas:evidence` — print + JSON anexados ao PR (**não** commitados)

## Handoff Tech Lead

- Conferir mapeamento checklist ↔ assertions no JSON de exemplo.
- Merge quando CI verde.
- PO assina checklist após execução sandbox.
