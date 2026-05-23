# Pacote de demandas — Sprint N: Entrega de produto (homolog + Inter PDF + portal polish + gateway N)

**Emitido por:** PO · Tech Lead · Coordenação de entrega  
**Para:** Fábrica (IA + dev)  
**Data:** 2026-05-23 · **Base:** `main` @ `85c5d34` (P2 #24 + portal UI P0 #25)  
**Prioridade:** P0/P1 misto · **Estimativa:** 12–18 dias úteis (3 ondas paralelas)  
**Branch mãe sugerida:** `feat/sprint-n-entrega-produto` (sub-branches por onda/item)  
**Governança:** [GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md) (G1–G8 obrigatório em cada PR)

**Documentos relacionados:**

| Doc | Uso |
|-----|-----|
| [COORDENACAO_ENTREGA_P2.md](./COORDENACAO_ENTREGA_P2.md) | Status P2 (referência — não reimplementar itens ✅) |
| [docs/QA_P2_POS_MERGE_CHECKLIST.md](../docs/QA_P2_POS_MERGE_CHECKLIST.md) | Homolog regressão Asaas + Inter |
| [docs/QA_PORTAL_UI_TOKENS_P0.md](../docs/QA_PORTAL_UI_TOKENS_P0.md) | UI tema claro/escuro P0 |
| [DEMANDA_PO_P2_INTER_PORTAL_ROADMAP.md](./DEMANDA_PO_P2_INTER_PORTAL_ROADMAP.md) | Itens P2.1–P2.8 (Onda B/C remanescente) |
| [docs/GATEWAY_UNIVERSAL.md](../docs/GATEWAY_UNIVERSAL.md) | Arquitetura adapters |

---

## 1. Snapshot executivo (PO)

### O que já está em `main` — **não refazer**

| Entrega | PR / commit | Conteúdo |
|---------|-------------|----------|
| Sprint M | #22 | C6, portal credenciais dinâmicas, `gateway_change_log` |
| P2 gateway + portal MVP | #23, #24 | Endereço pagador, PEM 422, smoke Inter, Onda C (histórico, enviar, Ver PDF condicional) |
| Portal UI P0 | #25 → `main` | Tokens tema, ComboBox cliente, BrDatePicker, toggle tema |
| Revisão técnica P2 | `6cc399f` | Endereço obrigatório Inter/Cora/C6, opt-in WhatsApp, merge credenciais |

### Objetivo Sprint N (uma frase)

**Fechar homologação utilizável do produto** (Asaas + portal), **destravar PDF Inter** quando OAuth permitir, **polir portal** nas telas P1/P2 restantes, e **iniciar gateway N** (webhooks + estorno) sem parar a fila por bloqueio externo do certificado Inter.

### Regra de ouro (PO)

```text
Homolog Inter bloqueada (certificado) NÃO para Onda 0, A nem D-paralelo.
Onda B (PDF real) só merge quando: OAuth 200 OU mock HTTP + testes verdes.
```

---

## 2. Bloco de autorização PO (copiar/colar na fábrica)

```text
AUTORIZAÇÃO PO + TECH LEAD — Sprint N Entrega de Produto
Data: 2026-05-23
Repo: cobranca-saas-api
Base: main (85c5d34 ou posterior)

Autorizo a fábrica a implementar o pacote completo:
  Projeto_CobrancaBoleto/DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md

Ordem de ondas (paralelizar quando indicado):

ONDA 0 — Homolog e evidências (P0, QA + dev)
  N.0.1 Executar docs/QA_P2_POS_MERGE_CHECKLIST.md e registrar em docs/evidencias/
  N.0.2 Completar evidências UI: docs/QA_PORTAL_UI_TOKENS_P0.md (prints claro/escuro)
  N.0.3 Relatório QA único: docs/evidencias/SPRINT_N_HOMOLOG_RELATORIO.md

ONDA A — Portal polish (P1, pode paralelizar com 0)
  N.1.1 Detalhe boleto: payment-panel, timeline, cards — tokens (sem hex fixo)
  N.1.2 Telas P1: Dashboard, Clientes, Boletos, modais, Configurações
  N.1.3 CobrancaEditPage: BrDatePicker (substituir input type=date nativo)
  N.1.4 A11y: focus, aria-label ícones, erros com aria-describedby
  N.1.5 Relatório UI/UX: docs/PORTAL_UI_REVISAO_SPRINT_N.md

ONDA B — Inter PDF (P1, depende homolog OU mock)
  N.2.1 P2.1 GET PDF Inter no adapter + persistência/URL portal
  N.2.2 P2.5 Ver PDF com URL real no detalhe e download seguro
  N.2.3 Testes mock HTTP + doc GATEWAY_UNIVERSAL

ONDA C — Relatórios e produto (P2)
  N.3.1 Relatórios/CSV: filtros data (BrDatePicker) + export com query params
  N.3.2 Notificações / Auditoria / NF: EmBreveSection ou MVP mínimo conforme LLD

ONDA D — Gateway N (P1/P2, backend)
  N.4.1 Webhook Inter: endpoint + normalização evento → charge_events
  N.4.2 Polling charge-sync para Inter (complementar webhook)
  N.4.3 Estorno status estornada (contrato + adapter Asaas primeiro)
  N.4.4 Migration + testes integração webhook (fixtures)

FORA DESTE SPRINT (registrar backlog):
  - BB sandbox adapter (DEMANDA_SPRINT_O_BB)
  - E-mail transacional P2.6 completo
  - Playwright E2E nova suíte portal tema

Governança: 1 PR por onda ou por item; merge só Tech Lead após G1–G8.
CI: npm run build && npm test && npm run portal:test && npm run test:integration (G8)
```

---

## 3. Gate de entrada

```bash
git fetch origin && git checkout main && git pull origin main
git checkout -b feat/sprint-n-entrega-produto
npm ci && npm run migrate && npm run seed:dev
npm run build && npm test && npm run portal:test
npm run quality:gate
```

**Login local:** `portal-seed@local.dev` · tenant `escritorio-demo` · `PortalSeedDev!ChangeMe1`

---

## 4. Mapa de itens (executável)

| ID | Item | Onda | P | Branch sugerida | DoD resumido |
|----|------|------|---|-----------------|--------------|
| **N.0.1** | QA checklist P2 | 0 | P0 | `docs/evidencias/*` | Checklist 100% preenchido com prints |
| **N.0.2** | QA UI tokens P0 | 0 | P0 | idem | Prints dropdown + calendário claro/escuro |
| **N.0.3** | Relatório homolog Sprint N | 0 | P0 | `docs/evidencias/SPRINT_N_HOMOLOG_RELATORIO.md` | Declaração impacto endpoints |
| **N.1.1** | Detalhe boleto tokens | A | P1 | `feat/sprint-n-portal-boleto-detail` | payment-panel/timeline em `var(--color-*)` |
| **N.1.2** | Portal P1 telas | A | P1 | `feat/sprint-n-portal-polish` | 4 telas + modais sem regressão contraste |
| **N.1.3** | BrDatePicker em edição | A | P1 | mesma ou sub-branch | CobrancaEditPage alinhada à nova cobrança |
| **N.1.4** | A11y mínimo WCAG AA | A | P1 | mesma | Tab/Enter/Esc; focus visível |
| **N.1.5** | Doc revisão UI | A | P2 | `docs/PORTAL_UI_REVISAO_SPRINT_N.md` | Lista corrigido + melhorias futuras |
| **N.2.1** | PDF Inter adapter | B | P1 | `feat/p2-inter-pdf` | Substitui `inter://` placeholder |
| **N.2.2** | Ver PDF real UX | B | P1 | portal | Download/abrir PDF após emissão |
| **N.2.3** | Testes + doc PDF | B | P1 | backend | Mock HTTP + GATEWAY_UNIVERSAL |
| **N.3.1** | Relatórios filtros data | C | P2 | `feat/sprint-n-relatorios-filtros` | API query + UI BrDatePicker |
| **N.3.2** | Rotas roadmap | C | P3 | portal | Em breve ou stub documentado |
| **N.4.1** | Webhook Inter | D | P1 | `feat/sprint-n-inter-webhook` | POST webhook → eventos |
| **N.4.2** | charge-sync Inter | D | P1 | mesma | Polling idempotente |
| **N.4.3** | Estorno estornada | D | P2 | `feat/sprint-n-estorno` | Status + adapter Asaas |
| **N.4.4** | Testes webhook | D | P1 | tests/ | Fixtures sem secrets |

---

## 5. Especificação por onda

### ONDA 0 — Homolog e evidências (P0)

**Dono:** QA (execução) + dev (correções de bugs encontrados)

1. Rodar [docs/QA_P2_POS_MERGE_CHECKLIST.md](../docs/QA_P2_POS_MERGE_CHECKLIST.md) completo.
2. Rodar [docs/QA_PORTAL_UI_TOKENS_P0.md](../docs/QA_PORTAL_UI_TOKENS_P0.md) — anexar prints em `docs/evidencias/prints/`.
3. Produzir `docs/evidencias/SPRINT_N_HOMOLOG_RELATORIO.md` com:
   - Ambiente (commit SHA, data, quem testou)
   - Tabelas R1–K2 do checklist P2 (pass/fail)
   - UI P0 (pass/fail + links prints)
   - Bloqueios externos (Inter cert) vs bugs código
   - **Declaração:** houve ou não impacto em endpoints

**Critério de aceite Onda 0:** relatório assinado PO; zero bug P0 aberto sem ticket.

---

### ONDA A — Portal polish (P1)

**Causa já conhecida:** blocos CSS com `#fff`, `#f8fafc`, `#f1f5f9` fora dos tokens — quebram tema escuro (ex.: `.payment-panel`, `.boleto-summary__row` em `index.css`).

#### N.1.1 — Detalhe do boleto (`BoletoDetalhePage` + CSS)

| Requisito | Detalhe |
|-----------|---------|
| Fundos | `var(--color-surface-primary)` / `secondary` |
| Texto | `var(--color-text-primary)` / `secondary` |
| Bordas | `var(--color-border)` |
| Timeline | estados ok/err/info legíveis em claro **e** escuro |
| Painel pagamento | QR, EMV, botões copiar com contraste AA |
| Sem mudança | Lógica de polling, timeline, WhatsApp opt-in |

#### N.1.2 — Telas P1 (lista PO)

Prioridade de navegação exploratória + correção token:

1. Dashboard  
2. Listagem Clientes + filtros toolbar  
3. Listagem Boletos (`CobrancasPage`)  
4. Todos os modais (`ConfirmDialog`, confirmações exclusão)  
5. Configurações (abas gateway)

**Proibido:** alterar rotas, contratos API, validações Zod de negócio.

#### N.1.3 — `CobrancaEditPage`

- Substituir `<input type="date">` por `BrDatePicker` (mesmas regras `PortalChargeRules`).
- Manter PATCH existente e testes `CobrancaEditPage.test.tsx` verdes.

#### N.1.4 — A11y mínimo

- Contraste 4.5:1 texto/fundo (WCAG AA) nos componentes alterados.
- `aria-label` em botões só ícone (calendário, copiar, fechar modal).
- Mensagens `.err` com `role="alert"` + `aria-describedby` (padrão já usado em ComboBox/DatePicker — replicar onde faltar).

#### N.1.5 — Entregável doc

Arquivo `docs/PORTAL_UI_REVISAO_SPRINT_N.md`:

- Lista telas visitadas  
- Componentes corrigidos  
- Melhorias futuras (fora Sprint N)  
- Confirmação critérios aceite P0 UI (#25) mantidos  

---

### ONDA B — Inter PDF (P1, dependência homolog)

Referência: [DEMANDA_PO_P2_INTER_PORTAL_ROADMAP.md](./DEMANDA_PO_P2_INTER_PORTAL_ROADMAP.md) § P2.1, P2.5.

#### N.2.1 — Adapter PDF

| | |
|--|--|
| **Objetivo** | Obter PDF da API Inter após emissão; persistir ou expor URL autenticada ao portal |
| **Código** | `src/modules/payment-gateway/infrastructure/inter/` |
| **Substituir** | URL placeholder `inter://{codigoSolicitacao}` |
| **Testes** | Mock `fetch`/`nock` com fixture PDF bytes ou 302 |
| **Segurança** | PDF não público sem auth tenant; nunca logar PEM |

#### N.2.2 — Portal Ver PDF

- `#pagamento`: botão abrir/baixar PDF quando `pdf_url` real existir.
- Lista: manter regra “Ver PDF” só pós-emissão (já em `CobrancasPage`).
- Loading e erro amigáveis.

#### N.2.3 — Documentação

Atualizar `docs/GATEWAY_UNIVERSAL.md` + nota em `docs/QA_HOMOLOG_INTER_GATEWAY_PORTAL.md`.

**Gate Onda B:** PR só merge se testes mock passam; homolog real opcional no relatório N.0.3.

---

### ONDA C — Relatórios e roadmap (P2)

#### N.3.1 — Relatórios / CSV com filtros

| Camada | Entrega |
|--------|---------|
| API | `GET /v1/portal/escritorio/cobrancas/export?format=csv&from=&to=` (ISO date) — validar tenant |
| Portal | `RelatoriosPage`: dois `BrDatePicker`, botão export, feedback erro |
| Testes | Integração export com range; portal test smoke render |

#### N.3.2 — Rotas em roadmap

Notificações, Auditoria, Notas Fiscais, Cobrança Recorrente:

- Se não houver API: manter `EmBreveSection` com copy PO + link doc.
- Não inventar endpoints.

---

### ONDA D — Gateway N (P1/P2 backend)

Ver [ESTUDO_APIS_BANCARIAS.md](./ESTUDO_APIS_BANCARIAS.md) §10 (backlog Sprint N histórico).

#### N.4.1 — Webhook Inter

- Rota `POST /v1/webhooks/inter` (ou prefixo já usado no projeto).
- Validar assinatura conforme doc Inter (quando disponível; senão feature flag + log).
- Normalizar para `charge_events` / atualização status portal.

#### N.4.2 — charge-sync Inter

- Job ou processor idempotente alinhado ao worker existente.
- Não duplicar emissão.

#### N.4.3 — Estorno `estornada`

- Contrato de status no domínio billing.
- Adapter **Asaas** primeiro (homologado); Inter/C6 em follow-up.

#### N.4.4 — Testes

- `tests/integration/` webhook com payload fixture JSON.
- Sem secrets em repo.

---

## 6. Ordem de execução recomendada (Tech Lead)

```text
Semana 1 (paralelo)
├── Dev A: Onda A (N.1.1 → N.1.3) + portal:test
├── Dev B: Onda 0 (QA) + bugs P0
└── Dev C: Onda D.4.1 spike webhook (RFC curta se API Inter incompleta)

Semana 2
├── Onda A concluir N.1.2, N.1.4, N.1.5
├── Onda B se mock pronto (N.2.*)
└── Onda D.4.2–4.4

Semana 3
├── Onda C N.3.1
├── Reteste Onda 0
└── PR consolidado ou PRs por onda → merge Tech Lead
```

**PRs sugeridos (máx. ~400 linhas cada):**

1. `feat/sprint-n-portal-boleto-detail`  
2. `feat/sprint-n-portal-polish`  
3. `feat/p2-inter-pdf` (Onda B)  
4. `feat/sprint-n-inter-webhook`  
5. `feat/sprint-n-relatorios-filtros`  
6. `docs/sprint-n-homolog-evidencias` (pode ser PR só docs se QA humano)

---

## 7. Critérios de aceite globais (PO)

- [ ] Homolog P2 checklist executado com relatório em `docs/evidencias/`
- [ ] Portal tema claro e escuro sem regressão P0 (#25)
- [ ] Detalhe boleto legível em ambos os temas
- [ ] PDF Inter: código + testes mock (homolog real documentada separadamente)
- [ ] `npm run quality:gate` verde em cada PR
- [ ] Nenhum secret (.env, PEM, Postman local) commitado
- [ ] `RETOMADA_FABRICA.md` atualizado ao fechar cada onda

---

## 8. Riscos e mitigação

| Risco | Prob. | Mitigação |
|-------|-------|-----------|
| Inter cert `unknown ca` | Alta | Onda B com mock; homolog manual fora CI |
| Escopo UI inflar | Média | N.1.2 só P1 listado; P2/P3 só doc |
| Webhook Inter doc incompleta | Média | Spike + feature flag; polling N.4.2 |
| Conflito branches longas | Média | Sub-branches por onda; merge frequente `main` |

---

## 9. SYSTEM PROMPT (colar no Cursor — fábrica)

```
Repositório: cobranca-saas-api
Base: main (≥ 85c5d34) — Sprint M + P2 #24 + portal UI P0 #25 já mergeados.

SPRINT N ATUAL — pacote único:
  Projeto_CobrancaBoleto/DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md

Branch mãe: feat/sprint-n-entrega-produto
Sub-branches por onda; PR ≤ ~400 linhas; merge só Tech Lead.

Não reimplementar: endereço pagador, PEM 422, tokens P0, Onda C MVP P2.

Paralelizar: Onda 0 (QA) + Onda A (portal) + spike Onda D.
Onda B bloqueada só sem mock — implementar com testes HTTP mock.

Gates: build + test + portal:test + test:integration (G8).
```

---

*Fim do pacote Sprint N — autorização vigente até revogação explícita do PO.*
