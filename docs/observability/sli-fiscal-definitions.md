# SLIs / SLOs — Módulo fiscal SERPRO (EXEQ-FISC-094)

Indicadores operacionais do pipeline PGDASD: filas BullMQ, latência de transmissão SERPRO e taxa de erro.  
Endpoint: `GET /v1/admin/metrics/fiscal-sli` (JWT `owner` + `x-tenant-id`).

Requer `FISCAL_GUIAS_ENABLED=true` na API. Com módulo desligado, o endpoint retorna `fiscalEnabled: false` e `slis: []`.

---

## 1. Profundidade das filas fiscais

| Campo | Valor |
|-------|-------|
| **ID** | `fiscal_queue_depth` |
| **SLO** | ≤ 50 jobs (waiting + delayed + active) |
| **Alerta** | > 100 |
| **Dono** | Operações |

Filas monitoradas:

- `fiscal-capture`
- `fiscal-ingest-validate`
- `fiscal-serpro-transmit`
- `fiscal-serpro-recibo`
- `fiscal-serpro-emit-das`
- `fiscal-certificate-expiry`

**PromQL (exemplo futuro com exporter BullMQ):**

```promql
sum(bullmq_queue_depth{queue=~"fiscal-.*"})
```

**Resposta API (trecho):**

```json
{
  "fiscalEnabled": true,
  "queueDepth": 12,
  "queues": [
    { "name": "fiscal-serpro-transmit", "counts": { "waiting": 3, "active": 1, "failed": 0 } }
  ]
}
```

---

## 2. Latência transmissão SERPRO (p95)

| Campo | Valor |
|-------|-------|
| **ID** | `fiscal_transmit_latency_p95` |
| **SLO** | p95 < 120s em 7 dias rolling |
| **Alerta** | p95 > 300s |
| **Dono** | Engenharia |

Mede o tempo entre eventos `transmissao_iniciada` e `transmissao_concluida` em `fiscal.processamento_evento`.

```sql
SELECT percentile_cont(0.95) WITHIN GROUP (
  ORDER BY EXTRACT(EPOCH FROM (fim.created_at - inicio.created_at))
) AS p95_seconds
FROM fiscal.processamento_evento inicio
INNER JOIN fiscal.processamento_evento fim
  ON fim.processamento_id = inicio.processamento_id
 AND fim.evento = 'transmissao_concluida'
WHERE inicio.evento = 'transmissao_iniciada'
  AND inicio.created_at >= NOW() - INTERVAL '7 days';
```

---

## 3. Taxa de erro SERPRO

| Campo | Valor |
|-------|-------|
| **ID** | `fiscal_serpro_error_rate` |
| **SLO** | < 5% em 7 dias rolling |
| **Alerta** | > 10% |
| **Dono** | Engenharia |

Processamentos com status terminal (`CONCLUIDO`, `ERRO`, `TRANSMITIDA`, `RECIBO_OK`, `EMITINDO_DAS`) no período; numerador = `status = ERRO` com `erro_codigo` relacionado a SERPRO.

```sql
SELECT
  COUNT(*) FILTER (
    WHERE status = 'ERRO'
      AND (
        erro_codigo LIKE 'SERPRO%'
        OR erro_codigo LIKE '%SERPRO%'
        OR erro_codigo IN ('RECIBO_SERPRO_ERRO', 'DAS_SERPRO_ERRO')
      )
  ) * 100.0 / NULLIF(COUNT(*), 0) AS error_rate_pct
FROM fiscal.processamento_fiscal
WHERE updated_at >= NOW() - INTERVAL '7 days'
  AND status IN ('CONCLUIDO', 'ERRO', 'TRANSMITIDA', 'RECIBO_OK', 'EMITINDO_DAS');
```

---

## Integração operacional

| Recurso | Uso |
|---------|-----|
| `GET /v1/admin/metrics/fiscal-sli` | Snapshot SLIs fiscais + contadores de fila |
| `GET /v1/admin/queues/status` | SLIs gerais de cobrança (Sprint K) |
| `docs/runbooks/FISCAL_SERPRO_DEPLOY_FEATURE_FLAG.md` | Rollout e rollback feature flags |

---

## Runbook de alerta (resumo)

1. **fiscal_queue_depth breach** — escalar workers SERPRO (`SERPRO_TRANSMIT_CONCURRENCY`), verificar Redis e jobs `failed`.
2. **fiscal_transmit_latency_p95 breach** — checar status SERPRO demo/prod, certificado A1 e procuração; ver `fiscal.processamento_evento`.
3. **fiscal_serpro_error_rate breach** — filtrar `erro_codigo` em `fiscal.processamento_fiscal`; correlacionar com auditoria `GET /v1/portal/fiscal/audit`.

---

*EXEQ-FISC-094 — Observabilidade SLI fiscal. Ver também [sli-definitions.md](./sli-definitions.md) (cobrança geral).*
