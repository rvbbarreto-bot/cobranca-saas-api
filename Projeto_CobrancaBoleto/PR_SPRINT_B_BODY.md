## Summary

- Botão **Ativar cobrança recorrente** em `/escritorio` (`POST /v1/portal/escritorio/assinatura/activate`) com tratamento de 409/503 e feedback de sucesso.
- **Carregar mais** nas listagens de cobranças, clientes e notas fiscais (`useInfiniteQuery` + `next_cursor`, 50 itens/página).
- Governança PO: `GOVERNANCA_FABRICA_COMMIT_PR.md` — autorização explícita para a fábrica commitar e abrir PR em entregas P0/P1.

## Sprint / autorização

- **Sprint B** — portal assinatura + paginação
- PO autorizou commit+PR conforme metodologia fábrica (`GOVERNANCA_FABRICA_COMMIT_PR.md`)
- Branch: `feat/portal-assinatura-pagination`

## Test plan

- [x] `npm run build` (API)
- [x] `npm test` (185 unitários API — validar no CI)
- [x] `npm run portal:test` (24 testes)
- [x] `npm run portal:build`
- [ ] CI `quality:gate` no GitHub Actions
- [ ] Demo manual: login admin → `/escritorio` → ativar (sandbox Asaas se configurado) → listas com Carregar mais

## Fora de escopo

- Tela `/configuracoes` (Sprint C)
- Merge automático em `main` (aguarda review PO)
