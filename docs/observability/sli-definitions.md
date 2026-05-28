# SLIs / SLOs — CobrançaSaaS (Sprint K)

Indicadores operacionais de cobrança, webhook, filas e notificações.  
Endpoint: `GET /v1/admin/metrics/sli` (JWT `owner` + `x-tenant-id`).

---

## 1. Taxa de emissão de boleto

| Campo | Valor |
|-------|-------|
| **SLO** | 99,5% em 7 dias rolling |
| **Alerta** | < 99% |
| **Dono** | Engenharia |

```sql
SELECT
  COUNT(*) FILTER (WHERE emitted_within_sla) * 100.0 / NULLIF(COUNT(*), 0) AS sli_pct
FROM (
  SELECT c.id,
    EXISTS (
      SELECT 1 FROM charge_events e
      WHERE e.charge_id = c.id
        AND e.event_type = 'charge.emitted'
        AND e.created_at <= c.created_at + INTERVAL '5 minutes'
    ) AS emitted_within_sla
  FROM charges c
  WHERE c.created_at >= NOW() - INTERVAL '7 days'
) t;
```

---

## 2. Latência de webhook (p95)

| Campo | Valor |
|-------|-------|
| **SLO** | p95 < 30s em 24h rolling |
| **Alerta** | p95 > 60s |
| **Dono** | Engenharia |

```sql
SELECT percentile_cont(0.95) WITHIN GROUP (
  ORDER BY EXTRACT(EPOCH FROM (processed_at - created_at))
) AS p95_seconds
FROM webhook_inbox
WHERE processed_at IS NOT NULL
  AND created_at >= NOW() - INTERVAL '24 hours';
```

---

## 3. Taxa de erro de emissão

| Campo | Valor |
|-------|-------|
| **SLO** | < 2% em 7 dias |
| **Alerta** | > 5% |
| **Dono** | Produto + Engenharia |

```sql
SELECT
  COUNT(*) FILTER (WHERE canonical_status = 'erro_emissao') * 100.0
    / NULLIF(COUNT(*), 0) AS error_rate_pct
FROM charges
WHERE created_at >= NOW() - INTERVAL '7 days';
```

---

## 4. Idempotência webhook

| Campo | Valor |
|-------|-------|
| **SLO** | 100% (zero duplicatas processadas) |
| **Alerta** | Qualquer violação de UNIQUE |
| **Dono** | Engenharia |

```sql
SELECT COUNT(*) AS duplicate_keys
FROM (
  SELECT tenant_id, external_event_id, COUNT(*) AS c
  FROM webhook_inbox
  WHERE external_event_id IS NOT NULL
    AND created_at >= NOW() - INTERVAL '7 days'
  GROUP BY tenant_id, external_event_id
  HAVING COUNT(*) > 1
) d;
```

---

## 5. Disponibilidade API portal

| Campo | Valor |
|-------|-------|
| **SLO** | 99,9% em 30 dias |
| **Alerta** | < 99,5% |
| **Dono** | SRE |

**PromQL (logs `http_access`):**

```promql
sum(rate({msg="http_access", path=~"/v1/portal/.*", status=~"2..|3.."}[5m]))
/
sum(rate({msg="http_access", path=~"/v1/portal/.*"}[5m]))
```

> O endpoint `/v1/admin/metrics/sli` retorna `unavailable` até agregador de logs estar configurado.

---

## 6. Taxa de notificação entregue

| Campo | Valor |
|-------|-------|
| **SLO** | 98% em 7 dias |
| **Alerta** | < 95% |
| **Dono** | Operações |

```sql
SELECT
  COUNT(*) FILTER (WHERE status IN ('sent', 'delivered')) * 100.0
    / NULLIF(COUNT(*), 0) AS delivery_pct
FROM communication_events
WHERE created_at >= NOW() - INTERVAL '7 days';
```

---

## 7. Cobrança paga confirmada < 2 min

| Campo | Valor |
|-------|-------|
| **SLO** | 99% em 7 dias |
| **Alerta** | < 97% |
| **Dono** | Operações |

```sql
SELECT
  COUNT(*) FILTER (WHERE confirmed_within_sla) * 100.0 / NULLIF(COUNT(*), 0) AS confirm_pct
FROM (
  SELECT c.id,
    EXISTS (
      SELECT 1 FROM charge_events e
      WHERE e.charge_id = c.id
        AND e.event_type IN ('payment.confirmed', 'charge.paid')
        AND e.created_at <= c.updated_at + INTERVAL '2 minutes'
    ) AS confirmed_within_sla
  FROM charges c
  WHERE c.canonical_status = 'paga'
    AND c.updated_at >= NOW() - INTERVAL '7 days'
) t;
```

---

## Integração com filas

`GET /v1/admin/queues/status` expõe contadores BullMQ (waiting, active, failed, delayed, completed, paused) por fila e DLQ associada.
