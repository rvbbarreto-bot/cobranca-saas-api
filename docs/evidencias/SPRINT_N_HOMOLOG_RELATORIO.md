# Relatório de homologação — Sprint N

**Data:** 2026-05-28  
**Commit:** `153c8ed` (`main` — merge #31; inclui #30 gaps B/D)  
**Executor:** Fábrica (automação + browser QA) · **Autorização PO:** [AUTORIZACAO_QA_ONDA_0_EXECUCAO.md](../../Projeto_CobrancaBoleto/AUTORIZACAO_QA_ONDA_0_EXECUCAO.md)  
**Ambiente:** local Docker (`dev:up`) + portal Vite `:5173`

---

## 1. Resumo executivo

| Área | Resultado | Observações |
|------|-----------|-------------|
| Regressão Asaas (P2 checklist) | **PARCIAL** | Login/lista/cobrança OK; **API clientes 500** (ver §5) |
| Portal UI tokens P0 | **PASS** | Prints claro/escuro em `prints/sprint-n-nova-cobranca-*` |
| Detalhe boleto (N.1.1) | **PASS** | Timeline + resumo; print `sprint-n-detalhe-boleto-light.png` |
| PDF Inter (proxy + mock) | **DEV OK** | Lista com “Ver PDF”; homolog real Inter: **BLOQUEADO** (cert) |
| Webhook Inter | **DEV OK** | #27 + #30; testes unitários verdes |
| Ondas B e D (DoD técnico) | **CONCLUÍDO** | PRs #27, #30 |
| Impacto em endpoints | **NÃO** | Homolog UI + regressão portal |

---

## 2. Checklist P2 (`docs/QA_P2_POS_MERGE_CHECKLIST.md`)

| ID | Cenário | Resultado | Evidência |
|----|---------|-----------|-----------|
| R1 | Login portal | **PASS** | Browser login → `/dashboard`; `sprint3` login integration PASS |
| R2 | Nova cobrança Asaas (sem endereço obrig.) | **PASS** (UI) | Form `/cobrancas/nova`; POST cobrança OK em api-battery B4 |
| R3 | Editar cobrança editável | **PASS** | api-battery B6; portal `CobrancaEditPage` tests |
| R4 | Reprocessar `erro_emissao` | **PASS** (UI) | Botão “Reprocessar” visível na lista |
| C1 | Cliente com endereço | **FAIL** | POST/GET `/v1/portal/clientes` → **500** |
| C2 | Cliente sem endereço | **FAIL** | Idem |
| C3 | PATCH endereço | **FAIL** | Idem |
| G1–G3 | Inter endereço obrigatório | **N/A** | Escritório seed Asaas |
| U1 | Lista → Histórico | **PASS** | Link “Histórico” na lista |
| U2 | Lista → Enviar | **PASS** | Link “Enviar” em títulos editáveis |
| U3 | Ver PDF em rascunho | **PASS** | “Ver PDF” só em emitida/paga (não em agendado) |
| U4–U5 | WhatsApp opt-in | **N/A** | Não exercitado nesta rodada |
| K1–K2 | PEM Inter config | **N/A** | Não exercitado nesta rodada |
| Smoke Inter | **BLOQUEADO** | Sem cert sandbox na máquina QA |

---

## 3. UI tema claro / escuro

| Tela | Claro | Escuro | Print |
|------|-------|--------|-------|
| Dashboard | OK | — | `prints/sprint-n-dashboard-light.png` |
| Lista boletos | OK | — | `prints/sprint-n-lista-boletos-light.png` |
| Detalhe boleto | OK | — | `prints/sprint-n-detalhe-boleto-light.png` |
| Nova cobrança — dropdown | OK | — | `prints/sprint-n-nova-cobranca-dropdown-light.png` |
| Nova cobrança — calendário | OK | — | `prints/sprint-n-nova-cobranca-calendar-light.png` |
| Nova cobrança (geral) | — | OK | `prints/sprint-n-nova-cobranca-dark.png` |

**Automação:** `npm run portal:test` — **56/56 PASS** · `npm test` — **285/285 PASS**

---

## 4. Bloqueios externos

| Bloqueio | Impacto | Ação |
|----------|---------|------|
| Inter certificado sandbox | PDF/OAuth real | Documentado; merge não depende |
| **API `GET/POST /v1/portal/clientes` → 500** | C1–C3, sprint3-e2e | **Abrir bug P1** — investigar logs API Docker |

---

## 5. Bugs encontrados

| ID | Severidade | Descrição | Evidência |
|----|------------|-----------|-----------|
| BUG-QA-001 | **P1** | `POST/GET /v1/portal/clientes` retorna 500 em integração e impede C1–C3 | `test:integration` falhas B3/B5, `portal-clientes-post` |

---

## 6. Declaração de impacto

- [x] Homolog Onda 0: sem alteração de contrato API nesta rodada (validação apenas)  
- [ ] **Assinatura PO final** pendente até correção BUG-QA-001 ou aceite explícito de risco  

**Assinatura PO:** Ricardo Barreto — autorização execução 28/05/2026 · homolog **parcial** até bug clientes
