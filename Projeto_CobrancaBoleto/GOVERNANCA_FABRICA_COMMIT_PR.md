# Governança — Autorização PO: IA abre PR, Tech Lead aprova

**Vigência:** Maio 2026 (atualizado)  
**Papéis:** PO (produto) · **Tech Lead** (aprovação técnica + merge) · **Fábrica IA** (implementação + PR)  
**Repositório:** `cobranca-saas-api`

---

## 1. Decisão do PO (registro)

| Ator | Pode | Não pode |
|------|------|----------|
| **Fábrica (IA)** | Commit + push em `feat/*` / `fix/*`; **abrir PR** para `main`; **informar Tech Lead** para aprovação | **Merge** em `main`; aprovar o próprio PR; force push em `main` |
| **Tech Lead** | Revisar PR; pedir alterações; **aprovar e mergear** quando CI + critérios técnicos OK | Ignorar handoff da IA sem revisar |
| **PO** | Aceite de produto (demo); priorizar sprint; revogar autorização | — |

A IA **só abre o PR** e **notifica o Tech Lead**. O merge fica **sempre** com o Tech Lead (alinhado ao PO em entregas P0/P1).

---

## 2. Quando a IA pode commitar + abrir PR (entrega importante)

Checklist **G1–G8** (todos obrigatórios em entregas P0/P1):

| # | Critério | Verificação |
|---|----------|-------------|
| G1 | Escopo fechado (P0/P1 no briefing) | `RETOMADA_FABRICA.md` / `PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md` |
| G2 | `npm run build` sem erro | Local ou CI |
| G3 | `npm test` verde | API (unitários; exclui `*.integration.test.ts` por defeito) |
| G4 | `npm run portal:test` verde | Se tocou `apps/portal-web` |
| G5 | DoD Fase 2 (contrato/docs se mudou API/SPA) | `FASE2_KICKOFF_QUALIDADE.md` |
| G6 | Branch `feat/*` a partir de `main` atualizado | `git pull origin main` |
| G7 | PR com Summary + Test plan + handoff Tech Lead | Secções 4 e 5 |
| G8 | `npm run test:integration` verde | Requer `DATABASE_URL` + `npm run migrate`; igual ao job CI (`quality:gate`) |

**P2/P3 / spike:** só commit na branch; PR quando o PO priorizar no ritual de 30 min.

### G8 — integração e bateria funcional (obrigatório quando)

Executar **antes de abrir PR** (local com Postgres ou confiar no CI, mas a fábrica deve corrigir falhas antes do handoff):

```bash
npm run migrate
npm run test:integration
# ou gate completo:
npm run quality:gate
```

**G8 é obrigatório** se o PR alterar qualquer um destes caminhos:

| Área | Exemplos |
|------|----------|
| Validação portal | `portal-cliente-input.ts`, `portal-charge-rules.ts`, `validate-portal-charge-create.ts` |
| Rotas portal | `portal-router.ts`, `escritorio-router.ts` |
| Seed / auth portal | `seed-portal-happy-path.ts`, login mock |
| Bateria / E2E | `tests/functional/api-battery.integration.test.ts`, `tests/portal-read/*.integration.test.ts` |

**Sincronizar a bateria** (`tests/functional/api-battery.integration.test.ts`) quando mudar regras de negócio — casos B4–B6 (referência):

| Cenário | Regra atual (API) |
|---------|-------------------|
| **B4** POST cobrança | `reference` sem caracteres que o gateway sanitiza (ex.: evitar `-` se o escritório usa Inter/Asaas com sanitize) |
| **B5** POST cliente | `email` obrigatório e válido |
| **B5** PATCH cliente | `whatsapp_opt_in: true` exige `telefone` (10–11 dígitos) no **mesmo** PATCH |

**Tech Lead:** PR que muda validação portal **sem** atualizar testes de integração ou bateria → pedir **changes** antes do merge.

---

## 3. Fluxo — IA (fábrica)

