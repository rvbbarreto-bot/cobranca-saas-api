# Pacote de demandas — Sprint F: Portal — editar cobrança (P0 UX)

**Emitido por:** Tech Lead · **Para:** Fábrica (IA + dev)  
**Data:** Maio 2026 · **Base:** `main` @ `6ef4c63` (após PR #10 Sprint E)  
**Prioridade:** P0 (UX pendente) · **Estimativa:** 3–5 dias · **Branch:** `feat/sprint-f-portal-editar-cobranca`

---

## Gate de entrada

```bash
git fetch origin && git checkout main && git pull origin main
git checkout -b feat/sprint-f-portal-editar-cobranca
npm ci && npm run migrate && npm run seed:dev
npm run build && npm test && npm run portal:test
```

**Governança:** [GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md)

**Contexto:** `PATCH /v1/portal/cobrancas/:chargeId` e `patchPortalCobranca` no SPA **já existem** (API + `api.ts` + testes unitários API). Falta a **tela** de edição e links na UI — espelhar `ClienteEditPage`.

---

## Objetivo

Permitir que **admin_escritorio** / **operador** retifiquem valor e vencimento de cobranças **não terminais**, sem duplicar registro.

**API (não alterar contrato salvo bug):**

| Método | Caminho | Body | Erros |
|--------|---------|------|-------|
| PATCH | `/v1/portal/cobrancas/:chargeId` | `{ amount?, due_date?, metadata? }` | **404** not found · **409** `charge_not_editable` se `paga`/`cancelada` · **422** validação |

---

## Entregas

### F.1 — Schema e formulário

- `cobrancaEditFormSchema` em `apps/portal-web/src/lib/schemas.ts` (amount > 0, due_date `YYYY-MM-DD`, ao menos um campo).
- Tipos alinhados a `PatchPortalCobrancaBody` em `api.ts`.

### F.2 — Página `/cobrancas/:chargeId/editar`

- Novo `CobrancaEditPage.tsx` (padrão `ClienteEditPage.tsx`):
  - Carregar cobrança via `fetchPortalCobrancaDetail` ou lista em cache + detail.
  - Campos: valor (`amount`), vencimento (`due_date`).
  - Submit → `patchPortalCobranca` → redirect `/cobrancas/:id`.
  - Mensagens de erro para `charge_not_editable` e validação.

### F.3 — Navegação

- Rota em `App.tsx`: `/cobrancas/:chargeId/editar`.
- Link **Editar** em `BoletoDetalhePage.tsx` quando status **não** for `paga` nem `cancelada`.
- Link opcional na lista `CobrancasPage.tsx` (mesma regra de status).

### F.4 — Testes portal

- `CobrancaEditPage.test.tsx`: render + submit PATCH mockado.
- Atualizar `schemas.test.ts` se necessário.

### F.5 — Documentação

- [docs/PORTAL_WEB.md](../docs/PORTAL_WEB.md) — rota e fluxo de edição.
- [docs/API_CONTRATO_E_SMOKE.md](../docs/API_CONTRATO_E_SMOKE.md) — referência PATCH cobrança (se ainda resumido).

### F.6 — PR + handoff Tech Lead

Título sugerido: `feat(portal): tela editar cobrança (Sprint F)`

---

## Definition of Done

```bash
npm run build
npm test
npm run portal:test    # meta: 30+ casos
```

- [ ] PO demo: abrir boleto emitido → Editar → alterar vencimento → lista/detalhe atualizados
- [ ] Cobrança `paga` não exibe Editar (ou exibe desabilitado com mensagem)
- [ ] Handoff no PR (governança §5)

---

## Fora de escopo

- Editar cliente (já existe `/clientes/:id/editar`)
- `charge.emitted` n8n (Sprint G)
- NFS-e, motor fiscal
- Merge pela IA

---

## Referências

- `apps/portal-web/src/pages/ClienteEditPage.tsx`
- `src/modules/portal-read/application/patch-portal-charge.ts`
- Testes API: `patch-portal-charge*.test.ts`, bateria **B6**
