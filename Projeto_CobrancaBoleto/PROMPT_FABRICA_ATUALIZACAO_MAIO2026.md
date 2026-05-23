# Briefing fábrica — SaaS Cobranças API · Maio 2026

Leia primeiro: `Projeto_CobrancaBoleto/RETOMADA_FABRICA.md`.

## Estado atual

- **`main`:** Sprint L mergeado (#20 docs, #21 factory Inter/Cora).
- **Próxima entrega:** Sprint M — [DEMANDA_SPRINT_M_GATEWAY_FASE2.md](./DEMANDA_SPRINT_M_GATEWAY_FASE2.md)
- **Branch:** `feat/sprint-m-gateway-fase2`

## Sprint M — ATUAL

1. Adapter **C6** + registry/factory (PO: implementar)
2. Migration `026_gateway_change_log` + troca gateway **permitida com log**
3. Portal **ConfiguracoesPage** — credenciais dinâmicas (Asaas/Inter/Cora/C6)
4. **BB:** sprint futura (credenciais sandbox PO)
5. Inter L: emissão OK; PDF/smoke opcional P2

## P2 + portal (PO autorizou)

Pacote: [DEMANDA_PO_P2_INTER_PORTAL_ROADMAP.md](./DEMANDA_PO_P2_INTER_PORTAL_ROADMAP.md)  
Onda A: endereço worker, smoke Inter, PEM/Postman (sem secrets no git).  
Onda B: PDF Inter (após homolog).  
Onda C: Ver PDF, Enviar, Cobrar, Histórico.  
P2.0 reprocessar erro_emissao: feito (Sprint M).

## Backlog

| Item | Sprint |
|------|--------|
| Estorno + webhooks normalizados | N |
| Contratos recorrentes | N+ |

## Regras

[GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md) · secrets fora do git.
