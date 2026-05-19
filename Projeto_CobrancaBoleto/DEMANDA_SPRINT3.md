# 📦 PACOTE DE DEMANDAS — Sprint 3: Portal do Cliente + Relatórios
## SaaS de Cobranças · Emitido por: PO + Tech Manager + Engenheiro de Prompt IA
### Data: Maio 2026 · Pré-requisito: PR Sprint 2 mergeado e CI verde

> **Status: CONCLUÍDO** (merge em `main`, PR #2/#3). Retomada: [RETOMADA_FABRICA.md](./RETOMADA_FABRICA.md).

---

> **⛔ GATE DE ENTRADA** *(histórico — sprint encerrado)*
> Este pacote só pode ser iniciado após o PR do Sprint 2 estar mergeado em `main`
> e `npm test` retornar ≥ 130 testes passando em ambiente limpo (sem cache local).
> Confirme antes de abrir qualquer arquivo novo.

---

> **Como usar no Cursor**
> Cole cada TAREFA no chat (`Ctrl+L`) uma por vez, na ordem indicada.
> Critérios de aceite devem ser verificados ANTES de avançar para a próxima tarefa.

---

## CONTEXTO PARA O AGENTE

```
Você está dando continuidade ao projeto cobranca-saas-api.

Estado confirmado pós-Sprint 2 (PR mergeado):
✅ Fase 0: saneamento, segurança, rate-limit, audit_log
✅ Sprint 1: payment-gateway (AsaasAdapter), emissão assíncrona (BullMQ), portal PIX
✅ Sprint 2: notification-send worker, ResendAdapter, ZapiAdapter, renderTemplate,
             webhook 6 eventos Asaas, charging-rule scheduler, charge-status-sync,
             CRUD escritorio_config/charging_rules/notification_templates,
             Migrations 015/016/018/020

Filas BullMQ ativas (constantes QUEUE_* em queues.ts):
  charges:emission   → payment-emission.worker
  inbox:process      → webhook-process.worker
  charges:sync       → charge-status-sync.worker + daily-regua scheduler
  notifications:send → notification-send.worker

FORA DE ESCOPO DESTE PROJETO — NÃO IMPLEMENTAR:
  🚫 NFS-e / nota fiscal de serviço → projeto separado futuro
  🚫 Focus NFe adapter
  🚫 nfse:emit queue
  🚫 nfse_emissions table

Stack imutável: Node.js 20 + TypeScript 5.7 + Express + pg + BullMQ
Regras: multi-tenant, audit_log em mutações, idempotência, inbox pattern,
        secrets nunca no código, cobertura ≥ 85% em application/domain.
```

---

---

# ══════════════════════════════════════
# BLOCO 1 — PORTAL DO CLIENTE (role: cliente_cnpj)
# ══════════════════════════════════════

---

## TAREFA 3.1 — Autenticação do cliente final (magic link)

```
O cliente final (devedor) precisa acessar suas próprias cobranças sem ter login
no sistema do escritório. Criar autenticação baseada em magic link / token por e-mail.

─────────────────────────────────────────
Migration 021_cliente_access_token.sql:
─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cliente_access_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL,
  cliente_id  UUID NOT NULL REFERENCES portal.cliente(id),
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + interval '15 minutes',
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cat_token ON cliente_access_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_cat_cliente ON cliente_access_tokens(cliente_id);

─────────────────────────────────────────
POST /v1/portal/cliente/auth/request-access
─────────────────────────────────────────
Body: { email: string; tenant_slug: string }
  1. Buscar portal.cliente WHERE email = email (join tenant via tenant_slug)
     → Se não encontrado: retornar 200 sempre (não revelar se e-mail existe — LGPD)
  2. Gerar token: crypto.randomBytes(32).toString('hex')
  3. Salvar hash: token_hash = sha256(token)
  4. INSERT cliente_access_tokens (expires_at = now() + 15min)
  5. Enfileirar e-mail com link:
     queues.notificationSend.add('magic-link', {
       chargeId: null, tenantId,
       eventType: 'magic_link',
       forceChannel: 'email',
       metadata: { token, clienteId, email }
     })
  6. Retornar 200 { message: 'Se o e-mail existir, você receberá um link de acesso.' }

─────────────────────────────────────────
POST /v1/portal/cliente/auth/verify-token
─────────────────────────────────────────
Body: { token: string; tenant_slug: string }
  1. hash = sha256(token)
  2. SELECT * FROM cliente_access_tokens
     WHERE token_hash = hash AND expires_at > now() AND used_at IS NULL
     → 401 se não encontrado ou expirado
  3. UPDATE cliente_access_tokens SET used_at = now()   ← token de uso único
  4. Gerar JWT: { sub: clienteId, role: 'cliente_cnpj', tenant_id: tenantId, exp: +4h }
  5. Retornar 200 { token: jwt }

Template e-mail magic link (adicionar ao seed em migration 021 ou seed.ts):
  INSERT INTO notification_templates (tenant_id, event_type, channel, subject, body_template)
  VALUES
    (NULL, 'magic_link', 'email',
     'Seu link de acesso — {{escritorio_nome}}',
     'Clique no link abaixo para acessar suas cobranças (válido por 15 minutos):\n{{magic_link_url}}')
  ON CONFLICT (tenant_id, event_type, channel) DO NOTHING;

Variável magic_link_url: montar no worker notification-send como
  ${process.env.PORTAL_CLIENT_URL}/acesso?token={token}&tenant={tenant_slug}
  Adicionar PORTAL_CLIENT_URL ao .env.example

Rate limit: aplicar authRateLimit nestes endpoints (já existente em rate-limit.middleware.ts)

Testes obrigatórios (5 mínimos):
  ✅ POST request-access com e-mail existente → magic link enfileirado
  ✅ POST request-access com e-mail inexistente → 200 sem revelar ausência (LGPD)
  ✅ POST verify-token válido → JWT com role='cliente_cnpj'
  ✅ POST verify-token expirado (expires_at < now()) → 401
  ✅ POST verify-token já usado (used_at NOT NULL) → 401 (token de uso único)
```

---

## TAREFA 3.2 — Rotas do portal do cliente

```
Criar rotas protegidas com JWT role='cliente_cnpj':

GET /v1/portal/cliente/cobrancas
  → Listar cobranças do cliente autenticado (sub do JWT = cliente_id)
  → Filtros opcionais: ?status=paga&page=1&limit=20
  → Retornar apenas campos seguros:
    [{
      id, canonical_status, amount, due_date, description, type,
      payment: { type, boleto_url, pix_qrcode_base64, pix_emv, expires_at } | null
    }]
  → Filtro obrigatório: charges.customer_id = sub do JWT (ou metadata->>'portal_cliente_id')
  → NUNCA retornar dados de outros clientes

GET /v1/portal/cliente/cobrancas/:id
  → Detalhe de uma cobrança com events[]
  → 403 se a cobrança não pertence ao cliente autenticado (cross-client isolation)
  → Incluir events: [{ event_type, old_status, new_status, created_at }]

GET /v1/portal/cliente/cobrancas/:id/boleto
  → Proxy do boleto_url do payment_transactions → redirect 302
  → 404 se não existe boleto ou canonical_status IN ('paga','cancelada')

Middleware de auth para estas rotas:
  Reusar o middleware JWT existente exigindo role = 'cliente_cnpj'
  Injetar no ctx: { clienteId: payload.sub, tenantId: payload.tenant_id, role }

RBAC: cliente_cnpj acessa APENAS suas próprias cobranças.
Nunca retornar audit_log, communication_events ou dados de outros clientes.

Testes obrigatórios (4 mínimos):
  ✅ GET /cobrancas com JWT válido → lista cobranças do cliente (não de outros)
  ✅ GET /cobrancas/:id de cobrança de outro cliente → 403
  ✅ GET /cobrancas sem JWT → 401
  ✅ GET /cobrancas?status=paga → filtra apenas cobranças com canonical_status='paga'
```

---

---

# ══════════════════════════════════════
# BLOCO 2 — RELATÓRIOS E DASHBOARD
# ══════════════════════════════════════

---

## TAREFA 3.3 — Endpoint de dashboard (escritório)

```
Criar GET /v1/portal/escritorio/dashboard:

Query params opcionais:
  ?periodo=7d|30d|90d|custom
  &data_inicio=YYYY-MM-DD
  &data_fim=YYYY-MM-DD

Defaults: periodo=30d (data_fim=hoje, data_inicio=hoje-30d)

Response:
{
  periodo: { inicio: string, fim: string },
  cobrancas: {
    total: number,
    por_status: {
      rascunho: number, emitida: number, enviada: number,
      pendente_pagamento: number, paga: number,
      vencida: number, cancelada: number, erro_emissao: number
    },
    valor_total_emitido: number,      // soma de amount (excluindo cancelada)
    valor_total_recebido: number,     // soma de amount WHERE canonical_status='paga'
    valor_total_vencido: number,      // soma WHERE canonical_status='vencida'
    taxa_conversao: number,           // paga / (total - cancelada - rascunho) * 100
  },
  notificacoes: {
    total_enviadas: number,           // communication_events status='sent'
    total_falhas: number,             // status='failed'
    por_canal: { email: number, whatsapp: number }
  },
  top_clientes_inadimplentes: [       // top 5 por valor vencido
    { nome: string, documento_mascarado: string, valor_vencido: number, qtd_cobr_vencidas: number }
  ]
}

SQL principal (CTEs para clareza):
  WITH periodo AS (
    SELECT $data_inicio::date AS inicio, $data_fim::date AS fim
  ),
  cobrancas_periodo AS (
    SELECT * FROM charges
    WHERE tenant_id = $tenantId
      AND created_at::date BETWEEN (SELECT inicio FROM periodo) AND (SELECT fim FROM periodo)
  )
  SELECT
    COUNT(*)                                            AS total,
    COUNT(*) FILTER (WHERE canonical_status='paga')    AS paga,
    SUM(amount) FILTER (WHERE canonical_status='paga') AS valor_recebido,
    ...
  FROM cobrancas_periodo

Top inadimplentes:
  SELECT
    cli.nome,
    '***' || RIGHT(cli.documento, 4) AS documento_mascarado,
    SUM(c.amount)                    AS valor_vencido,
    COUNT(*)                         AS qtd_cobr_vencidas
  FROM charges c
  JOIN portal.cliente cli ON cli.id = (c.metadata->>'portal_cliente_id')::uuid
  WHERE c.tenant_id = $tenantId
    AND c.canonical_status = 'vencida'
    AND c.created_at::date BETWEEN $inicio AND $fim
  GROUP BY cli.id, cli.nome, cli.documento
  ORDER BY valor_vencido DESC
  LIMIT 5

RBAC: tenant_owner, admin_escritorio, operador (somente leitura)
      viewer → 403
Sem writeAuditLog (endpoint de leitura)

Testes obrigatórios (4 mínimos):
  ✅ GET dashboard período 30d → retorna objeto com todos os campos corretos
  ✅ GET dashboard sem cobranças no período → zeros em todos os counters (não 404)
  ✅ GET dashboard com role='viewer' → 403
  ✅ Cross-tenant: dashboard do tenant A não inclui dados do tenant B
```

---

## TAREFA 3.4 — Export CSV de cobranças

```
GET /v1/portal/escritorio/cobrancas/export?format=csv

Query params:
  format=csv (obrigatório; retornar 400 se ausente ou inválido)
  status=paga|vencida|emitida|...  (opcional, filtra canonical_status)
  data_inicio=YYYY-MM-DD           (opcional)
  data_fim=YYYY-MM-DD              (opcional)

Colunas do CSV (nesta ordem):
  id, created_at, due_date, paid_at, canonical_status, amount,
  description, type, cliente_nome, cliente_documento_mascarado,
  boleto_barcode, gateway_transaction_id

Response headers:
  Content-Type: text/csv; charset=utf-8
  Content-Disposition: attachment; filename="cobrancas-{YYYY-MM-DD}.csv"

Implementação:
  1. SQL com JOIN:
       SELECT c.*, cli.nome, cli.documento, pt.boleto_barcode, pt.gateway_transaction_id
       FROM charges c
       LEFT JOIN portal.cliente cli ON cli.id = (c.metadata->>'portal_cliente_id')::uuid
       LEFT JOIN payment_transactions pt ON pt.charge_id = c.id
       WHERE c.tenant_id = $tenantId
         [AND c.canonical_status = $status]
         [AND c.created_at::date BETWEEN $inicio AND $fim]
       ORDER BY c.created_at DESC
       LIMIT 10000
  2. Streaming: usar cursor pg ou lote + res.write() linha por linha
     (não carregar tudo em memória — máx 10.000 linhas)
  3. Mascarar documento: '***' + documento.slice(-4)
  4. Formatar datas como DD/MM/YYYY, valores como R$ X.XXX,XX

Rate limit específico: 5 exports por minuto por tenant (evitar abuso de geração)

RBAC: tenant_owner e admin_escritorio apenas

Testes obrigatórios (4 mínimos):
  ✅ GET export → Content-Type='text/csv', primeira linha = header correto
  ✅ GET export com 3 cobranças → CSV tem 4 linhas (header + 3 dados)
  ✅ Documento do cliente mascarado (***xxxx) — nunca expor completo
  ✅ Role 'operador' → 403 Forbidden
```

---

---

# ══════════════════════════════════════
# BLOCO 3 — QUALIDADE E INFRAESTRUTURA
# ══════════════════════════════════════

---

## TAREFA 3.5 — Criar validacao_sprint3.sh

```
Crie Projeto_CobrancaBoleto/validacao_sprint3.sh

Verificações (6 itens):
  [1] Migration 021 existe em db/migrations/
      ls "$MIGRATIONS_DIR"/021_*.sql → ok ou fail

  [2] Tabela cliente_access_tokens referenciada no código
      grep -r "cliente_access_tokens" "$PROJECT_ROOT/src" → ok se > 0 arquivos

  [3] Endpoints portal/cliente existem
      grep -r "portal/cliente" "$PROJECT_ROOT/src" --include="*.ts" -l → ok se > 0

  [4] Endpoint dashboard existe
      grep -r "escritorio/dashboard" "$PROJECT_ROOT/src" --include="*.ts" -l → ok se > 0

  [5] Export CSV endpoint existe
      grep -r "export.*format\|format.*csv" "$PROJECT_ROOT/src" --include="*.ts" -l → ok se > 0

  [6] Nenhuma referência a nfse_emissions ou focus_nfe no código TypeScript
      grep -r "nfse_emissions\|focus_nfe\|FocusNFe\|nfseEmit" "$PROJECT_ROOT/src" --include="*.ts" -l
      → ok se resultado VAZIO (confirma que NFS-e não foi implementada)

Estrutura idêntica a validacao_fase_0.sh:
  ok() / fail() / warn() / info() / resultado final com contagem de passed/failed
  Auto-detectar PROJECT_ROOT (subir se estiver dentro de Projeto_CobrancaBoleto/)

Critério: bash Projeto_CobrancaBoleto/validacao_sprint3.sh → 6/6 OK
```

---

## TAREFA 3.6 — .env.example atualizado + DEPLOY_CHECKLIST.md

```
─────────────────────────────────────────
Adicionar ao .env.example:
─────────────────────────────────────────

# ── PORTAL DO CLIENTE ──────────────────────────────────────
PORTAL_CLIENT_URL=http://localhost:5173

─────────────────────────────────────────
Criar docs/DEPLOY_CHECKLIST.md:
─────────────────────────────────────────

## Deploy Sprint 3 — Checklist

### Antes de subir para staging/produção
- [ ] npm run migrate → confirmar migration 021 aplicada
- [ ] Verificar PORTAL_CLIENT_URL aponta para o frontend correto
- [ ] Redis limpo de filas legadas com hífen (se ainda não feito):
        redis-cli DEL "bull:notifications-send:*"
        redis-cli DEL "bull:charges-emission:*"

### Verificação pós-deploy
- [ ] GET /health/ready → 200
- [ ] POST /v1/portal/cliente/auth/request-access → 200 (sem revelar e-mail)
- [ ] GET /v1/portal/escritorio/dashboard → 200 com objeto JSON
- [ ] GET /v1/portal/escritorio/cobrancas/export?format=csv → stream CSV
- [ ] bash Projeto_CobrancaBoleto/validacao_fase_0.sh → 0 falhas
- [ ] bash Projeto_CobrancaBoleto/validacao_sprint3.sh → 0 falhas
- [ ] Confirmar: nenhuma rota /nfse existe (grep -r "nfse" src/modules)
```

---

---

# ══════════════════════════════════════
# BLOCO 4 — CRITÉRIO DE ACEITE GLOBAL
# ══════════════════════════════════════

## Fluxo ponta a ponta Sprint 3 (deve funcionar end-to-end)

```
1. POST /v1/portal/cobrancas type='pix'
   → 201, canonical_status='rascunho', job enfileirado

2. Worker payment-emission executa
   → pix_qrcode_base64 gerado, canonical_status='emitida'

3. GET /v1/portal/cobrancas/:id
   → payment.pix_qrcode_base64 não nulo

4. POST /v1/inbox/webhooks body: PAYMENT_CONFIRMED
   → canonical_status='paga'
   → notificação 'pagamento_confirmado' enfileirada
   → jobs de régua cancelados

5. GET /v1/portal/cobrancas/:id → canonical_status='paga'

6. Cliente faz POST /v1/portal/cliente/auth/request-access (com e-mail)
   → magic link enviado por e-mail (communication_events status='sent')

7. POST /v1/portal/cliente/auth/verify-token (com token do e-mail)
   → JWT com role='cliente_cnpj' retornado

8. GET /v1/portal/cliente/cobrancas (com JWT do cliente)
   → lista cobranças do cliente incluindo a cobrança paga

9. GET /v1/portal/cliente/cobrancas/:id
   → detalhe com events[] mostrando transição para 'paga'

10. GET /v1/portal/escritorio/dashboard?periodo=30d
    → valor_total_recebido > 0, taxa_conversao calculada

11. GET /v1/portal/escritorio/cobrancas/export?format=csv
    → download CSV com headers corretos e dados mascarados
```

---

## Checklist de entrega — PR Sprint 3

```markdown
### Sprint 3 — Portal do Cliente + Relatórios
[ ] TAREFA 3.1: Magic link auth (migration 021 + endpoints request-access/verify-token + 5 testes)
[ ] TAREFA 3.2: Rotas portal cliente (GET /cobrancas + detalhe + proxy boleto + 4 testes)
[ ] TAREFA 3.3: Dashboard endpoint (CTEs SQL + campos sem NFS-e + 4 testes)
[ ] TAREFA 3.4: Export CSV (streaming + mascaramento + rate limit + 4 testes)
[ ] TAREFA 3.5: validacao_sprint3.sh (6 checks, incluindo verificação de ausência de NFS-e)
[ ] TAREFA 3.6: .env.example com PORTAL_CLIENT_URL + DEPLOY_CHECKLIST.md
[ ] Template magic_link no seed/migration
[ ] Rate limit nos endpoints /auth/request-access e export CSV
[ ] RBAC correto em todos os endpoints novos
[ ] writeAuditLog em mutações (verify-token gera audit de login)
[ ] npm run build ✅ (zero erros TypeScript)
[ ] npm test ✅ (cobertura ≥ 85% em application/domain)
[ ] bash Projeto_CobrancaBoleto/validacao_fase_0.sh → 0 falhas (sem regressão)
[ ] bash Projeto_CobrancaBoleto/validacao_sprint3.sh → 0 falhas
[ ] Nenhuma referência a NFS-e, Focus NFe ou nfse_emissions no código
```

---

## Ordem de execução recomendada

```
Cursor — cole nesta ordem:

1. TAREFA 3.1  → Magic link auth + migration 021 (base da autenticação do cliente)
2. TAREFA 3.2  → Rotas portal cliente (depende de 3.1)
3. TAREFA 3.3  → Dashboard (SQL puro, independente das anteriores)
4. TAREFA 3.4  → Export CSV (independente)
5. TAREFA 3.5  → Script de validação
6. TAREFA 3.6  → Env + deploy checklist
```

---

*Pacote emitido por: PO + Tech Manager + Engenheiro de Prompt IA · Maio 2026*
*Próximo milestone após Sprint 3: Sprint 4 — SaaS Billing (planos, assinaturas, metering) + n8n orchestration*
*NFS-e: implementação futura em projeto dedicado, fora do escopo cobranca-saas-api*
