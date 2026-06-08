# Sprint 0 — Kickoff (Discovery SERPRO)

**Programa:** Automação Fiscal SERPRO — PGDAS-D + DAS  
**Sprint:** S0 — Discovery & Kickoff  
**Início:** 2026-06-06  
**Duração:** 2 semanas  
**Rastreio:** Git (`EXEQ-FISC-XXX`) — Jira em paralelo (DevOps)

---

## Autorização PO

Desenvolvimento **autorizado** — execução imediata de comandos e configuração.  
Ref: [`AUTORIZACAO_PO_FABRICA_EXECUCAO_IMEDIATA.md`](../AUTORIZACAO_PO_FABRICA_EXECUCAO_IMEDIATA.md)  
Ref (sem Jira): [`AUTORIZACAO_PO_INICIO_DESENVOLVIMENTO_SEM_JIRA.md`](../AUTORIZACAO_PO_INICIO_DESENVOLVIMENTO_SEM_JIRA.md)

| PO | Data | Decisão |
|----|------|---------|
| Ricardo / Exeq | 2026-06-07 | **GO fábrica — comandos + desenvolvimento imediato** |

---

## Sprint Goal

> Entregar fundação de negócio e técnica para S1: ADR aprovado, CSV v1, wireframes UX, spike SERPRO documentado.

---

## Backlog Sprint 0

| ID | Entrega | Status | Artefato |
|----|---------|--------|----------|
| EXEQ-FISC-001 | Credenciais SERPRO demo | 🟡 Em andamento | [`SERPRO_HOMOLOG_CHECKLIST.md`](../SERPRO_HOMOLOG_CHECKLIST.md) |
| EXEQ-FISC-002 | Layout CSV PGDASD v1 | ✅ Draft | [`templates/PGDASD_CSV_SPEC.md`](../templates/PGDASD_CSV_SPEC.md) |
| EXEQ-FISC-003 | Wireframes UX | ✅ Draft | [`ux/FISCAL_MVP_WIREFRAMES.md`](../ux/FISCAL_MVP_WIREFRAMES.md) |
| EXEQ-FISC-004 | ADR arquitetura | ✅ Draft | [`ADR_SERPRO_FISCAL_MVP.md`](../ADR_SERPRO_FISCAL_MVP.md) |
| EXEQ-FISC-096 | Gestão sprint | ✅ | Esta pasta |

---

## Equipe (sugerida)

| Papel | Foco S0 |
|-------|---------|
| Backend | Revisão ADR; spike SERPRO script |
| UX | Wireframes → Figma (opcional) |
| PO | Aprovar CSV + wireframes + ADR |
| DevOps | Jira EXEQFISC (paralelo) |
| Contabilidade | Validar CSV v1 |

---

## Cerimônias

| Evento | Quando |
|--------|--------|
| Kickoff | D0 |
| Daily 15min | Diário |
| Review S0 | D10 |
| Retro | D10 |

---

## Blockers

| ID | Blocker | Owner | Impacto |
|----|---------|-------|---------|
| B1 | Projeto Jira EXEQFISC não criado | DevOps | Baixo — Git rastreia |
| B2 | Contrato Loja SERPRO | PO/Comercial | Médio — spike usa demo/mock |
| B3 | Validação contábil CSV | Contabilidade | Médio — antes S3 |

---

## Definition of Done — Sprint 0

- [x] ADR publicado (review tech lead pendente)
- [x] CSV template + spec publicados
- [x] Wireframes draft publicados
- [ ] Spike SERPRO demo executado OU plano B documentado
- [ ] PO aprova wireframes + CSV
- [ ] Retro S0 registrada

---

## Próximo sprint (S1 preview)

**PO autorizou GO imediato:** [`AUTORIZACAO_PO_SPRINT1_PROXIMA_DEMANDA.md`](../AUTORIZACAO_PO_SPRINT1_PROXIMA_DEMANDA.md)

EXEQ-FISC-010, 011, 012 — organization + serpro_config (branch `feature/EXEQ-FISC-010-organization-model`).

---

*Atualizar daily em `docs/evidencias/sprint-0/daily-YYYY-MM-DD.md`*
