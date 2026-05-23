## Summary

- Workflow manual **Asaas E2E (manual)** (`.github/workflows/asaas-e2e-manual.yml`): `workflow_dispatch`, Postgres+Redis, `migrate` + `seed:dev` + `e2e:asaas:evidence`, upload artefacto JSON (30 dias).
- Sem secret `ASAAS_API_KEY`: job `asaas-e2e-not-configured` com aviso — não quebra `main`.
- Docs: `docs/evidencias/README.md` (secção CI manual), `docs/ASAAS_SANDBOX_E2E.md`.
- Teste estático: `tests/dev/asaas-e2e-workflow.test.ts`.

## Secrets (Tech Lead — configurar antes do primeiro run)

| Secret | Obrigatório |
|--------|-------------|
| `ASAAS_API_KEY` | Sim (sandbox `$aact_...`) |

`WEBHOOK_INBOX_SECRET` / `ENCRYPTION_KEY` vêm do workflow (valores CI); não commitar keys.

## Test plan

- [x] `npm run build`
- [x] `npm test` (incl. `asaas-e2e-workflow.test.ts`)
- [ ] `npm run quality:gate` (local com Postgres)
- [ ] Pós-merge: disparar workflow manual com `ASAAS_API_KEY` e validar artefacto 14/14 assertions

## Handoff Tech Lead

- Criar secret `ASAAS_API_KEY` em **Settings → Secrets → Actions**.
- Merge quando CI do PR verde.
- Opcional: anexar artefacto do primeiro run ao ticket de homolog PO.
