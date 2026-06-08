# DevOps — Importação do backlog SERPRO Fiscal no Jira

Backlog fonte: [`JIRA_SERPRO_FISCAL_BACKLOG.csv`](./JIRA_SERPRO_FISCAL_BACKLOG.csv) (58 issues + 12 epics)  
Documentação: [`../JIRA_PACOTE_SERPRO_FISCAL_MVP.md`](../JIRA_PACOTE_SERPRO_FISCAL_MVP.md)

---

## O que é possível integrar

| Método | Quando usar | Automação |
|--------|-------------|-----------|
| **A. Bootstrap script** | Projeto EXEQFISC + import completo | `npm run jira:bootstrap:full` |
| **B. Setup manual UI + bootstrap** | API sem permissão criar projeto | [`FABRICA_SETUP_JIRA_MANUAL.md`](./FABRICA_SETUP_JIRA_MANUAL.md) |
| **C. CSV no Jira (UI)** | Sem terminal | Manual, 15–30 min |
| **D. REST API import only** | Projeto já existe | `npm run jira:import:apply` |
| **E. GitHub ↔ Jira** | **Depois** da importação | App GitHub for Jira |

**Não há Terraform oficial** para criar issues em massa; use A ou B.

---

## Pré-requisitos (DevOps + Jira Admin)

