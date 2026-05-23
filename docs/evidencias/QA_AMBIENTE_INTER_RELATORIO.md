# Relatório QA — Preparação de ambiente (Banco Inter)

**Data:** 2026-05-22  
**Executor:** QA automatizado (Newman + health checks)  
**Objetivo:** Validar se o ambiente local está pronto para homologação Inter.

---

## Resumo executivo (1 minuto)

| Item | Status | Ação QA |
|------|--------|---------|
| API health `:3334` | **OK** | Usar esta URL nos testes |
| API Docker `:3333` | **Não serve para Inter** | Não usar — sem rotas `/gateway` |
| Migrations 025/026 | **OK** (já aplicadas) | Nada pendente |
| Postman smoke (24 testes) | **OK** | Pode importar collection |
| Emissão de boleto (pasta 3) | **Pendente** | Falta PEM + `pemConfigured=true` |
| `git checkout main` | **Não executado** | Branch atual: `feat/sprint-m-gateway-fase2` (código Inter completo) |

**Veredito:** Ambiente **aprovado para smoke/config Inter** em `http://localhost:3334`. Homologação ponta a ponta (boleto emitido) depende dos certificados PEM.

---

## 1. Checklist do roteiro que você pediu

| Passo | Comando / ação | Resultado |
|-------|----------------|-----------|
| 1 | `git checkout main && git pull` | **Pulado** — há alterações locais na branch `feat/sprint-m-gateway-fase2`. Para homolog Inter, esta branch (ou `main` após merge PR #22) é a correta. |
| 2 | `npm ci` | **Não reexecutado** — `node_modules` já presente; `newman` instalado. |
| 3 | `npm run migrate` | **OK** — saída: `nenhuma migration pendente` (025 e 026 já no banco). |
| 4 | `npm run dev` | **Já em execução** — responde em `:3334` (e `:3333` é outro processo Docker). |
| 5 | `GET /health` | **OK** — `{"status":"ok","service":"cobranca-saas-api"}` |

---

## 2. Duas APIs na máquina (importante)

```
┌─────────────────────────────────────────────────────────────┐
│  http://localhost:3334  →  npm run dev (código ATUAL)     │
│  ✅ Gateway Inter, migrations, Postman smoke 24/24        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  http://localhost:3333  →  Docker cobranca-saas-api-api-1  │
│  ❌ GET /gateway/providers → 400 (API antiga, sem Sprint L) │
│  ❌ gateway_provider só asaas|pagarme no PATCH config       │
└─────────────────────────────────────────────────────────────┘
```

**Regra para QA:** Postman e portal devem apontar para **`http://localhost:3334`** (ou rebuild do Docker após merge + migrate).

---

## 3. Health detalhado (`/health/ready`)

| Check | OK? |
|-------|-----|
| Postgres (`selectOne`) | Sim |
| `pgcrypto` | Sim |
| Tabela `public.tenants` | Sim |
| Tabela `public.charges` | Sim |
| Tabela `portal.app_user` | Sim |

Latência ~36 ms.

---

## 4. Postman — smoke automatizado

| Métrica | Valor |
|---------|--------|
| Collection | `postman/Inter_Gateway_Homolog.postman_collection.json` |
| Base URL | `http://localhost:3334` |
| Requests | 10 |
| Assertions | **24 pass / 0 fail** |
| Duração | ~1,3 s |

### Cenários validados

| ID | Nome | Resultado |
|----|------|-----------|
| — | Health + ready | Pass |
| — | Login seed + admin | Pass |
| INT-01 | Lista providers com Inter | Pass |
| INT-02 | Schema 4 campos PEM | Pass |
| INT-03 | PATCH gateway Inter | Pass |
| INT-04 | Config sem secrets em claro | Pass |
| INT-07 | Histórico troca gateway | Pass |

Relatório técnico JSON: `docs/evidencias/postman-inter-homolog-report.json` (gitignored).

---

## 5. O que falta para homologação completa (PO)

| # | Item | Quem |
|---|------|------|
| 1 | Arquivos **Certificado PEM** + **Chave privada PEM** (sandbox Inter) | PO / Financeiro |
| 2 | Colar PEM no environment Postman `.local` e `pemConfigured=true` | QA |
| 3 | Redis ativo (`REDIS_URL=redis://127.0.0.1:6379`) para fila de emissão | Tech Lead |
| 4 | Rodar pasta **3 — Cobrança** no Collection Runner ou `npm run postman:inter:homolog` | QA |

---

## 6. Comandos rápidos (copiar/colar)

São **dois terminais** — API e portal são processos separados.

**Terminal 1 — API:**

```powershell
cd "C:\Users\Ricardo\OneDrive\Empresas Ricardo\Exeq\Projeto_CobrancaBoleto\Projeto\cobranca-saas-api"
npm run migrate
$env:PORT="3334"
$env:REDIS_URL="redis://127.0.0.1:6379"
npm run dev
```

**Terminal 2 — Portal (obrigatório para `/login`):**

```powershell
cd "C:\Users\Ricardo\OneDrive\Empresas Ricardo\Exeq\Projeto_CobrancaBoleto\Projeto\cobranca-saas-api"
npm run portal:dev
```

O portal usa `apps/portal-web/.env.local` com `VITE_API_BASE_URL=http://localhost:3334` (homolog Inter).

**Validar:**

```powershell
Invoke-RestMethod http://localhost:3334/health
Invoke-WebRequest http://localhost:5173/login -UseBasicParsing   # deve ser 200
$env:POSTMAN_BASE_URL="http://localhost:3334"
npm run postman:inter:smoke
```

**Login portal (manual):**

| Campo | Valor |
|-------|--------|
| URL | http://localhost:5173/login |
| E-mail | `portal-seed@local.dev` |
| Tenant | `escritorio-demo` |
| Senha | `PortalSeedDev!ChangeMe1` |

---

## 7. Documentos de apoio

- Setup passo a passo UI: [QA_INTER_SETUP_GUIA_PASSO_A_PASSO.md](../QA_INTER_SETUP_GUIA_PASSO_A_PASSO.md)
- Matriz homolog: [QA_HOMOLOG_INTER_GATEWAY_PORTAL.md](../QA_HOMOLOG_INTER_GATEWAY_PORTAL.md)
- Postman: [postman/README_INTER_HOMOLOG.md](../../postman/README_INTER_HOMOLOG.md)
- Template evidência: [INTER_HOMOLOG_TEMPLATE.md](./INTER_HOMOLOG_TEMPLATE.md)

---

*Gerado após execução real no ambiente local. Reexecutar após `git pull` ou troca de branch.*
