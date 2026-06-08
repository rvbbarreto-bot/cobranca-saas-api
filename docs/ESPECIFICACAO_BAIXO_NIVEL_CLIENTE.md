# Especificação de baixo nível — Cobrança SaaS (Portal + API)

**Documento para:** Cliente / área de negócio / homologação  
**Emitido por:** Análise de requisitos + Product Owner  
**Versão:** 1.0 · **Maio/2026**  
**Sistema:** `cobranca-saas-api` + portal web (`apps/portal-web`)  
**Referência técnica interna:** [API_CONTRATO_E_SMOKE.md](./API_CONTRATO_E_SMOKE.md)

---

## 1. Objetivo do produto

Plataforma **multi-escritório** para:

1. Cadastrar **clientes pagadores** (CPF/CNPJ).
2. Criar **cobranças/boletos** (e PIX quando o gateway permitir).
3. Emitir no **banco/gateway** configurado (Asaas, Inter, Cora, C6, etc.).
4. Acompanhar **status** (emitida, pendente, paga, vencida, cancelada, erro).
5. Operar via **portal web** (escritório) e, opcionalmente, **área do devedor** (magic link).
6. Integrar **webhooks** (inbox + n8n) para automação e régua de cobrança.

Cada **escritório** (tenant) possui dados isolados. Não há visibilidade cruzada entre escritórios.

---

## 2. Atores e papéis

### 2.1 Portal do escritório

| Papel | Código no sistema | Descrição |
|-------|-------------------|-----------|
| **Administrador do escritório** | `admin_escritorio` | Acesso completo: configurações, gateway, régua, relatórios, export CSV, assinatura SaaS. |
| **Operador** | `operador` | Operação do dia a dia: dashboard, clientes, boletos, cobrança recorrente (tela). **Sem** configurações, relatórios CSV, auditoria, notificações avançadas. |
| **Cliente final (devedor)** | `cliente_cnpj` | Acesso restrito à **própria** área (`/cliente/cobrancas`) via magic link; vê apenas cobranças do seu CNPJ/CPF. |

**Regra RB-001 — Menu por papel**

| Área do menu | Admin | Operador |
|--------------|:-----:|:--------:|
| Dashboard | Sim | Sim |
| Clientes | Sim | Sim |
| Boletos | Sim | Sim |
| Cobrança recorrente | Sim | Sim |
| Notificações | Sim | Não |
| Auditoria | Sim | Não |
| Configurações | Sim | Não |
| Notas fiscais | Sim | Não |
| Relatórios / CSV | Sim | Não |
| Escritório (plano/assinatura) | Sim | Não |
| Ajuda (provisionamento) | Sim | Não |

**Regra RB-002:** Se o operador tentar abrir URL de área admin (ex.: `/configuracoes`), o sistema **redireciona** para o dashboard.

**Regra RB-003:** Apenas `admin_escritorio` ou `operador` podem **criar/editar clientes** e **criar/editar/cancelar/reprocessar** cobranças no portal.

### 2.2 API core (integrações / backoffice)

| Papel | Uso |
|-------|-----|
| `owner` / `admin` | Provisionamento de tenants, métricas SaaS, filas admin. |
| `finance` / `support` / `viewer` | Conforme política JWT core (rotas `/v1/billing`, `/v1/auth`). |

---

## 3. Autenticação e sessão

**Regra AUTH-001:** Login do portal exige **e-mail**, **tenant_id** (id ou slug do escritório) e **senha**.

**Regra AUTH-002:** Em **produção**, rotas mock (`/auth/token/mock`) ficam **desligadas**; só login real.

**Regra AUTH-003:** Cada requisição autenticada envia `Authorization: Bearer <JWT>` e header `x-tenant-id` alinhado ao tenant do token.

**Regra AUTH-004:** JWT do portal carrega o tenant de **automação** (texto); o core usa UUID de `public.tenants`.

---

## 4. Multi-tenant e vínculo de cobrança

**Regra MT-001:** Dados sensíveis (cobranças, clientes portal) são filtrados por **tenant** — isolamento obrigatório (RLS no banco).

**Regra MT-002:** Para emitir cobrança pelo portal, o escritório precisa de vínculo **`portal.billing_tenant_link`** entre:
- tenant de automação (escritório), e  
- tenant público de cobrança (`public.tenants`).

