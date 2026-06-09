# ADR — Regra de cobrança recorrente (Spike O.3.0)

**Status:** Proposta — aguarda aprovação PO para O.3.1+  
**Data:** 2026-05-28

## Contexto

A UI de cadastro de cliente exibe seção **Regra de cobrança** (mensalidade, dia de vencimento, descrição no boleto, mês referência). Hoje os campos estão desabilitados (`EmBreveSection`) e **nada é persistido**.

## Opções de modelo

| Opção | Prós | Contras |
|-------|------|---------|
| **A — Colunas em `portal.cliente`** | Simples; 1:1 com cliente | Mistura cadastro com contrato; difícil histórico |
| **B — Tabela `portal.cliente_contrato`** | Contrato versionável; dia/mensalidade isolados | Migration + CRUD extra |
| **C — JSON em `portal.cliente.metadata`** | Rápido para MVP | Sem validação SQL; queries ruins |

## Recomendação (Tech Lead)

**Opção B** para produção; **Opção C** apenas se PO exigir MVP em &lt; 3 dias.

Campos mínimos do contrato:

- `valor_mensal` (numeric)
- `dia_vencimento` (1–28)
- `descricao_boleto` (varchar 80, regra Inter)
- `mes_referencia_modo` (`automatico` | `manual`)
- `ativo` (boolean)

## Gatilho de geração de cobrança (O.3.3)

| Gatilho | Uso |
|---------|-----|
| **Manual** | Fora do MVP — usuário cria cobrança avulsa |
| **BullMQ cron diário** | Recomendado — job `generate-recurring-charges` |
| **n8n** | Se já houver orquestração externa |

## Estimativa

| Item | Dias úteis |
|------|------------|
| O.3.1 API + migration | 2–3 |
| O.3.2 UI (tirar Em breve) | 1–2 |
| O.3.3 Job mensal | 3–5 |

## Decisão PO

- [ ] Aprovar Opção B + job BullMQ  
- [ ] Reduzir escopo: só persistir contrato, sem job (O.3.3 fora)  
- [ ] Adiar para sprint posterior
