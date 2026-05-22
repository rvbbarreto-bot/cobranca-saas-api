# Briefing fábrica — SaaS Cobranças API · Maio 2026

Leia primeiro: `Projeto_CobrancaBoleto/RETOMADA_FABRICA.md`.

## Estado atual

- **`main`:** Sprint L mergeado (#20 docs, #21 factory Inter/Cora).
- **Próxima entrega:** Sprint M — [DEMANDA_SPRINT_M_GATEWAY_FASE2.md](./DEMANDA_SPRINT_M_GATEWAY_FASE2.md)
- **Branch:** `feat/sprint-m-gateway-fase2`

## Sprint M — ATUAL

1. Adapter **Banco do Brasil** + registry/factory
2. Migration `026_gateway_change_log` + API troca gateway
3. Portal **ConfiguracoesPage** — campos dinâmicos via `GATEWAY_REGISTRY`
4. C6 atrás de `GATEWAY_C6_ENABLED` (PO credenciais)
5. PR — TL homologa sandbox BB

## Backlog

| Item | Sprint |
|------|--------|
| Estorno + webhooks normalizados | N |
| Contratos recorrentes | N+ |

## Regras

[GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md) · secrets fora do git.
