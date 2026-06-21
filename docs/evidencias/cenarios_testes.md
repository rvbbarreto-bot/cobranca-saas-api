# Relatório de cenários — Playwright E2E

**Gerado em:** 2026-06-10T01:57:53.842Z
**Duração total:** 8.9s

## Resumo

| Status | Quantidade |
|--------|------------|
| Passou | 2 |
| Falhou | 0 |
| Ignorado | 0 |

## Cenários por feature

### autenticar seed portal

| Cenário | Status | Duração (ms) | Notas |
|---------|--------|--------------|-------|
| autenticar seed portal | **Passou** | 1372 | — |

### Fiscal PGDASD

| Cenário | Status | Duração (ms) | Notas |
|---------|--------|--------------|-------|
| Upload CSV, stepper e download DAS | **Passou** | 5256 | — |

## Homolog Asaas (script / workflow)

```json
{
  "asaasScript": {
    "case": "missing_database_url",
    "exitCode": 1,
    "ok": true
  },
  "githubWorkflow": {
    "validatedAt": "2026-05-22T00:34:29.227Z",
    "note": "Disparo real no GitHub exige secret ASAAS_API_KEY; job asaas-e2e-not-configured validado estaticamente no YAML.",
    "jobs": [
      "asaas-e2e-not-configured",
      "asaas-e2e"
    ]
  }
}
```

---

*Gerado por `e2e/reporters/evidence-reporter.ts` (Playwright)*