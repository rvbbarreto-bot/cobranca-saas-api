*** Variables ***
# Login escritório
${LOC_LOGIN_EMAIL}          id=login-email
${LOC_LOGIN_PASSWORD}       id=login-password
${LOC_LOGIN_TENANT}         id=login-tenant
${LOC_LOGIN_SUBMIT}         css=button.btn-login-cta

# Shell autenticado
${LOC_SHELL_TITLE}          css=h1.shell-header__title
${LOC_LOGOUT_BTN}           css=button.shell-header__logout

# Nova cobrança
${LOC_COBRANCA_REF}         id=cobranca-reference
${LOC_COBRANCA_AMOUNT}      id=cobranca-amount
${LOC_COBRANCA_SUBMIT}      css=form button.btn-primary[type="submit"]

# Cliente novo — ordem dos campos no form
${LOC_CLIENTE_TIPO}         css=select
${LOC_CLIENTE_SUBMIT}       css=form button.btn-primary

# Config fiscal
${LOC_FISCAL_CLIENTE}       id=fiscal-config-cliente
${LOC_FISCAL_CERT_EMPTY}    css=[data-testid="fiscal-cert-empty"]
${LOC_FISCAL_PROC_EMPTY}    css=[data-testid="fiscal-proc-empty"]
${LOC_FISCAL_SAVED_CARD}    css=[data-testid="fiscal-saved-card"]

# Portal cliente (/acesso)
${LOC_ACESSO_EMAIL}         css=.login-form input[type="email"]