Sem vínculo → erro **409** `billing_link_missing` ao criar cobrança.

---

## 5. Regras — Cadastro de clientes

### 5.1 Campos e validação

| Campo | Obrigatório | Regra |
|-------|:-----------:|-------|
| Documento (CPF/CNPJ) | Sim (criação) | Dígitos válidos; **único por escritório** (duplicata → **409**). |
| Nome | Sim | 1–100 caracteres; letras, números, espaço e `,'.-`. |
| E-mail | Sim (criação) | Formato válido; 3–254 caracteres. |
| Telefone | Condicional | Obrigatório se **WhatsApp opt-in** = true; 10 ou 11 dígitos (DDD + número). |
| Endereço | Condicional | **Opcional no cadastro** para Asaas; **obrigatório na emissão** para Inter/Cora/C6 (ver §7). |

**Regra CLI-001:** Endereço completo = CEP (8 dígitos) + logradouro + bairro + cidade + UF (2 letras). Número e complemento são recomendados mas não entram na checagem mínima de emissão.

**Regra CLI-002:** **PATCH** (edição) permite alterar nome, e-mail, telefone, opt-in WhatsApp e **endereço**. **Não** permite alterar documento (CPF/CNPJ).

**Regra CLI-003:** Endereço parcial no POST/PATCH é **rejeitado** (ex.: só CEP sem bairro → **422**).

### 5.2 Unicidade e concorrência

**Regra CLI-004:** Dois cadastros simultâneos com o mesmo documento no mesmo escritório → um **201**, o outro **409**.

---

## 6. Regras — Cobranças (boletos)

### 6.1 Criação

**Regra COB-001:** Nova cobrança inicia em status **`rascunho`**. A emissão no gateway ocorre **em segundo plano** (fila de jobs).

**Regra COB-002:** Campos mínimos: referência/descrição, valor (> 0), data de vencimento, opcionalmente cliente (`portal_cliente_id`).

**Regra COB-003 — Idempotência:** Reenvio com a mesma `idempotency_key` no mesmo tenant retorna a **mesma cobrança** (`200` + `idempotent: true`), sem duplicar.

**Regra COB-004 — Vencimento (fuso):** Datas são validadas no fuso **America/Sao_Paulo**. “Hoje” é permitido para gateways que aceitam D+0 (ex.: Asaas); após 21h BRT não deve gerar 422 indevido.

### 6.2 Edição (retificação)

**Regra COB-005:** PATCH permite alterar **valor**, **vencimento** e **metadata**.

**Regra COB-006:** Cobrança **paga** ou **cancelada** → **não editável** (**409** `charge_not_editable`).

**Regra COB-007:** Edição não duplica cobrança; altera o registro existente.

### 6.3 Cancelamento

**Regra COB-008:** Cancelamento permitido para papéis staff; status passa a **`cancelada`** (transições conforme §8).

### 6.4 Reprocessamento de emissão

**Regra COB-009:** Cobrança em **`erro_emissao`** pode ser **reprocessada** (portal: botão “Reprocessar”).

**Regra COB-010:** Antes de enfileirar emissão/reprocesso, o sistema valida:
- cliente vinculado à cobrança;
- endereço completo **se** o gateway exige (§7).

Falha → **422** com mensagem legível; status **não** avança indevidamente para “agendado”.

### 6.5 Bloqueio preventivo na UI (O.2.2)

**Regra COB-011:** Na tela **Nova cobrança**, se gateway = Inter/Cora/C6 e cliente **sem endereço completo**:
- exibe aviso amarelo + link para editar cliente;
- botão **Criar cobrança desabilitado**;
- API também rejeita POST com **422** se contornar a UI.

---

## 7. Regras por gateway de pagamento

Configuração em **Configurações → Gateway** (`escritorio_config.gateway_provider`).

### 7.1 Tabela comparativa

