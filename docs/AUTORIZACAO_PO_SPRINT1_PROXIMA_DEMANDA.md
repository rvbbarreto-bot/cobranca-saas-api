# Autorização PO — Sprint 1 / Próxima demanda (desenvolvimento)

**Programa:** Automação Fiscal SERPRO — PGDAS-D + DAS  
**Data:** 2026-06-07  
**Status:** **AUTORIZADO — GO imediato**

---

## 1. Declaração do Product Owner

Eu, **Ricardo / Product Owner Exeq**, **autorizo a fábrica a iniciar imediatamente a próxima demanda** (Sprint 1 — Fundação técnica), com as seguintes condições:

### Escopo autorizado (Sprint 1)

| Issue | Entrega | Autorizado |
|-------|---------|------------|
| **EXEQ-FISC-010** | Migration `portal.organization` + backfill escritórios | ✅ |
| **EXEQ-FISC-011** | API gestão organização (console EXEQ) | ✅ |
| **EXEQ-FISC-012** | Config SERPRO por organização (`fiscal.serpro_config`) | ✅ |
| **EXEQ-FISC-020** | Início Certificate Vault (se capacity S1) | ✅ opcional |

**Base arquitetural:** [`ADR_SERPRO_FISCAL_MVP.md`](./ADR_SERPRO_FISCAL_MVP.md) (draft S0 — válido para implementação com revisão tech lead em paralelo).

### Pré-requisitos considerados atendidos pelo PO

- [x] Sprint 0 iniciada — ADR, CSV v1, wireframes, spike SERPRO dry-run publicados
- [x] Autorização execução geral: [`AUTORIZACAO_PO_FABRICA_EXECUCAO_IMEDIATA.md`](./AUTORIZACAO_PO_FABRICA_EXECUCAO_IMEDIATA.md)
- [x] Desenvolvimento **não depende** de Jira operacional
- [ ] Jira `Exeq SERPRO` (EXEQSRP) — desejável, não bloqueante
- [ ] Credenciais SERPRO demo — não bloqueia S1 (migrations + APIs locais)

---

## 2. Texto para enviar à fábrica (copiar)

**Assunto:** [AUTORIZADO] Sprint 1 — Fundação organização + config SERPRO

> Como PO, **autorizo início imediato da Sprint 1** (próxima demanda):
>
> - **EXEQ-FISC-010** — `portal.organization` + backfill  
> - **EXEQ-FISC-011** — API organização EXEQ  
> - **EXEQ-FISC-012** — config SERPRO por org  
>
> Referência: `docs/ADR_SERPRO_FISCAL_MVP.md`  
> Branch: `feature/EXEQ-FISC-010-organization-model`  
> Ambiente: `npm run dev:up` antes de migrations  
>
> Jira e credenciais SERPRO **não bloqueiam** esta sprint.  
> Review tech lead do ADR em paralelo ao desenvolvimento.
>
> **GO.**

---

## 3. Comandos autorizados (Sprint 1)

```powershell
git checkout -b feature/EXEQ-FISC-010-organization-model
npm run dev:up
npm run migrate                    # após criar db/migrations/032_*.sql
npm run test
npm run test:integration
npm run build
```

---

## 4. Definition of Done — Sprint 1

- [ ] Migration `032_organization.sql` aplicada sem regressão
- [ ] Backfill escritórios existentes idempotente
- [ ] API org documentada (OpenAPI ou PORTAL_WEB.md)
- [ ] `fiscal.serpro_config` + API admin (012)
- [ ] Testes integração cross-tenant org
- [ ] PR com prefixo `EXEQ-FISC-010` / `011` / `012`
- [ ] Nenhum secret commitado

---

## 5. Fora do escopo desta autorização

- Transmissão SERPRO real (S5)
- Portal UX fiscal completo (S8)
- Ingestão CSV (S3)
- Deploy produção

---

## 6. Sequência de autorizações PO

| Documento | Escopo |
|-----------|--------|
| [`AUTORIZACAO_PO_INICIO_DESENVOLVIMENTO_SEM_JIRA.md`](./AUTORIZACAO_PO_INICIO_DESENVOLVIMENTO_SEM_JIRA.md) | S0 + sem Jira |
| [`AUTORIZACAO_PO_FABRICA_EXECUCAO_IMEDIATA.md`](./AUTORIZACAO_PO_FABRICA_EXECUCAO_IMEDIATA.md) | Comandos e config |
| **Este documento** | **Sprint 1 — próxima demanda** |

---

## 7. Assinatura

| Papel | Nome | Data | Decisão |
|-------|------|------|---------|
| **PO** | Ricardo / Exeq | **2026-06-07** | **De acordo — GO imediato (autorização formal)** |
| Tech Lead | _review ADR em paralelo_ | | |

---

*Próxima autorização prevista: Sprint 2 (S3 ingestão CSV) após DoD S1.*
