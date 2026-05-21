## Summary

- Alinha runner `e2e:asaas:evidence` aos **13 critérios** do checklist Sprint 1.
- Adiciona testes **unitários** (utils/evidência) e **funcionais** (script sem DB → erro).
- Documenta homolog PO: `docs/evidencias/README.md`, template JSON redigido, `.gitignore` para evidências reais.

## Test plan

- [ ] `npm run build`
- [ ] `npm test`
- [ ] `npm run portal:test`
- [ ] `npm run quality:gate`
- [ ] Homolog manual (fora do CI): `npm run e2e:asaas:evidence` com Asaas Sandbox — anexar print no PR, JSON **não** commitado

## Handoff Tech Lead

- Validar mapeamento checklist ↔ assertions no JSON de exemplo.
- Merge quando CI verde.
- PO assina checklist após execução sandbox do executor.
