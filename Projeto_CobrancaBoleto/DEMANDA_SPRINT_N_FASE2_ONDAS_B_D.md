# Sprint N — Fase 2 (próxima entrega à fábrica)

**Emitido por:** PO · Tech Lead  
**Para:** Fábrica (IA + dev)  
**Data:** 2026-05-23 · **Base:** `main` @ `4e69efa` (PR #26 mergeado — Onda A parcial)  
**Pacote mãe:** [DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md](./DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md)  
**Governança:** [GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md)

---

## 1. O que já foi entregue (não refazer)

| Item | PR | Status |
|------|-----|--------|
| Tokens P0 (#25) | #25 | ✅ `main` |
| Onda A — detalhe boleto, BrDatePicker edição, dash/toolbar | #26 | ✅ `main` |
| P2.2 endereço, PEM, Onda C MVP | #24 | ✅ `main` |

**Onda A remanescente (fazer nesta fase se sobrar capacidade):** N.1.2 Clientes/Config/Login (hex legados), N.1.4 a11y residual.

---

## 2. Objetivo desta fase (PO)

Executar em **paralelo** três frentes:

1. **Onda B (P1)** — PDF Inter com **testes mock HTTP** (não esperar certificado sandbox).  
2. **Onda 0 (P0)** — Homolog humana + relatório preenchido.  
3. **Onda D (P1)** — Webhook Inter + charge-sync (spike → implementação).

**Onda C** (relatórios filtros data) entra **após** Onda B mergeada ou em PR separado se capacidade.

---

## 3. Bloco de autorização PO (copiar/colar no chat da fábrica)

```text
AUTORIZAÇÃO PO + TECH LEAD — Sprint N Fase 2 (Ondas B + 0 + D)
Data: 2026-05-23
Repo: cobranca-saas-api
Base: main (4e69efa)

Pacote: Projeto_CobrancaBoleto/DEMANDA_SPRINT_N_FASE2_ONDAS_B_D.md
Referência: DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md

AUTORIZADO AGORA (paralelo):

ONDA B — PDF Inter (P1) — branch feat/p2-inter-pdf
  N.2.1 GET PDF no adapter Inter + URL utilizável no portal
  N.2.2 Ver PDF / download no detalhe (#pagamento)
  N.2.3 Testes mock HTTP + atualizar docs/GATEWAY_UNIVERSAL.md
  Gate merge: testes mock verdes (homolog real opcional no relatório)

ONDA 0 — Homolog (P0) — branch docs/evidencias ou QA local
  N.0.1 docs/QA_P2_POS_MERGE_CHECKLIST.md
  N.0.2 docs/QA_PORTAL_UI_TOKENS_P0.md + prints
  N.0.3 Preencher docs/evidencias/SPRINT_N_HOMOLOG_RELATORIO.md

ONDA D — Gateway (P1) — branch feat/sprint-n-inter-webhook
  N.4.1 POST webhook Inter → charge_events
  N.4.2 charge-sync Inter (idempotente)
  N.4.4 Testes integração com fixtures JSON

OPCIONAL (se PR B/D aguardando review):
  Onda A restante: N.1.2 telas Clientes/Config/Login (tokens)

NÃO REIMPLEMENTAR: Onda A entregue #26, P2.2, PEM, tokens P0, Onda C MVP lista.

Gates por PR: quality:gate (G1–G8). Merge só Tech Lead.
```

---

## 4. Gate de entrada

```bash
git fetch origin && git checkout main && git pull origin main
git checkout -b feat/p2-inter-pdf          # Onda B
# ou: git checkout -b feat/sprint-n-inter-webhook   # Onda D
npm ci && npm run migrate && npm run seed:dev
npm run build && npm test && npm run portal:test
```

---

## 5. Onda B — especificação executável

### N.2.1 Adapter PDF Inter

| | |
|--|--|
| **Objetivo** | Substituir URL `inter://{codigo}` por PDF obtido via API Inter |
| **Código** | `src/modules/payment-gateway/infrastructure/inter/` |
| **Portal** | `payment.boleto_pdf_url` HTTP(S) utilizável |
| **Testes** | Mock `fetch`/HTTP client — fixture PDF ou 302 |
| **Fora** | E-mail (P2.6 completo) |

### N.2.2 Portal

- Detalhe `#pagamento`: link “PDF do boleto” quando URL real existir.
- Erro amigável se PDF indisponível.
- Manter regra lista: Ver PDF só pós-emissão.

### N.2.3 DoD

- [ ] `npm test` verde (módulo Inter)
- [ ] `portal:test` se tocou portal
- [ ] Doc `GATEWAY_UNIVERSAL.md` atualizada

---

## 6. Onda D — especificação executável

### N.4.1 Webhook

- Rota alinhada ao padrão do projeto (`/v1/webhooks/...`).
- Payload fixture em `tests/fixtures/inter-webhook-*.json`.
- Atualizar status cobrança + `charge_events`.

### N.4.2 charge-sync

- Reutilizar factory/worker existente; idempotência obrigatória.

### N.4.4 Testes

- `tests/integration/` sem secrets.
- `npm run test:integration` verde (G8).

**Fora desta fase:** N.4.3 estorno `estornada` → PR dedicado após B+D.

---

## 7. Onda 0 — QA (humano + dev)

Preencher `docs/evidencias/SPRINT_N_HOMOLOG_RELATORIO.md` com:

- SHA `4e69efa` ou posterior  
- Resultado checklist P2 (tabela R/C/G/U/K)  
- Prints UI em `docs/evidencias/prints/`  
- Bloqueio Inter cert: SIM/NÃO  
- **Declaração:** impacto em endpoints SIM/NÃO  

---

## 8. PRs esperados (Tech Lead)

| # | Branch | Conteúdo |
|---|--------|----------|
| 1 | `feat/p2-inter-pdf` | Onda B |
| 2 | `feat/sprint-n-inter-webhook` | Onda D |
| 3 | `docs/sprint-n-homolog` | Onda 0 evidências (opcional só docs) |
| 4 | `feat/sprint-n-portal-polish` | Onda A restante (opcional) |

**Regra:** 1 PR por onda; máx. ~400 linhas — split se necessário.

---

## 9. SYSTEM PROMPT (fábrica)

```
main @ 4e69efa. Sprint N Fase 2: Ondas B + D + 0 em paralelo.
Pacote: DEMANDA_SPRINT_N_FASE2_ONDAS_B_D.md
Não refazer PR #26 (detalhe boleto / BrDatePicker edição).
PDF Inter: mock HTTP obrigatório; homolog real não bloqueia merge.
```

---

*Autorização vigente até nova instrução do PO.*
