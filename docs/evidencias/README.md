# Evidências de homologação

Pasta para artefatos do aceite **Sprint 1** (Asaas Sandbox E2E).

## Gerar evidência real (local / sandbox)

```bash
npm run migrate
npm run seed:dev
# .env: DATABASE_URL, ASAAS_API_KEY (sandbox), ENCRYPTION_KEY, WEBHOOK_INBOX_SECRET
npm run e2e:asaas:evidence
```

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

## Referências

- [ASAAS_SANDBOX_E2E.md](../ASAAS_SANDBOX_E2E.md)
- [INBOX_WEBHOOK_IDEMPOTENCIA.md](../INBOX_WEBHOOK_IDEMPOTENCIA.md)
