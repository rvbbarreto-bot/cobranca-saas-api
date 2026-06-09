# EXEQ-FISC-001 — Credenciais SERPRO live (dependência PO)

**Sem secrets neste arquivo.** Consumer key/secret entram apenas via portal (Config Fiscal) ou cofre de deploy.

Checklist homolog (demo): [SERPRO_HOMOLOG_CHECKLIST.md](./SERPRO_HOMOLOG_CHECKLIST.md)  
Go-live: [FISCAL_GO_LIVE_CHECKLIST.md](./FISCAL_GO_LIVE_CHECKLIST.md)

---

## 1. Responsável PO — entregáveis comerciais

| Item | Status | Responsável | Data |
|------|--------|-------------|------|
| Contrato Loja SERPRO — Integra Contador | [ ] | PO | |
| Ambiente **produção** habilitado (não apenas demo) | [ ] | PO | |
| CNPJ contratante Exeq definido | [ ] | PO | |
| Escritório piloto + CNPJs clientes acordados | [ ] | PO | |

---

## 2. Configuração técnica (Tech Lead + admin portal)

Por **organização** (não no `.env` global):

1. Portal → **Config. fiscal** → **Conexão Receita**
2. Ambiente: **prod**
3. CNPJ contratante (14 dígitos)
4. Consumer Key + Consumer Secret SERPRO
5. `serpro_enabled = true`

Variáveis de **deploy** (servidor):

```env
FISCAL_GUIAS_ENABLED=true
FISCAL_SERPRO_ENABLED=true
FISCAL_SERPRO_MOCK=false
ENCRYPTION_KEY=<openssl rand -hex 32>
RECEITA_GATEWAY_PROVIDER=serpro
```

---

## 3. Verificação automatizada (Dev)

```powershell
npm run migrate
npm run verify:fisc-001
```

Opcional — org piloto específica:

```powershell
$env:FISC_001_ORGANIZATION_ID="<uuid-org>"
npm run verify:fisc-001
```

Saída: `docs/evidencias/fisc-001/fisc-001-readiness-*.json` (sem secrets).

Critérios de **OK**:

- `FISCAL_SERPRO_MOCK=false`
- `ENCRYPTION_KEY` presente
- Pelo menos uma org com `ambiente=prod`, keys configuradas e `serpro_enabled=true`

---

## 4. Spike OAuth (opcional pós-config)

```powershell
# Credenciais locais fora do Git (.env.serpro.local)
node scripts/serpro-demo-spike.mjs
```

Evidência arquivada em `docs/evidencias/sprint-0/`.

---

## 5. Bloqueios conhecidos

| Bloqueio | Ação |
|----------|------|
| PO sem contrato prod SERPRO | Continuar homolog com `FISCAL_SERPRO_MOCK=true` |
| Certificado A1 / procuração pendente | Ver FISC-020 / vault certificados |
| `verify:fisc-001` falha | Completar Config Fiscal no tenant piloto |

---

## 6. Assinatura PO

| Papel | Nome | Assinatura | Data |
|-------|------|------------|------|
| **PO** | | | |
| **Tech Lead** | | | |

*EXEQ-FISC-001 — gate externo desbloqueia transmissão live SERPRO.*
