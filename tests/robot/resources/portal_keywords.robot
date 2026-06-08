*** Settings ***
Library    Browser
Resource   portal_variables.robot
Resource   portal_locators.robot

*** Keywords ***
Abrir Navegador Portal
    [Documentation]    Inicializa Browser Library (Playwright) para testes E2E.
    ${headless}=    Convert To Boolean    ${BROWSER_HEADLESS}
    New Browser    chromium    headless=${headless}
    Set Browser Timeout    ${BROWSER_TIMEOUT}
    New Context    viewport={'width': 1440, 'height': 900}    locale=pt-BR
    New Page    ${PORTAL_BASE_URL}/

Ir Para
    [Arguments]    ${path}
    Go To    ${PORTAL_BASE_URL}${path}
    Wait For Load State    networkidle    timeout=20s

Fechar Navegador Portal
    Close Browser

Preparar Sessao Limpa
    [Documentation]    Garante estado deslogado antes de cada teste.
    ${logged}=    Run Keyword And Return Status    Wait For Elements State    ${LOC_LOGOUT_BTN}    visible    timeout=3s
    Run Keyword If    ${logged}    Logout Escritorio
    ${on_login}=    Run Keyword And Return Status    Wait For Elements State    ${LOC_LOGIN_EMAIL}    visible    timeout=3s
    Run Keyword If    not ${on_login}    Ir Para    /login

Verificar API Disponivel
    [Documentation]    Pré-condição: API em ${API_BASE_URL} com /health OK.
    ${body}=    Evaluate    __import__('urllib.request', fromlist=['urlopen']).urlopen('${API_BASE_URL}/health', timeout=5).read().decode()
    Should Contain    ${body}    ok    msg=API indisponível em ${API_BASE_URL}. Rode npm run dev.

Login Escritorio
    [Arguments]    ${email}=${PORTAL_ADMIN_EMAIL}    ${password}=${PORTAL_ADMIN_PASSWORD}    ${tenant}=${PORTAL_TENANT}
    Ir Para    /login
    Wait For Elements State    ${LOC_LOGIN_EMAIL}    visible
    Fill Text    ${LOC_LOGIN_EMAIL}    ${email}
    Fill Text    ${LOC_LOGIN_PASSWORD}    ${password}
    Fill Text    ${LOC_LOGIN_TENANT}    ${tenant}
    Click    ${LOC_LOGIN_SUBMIT}
    Wait For Load State    networkidle
    Wait For Elements State    ${LOC_SHELL_TITLE}    visible    timeout=20s
    Get Text    ${LOC_SHELL_TITLE}    contains    Portal SaaS

Logout Escritorio
    Click    ${LOC_LOGOUT_BTN}
    Wait For Elements State    ${LOC_LOGIN_EMAIL}    visible    timeout=15s

Navegar Menu Lateral
    [Arguments]    ${label}
    Click    css=nav.sidebar__nav >> role=link[name="${label}"]
    Wait For Load State    networkidle
    Sleep    ${NAV_WAIT}

Pagina Deve Ter Titulo
    [Arguments]    ${titulo}
    Wait For Elements State    css=h2.shell-page__title    visible    timeout=15s
    Get Text    css=h2.shell-page__title    contains    ${titulo}

Pagina Deve Conter Texto
    [Arguments]    ${texto}
    Get Text    body    contains    ${texto}

Clicar Botao
    [Arguments]    ${nome}
    Click    css=.shell-content >> role=button[name="${nome}"]

Clicar Link Pagina
    [Arguments]    ${nome}
    Click    css=.shell-content >> role=link[name="${nome}"]

Clicar Link
    [Arguments]    ${nome}
    Clicar Link Pagina    ${nome}

Submeter Formulario Login Vazio
    Ir Para    /login
    Click    ${LOC_LOGIN_SUBMIT}

Validar Erros Login Obrigatorios
    ${count}=    Get Element Count    css=.err
    Should Be True    ${count} >= 3
    Pagina Deve Conter Texto    ${MSG_EMAIL_OBRIGATORIO}
    Pagina Deve Conter Texto    ${MSG_SENHA_OBRIGATORIA}
    Pagina Deve Conter Texto    ${MSG_TENANT_OBRIGATORIO}

Submeter Nova Cobranca Vazia
    Navegar Menu Lateral    Boletos
    Clicar Link Pagina    Nova cobrança
    Pagina Deve Ter Titulo    Nova cobranca avulsa
    Click    ${LOC_COBRANCA_SUBMIT}

Submeter Cliente Novo Vazio
    Navegar Menu Lateral    Clientes
    Clicar Link Pagina    Novo cliente
    Pagina Deve Ter Titulo    Cadastro do cliente
    Click    ${LOC_CLIENTE_SUBMIT}

Selecionar Tipo Cliente
    [Arguments]    ${tipo_label}
    Select Options By    ${LOC_CLIENTE_TIPO}    label    ${tipo_label}

Ir Config Fiscal Aba
    [Arguments]    ${aba}
    Navegar Menu Lateral    Config. fiscal
    Pagina Deve Ter Titulo    Configuração fiscal
    Clicar Botao    ${aba}

Operador Nao Deve Ver Link Menu
    [Arguments]    ${label}
    ${count}=    Get Element Count    css=nav.sidebar__nav >> role=link[name="${label}"]
    Should Be Equal As Numbers    ${count}    0    msg=Operador não deveria ver menu "${label}"

Operador Acesso Direto Deve Redirecionar Dashboard
    [Arguments]    ${path}
    Ir Para    ${path}
    Wait For Load State    networkidle
    Pagina Deve Ter Titulo    Dashboard do escritório
