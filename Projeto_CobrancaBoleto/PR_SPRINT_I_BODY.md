## Summary

- Consolida em **`main`** a branch de integração `feat/sprint1-payment-emission-portal` (Sprints G–H, FASE2 A, SaaS billing, portal, n8n, inbox, runbooks).
- Adiciona [docs/RELEASE_NOTES_INTEGRACAO_MAIN.md](../docs/RELEASE_NOTES_INTEGRACAO_MAIN.md) e pacote fábrica Sprint I/J.
- **Não** inclui código de feature novo — release hygiene.

## Conteúdo principal (já na head)

| Área | PRs / entregas |
|------|----------------|
| n8n | #12 `charge.emitted` |
| Homolog | #14 runner + checklist + evidências |
| Auth prod | #15 `RUNBOOK_AUTH_PRODUCAO`, JWT policy, mocks 404 |
| BD | migrations `023`, `024` |
| CI | `check:prod-env --strict` em modo production |

## Test plan

- [ ] GitHub Actions **CI** verde neste PR
- [x] Branch já validada na integração (`quality:gate` na fábrica quando aplicável)
- [ ] Pós-merge TL: `git pull main && npm run migrate && npm run quality:gate`

## Handoff Tech Lead

- Revisar `RELEASE_NOTES_INTEGRACAO_MAIN.md` (breaking NFS-e legado removido).
- **Merge** quando CI verde — fábrica não faz merge.
- Após merge: PO pode rodar homolog sandbox (`e2e:asaas:evidence` + checklist).
- Próxima demanda fábrica: Sprint J (CI `workflow_dispatch` Asaas).
