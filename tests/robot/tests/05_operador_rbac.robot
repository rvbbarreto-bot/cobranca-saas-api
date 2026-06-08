*** Settings ***
Documentation    |
...    RBAC operador: menu restrito e bloqueio de URL direta para rotas admin-only.
Resource           ../resources/portal_keywords.robot
Suite Setup        Run Keywords    Abrir Navegador Portal    AND    Login Escritorio    email=${PORTAL_OPERADOR_EMAIL}    password=${PORTAL_OPERADOR_PASSWORD}
Suite Teardown     Fechar Navegador Portal

*** Test Cases ***
Operador Ve Menu Operacional
    [Tags]    rbac    operador    critical
    Pagina Deve Conter Texto    operador
    Navegar Menu Lateral    Clientes
    Pagina Deve Conter Texto    Clientes
    Navegar Menu Lateral    Boletos
    Pagina Deve Conter Texto    Boletos

Operador Nao Ve Configuracoes No Menu
    [Tags]    rbac    operador
    Operador Nao Deve Ver Link Menu    Configurações
    Operador Nao Deve Ver Link Menu    Notificações
    Operador Nao Deve Ver Link Menu    Auditoria
    Operador Nao Deve Ver Link Menu    Notas fiscais

Operador URL Configuracoes Redireciona Dashboard
    [Tags]    rbac    operador    critical
    Operador Acesso Direto Deve Redirecionar Dashboard    /configuracoes

Operador URL Config Fiscal Redireciona Dashboard
    [Tags]    rbac    operador    fiscal
    Skip If    '${FISCAL_ENABLED}' != 'true'    Fiscal desligado
    Operador Acesso Direto Deve Redirecionar Dashboard    /configuracoes/fiscal

Operador URL Relatorios Redireciona Dashboard
    [Tags]    rbac    operador
    Operador Acesso Direto Deve Redirecionar Dashboard    /relatorios
