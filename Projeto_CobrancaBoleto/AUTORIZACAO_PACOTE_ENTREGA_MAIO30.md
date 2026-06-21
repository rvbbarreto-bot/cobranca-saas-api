# Autorização PO — Pacote entrega (Maio/2026 · ciclo 2)

**De:** Ricardo Barreto (PO)  
**Para:** Time sênior full-stack + DevOps  
**Data:** 30/05/2026  
**Status:** ✅ **AUTORIZADO EXECUTAR AGORA**  
**Princípio:** **foco na entrega** — PRs pequenos, `quality:gate` verde, homolog paralela.

---

## 1. Baseline (já no ambiente / trunk local)

| Entrega | Status | Nota |
|---------|--------|------|
| Docker dev (`dev:up`, migrate **027**) | ✅ | `docs/LOCAL_DOCKER_SETUP.md` |
| N.3.1 Relatórios CSV `from`/`to` | ✅ código | Não reimplementar |
| Ondas B/D Inter (PDF mock, webhook) | ✅ | #27, #30 |
| Endereço cliente API + UI cadastro/edição | ✅ | Cenários 4–6 homolog OK |
| Usuários RBAC dev (`seed:dev-rbac`) | ✅ código local | **P0.1 entregue** — PR `feat/portal-rbac-menu-seed` |
| Bloqueio emissão O.2.2 | ✅ código local | **P0.2 entregue** — banner + botão desabilitado + API 422 |
| Sprint O homolog O.0 | ☐ parcial | Itens **1** e **7** — QA assina após teste manual |

**Trunk:** `main` @ **`f9120a6+`** · ambiente: `/health/ready` com `portalClienteEndereco: true`.

---

## 2. Bloco de autorização PO (copiar/colar na fábrica)

```text
AUTORIZAÇÃO PO — Pacote entrega Maio/2026 (ciclo 2)
Data: 2026-05-30
Repo: cobranca-saas-api
Time: sênior full-stack
Foco: ENTREGA (PR pequeno, quality:gate, sem re-trabalho)

AUTORIZO executar, nesta ordem:

P0.1 — RBAC portal (admin vs operador)
  Branch: feat/portal-rbac-menu-seed
  Escopo: menu filtrado, PortalRoleGuard, seed admin@teste.local + operador@teste.local
  Gate: portal:test + seed:dev-rbac documentado no output do script

P0.2 — Sprint O · O.2.2 Bloqueio preventivo emissão
  Branch: feat/sprint-o-emissao-endereco-guard
  Escopo: nova cobrança bloqueia Inter/Cora/C6 se cliente sem endereço (UI + API alinhados)
  DoD: cenário 7 em docs/evidencias/SPRINT_O_HOMOLOG_CHECKLIST.md = OK + testes

P1.1 — Sprint O · O.0 homolog fechamento (QA ∥ dev)
  Artefatos: SPRINT_O_HOMOLOG_CHECKLIST.md + SPRINT_N_HOMOLOG C1–C3 pós-027
  Responsável: QA/PO — não bloqueia merge P0 se dev entregou código

P1.2 — Sprint O · O.1 residual (se P0.2 mergeado)
  Branch: feat/sprint-o-playwright-smoke
  Escopo: 1 spec Playwright login admin + operador (menu visível diferente)
  Opcional se capacidade; não bloqueia release interna

P2.1 — Cobrança recorrente · persistência (sem job automático neste ciclo)
  Branch: feat/sprint-o-recorrente-contrato-mvp
  Pacote: docs/ADR_REGRA_COBRANCA_RECORRENTE.md
  Decisão PO: Opção B (portal.cliente_contrato) OU Opção C se ≤3 dias — Tech Lead escolhe e registra no PR
  Escopo: migration + PATCH/GET contrato no cliente + UI tira EmBreve (só admin edita)
  FORA: job BullMQ O.3.3 (backlog próximo ciclo)

NÃO INICIAR sem novo RFC PO:
  - Reimplementar N.3.1, PDF/webhook Inter, BB sandbox, job recorrente automático, failover gateway

Gate merge: npm run quality:gate · PR ≤ ~400 linhas · Tech Lead merge
Governança: GOVERNANCA_FABRICA_COMMIT_PR.md
```

---

## 3. Ordem de execução (uma linha por vez)

| Ordem | ID | Entrega | Branch | Estimativa |
|-------|-----|---------|--------|------------|
| **1** | P0.1 | RBAC menu + seed usuários teste | `feat/portal-rbac-menu-seed` | 0,5–1 d |
| **2** | P0.2 | Bloqueio emissão sem endereço (O.2.2) | `feat/sprint-o-emissao-endereco-guard` | 1–2 d |
| **3** | P1.1 | Homolog O.0 + C1–C3 (QA) | — | 0,5 d |
| **4** | P1.2 | Playwright smoke RBAC | `feat/sprint-o-playwright-smoke` | 1 d |
| **5** | P2.1 | Contrato recorrente MVP (sem job) | `feat/sprint-o-recorrente-contrato-mvp` | 3–5 d |

---

## 4. Gate de entrada (dia 1 — DevOps)

```powershell
# Docker Desktop aberto
cd cobranca-saas-api
npm ci && npm run migrate && npm run seed:dev && npm run seed:dev-rbac
npm run dev:up
npm run portal:dev   # terminal 2
npm run build && npm test && npm run portal:test
```

**Login teste RBAC:** tenant `escritorio-demo` · senha `TesteDev!2026`  
- Admin: `admin@teste.local`  
- Operador: `operador@teste.local`

---

## 5. Gates de saída do pacote

| Gate | Critério |
|------|----------|
| **G-RBAC** | Operador vê 4 itens menu; admin vê 11; URL admin bloqueada para operador |
| **G-O.2** | Cenário 7 checklist OK; integração emissão Inter/C6/Cora sem endereço → 422 legível |
| **G-O.0** | Checklist Sprint O assinado PO (itens 1 e 7) |
| **G-merge** | `quality:gate` verde · contrato atualizado se API mudou |

---

## 6. SYSTEM PROMPT (colar no Cursor)

```
Repositório: cobranca-saas-api
Autorização: Projeto_CobrancaBoleto/AUTORIZACAO_PACOTE_ENTREGA_MAIO30.md
Foco: ENTREGA — começar por P0.1 (RBAC PR) ou P0.2 se RBAC já mergeado.

Ambiente: npm run dev:up + seed:dev + seed:dev-rbac
NÃO REIMPLEMENTAR: relatórios CSV from/to, PDF Inter, webhook Inter.
Próximo código: O.2.2 bloqueio emissão sem endereço (cenário 7 homolog).
Gate: npm run quality:gate antes de PR.
```

---

## 7. Decisões PO registradas neste ciclo

| Tema | Decisão |
|------|---------|
| Recorrência O.3 | **Autorizado P2.1** persistência contrato + UI; **job automático adiado** |
| RBAC | **Autorizado P0.1** — roles nativos `admin_escritorio` / `operador` |
| Inter sandbox real | **Fora** — continua mock/dev |
| Homolog | **Paralela** — não bloqueia merge técnico P0 |

---

*Assinatura: Ricardo Barreto — PO · CobrançaSaaS v2*