```
1. git pull origin main → feat/<nome>
2. Implementar + testes + docs
3. npm run build && npm test && (portal:test) && (test:integration se G8 aplicável)
4. git commit + git push
5. gh pr create --base main
6. HANDOFF → informar Tech Lead (obrigatório, secção 5)
7. PARAR — não fazer merge nem gh pr merge
```

---

## 4. Fluxo — Tech Lead (após handoff)

```
1. Abrir URL do PR
2. Verificar CI (build, test, portal:test, test:integration / quality:gate)
3. Review de código + segurança (tenant, secrets, migrations)
4. Pedir changes OU Approve
5. Merge em main (squash ou merge commit — política da equipa)
6. PO: demo/aceite produto se P0/P1
```

---

## 5. Handoff obrigatório (IA → Tech Lead)

Após `gh pr create`, a IA deve **entregar ao Tech Lead** (chat, Slack, ou comentário no PR) este bloco:

```markdown
## Handoff — PR pronto para revisão técnica

- **PR:** <URL>
- **Branch:** `feat/...`
- **Sprint:** <ex. Sprint B>
- **Gates locais:** build ✅ | test ✅ | portal:test ✅/N/A | test:integration ✅/N/A (G8)
- **CI:** aguardando / link Actions
- **Demo sugerida:** <3 passos>
- **Riscos / atenção:** <migrations, env, breaking>
- **Ação pedida:** @Tech Lead — revisar e **aprovar merge** (IA não faz merge).
```

**Regra:** sem handoff explícito, o PR **não** está “entregue” na metodologia fábrica.

---

## 6. Template do corpo do PR

```markdown
## Summary
- …

## Sprint / governança
- Sprint: …
- IA: commit + PR apenas — merge pelo **Tech Lead** (GOVERNANCA_FABRICA_COMMIT_PR.md)

## Test plan
- [ ] `npm test`
- [ ] `npm run portal:test` (se portal)
- [ ] `npm run test:integration` ou `npm run quality:gate` (G8 — se validação/API portal)
- [ ] …

## Revisão
- [ ] **Tech Lead:** aprovação técnica + merge
- [ ] **PO:** aceite produto (se P0/P1)
```

---

## 7. Responsabilidades (resumo)

| Papel | Responsabilidade |
|-------|------------------|
| **PO** | Prioridade; aceite produto; autorização vigente |
| **Tech Lead** | **Único** responsável por merge após review + CI |
| **IA** | Código + testes + PR + **handoff**; **nunca** merge |

---

## 8. Artefatos ignorados (Sprint K — higiene)

Nunca commitar:

| Padrão | Motivo |
|--------|--------|
| `node_modules/`, `**/node_modules/` | Dependências |
| `secrets/` (exceto `secrets/README.md`) | Credenciais TLS/API |
| `.env`, `.env.local`, `.env.*.local` | Overrides locais |
| `docs/evidencias/asaas-e2e-*.json` (exceto `EXAMPLE`) | Evidências reais de homolog |
| `tests/robot/evidence/screenshots/*` (exceto `.gitkeep`) | Screenshots Robot locais |
| `*.docx`, `prototype-*.html` | Estudos fora do código |
| `Projeto_CobrancaBoleto_v2/` | Cópia acidental de workspace |

Após `npm install && npm run build`, `git status` deve listar apenas alterações intencionais do dev.

---

## 9. Referências

- [RETOMADA_FABRICA.md](./RETOMADA_FABRICA.md) §10
- [PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md](./PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md)
- [docs/API_CONTRATO_E_SMOKE.md](../docs/API_CONTRATO_E_SMOKE.md) — bateria funcional
- [docs/FASE2_KICKOFF_QUALIDADE.md](../docs/FASE2_KICKOFF_QUALIDADE.md) — `quality:gate`
- [AUTORIZACAO_SPRINT_K_MAIO2026.md](./AUTORIZACAO_SPRINT_K_MAIO2026.md)

---

*Registo PO: IA só abre PR; Tech Lead aprova e mergeia. Maio 2026.*
