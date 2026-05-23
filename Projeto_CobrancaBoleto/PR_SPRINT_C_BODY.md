## Summary

- Nova página `/configuracoes` com abas: **Gateway**, **Régua de cobrança**, **Templates** (consome API existente em `escritorio-router`).
- Funções client em `apps/portal-web/src/lib/api.ts` + helper `shouldPatchSecret` (não reenvia credenciais mascaradas).
- Testes: `escritorio-config-router.test.ts` (5), `ConfiguracoesPage.test.tsx` (2), extensão `api.test.ts`.
- Contrato: `API_CONTRATO_E_SMOKE.md`, `PORTAL_WEB.md`.

## Sprint / governança

- **Sprint C** — portal configurações
- IA: commit + PR apenas — **merge pelo Tech Lead** (`GOVERNANCA_FABRICA_COMMIT_PR.md`)
- Branch: `feat/sprint-c-portal-configuracoes`

## Test plan

- [x] `npm run build`
- [x] `npm test` (190)
- [x] `npm run portal:test` (29)
- [x] `npm run portal:build`
- [ ] CI / `quality:gate`
- [ ] Demo: login admin → `/configuracoes` → guardar gateway; criar regra régua; editar template + preview

## Fora de escopo

- Alterações em use-cases backend (salvo bugs encontrados em review)
- Merge automático em `main`
