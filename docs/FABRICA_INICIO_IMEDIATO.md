# Fábrica — Início imediato (PO autorizado)

**Data:** 2026-06-07  
**Status:** GO para desenvolvimento

---

## Autorização PO

Documento vinculante: [`AUTORIZACAO_PO_FABRICA_EXECUCAO_IMEDIATA.md`](./AUTORIZACAO_PO_FABRICA_EXECUCAO_IMEDIATA.md)

> Fábrica **autorizada** a executar comandos de setup, config local, testes, DevOps Jira e **seguir desenvolvimento S0/S1 imediatamente**.

---

## Sprint atual: S0

Kickoff: [`evidencias/sprint-0/KICKOFF.md`](./evidencias/sprint-0/KICKOFF.md)

| ID | Entrega | Artefato | Status |
|----|---------|----------|--------|
| 004 | ADR | [`ADR_SERPRO_FISCAL_MVP.md`](./ADR_SERPRO_FISCAL_MVP.md) | Draft — implementar S1 após review |
| 002 | CSV v1 | [`templates/PGDASD_CSV_SPEC.md`](./templates/PGDASD_CSV_SPEC.md) | Draft |
| 003 | UX | [`ux/FISCAL_MVP_WIREFRAMES.md`](./ux/FISCAL_MVP_WIREFRAMES.md) | Draft |
| 001 | SERPRO spike | `npm run serpro:spike` | Dry-run OK |

---

## Comandos — ordem recomendada

### 1. Ambiente local (qualquer dev)

```powershell
npm ci
npm run dev:up
npm run portal:dev    # terminal 2
```

Login demo: `admin@teste.local` / tenant `escritorio-demo` / `TesteDev!2026`

### 2. DevOps — Jira

```powershell
# Se projeto EXEQFISC ainda não existe: 10 min UI
# Ver: docs/jira-import/FABRICA_SETUP_JIRA_MANUAL.md

npm run jira:bootstrap:full
```

### Desenvolvimento S1 (autorizado PO — próxima demanda)

Branch: `feature/EXEQ-FISC-010-organization-model`

Backlog: [`JIRA_PACOTE_SERPRO_FISCAL_MVP.md`](./JIRA_PACOTE_SERPRO_FISCAL_MVP.md) — issues 010, 011, 012

Autorização: [`AUTORIZACAO_PO_SPRINT1_PROXIMA_DEMANDA.md`](./AUTORIZACAO_PO_SPRINT1_PROXIMA_DEMANDA.md)

---

## Jira vs Git

| Jira indisponível | Usar |
|-------------------|------|
| Issue key | `EXEQ-FISC-XXX` no branch/commit |
| Backlog | `JIRA_PACOTE_SERPRO_FISCAL_MVP.md` |
| Sprint | `evidencias/sprint-0/` |

---

## Contatos / blockers

| Blocker | Owner |
|---------|-------|
| Projeto Jira UI | DevOps + admin Atlassian |
| Credenciais SERPRO | PO / Comercial |
| Validação CSV contábil | PO |

---

**Próxima ação fábrica:** `npm run dev:up` + DevOps criar EXEQFISC (manual 10 min) + `jira:bootstrap:full`.
