# Setup Jira EXEQFISC — Guia DevOps + Fábrica (10 min)

**Quando usar:** `npm run jira:bootstrap:full` falhou (projeto ainda não existe ou API sem permissão de criação).

**Nome sugerido:** **Exeq SERPRO** | **Key sugerida:** **EXEQSRP**

**Após criar o projeto na UI:** rode `npm run jira:bootstrap:full` de novo — importa backlog automaticamente.

---

## Passo 1 — Criar projeto (UI — admin Jira)

1. Abra https://exeq.atlassian.net  
2. Login: **ricardo@exeq.com** (mesmo e-mail do `.env.jira.local`)  
3. Menu **Projects** → **Create project**  
4. Escolha **Software development** → **Scrum**  
5. Preencha:

| Campo | Valor |
|-------|-------|
| Nome | **`Exeq SERPRO`** |
| Key | **`EXEQSRP`** (ou outra — ajuste `JIRA_PROJECT_KEY` no `.env.jira.local`) |
| Lead | Ricardo |

6. **Create**

---

## Passo 2 — Components (8 itens)

**Project settings** → **Components** → **Create component** (repetir):

`backend` · `frontend` · `database` · `devops` · `ux-ui` · `qa` · `architecture` · `pm`

---

## Passo 3 — Issue types

Confirmar que existem: **Epic**, **Story**, **Task**, **Spike**, **Sub-task**  
(Scrum template já inclui.)

---

## Passo 4 — Import backlog (terminal)

```powershell
cd cobranca-saas-api
npm run jira:test
npm run jira:import:discover
npm run jira:bootstrap:full
```

Esperado: **12 epics + 58 issues** importados.

Se erro de Epic Link, rode `npm run jira:import:discover` e ajuste em `docs/jira-import/.env.jira.local`:

```env
JIRA_EPIC_LINK_FIELD=customfield_XXXXX
JIRA_EPIC_NAME_FIELD=customfield_XXXXX
```

---

## Passo 5 — Board e Sprint S0

1. Abrir board do projeto **EXEQFISC**  
2. **Backlog** → **Create sprint**  
   - Nome: `S0 — Discovery SERPRO`  
   - Duração: 2 semanas  
3. Arrastar para S0:

| Issue (summary contém) |
|----------------------|
| EXEQ-FISC-001 |
| EXEQ-FISC-002 |
| EXEQ-FISC-003 |
| EXEQ-FISC-004 |
| EXEQ-FISC-096 |

4. Colunas sugeridas: **To Do** | **In Progress** | **In Review** | **Done**

---

## Passo 6 — Labels (opcional — CSV já importa)

Confirmar labels: `fase-1-mvp`, `serpro`, `pgdasd`, `mobile-first`, `blocker-externo`

---

## Passo 7 — GitHub (opcional)

Instalar **GitHub for Jira** → conectar repo `cobranca-saas-api`  
Commits: `EXEQ-FISC-051: descrição`

---

## Verificação final

- [ ] `npm run jira:test` lista `EXEQFISC`  
- [ ] Board com epics E00–E11  
- [ ] Sprint S0 com 5 issues  
- [ ] PO autorização: `docs/AUTORIZACAO_PO_FABRICA_EXECUCAO_IMEDIATA.md`

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| 0 projetos no `jira:test` | Conta errada ou projeto em outro site Atlassian |
| 400 ao import | Key EXEQFISC diferente — ajuste `JIRA_PROJECT_KEY` |
| 400 Component | Criar components passo 2 |
| Spike issue type | Criar tipo Spike ou editar CSV Task |

---

*DevOps: após passo 1 UI, automatizar passo 4 com `jira:bootstrap:full`.*
