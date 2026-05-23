# Coordenação de entrega — P2 Inter + portal (multidisciplinar)

**Atualizado:** 2026-05-23 · **Coordenador:** PO + fábrica  
**Base:** `main` (`85c5d34` — P2 #24 + portal UI P0 #25)  
**P2 (referência):** [DEMANDA_PO_P2_INTER_PORTAL_ROADMAP.md](./DEMANDA_PO_P2_INTER_PORTAL_ROADMAP.md)  
**Sprint atual:** [DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md](./DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md)

---

## 1. Status executivo (não parar a fila)

| Stream | Item | Dono sugerido | Status | Próximo passo |
|--------|------|---------------|--------|----------------|
| **Gateway** | P2.2 Endereço pagador | Backend | ✅ **main** (#24) | — |
| **Gateway** | P2.3 Smoke Inter OAuth | Backend/DevOps | ✅ Script em `main` | QA rodar smoke com credenciais locais |
| **Gateway** | P2.4 PEM + Postman | DevOps/QA | ✅ Validação no save | Postman local sem commit de secrets |
| **Homolog** | OAuth Inter sandbox | QA + Inter | 🔴 Bloqueado externo | `SSL alert unknown ca` — pacote certificado com o banco |
| **Portal** | P2.8 Histórico | Frontend | 🟢 MVP | Lista → detalhe `#timeline` |
| **Portal** | P2.6 Enviar (WhatsApp) | Frontend | 🟢 MVP | Detalhe `#enviar` · wa.me |
| **Portal** | P2.5 Ver PDF | Frontend | 🟡 Parcial | Detalhe `#pagamento` · PDF real depende P2.1 |
| **Portal** | P2.7 Cobrar vencida | Frontend | 🟡 MVP | Lista → detalhe `#enviar` |
| **Gateway** | P2.1 PDF Inter | Backend | ⏸ Onda B | Após OAuth 200 ou mock HTTP |

**Regra de ouro:** itens **Onda A** e **C** seguem mesmo com homolog Inter bloqueada.

---

## 2. Fila paralela (Sprint N — substitui fila P2)

```text
[Concluído] PR #24 + #25 → main
     │
     ├─► Onda 0: QA homolog + evidências (docs/QA_* + SPRINT_N_HOMOLOG_RELATORIO)
     ├─► Onda A: portal polish (detalhe boleto, P1, BrDatePicker edição)
     ├─► Onda B: feat/p2-inter-pdf (P2.1) — mock ou OAuth Inter
     ├─► Onda C: relatórios filtros data
     └─► Onda D: webhook Inter + estorno
```

Pacote único: **DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md**

**CI obrigatório antes de merge:** `npm run build && npm test && npm run portal:test`

---

## 3. Ritual diário (15 min)

1. **PO/Coordenador:** confirmar 1 item “em merge” e 1 item “em dev”.
2. **Tech Lead:** revisar PR aberto; decidir split se diff > ~400 linhas.
3. **QA:** registrar homolog Inter em `docs/evidencias/` (sem secrets).
4. **Dev:** branch a partir de `main` após cada merge; nunca acumular 3 features numa branch sem PR.

---

## 4. Comandos rápidos

```bash
git fetch origin && git checkout main && git pull origin main
npm ci && npm run migrate && npm run seed:dev
npm run build && npm test && npm run portal:test
```

**Smoke Inter (máquina com certificado):**

```powershell
$env:INTER_CLIENT_ID="..."
$env:INTER_CLIENT_SECRET="..."
$env:INTER_CERT_PATH="C:\QA\inter-sandbox\Inter API_Certificado.crt"
$env:INTER_KEY_PATH="C:\QA\inter-sandbox\Inter API_Chave.key"
$env:RUN_INTER_SANDBOX="1"
npm run gateway:smoke:inter
```

---

## 5. Bloqueios e donos

| Bloqueio | Impacto | Ação |
|----------|---------|------|
| Inter rejeita cert (unknown CA) | P2.1 PDF, emissão real | QA + comercial Inter; continuar Onda A/C |
| PDF placeholder `inter://` | P2.5 lista sem URL | Ver PDF no detalhe após emissão mock/Asaas |
| E-mail transacional | P2.6 completo | MVP WhatsApp; e-mail em sprint seguinte |

---

## 6. Correções pós-revisão técnica (2026-05-23)

Branch `feat/p2-review-fixes`:

- Q-01/Q-02: endereço obrigatório no backend (criação cobrança + worker + adapters Inter/Cora/C6; removido fallback `DEFAULT_ADDRESS`).
- Q-03: erros PEM → HTTP 422 (`gateway_credentials_invalid`).
- Q-04: merge de credenciais em PATCH parcial.
- Q-05: `loadPortalCliente` exige `portal_automacao_tenant_id`.
- U-01: WhatsApp respeita `whatsapp_opt_in`.
- U-02: “Ver PDF” na lista só após emissão.
- Testes: unitários + integração POST cliente com endereço.

---

## 7. Definição de pronto (por PR)

- [ ] Migração aplicada em dev (`npm run migrate`)
- [ ] Testes unitários/integração verdes
- [ ] `portal:test` se tocou `apps/portal-web`
- [ ] Sem `.env`, PEM ou Postman com secrets no commit
- [ ] `RETOMADA_FABRICA.md` ou este doc atualizado se mudou status de item
