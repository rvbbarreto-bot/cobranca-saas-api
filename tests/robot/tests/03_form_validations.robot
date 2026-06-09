*** Settings ***
Documentation    |
...    Validação de campos obrigatórios e regras de formulário (client-side Zod).
...    Não persiste dados — apenas dispara erros visíveis (role=alert / .err).
Resource           ../resources/portal_keywords.robot
Suite Setup        Run Keywords    Abrir Navegador Portal    AND    Login Escritorio
Suite Teardown     Fechar Navegador Portal

*** Test Cases ***
Nova Cobranca Referencia Obrigatoria
    [Tags]    validation    forms    cobranca    critical
    Submeter Nova Cobranca Vazia
    Pagina Deve Conter Texto    ${MSG_REF_OBRIGATORIA}

Nova Cobranca Valor Minimo
    [Tags]    validation    forms    cobranca
    Navegar Menu Lateral    Boletos
    Clicar Link    Nova cobrança
    Fill Text    ${LOC_COBRANCA_REF}    Teste Robot RF
    Fill Text    ${LOC_COBRANCA_AMOUNT}    0
    Click    ${LOC_COBRANCA_SUBMIT}
    Pagina Deve Conter Texto    Valor minimo

Cliente Novo Tipo Obrigatorio
    [Tags]    validation    forms    clientes    critical
    Submeter Cliente Novo Vazio
    Pagina Deve Conter Texto    ${MSG_TIPO_CLIENTE}

Cliente Novo PJ Campos Obrigatorios
    [Tags]    validation    forms    clientes
    Navegar Menu Lateral    Clientes
    Clicar Link    Novo cliente
    Selecionar Tipo Cliente    Pessoa Juridica
    Click    ${LOC_CLIENTE_SUBMIT}
    Pagina Deve Conter Texto    ${MSG_DOC_OBRIGATORIO}
    Pagina Deve Conter Texto    ${MSG_NOME_OBRIGATORIO}
    Pagina Deve Conter Texto    E-mail invalido

Cliente Novo CNPJ Invalido
    [Tags]    validation    forms    clientes
    Navegar Menu Lateral    Clientes
    Clicar Link    Novo cliente
    Selecionar Tipo Cliente    Pessoa Juridica
    Fill Text    css=input[inputmode="numeric"]    1234567890123
    Fill Text    css=input[type="email"]    robot@teste.local
    Fill Text    css=label:has-text("Razao social") input    Empresa Robot LTDA
    Click    ${LOC_CLIENTE_SUBMIT}
    Pagina Deve Conter Texto    CNPJ deve ter 14 digitos

Cliente Novo Email Invalido
    [Tags]    validation    forms    clientes
    Navegar Menu Lateral    Clientes
    Clicar Link    Novo cliente
    Selecionar Tipo Cliente    Pessoa Fisica
    Fill Text    css=input[inputmode="numeric"]    52998224725
    Fill Text    css=label:has-text("Nome completo") input    Joao Robot
    Fill Text    css=input[type="email"]    email-invalido
    Click    ${LOC_CLIENTE_SUBMIT}
    Pagina Deve Conter Texto    E-mail invalido

Portal Cliente Email Obrigatorio HTML5
    [Tags]    validation    cliente-portal
    Ir Para    /acesso?tenant=${PORTAL_TENANT}
    Wait For Elements State    ${LOC_ACESSO_EMAIL}    visible
    ${valid}=    Get Property    ${LOC_ACESSO_EMAIL}    required
    Should Be True    ${valid}
