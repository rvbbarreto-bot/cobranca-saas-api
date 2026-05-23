# Autorização PO — P2 Inter + roadmap portal (pós Sprint M)

**Emitido por:** PO · validado Tech Lead  
**Para:** Fábrica (IA + dev)  
**Data:** Maio 2026  
**Repositório:** `cobranca-saas-api`  
**Governança:** [GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md) (G1–G8 em P1; P2 conforme secção abaixo)

---

## 1. Como o PO autoriza (ritual — 3 passos)

| Passo | Ação PO | Resultado |
|-------|---------|-----------|
| **1** | Confirmar **Sprint M mergeada** em `main` (PR #22) e CI verde | Gate de entrada |
| **2** | Registrar prioridade abaixo (pode ajustar ordem das ondas) | Escopo fechado para a fábrica |
| **3** | Colar o **bloco de autorização** (secção 2) no chat da fábrica ou comentário do PR de kickoff | Autorização explícita para `feat/*` + PR |

**Regra:** sem este documento (ou bloco equivalente datado) na thread da fábrica, itens **P2** ficam só em branch local — **PR sob demanda** no ritual de 30 min ([GOVERNANCA](./GOVERNANCA_FABRICA_COMMIT_PR.md) §2).

---

## 2. Bloco de autorização PO (copiar/colar)

```text
AUTORIZAÇÃO PO — Desenvolvimento P2 Inter + roadmap portal
Data: 2026-05-23
Repo: cobranca-saas-api
Pré-requisito: Sprint M em main (feat/sprint-m-gateway-fase2 mergeado).

Autorizo a fábrica a implementar, na ordem das ondas deste pacote:
  DEMANDA_PO_P2_INTER_PORTAL_ROADMAP.md

Onda A (P2 gateway — pode paralelizar com homolog Inter bloqueada):
  - P2.2 Endereço pagador no worker (portal.cliente → emissão)
  - P2.3 Smoke Inter E2E evoluído
  - P2.4 Validação PEM/Postman (somente se artefatos versionáveis sem secrets)

Onda B (depende homolog Inter OAuth 200 ou mock controlado):
  - P2.1 PDF Inter real (GET .../pdf)

Onda C (portal UX):
  - P2.5 Ver PDF (lista + detalhe)
  - P2.6 Enviar boleto (WhatsApp/e-mail — MVP API + UI)
  - P2.7 Cobrar (vencida)
  - P2.8 Histórico do boleto

Já entregue (não reimplementar): P2.0 Reprocessar erro_emissao (PR Sprint M).

Governança: commit+PR por onda ou por item; merge só Tech Lead.
Gates: G1–G8 quando PR P1; P2 mínimo build + test + portal:test se portal.
```

*(PO: ajuste datas e remova itens que não quiser autorizar agora.)*

---

## 3. Gate de entrada (fábrica)

```bash
git fetch origin && git checkout main && git pull origin main
git checkout -b feat/p2-inter-portal-<item>
npm ci && npm run migrate && npm run seed:dev
npm run build && npm test && npm run portal:test
```

**Bloqueio homolog externo:** emissão real Inter (sandbox) continua dependente de certificado aceito pelo Inter (`unknown ca`). Itens da **Onda A** e **C** não exigem OAuth 200. **Onda B (PDF)** exige homolog ou testes com mock HTTP.

---

## 4. Mapa de itens autorizados

| ID | Feature | Onde | Prioridade PO | Branch sugerida | Depende de |
|----|---------|------|---------------|-----------------|------------|
| **P2.0** | Reprocessar `erro_emissao` | Lista + detalhe | ✅ **Feito** | (Sprint M) | — |
| **P2.1** | PDF Inter real (`GET .../pdf`) | Adapter Inter + storage/URL | Onda B | `feat/p2-inter-pdf` | Homolog Inter ou mock |
| **P2.2** | Endereço pagador no worker | `payment-emission-processor` + `portal.cliente` | Onda A · **PR** | `feat/p2-inter-payer-address` | Migração 027 |
| **P2.3** | Smoke Inter OAuth | `gateway-smoke-inter-sandbox.ts` | Onda A · **MVP** | (mesma branch ou `feat/p2-inter-smoke`) | `RUN_INTER_SANDBOX=1` |
| **P2.4** | Validação PEM | `mtls-credential-validation.ts` | Onda A · **MVP** | (mesma branch) | Fixtures em `tests/fixtures/` |
| **P2.5** | Ver PDF | Lista → `#pagamento` | Onda C · **MVP** | portal | PDF HTTP real = P2.1 |
| **P2.6** | Enviar (WhatsApp/e-mail) | Detalhe `#enviar` | Onda C · **MVP** | portal | Telefone no cliente |
| **P2.7** | Cobrar (vencida) | Lista → `#enviar` | Onda C · **MVP** | portal | Regras avançadas depois |
| **P2.8** | Histórico | Lista → `#timeline` | Onda C · **MVP** | portal | `charge_events` |

---

## 5. Escopo por item (executável)

### P2.1 — PDF Inter real

| | |
|--|--|
| **Objetivo** | Substituir URL placeholder `inter://...` por PDF obtido na API Inter e entregue ao portal (link assinado, proxy ou storage privado). |
| **Código** | `src/modules/payment-gateway/infrastructure/inter/` |
| **DoD** | GET cobrança portal expõe URL de PDF utilizável; teste unitário com mock HTTP; doc em `docs/GATEWAY_UNIVERSAL.md`. |
| **Fora** | Envio por e-mail (P2.6). |

### P2.2 — Endereço pagador no worker

| | |
|--|--|
| **Objetivo** | Ao emitir, enviar endereço do `portal.cliente` (ou metadata) para `createCustomer` / payload Inter. |
| **Código** | Worker emissão + leitura cliente portal |
| **DoD** | Teste unitário/integração com cliente com CEP; emissão mock valida campos de endereço. |

### P2.3 — Smoke Inter E2E

| | |
|--|--|
| **Objetivo** | Script opt-in documentado: OAuth → emitir → consultar (sem depender do portal). |
| **DoD** | `RUN_INTER_SANDBOX=1` + README; falha clara se PEM inválido. |

### P2.4 — Validação PEM / Postman

| | |
|--|--|
| **Objetivo** | Manter validação ao salvar credenciais; Postman sem placeholder `PENDING`; guias QA atualizados. |
| **DoD** | Apenas ficheiros sem secrets no git; `.local` no `.gitignore`. |

### P2.5 — Ver PDF (portal)

| | |
|--|--|
| **Objetivo** | Ativar ação **Ver PDF** na lista e no detalhe quando existir URL/PDF. |
| **DoD** | `portal:test` + fluxo manual no guia BDD. |

### P2.6 — Enviar boleto

| | |
|--|--|
| **Objetivo MVP** | PO define: (a) só registrar intenção + fila futura, ou (b) integração mínima (ex.: link WhatsApp `wa.me` com texto). |
| **DoD** | Remover estado "Em roadmap" na UI para o fluxo acordado; audit log se houver API. |

### P2.7 — Cobrar (vencida)

| | |
|--|--|
| **Objetivo** | Ação na lista para títulos `vencida` (segunda via, lembrete ou reemissão — PO escolhe no refinamento). |
| **DoD** | Regra de status documentada; teste portal ou integração conforme API nova ou existente. |

### P2.8 — Histórico

| | |
|--|--|
| **Objetivo** | Ação **Histórico** abre detalhe com timeline (`events[]`) ou modal — reutilizar `charge-detail-timeline`. |
| **DoD** | Paridade com detalhe do boleto; sem eventos fictícios. |

---

## 6. Ordem recomendada (Tech Lead + PO)

```
main (pós Sprint M)
  → P2.2 endereço worker
  → P2.3 smoke + P2.4 PEM/docs (paralelo)
  → [desbloqueio Inter OAuth] → P2.1 PDF
  → P2.5 Ver PDF
  → P2.6 Enviar | P2.7 Cobrar | P2.8 Histórico (paralelo entre si)
```

---

## 7. Critérios de aceite PO (produto)

- [ ] **P2.0** Reprocessar: cobrança em falha volta a rascunho e reenfileira (já em homologação Sprint M).
- [ ] **P2.2** Nova cobrança com cliente completo não falha por endereço no gateway (quando Inter OK).
- [ ] **P2.1 + P2.5** Utilizador abre PDF do boleto emitido Inter a partir do portal.
- [ ] **P2.6–P2.8** Ações da lista deixam de estar desabilitadas conforme escopo MVP acordado.
- [ ] Nenhum secret/PEM em repositório ou PR público.

---

## 8. PR e handoff

| Tipo | Regra |
|------|--------|
| **Título PR** | `feat(p2): <item> — <resumo>` ou `feat(portal): <item>` |
| **Corpo** | Summary + Test plan + referência a este doc |
| **Merge** | Tech Lead apenas |
| **PO** | Demo por item ou por onda antes de marcar aceite §7 |

---

## 9. Referências

- [DEMANDA_SPRINT_M_GATEWAY_FASE2.md](./DEMANDA_SPRINT_M_GATEWAY_FASE2.md) § M.9 (gaps Inter)
- [docs/QA_INTER_ENTREGA_HOMOLOG_FORCA_TAREFA.md](../docs/QA_INTER_ENTREGA_HOMOLOG_FORCA_TAREFA.md)
- [RETOMADA_FABRICA.md](./RETOMADA_FABRICA.md)

---

*Documento de autorização PO. Alterações de escopo: nova data + bloco §2 na thread da fábrica.*
