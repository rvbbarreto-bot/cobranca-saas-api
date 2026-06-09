# Checklist go-live fiscal SERPRO (EXEQ-FISC-095)

**Sem secrets neste arquivo.** Assinaturas PO/Tech Lead abaixo.

Runbook operacional: [FISCAL_SERPRO_DEPLOY_FEATURE_FLAG.md](./runbooks/FISCAL_SERPRO_DEPLOY_FEATURE_FLAG.md)  
Homologação técnica: [SERPRO_HOMOLOG_CHECKLIST.md](./SERPRO_HOMOLOG_CHECKLIST.md)  
SLIs: [observability/sli-fiscal-definitions.md](./observability/sli-fiscal-definitions.md)

---

## 1. Segurança e secrets

- [ ] `ENCRYPTION_KEY` gerada com `openssl rand -hex 32` e armazenada no cofre de deploy
- [ ] `npm run check:prod-env -- --strict` verde com flags fiscais de produção
- [ ] `FISCAL_SERPRO_MOCK=false` em produção (bloqueado por `check:prod-env`)
- [ ] Consumer key/secret SERPRO configurados por org via portal (não no `.env` global)
- [ ] `ENABLE_MOCK_AUTH=false` em produção

**Revisão Tech Lead:** _________________ Data: _______

---

## 2. Rate limits e abuso (API)

| Rota | Limite | Chave |
|------|--------|-------|
| `POST /v1/portal/fiscal/ingest/csv` | 10 req/min | tenant + usuário |
| `POST /v1/portal/auth/login` | 10 req/min | IP |
| `GET /v1/portal/escritorio/cobrancas/export` | 5 req/min | tenant |

- [ ] Redis (`REDIS_URL`) configurado em produção para rate limit distribuído
- [ ] Resposta `429` com `RATE_LIMIT_EXCEEDED` validada em homolog

**Revisão Tech Lead:** _________________ Data: _______

---

## 3. Feature flags e rollback testado

Ordem de rollback (efeito imediato):

1. `FISCAL_SERPRO_ENABLED=false` — bloqueia novas transmissões (`503 fiscal_serpro_disabled`); ingest/consultas OK
2. `FISCAL_GUIAS_ENABLED=false` — remove rotas `/v1/portal/fiscal/*` (`404`)
3. Portal: `VITE_FISCAL_GUIAS_ENABLED=false` + redeploy
4. Tenant piloto: desabilitar módulo `fiscal_guias` na plataforma Exeq

**Testes automatizados (CI/local):**

```powershell
npm run verify:sprint10
```

- [ ] `fiscal-go-live-hardening.integration.test.ts` verde
- [ ] Rollback simulado em homolog (passos 1–2) documentado em evidência

**Revisão DevOps:** _________________ Data: _______

---

## 4. Pipeline e observabilidade

- [ ] Migrações aplicadas (`npm run migrate`) incl. `035_processamento_fiscal.sql`
- [ ] Workers BullMQ fiscal ativos (`ENABLE_BULLMQ_WORKERS=true` em prod)
- [ ] `GET /v1/admin/metrics/fiscal-sli` acessível (admin)
- [ ] Filas monitoradas: `fiscal-ingest-validate`, `fiscal-serpro-transmit`, `fiscal-serpro-recibo`, `fiscal-serpro-emit-das`
- [ ] Alertas de profundidade de fila configurados (ver SLI doc)

**Revisão Tech Lead:** _________________ Data: _______

---

## 5. Homologação funcional

- [ ] `npm run fiscal:serpro:homolog:e2e` — pipeline mock/live
- [ ] Playwright `fiscal-portal-e2e.yml` verde (upload → stepper → recibo/DAS)
- [ ] Certificado A1 + procuração SERPRO validados no tenant piloto
- [ ] Evidência JSON arquivada em `docs/evidencias/`

**Revisão QA:** _________________ Data: _______

---

## 6. Go-live piloto (PO)

- [ ] Escritório piloto definido (tenant + CNPJs)
- [ ] Janela de deploy comunicada ao escritório
- [ ] Plano de rollback acordado (seção 3)
- [ ] Suporte operacional de plantão na janela

| Papel | Nome | Assinatura | Data |
|-------|------|------------|------|
| **PO** | | | |
| **Tech Lead** | | | |
| **DevOps** | | | |

---

## 7. Pós go-live (D+1)

- [ ] Revisar SLIs fiscais (taxa erro SERPRO, p95 transmissão, depth filas)
- [ ] Nenhum processamento preso em `TRANSMITINDO` > 30 min
- [ ] Retrospectiva S10 documentada

---

*EXEQ-FISC-095 — Hardening segurança + checklist go-live.*
