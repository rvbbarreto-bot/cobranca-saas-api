*** Variables ***
# Sobrescreva via ambiente ou linha de comando (-v PORTAL_BASE_URL:...)
${PORTAL_BASE_URL}          %{PORTAL_BASE_URL=http://localhost:5173}
${API_BASE_URL}             %{API_BASE_URL=http://localhost:3333}

# Credenciais seed: npm run seed:dev-rbac (scripts/seed-dev-rbac-users.ts)
${PORTAL_TENANT}            %{PORTAL_TENANT=escritorio-demo}
${PORTAL_ADMIN_EMAIL}       %{PORTAL_ADMIN_EMAIL=admin@teste.local}
${PORTAL_ADMIN_PASSWORD}    %{PORTAL_ADMIN_PASSWORD=TesteDev!2026}
${PORTAL_OPERADOR_EMAIL}    %{PORTAL_OPERADOR_EMAIL=operador@teste.local}
${PORTAL_OPERADOR_PASSWORD}    %{PORTAL_OPERADOR_PASSWORD=TesteDev!2026}

${FISCAL_ENABLED}           %{FISCAL_ENABLED=true}
${BROWSER_HEADLESS}         %{BROWSER_HEADLESS=true}
${BROWSER_TIMEOUT}          15s
${NAV_WAIT}                 2s

# Mensagens de validação (schemas.ts / cobranca-form.ts)
${MSG_EMAIL_OBRIGATORIO}    E-mail invalido
${MSG_SENHA_OBRIGATORIA}    Senha obrigatoria
${MSG_TENANT_OBRIGATORIO}   Tenant obrigatorio
${MSG_REF_OBRIGATORIA}      Referencia / descricao obrigatoria
${MSG_TIPO_CLIENTE}         Selecione Pessoa Fisica ou Pessoa Juridica
${MSG_NOME_OBRIGATORIO}     Nome obrigatorio
${MSG_DOC_OBRIGATORIO}      Documento obrigatorio
${MSG_SELECIONE_EMPRESA}    Selecione a empresa (cliente portal).
