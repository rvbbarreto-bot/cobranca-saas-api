# Robot Framework E2E — Portal Web EXEQ

Automação **Robot Framework 7** + **Browser Library** (Playwright) para validação end-to-end do portal React (`apps/portal-web`).

Complementa (não substitui):
- **Vitest** — unit/component (`npm run portal:test`)
- **Playwright** — fluxos API+portal integrados (`npm run e2e:playwright`)

---

## 1. Preparar ambiente

### Pré-requisitos

| Item | Versão / nota |
|------|----------------|
| Python | 3.10+ no PATH |
| Node | stack do repo |
| Postgres + Redis | `npm run dev:up` ou docker-compose |
| API | porta **3333** |
| Portal | porta **5173** |

### Setup único

```powershell
# Python 3.12+ (se ausente):
winget install Python.Python.3.12

npm run test:robot:setup
```

O venv é criado em **`%LOCALAPPDATA%\exeq-robot-venv`** (fora do OneDrive) para evitar corrupção de pacotes em caminhos longos. Override: variável `ROBOT_VENV`.

### Dados e flags

```powershell
npm run migrate
npm run seed:dev
npm run seed:dev-rbac
```

| Variável | Default | Descrição |
|----------|---------|-----------|
| `PORTAL_BASE_URL` | `http://localhost:5173` | SPA Vite |
| `API_BASE_URL` | `http://localhost:3333` | Health check |
| `PORTAL_TENANT` | `escritorio-demo` | Login |
| `PORTAL_ADMIN_EMAIL` | `admin@teste.local` | Admin |
| `PORTAL_ADMIN_PASSWORD` | `TesteDev!2026` | Senha seed |
| `PORTAL_OPERADOR_EMAIL` | `operador@teste.local` | Operador |
| `FISCAL_ENABLED` | `true` | Skip testes fiscais se `false` |
| `BROWSER_HEADLESS` | `true` | `false` para debug visual |

**Fiscal:** API `FISCAL_GUIAS_ENABLED=true` e portal `VITE_FISCAL_GUIAS_ENABLED=true`.

### Subir stack

```powershell
# Terminal 1
npm run dev

# Terminal 2
npm run portal:dev
```

---

## 2. Executar suite

```powershell
npm run test:robot
```

Relatórios: `tests/robot/results/report.html` e `log.html`.

### Filtros por tag

```powershell
cd tests/robot
..\.venv\Scripts\robot.exe -i smoke tests
..\.venv\Scripts\robot.exe -i critical tests
..\.venv\Scripts\robot.exe -i fiscal tests
..\.venv\Scripts\robot.exe -i rbac tests
```

Debug com browser visível:

```powershell
$env:BROWSER_HEADLESS="false"
npm run test:robot
```

---

## 3. Matriz de cobertura (telas e regras)

### Rotas públicas

| Rota | Suite | Validação |
|------|-------|-----------|
| `/login` | 00, 01 | Campos e-mail, tenant, senha; submit vazio → Zod |
| `/acesso` | 00, 03 | Tenant na URL; e-mail required (HTML5) |
| `/` → redirect | 00 | Rota protegida → login |

### Escritório autenticado (admin)

| Rota / menu | Suite | Validação |
|-------------|-------|-----------|
| `/dashboard` | 01, 02 | KPIs ou loading; atalhos |
| `/clientes` | 02 | Lista + link Novo cliente |
| `/clientes/novo` | 02, 03 | Tipo PF/PJ, doc, nome, e-mail obrigatórios |
| `/cobrancas` | 02 | Título Boletos |
| `/cobrancas/nova` | 02, 03 | Referência*, valor*, vencimento* |
| `/guias-fiscais` | 02 | Se fiscal ON |
| `/configuracoes/fiscal` | 02, 04 | Abas; empresa obrigatória; PEM required |
| `/recorrente` | 02 | Placeholder |
| `/notificacoes` | 02 | Placeholder admin |
| `/auditoria` | 02 | Placeholder admin |
| `/configuracoes` | 02 | Gateway / régua / templates |
| `/notas-fiscais` | 02 | Ferramentas |
| `/relatorios` | 02 | CSV |
| `/escritorio` | 02 | Perfil tenant |
| `/ajuda/provisionamento-core` | 02 | Doc provision |

\* Campos com validação Zod documentada em `apps/portal-web/src/lib/schemas.ts` e `cobranca-form.ts`.

### RBAC operador

| Regra | Suite |
|-------|-------|
| Menu: Dashboard, Clientes, Boletos, Recorrente (+ Guias se fiscal) | 05 |
| Sem Configurações, Notificações, Auditoria, Ferramentas | 05 |
| URL `/configuracoes`, `/relatorios`, `/configuracoes/fiscal` → redirect `/dashboard` | 05 |

### Autenticação

| Cenário | Suite |
|---------|-------|
| Login admin seed | 01 |
| Login operador seed | 01 |
| Campos vazios | 01 |
| Senha inválida → banner erro | 01 |
| Logout → `/login` | 01 |

---

## 4. Estrutura do projeto

```
tests/robot/
  requirements.txt       # robotframework + robotframework-browser
  robot.yaml
  resources/
    portal_variables.robot
    portal_locators.robot
    portal_keywords.robot
  tests/
    00_smoke_environment.robot
    01_login_auth.robot
    02_navigation_admin_pages.robot
    03_form_validations.robot
    04_config_fiscal.robot
    05_operador_rbac.robot
  scripts/
    prepare_env.ps1
    run_suite.ps1
  results/               # gitignored — report.html
```

---

## 5. Tags Robot

| Tag | Uso |
|-----|-----|
| `smoke` | Ambiente + login page |
| `critical` | Login, navegação core, validações bloqueantes |
| `auth` | Autenticação |
| `navigation` | Todas as telas menu |
| `validation` | Campos obrigatórios |
| `forms` | Formulários cliente/cobrança |
| `fiscal` | Módulo fiscal |
| `rbac` | Papéis admin vs operador |
| `admin` / `operador` | Filtro por papel |
| `placeholder` | Telas roadmap |
| `ferramentas` | Seção Ferramentas |

---

## 6. CI (sugestão)

```yaml
- run: npm run test:robot:setup
- run: npm run migrate && npm run seed:dev && npm run seed:dev-rbac
- run: npm run dev & npm run portal:dev &
- run: npm run test:robot
  env:
    BROWSER_HEADLESS: "true"
    FISCAL_ENABLED: "true"
```

---

## 7. Extensões recomendadas

1. **Fluxo feliz persistido** — cadastrar cliente PJ + cobrança (dados únicos por run).
2. **Detalhe dinâmico** — `/clientes/:id`, `/cobrancas/:id` após seed E2E.
3. **Config fiscal com empresa** — autocomplete + assert card salvo (GET).
4. **Integração CI** — job paralelo ao Playwright com artefatos `results/`.

Consultor QA: priorize tags `critical` no pipeline; use `BROWSER_HEADLESS=false` localmente para triagem visual.
