# Autorização PO — Execução imediata pela Fábrica

**Programa:** Automação Fiscal SERPRO (PGDAS-D + DAS)  
**Data:** 2026-06-07  
**Status:** **VIGENTE — AUTORIZADO**

---

## 1. Declaração do Product Owner

Eu, **Ricardo / Product Owner Exeq**, **autorizo de forma imediata e irrestrita** a equipe de fábrica (desenvolvimento, DevOps, QA e UX) a:

1. **Executar todos os comandos** de setup, configuração, build, teste e scripts documentados neste repositório para o programa fiscal SERPRO.
2. **Prosseguir com o desenvolvimento** da Sprint 0 e Sprint 1 **sem aguardar** conclusão da importação Jira (DevOps executa Jira em paralelo).
3. **Subir ambiente local** (Docker, seeds, portal) conforme runbooks aprovados.
4. **Criar branches, commits e PRs** com prefixo `EXEQ-FISC-XXX`.
5. **Aplicar configurações** em arquivos `.env.local`, `.env.jira.local`, `.env.serpro.local` (**nunca commitar secrets**).

Esta autorização **substitui** qualquer bloqueio operacional interno que exija nova aprovação PO para comandos já listados na §3.

---

## 2. Escopo autorizado

| Fase | Escopo |
|------|--------|
| **S0 (atual)** | ADR, CSV, UX, spike SERPRO, kickoff |
| **S1** | Organization model, serpro_config, início vault |
| **Infra local** | Docker Postgres/Redis/API, portal Vite |
| **DevOps Jira** | Bootstrap projeto EXEQFISC + import backlog |

**Fora desta autorização:** deploy produção, force push, alteração git config, commit de secrets, contratação SERPRO (PO/comercial).

---

## 3. Comandos explicitamente autorizados

### Ambiente de desenvolvimento

```powershell
npm ci
npm run dev:up
npm run portal:dev
npm run dev
```

### Qualidade

```powershell
npm run build
npm run test
npm run test:integration
npm run portal:test
npm run check:readiness
```

### Fiscal / SERPRO (Sprint 0+)

```powershell
npm run serpro:spike
npm run serpro:spike:live          # após .env.serpro.local
npm run receita:mock:gateway
npm run fiscal:homolog:e2e
```

### DevOps Jira

```powershell
npm run jira:test
npm run jira:import:discover
npm run jira:import:dry-run
npm run jira:import:apply
node scripts/jira-bootstrap-factory.mjs --check
node scripts/jira-bootstrap-factory.mjs --create-project
node scripts/jira-bootstrap-factory.mjs --full
```

### Docker

```powershell
docker compose up -d postgres redis api
docker compose run --rm migrate
```

---

## 4. Rastreabilidade (sem Jira ou com Jira)

| Mecanismo | Regra |
|-----------|--------|
| Branch | `feature/EXEQ-FISC-XXX-descricao` |
| Commit | `EXEQ-FISC-XXX: mensagem` |
| PR | Título com ID + checklist do pacote Jira |
| Backlog | `docs/JIRA_PACOTE_SERPRO_FISCAL_MVP.md` |
| Sprint | `docs/evidencias/sprint-0/KICKOFF.md` |

---

## 5. Decisões de negócio confirmadas

- Contratante SERPRO: **CNPJ Exeq** (Loja SERPRO centralizada)
- MVP: **PGDASD** (Simples) — DCTFWeb Fase 3
- Entrada MVP: **CSV layout v1** — ERP Fase 2
- Processamento: **100% assíncrono** (filas BullMQ)
- Jira: desejável; **não bloqueante** para código

---

## 6. Critérios para fábrica começar **agora**

- [x] PO autorizou execução (este documento)
- [x] Sprint 0 kickoff: `docs/evidencias/sprint-0/KICKOFF.md`
- [x] ADR draft: `docs/ADR_SERPRO_FISCAL_MVP.md`
- [ ] Tech lead review ADR (não bloqueia S0, bloqueia merge S1 migrations)
- [ ] Credenciais SERPRO demo (spike live — plano B: mock)

---

## 7. Assinatura

| Papel | Nome | Data | Autorização |
|-------|------|------|-------------|
| **PO** | Ricardo / Exeq | 2026-06-07 | **AUTORIZADO — executar imediatamente** |
| Tech Lead | _pendente review ADR_ | | |
| DevOps | _bootstrap Jira_ | | |

---

## 8. Mensagem para equipe (Slack)

```
PO AUTORIZA execução imediata — fábrica pode rodar todos os comandos da §3.
Desenvolvimento S0/S1: GO. Jira: DevOps bootstrap paralelo.
Ref: docs/AUTORIZACAO_PO_FABRICA_EXECUCAO_IMEDIATA.md
```

---

*Documento vinculante para fábrica até revogação expressa do PO.*
