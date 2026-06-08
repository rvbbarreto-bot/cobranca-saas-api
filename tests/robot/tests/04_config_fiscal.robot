*** Settings ***
Documentation    |
...    Configuração fiscal: abas, empresa obrigatória, estado vazio/salvo (GET).
...    Requer FISCAL_GUIAS_ENABLED na API e VITE_FISCAL_GUIAS_ENABLED no portal.
Resource           ../resources/portal_keywords.robot
Suite Setup        Run Keywords    Abrir Navegador Portal    AND    Login Escritorio
Suite Teardown     Fechar Navegador Portal

*** Test Cases ***
Config Fiscal Abas Visiveis
    [Tags]    fiscal    admin
    Skip If    '${FISCAL_ENABLED}' != 'true'    Fiscal desligado
    Navegar Menu Lateral    Config. fiscal
    Pagina Deve Conter Texto    Certificado A1
    Pagina Deve Conter Texto    Procuração
    Pagina Deve Conter Texto    Status homolog

Config Fiscal Certificado Exige Empresa
    [Tags]    fiscal    validation    critical
    Skip If    '${FISCAL_ENABLED}' != 'true'    Fiscal desligado
    Ir Config Fiscal Aba    Certificado A1
    Clicar Botao    Cadastrar certificado
    Pagina Deve Conter Texto    ${MSG_SELECIONE_EMPRESA}

Config Fiscal Procuracao Exige Empresa
    [Tags]    fiscal    validation    critical
    Skip If    '${FISCAL_ENABLED}' != 'true'    Fiscal desligado
    Ir Config Fiscal Aba    Procuração
    Clicar Botao    Cadastrar procuração
    Pagina Deve Conter Texto    ${MSG_SELECIONE_EMPRESA}

Config Fiscal Certificado PEM Obrigatorio HTML5
    [Tags]    fiscal    validation
    Skip If    '${FISCAL_ENABLED}' != 'true'    Fiscal desligado
    Ir Config Fiscal Aba    Certificado A1
    ${pem}=    Get Element Count    css=textarea[placeholder*="BEGIN CERTIFICATE"]
    Should Be True    ${pem} > 0
    ${required}=    Get Property    css=textarea[placeholder*="BEGIN CERTIFICATE"]    required
    Should Be True    ${required}

Config Fiscal Aba Status Homolog
    [Tags]    fiscal    admin
    Skip If    '${FISCAL_ENABLED}' != 'true'    Fiscal desligado
    Ir Config Fiscal Aba    Status homolog
    Pagina Deve Conter Texto    FISCAL_CAPTURE_STUB
    Pagina Deve Conter Texto    codigo_receita

Config Fiscal Estado Vazio Sem Empresa
    [Tags]    fiscal    admin
    Skip If    '${FISCAL_ENABLED}' != 'true'    Fiscal desligado
    Navegar Menu Lateral    Config. fiscal
    ${empty}=    Get Element Count    ${LOC_FISCAL_CERT_EMPTY}
    Should Be Equal As Numbers    ${empty}    0