1. **Jira Cloud** (atlassian.net) ou Server/Data Center com REST API.
2. Permissão **Create issues** + **Administer projects** (ou Jira Admin para criar projeto).
3. **API token:** [id.atlassian.com → Security → API tokens](https://id.atlassian.com/manage-profile/security/api-tokens).
4. Projeto criado — sugerido:
   - **Key:** `EXEQFISC` ou `EXEQ`
   - **Template:** Scrum (company-managed) ou Team-managed
   - **Issue types:** Epic, Story, Task, Spike, Sub-task

### Components a criar no projeto

`backend`, `frontend`, `database`, `devops`, `ux-ui`, `qa`, `architecture`, `pm`

*(CSV referencia components; se não existirem, o script/API pode falhar — crie antes ou remova a coluna.)*

---

## Método A — Import CSV pela interface (mais rápido)

1. Jira → **Settings (engrenagem)** → **System** → **External System Import** → **CSV**.
   - Em Jira Cloud: **Settings** → **Import** → **CSV** (caminho pode variar por plano).
2. Upload: `docs/jira-import/JIRA_SERPRO_FISCAL_BACKLOG.csv`
3. Mapeamento sugerido:

| Coluna CSV | Campo Jira |
|------------|------------|
| Summary | Summary |
| Issue Type | Issue Type |
| Description | Description |
| Epic Name | **Epic Link** (ou Parent Epic em team-managed) |
| Story Points | Story Points |
| Priority | Priority |
| Labels | Labels |
| Components | Components |

4. **Importar em 2 passos** se o Jira exigir epics primeiro:
   - Passo 1: filtrar só linhas `Issue Type = Epic` — ou criar 12 epics manualmente (E00–E11).
   - Passo 2: importar stories vinculadas ao Epic Name.

5. Após import: criar **Sprint S0**, mover issues 001–004 e 096.

---

## Método B — Script REST API (recomendado DevOps)

### 1. Configurar credenciais (nunca commitar)

```powershell
cd cobranca-saas-api
copy docs\jira-import\.env.example docs\jira-import\.env.jira.local
# Editar .env.jira.local com JIRA_BASE_URL, EMAIL, API_TOKEN, PROJECT_KEY
```

Adicione ao `.gitignore` local se ainda não existir:

```
docs/jira-import/.env.jira.local
```

### 2. Descobrir IDs de campos customizados (Epic Link, Story Points)

```powershell
node scripts/jira-import-backlog.mjs --discover
```

Anote saída tipo:

```
customfield_10014    Epic Link
customfield_10011    Epic Name
customfield_10016    Story point estimate
```

Atualize `.env.jira.local`:

```env
JIRA_EPIC_LINK_FIELD=customfield_10014
JIRA_EPIC_NAME_FIELD=customfield_10011
```

**Team-managed projects:** use `JIRA_USE_PARENT_EPIC=true` e deixe `JIRA_EPIC_LINK_FIELD` vazio.

### 3. Simular importação (dry-run — padrão)

```powershell
node scripts/jira-import-backlog.mjs --dry-run
```

### 4. Executar importação real

```powershell
node scripts/jira-import-backlog.mjs --apply
```

O script:

1. Cria **12 Epics** (E00–E11) com títulos do pacote Jira.
2. Cria **58 issues** do CSV vinculadas aos epics.
3. Respeita rate limit (~250 ms entre requests).

### 5. Pós-import manual no Jira

- [ ] Criar sprints **S0** … **S10** (2 semanas)
- [ ] Mover **EXEQ-FISC-001, 002, 003, 004, 096** → Sprint S0
- [ ] Configurar board: colunas To Do / In Progress / Review / Done
- [ ] Conectar repositório GitHub (app Atlassian) — ver seção GitHub abaixo

---

## Método C — Atlassian CLI (opcional)

```powershell
# Instalar: https://developer.atlassian.com/cloud/acli/
acli auth login
acli jira workitem create --project EXEQFISC --type Story --summary "..."
```

Útil para issues avulsas; para 58 issues o script B é mais eficiente.

---

## Integração GitHub ↔ Jira (pós-import)

**Objetivo:** commits e PRs aparecem nas issues (`EXEQFISC-42`).

1. Instalar app **GitHub for Jira** no site Atlassian.
2. Conectar org/repo `cobranca-saas-api`.
3. Configurar smart commits: mensagem `EXEQFISC-123 #comment ... #time 2h`.
4. Branch naming (opcional): `feature/EXEQFISC-051-serpro-transmit`.

**CI existente** (`.github/workflows/ci.yml`) não precisa mudar para import; opcionalmente adicionar step que comenta no Jira em falha de build (via webhook Automation).

### Jira Automation (exemplo)

- Trigger: PR merged → Transition issue to Done se branch contém key.
- Trigger: Build failed → comment na issue linked.

---

## Segurança

| Item | Regra |
|------|--------|
| `JIRA_API_TOKEN` | Só em `.env.jira.local` ou secret CI (`JIRA_API_TOKEN`) |
| CI import | Use `--dry-run` em PR; `--apply` só `workflow_dispatch` com secret |
| Token scope | Conta de serviço DevOps dedicada, não pessoal do PO |

### GitHub Actions (import manual, opcional)

```yaml
# .github/workflows/jira-import-backlog.yml
name: Jira import backlog
on:
  workflow_dispatch:
jobs:
  import:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - name: Dry run
        env:
          JIRA_BASE_URL: ${{ secrets.JIRA_BASE_URL }}
          JIRA_EMAIL: ${{ secrets.JIRA_EMAIL }}
          JIRA_API_TOKEN: ${{ secrets.JIRA_API_TOKEN }}
          JIRA_PROJECT_KEY: EXEQFISC
          JIRA_EPIC_LINK_FIELD: customfield_10014
          JIRA_EPIC_NAME_FIELD: customfield_10011
        run: node scripts/jira-import-backlog.mjs --dry-run
```

Para apply real, trocar para `--apply` e restringir a admins.

---

## Troubleshooting

| Erro | Solução |
|------|---------|
| `401 Unauthorized` | Token inválido ou e-mail errado |
| `404 project` | Criar projeto ou corrigir `JIRA_PROJECT_KEY` |
| `400 Epic Link` | Rodar `--discover`, ajustar custom field |
| `400 Component` | Criar components no projeto ou remover do CSV |
| `400 Issue Type Spike` | Adicionar tipo Spike ao projeto ou trocar para Task no CSV |
| Rate limit 429 | Script já faz sleep; aumentar intervalo se necessário |

---

## Checklist DevOps — Sprint 0 no Jira

- [ ] Projeto Jira criado (`EXEQFISC`)
- [ ] Components criados
- [ ] CSV ou script `--apply` executado
- [ ] Sprint **S0** criada; 5 issues alocadas
- [ ] PO comentou autorização na Epic E00
- [ ] GitHub for Jira conectado (opcional S0, recomendado S1)
- [ ] Equipe convidada ao projeto

---

## Referências

- [Jira REST API v3 — Create issue](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-post)
- [Import CSV Jira Cloud](https://support.atlassian.com/jira-cloud-administration/docs/import-data-from-a-csv-file/)
