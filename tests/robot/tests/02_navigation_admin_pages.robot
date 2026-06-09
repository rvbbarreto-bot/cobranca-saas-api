*** Settings ***
Documentation    |
...    Navegação admin: valida carregamento de todas as rotas do menu lateral
...    e páginas placeholder/ferramentas (smoke visual + título).
Resource           ../resources/portal_keywords.robot
Suite Setup        Run Keywords    Abrir Navegador Portal    AND    Login Escritorio
Suite Teardown     Fechar Navegador Portal

*** Test Cases ***
Dashboard Carrega KPIs Ou Estado Vazio
    [Tags]    navigation    admin    critical
    Navegar Menu Lateral    Dashboard
    Pagina Deve Ter Titulo    Dashboard do escritório
    Pagina Deve Conter Texto    Atalhos

Clientes Lista Carrega
    [Tags]    navigation    admin
    Navegar Menu Lateral    Clientes
    Pagina Deve Conter Texto    Clientes
    Pagina Deve Conter Texto    Novo cliente

Boletos Lista Carrega
    [Tags]    navigation    admin
    Navegar Menu Lateral    Boletos
    Pagina Deve Conter Texto    Boletos

Nova Cobranca Formulario Carrega
    [Tags]    navigation    admin    forms
    Navegar Menu Lateral    Boletos
    Clicar Link    Nova cobrança
    Pagina Deve Ter Titulo    Nova cobranca avulsa
    Wait For Elements State    ${LOC_COBRANCA_REF}    visible
    Wait For Elements State    ${LOC_COBRANCA_AMOUNT}    visible

Cadastro Cliente Formulario Carrega
    [Tags]    navigation    admin    forms
    Navegar Menu Lateral    Clientes
    Clicar Link    Novo cliente
    Pagina Deve Ter Titulo    Cadastro do cliente
    Wait For Elements State    ${LOC_CLIENTE_TIPO}    visible

Guias Fiscais Se Modulo Habilitado
    [Tags]    navigation    admin    fiscal
    Skip If    '${FISCAL_ENABLED}' != 'true'    Módulo fiscal desligado (FISCAL_ENABLED)
    Navegar Menu Lateral    Guias fiscais (DAS/DARF)
    Pagina Deve Conter Texto    Guias fiscais

Config Fiscal Se Modulo Habilitado
    [Tags]    navigation    admin    fiscal
    Skip If    '${FISCAL_ENABLED}' != 'true'    Módulo fiscal desligado
    Navegar Menu Lateral    Config. fiscal
    Pagina Deve Ter Titulo    Configuração fiscal
    Pagina Deve Conter Texto    Certificado A1

Placeholder Cobranca Recorrente
    [Tags]    navigation    admin    placeholder
    Navegar Menu Lateral    Cobrança recorrente
    Pagina Deve Conter Texto    Cobrança recorrente

Placeholder Notificacoes
    [Tags]    navigation    admin    placeholder
    Navegar Menu Lateral    Notificações
    Pagina Deve Conter Texto    Notificações

Placeholder Auditoria
    [Tags]    navigation    admin    placeholder
    Navegar Menu Lateral    Auditoria
    Pagina Deve Conter Texto    Auditoria

Configuracoes Escritorio Admin
    [Tags]    navigation    admin
    Navegar Menu Lateral    Configurações
    Pagina Deve Conter Texto    Configurações

Notas Fiscais Ferramentas
    [Tags]    navigation    admin    ferramentas
    Navegar Menu Lateral    Notas fiscais
    Pagina Deve Conter Texto    Notas fiscais

Relatorios CSV Ferramentas
    [Tags]    navigation    admin    ferramentas
    Navegar Menu Lateral    Relatórios / CSV
    Pagina Deve Conter Texto    Relatórios

Escritorio Perfil Ferramentas
    [Tags]    navigation    admin    ferramentas
    Navegar Menu Lateral    Escritório
    Pagina Deve Conter Texto    Escritório

Ajuda Provisionamento Core
    [Tags]    navigation    admin    ferramentas
    Navegar Menu Lateral    Ajuda (core)
    Pagina Deve Conter Texto    provision