| Regra | Asaas (padrão) | Banco Inter | Cora | C6 Bank |
|-------|----------------|-------------|------|---------|
| Cliente obrigatório na cobrança | Não | Sim | Sim | Sim |
| Endereço completo obrigatório | Não | Sim | Sim | Sim |
| Vencimento mínimo | D+0 (hoje ou futuro) | D+1 **dia útil** | D+1 | D+1 |
| Tamanho máx. referência | 150 | **80** | 150 | 150 |
| Referência só alfanumérica | Não | **Sim** | Não | Não |
| PIX | Sim | Não | Sim | Sim |
| Valor mín./máx. | R$ 0,01 – R$ 999.999,99 | Idem | Idem | Idem |

**Regra GW-001:** Referência/descrição é sanitizada (remove quebras de linha; Inter remove caracteres especiais).

**Regra GW-002:** Troca de gateway registra histórico (`gateway_change_log`) e exige credenciais válidas (PEM/certificado para Inter/C6 conforme configuração).

**Regra GW-003:** Emissão real Inter depende de certificado sandbox/produção aceito pelo banco; ambiente de homolog pode usar mock.

---

## 8. Status da cobrança e transições

### 8.1 Estados

| Status | Significado para o negócio |
|--------|----------------------------|
| `rascunho` | Criada no sistema; emissão pendente ou não iniciada. |
| `emitida` | Registrada no gateway; boleto/PIX gerado. |
| `enviada` | Enviada ao pagador (canal/regua). |
| `pendente_pagamento` | Aguardando pagamento. |
| `paga` | Quitada (**terminal** para edição). |
| `vencida` | Passou do vencimento sem pagamento. |
| `cancelada` | Cancelada (**terminal** para edição). |
| `erro_emissao` | Falha na emissão; permite reprocesso. |

### 8.2 Transições permitidas (resumo)

| De → Para | Permitido? |
|-----------|:----------:|
| `rascunho` → `emitida`, `pendente_pagamento`, `paga`, `vencida`, `cancelada` | Sim (via gateway/webhook) |
| `emitida` → `pendente_pagamento`, `paga`, `vencida`, `cancelada`, `erro_emissao` | Sim |
| `pendente_pagamento` → `paga`, `vencida`, `cancelada` | Sim |
| `vencida` → `paga`, `cancelada` | Sim |
| `paga` → qualquer outro | **Não** |
| `cancelada` → `emitida` | Sim (caso específico de reabertura) |
| `erro_emissao` → `emitida`, `cancelada`, `rascunho` | Sim (reprocesso/correção) |
| Retrocesso (ex.: `pendente_pagamento` → `emitida`) | **Não** |

**Regra ST-001:** Webhooks duplicados com **mesmo status** são ignorados (noop).

**Regra ST-002:** Reconciliação periódica com gateway não retrocede status indevidamente.

---

## 9. Plano SaaS do escritório (metering)

**Regra SAAS-001:** Escritório pode ter **assinatura/plano** com limites de clientes e cobranças/mês.

| Situação | HTTP | Código |
|----------|------|--------|
| Assinatura expirada / somente leitura | 403 | `SUBSCRIPTION_READ_ONLY` |
| Limite de clientes atingido | 402 | `LIMIT_CLIENTES` |
| Limite mensal de cobranças atingido | 402 | `LIMIT_COBRANCAS_MES` |

**Regra SAAS-002:** Apenas **admin_escritorio** ativa cobrança recorrente da **plataforma** (Asaas subscription) em `/escritorio`.

**Regra SAAS-003:** Trial padrão no provisionamento: **14 dias** (quando aplicável).

---

## 10. Portal — funcionalidades por módulo

### 10.1 Dashboard

**Regra UI-001:** Exibe indicadores do escritório (volume, status, atalhos). Acesso: admin e operador.

### 10.2 Clientes

- Listagem paginada (**50** por página, “Carregar mais”).
- Cadastro, detalhe, edição, link “Cobrar” (nova cobrança com cliente pré-selecionado).

### 10.3 Boletos

- Listagem com filtro por status, detalhe (timeline, PIX/boleto), edição, reprocesso, cancelamento.
- Export CSV com filtro **data inicial/final** (somente **admin**).

### 10.4 Configurações (somente admin)

- Dados fiscais do escritório.
- Gateway e credenciais (mascaradas na leitura).
- **Régua de cobrança** (regras por dias antes/depois do vencimento).
- **Templates** de notificação (e-mail/WhatsApp).

