# EXEQ-FISC-021 — Homolog live SERPRO demo (titular ricardo/EXEQ)

Piloto: tenant `ricardo` · CNPJ `37229907000137` · **titular** (sem procuração e-CAC).

**Autorização / aceite FISC-021b:** [`AUTORIZACAO_PO_FISC-021B_PROTOCOLO_DEMO_JUN2026.md`](./AUTORIZACAO_PO_FISC-021B_PROTOCOLO_DEMO_JUN2026.md) — **ENCERRADO 2026-06-06**

---

## FISC-021 — Auth + schema (baseline) ✅

- [x] OAuth / SAPI OK
- [x] `certificado_decrypt` OK
- [x] `resolve_runtime` com jwt (não mock)
- [x] Consultar/Declarar **≠ 403 jwt_token**
- [x] Payload `TRANSDECLARACAO11` com `cnpjCompleto` (sem erro de schema)
- [x] `test:fiscal-serpro` 51/51

Evidências: `docs/evidencias/fisc-021/fisc-021-serpro-live-ricardo-2026-06-14T03-*.json`

---

## FISC-021b — Integração PGDASD demo ✅ (aceite PO limite demo)

- [x] Sem 403 auth · sem erro de schema
- [x] Fase 1 simulação — `fisc-021-serpro-live-ricardo-2026-06-14T03-46-49-127Z.json`
- [x] Fase 2 transmissão — `fisc-021-serpro-live-ricardo-2026-06-14T03-46-58-661Z.json`
- [x] Erro negócio HTTP 400 **aceito PO** (sem protocolo real neste ciclo)
- [x] Factory 8/9 live — falha justificada (`SERPRO_REJEITOU`)
- [x] Aceite formal PO registrado

Resumo execução: [`evidencias/fisc-021/fisc-021b-exec-2026-06-06.json`](./evidencias/fisc-021/fisc-021b-exec-2026-06-06.json)

**Follow-up (não bloqueia 021b):** EXEQ-FISC-021c — protocolo demo + factory 9/9 live com PA/contabilidade.

---

## Pré-requisitos (referência reexecução)

- [ ] API/Postgres up (`npm run check:db`)
- [ ] `.env`: `ENCRYPTION_KEY`, `SERPRO_CONSUMER_KEY/SECRET`, `DATABASE_URL`
- [ ] `FISCAL_SERPRO_MOCK=false` · `FISCAL_SERPRO_REQUIRE_PROCURACAO=false`
- [ ] Certificado A1 EXEQ decriptável (`ENCRYPTION_KEY` alinhada)

### Certificado A1 (bloqueio comum)

Se homolog falhar com `SERPRO_CERTIFICADO_DECRYPT_FAILED`: regravar PEM no portal ou `npm run fisc-021:sync-cert`.

### Comandos homolog (referência)

```powershell
$env:FISCAL_SERPRO_MOCK="false"
$env:FISCAL_SERPRO_REQUIRE_PROCURACAO="false"
npm run fisc-021:live
```

Simulação: `$env:FISCAL_SERPRO_PGDASD_SIMULAR="true"` antes do comando acima.

---

## Próximas prioridades engenharia (pós-021b)

Conforme roadmap — **sem reabrir 021b** salvo regressão auth/schema:

- Recibo live (`CONSDECREC15` / `CONSULTIMADECREC14`)
- DAS live (`GERARDAS12`)
- Portal / UX processamentos
- Produção (feature flags, runbooks)

---

## Fora de escopo (titular)

- Procuração e-CAC · `FISCAL_SERPRO_REQUIRE_PROCURACAO=true`
- SERPRO produção

---

*Relacionado: [MEMO_PRIORIZACAO_SERPRO_JWT_TOKEN_JUN2026.md](./MEMO_PRIORIZACAO_SERPRO_JWT_TOKEN_JUN2026.md)*
