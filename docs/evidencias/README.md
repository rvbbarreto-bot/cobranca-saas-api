# Evidências de homologação

Pasta para artefatos do aceite **Sprint 1** (Asaas Sandbox E2E).

## Gerar evidência real (local / sandbox)

```bash
npm run migrate
npm run seed:dev
# .env: DATABASE_URL, ASAAS_API_KEY (sandbox), ENCRYPTION_KEY, WEBHOOK_INBOX_SECRET
npm run e2e:asaas:evidence
```

## Playwright E2E (portal + API)

```bash
npm run e2e:playwright:install   # primeira vez
npm run e2e:playwright
```

Relatórios: `cenarios_testes.md`, `asaas-e2e-result.json` (atualizados pelo reporter em `e2e/reporters/`).
O `seed:dev` garante ≥ 55 cobranças no tenant demo para o cenário «Carregar mais».

Saída: `asaas-e2e-<timestamp>.json` (caminho impresso no terminal).

## O que commitar no Git

| Permitido | Proibido |
|-----------|----------|
| `asaas-e2e-EXAMPLE.redacted.json` (template) | `asaas-e2e-*.json` com execução real |
| Checklist preenchido em PR (texto) | `ASAAS_API_KEY`, prints com chaves |

Arquivos `asaas-e2e-*.json` (exceto `*-EXAMPLE.redacted.json`) estão no `.gitignore`.

## O que anexar no PR de homolog (Tech Lead / PO)

1. Print do terminal com contagem `Assertions: 14/14 OK` (ou 13 critérios + meta).
2. Link ou anexo do JSON gerado (Drive / ticket), **sem** subir o JSON com dados reais ao repositório.
3. [SPRINT1_ACEITE_CHECKLIST.md](./SPRINT1_ACEITE_CHECKLIST.md) com coluna **Assertion runner** conferida.

## CI manual (GitHub Actions — Sprint J)

Workflow: **Asaas E2E (manual)** — arquivo `.github/workflows/asaas-e2e-manual.yml`

| Passo | Ação |
|-------|------|
| 1 | Repositório → **Actions** → **Asaas E2E (manual)** → **Run workflow** |
| 2 | (Opcional) marcar `skip_seed` ou `skip_migrate` se o banco já estiver pronto |
| 3 | Após o job, baixar o artefacto `asaas-e2e-evidence-<run_id>` (JSON, retenção **30 dias**) |

### Secrets (Settings → Secrets and variables → Actions)

| Secret | Obrigatório | Descrição |
|--------|-------------|-----------|
| `ASAAS_API_KEY` | **Sim** (para rodar E2E) | API key **sandbox** Asaas (`$aact_...`) |

Sem `ASAAS_API_KEY`, o workflow termina com aviso (`asaas-e2e-not-configured`) — **não falha** o repositório.

Variáveis de CI (Postgres/Redis, `ENCRYPTION_KEY`, `WEBHOOK_INBOX_SECRET`, etc.) estão definidas no workflow; não é necessário duplicá-las em secrets.

## Referências

- [QA_GUIA_TESTES_BDD.md](../QA_GUIA_TESTES_BDD.md) — guia PO/TL para time QA (URLs, workflow, cenários BDD)
- [ASAAS_SANDBOX_E2E.md](../ASAAS_SANDBOX_E2E.md)
- [INBOX_WEBHOOK_IDEMPOTENCIA.md](../INBOX_WEBHOOK_IDEMPOTENCIA.md)