**Regra UI-002:** Template de sistema → **somente leitura** (**422** se tentar editar).

**Regra UI-003:** Regra de régua duplicada (mesmo offset/canal) → **409** `duplicate_rule`.

### 10.5 Cobrança recorrente (contrato do cliente)

**Regra UI-004 (roadmap):** Tela existe; persistência de “mensalidade / dia de vencimento / descrição no boleto” está **planejada** (ADR em elaboração). Hoje a seção pode aparecer como “Em breve” no cadastro.

### 10.6 Área do cliente final (devedor)

**Regra DEV-001:** Acesso via **magic link** (`/acesso`); JWT com papel `cliente_cnpj`.

**Regra DEV-002:** Vê **somente** cobranças do documento vinculado ao token.

---

## 11. Integrações — Webhooks e automação

### 11.1 Inbox (entrada)

**Regra WH-001:** `POST /v1/inbox/webhooks` grava evento com idempotência por `(tenant, external_event_id)`.

| Cenário | HTTP | Comportamento |
|---------|------|---------------|
| Primeiro envio | 202 | Grava e aceita |
| Reenvio (na fila) | 200 | `deduplicated: true` |
| Reenvio (já processado) | 200 | `deduplicated: true`, `already_processed: true` |

**Regra WH-002:** Em produção, secret `X-Webhook-Secret` **obrigatório**.

### 11.2 n8n (saída)

**Regra WH-003:** Eventos de cobrança (criada, emitida, paga, cancelada, etc.) podem disparar webhook outbound para orquestração externa (WhatsApp, e-mail, CRM).

**Regra WH-004:** Cancelamento de cobrança remove jobs pendentes de régua associados.

### 11.3 Asaas / Inter

**Regra WH-005:** Webhooks Asaas mapeiam status de pagamento → status canônico (§8).

**Regra WH-006:** Inter: webhook + polling de reconciliação complementares quando configurado.

---

## 12. Segurança e auditoria

**Regra SEC-001:** Senhas portal armazenadas com **hash bcrypt** (nunca texto puro).

**Regra SEC-002:** Credenciais de gateway criptografadas (`ENCRYPTION_KEY`); exibição mascarada no portal.

**Regra SEC-003:** Ações críticas registradas em **audit_log** (alteração de cobrança, cliente, gateway, etc.).

**Regra SEC-004:** Produção exige TLS na conexão com banco e JWT secret forte; mocks desabilitados.

---

## 13. Paginação e listagens

**Regra PAG-001:** Listagens portal aceitam `limit` (1–200, padrão **50**) e `cursor` opaco.

**Regra PAG-002:** Cursor inválido → **400** `invalid_cursor`.

**Regra PAG-003:** Ordenação estável: cobranças por data de criação decrescente; clientes por nome A–Z.

---

## 14. Fora de escopo / roadmap (informar cliente)

| Item | Status |
|------|--------|
| Cobrança recorrente automática (job mensal) | Planejado — ADR aprovado parcialmente |
| NFS-e emissão neste pacote | Fora — legado desacoplado |
| Failover automático entre gateways | Fora (v1) |
| BB sandbox completo | Backlog |
| Homologação Inter real (certificado) | Dependente do banco |

---

## 15. Glossário

| Termo | Definição |
|-------|-----------|
| **Escritório / tenant** | Empresa contábil ou corretora que usa o sistema. |
| **Cliente pagador** | PF/PJ cobrada via boleto/PIX. |
| **Cobrança / boleto** | Título financeiro com ciclo de vida (§8). |
| **Gateway** | Provedor bancário/fintech (Asaas, Inter, …). |
| **Status canônico** | Estado normalizado interno, independente do banco. |
| **Magic link** | Link de acesso único para o devedor ver seus boletos. |
| **Régua** | Sequência automática de lembretes (dias vs vencimento). |

---

## 16. Controle de versão do documento

| Versão | Data | Autor | Alteração |
|--------|------|-------|-----------|
| 1.0 | 30/05/2026 | PO / Análise | Versão inicial para cliente — Fase 2 |

---

*Documento derivado do comportamento implementado em `cobranca-saas-api` e portal web. Divergências em homologação devem ser registradas com evidência (print + tenant + IDs) para atualização desta especificação.*
