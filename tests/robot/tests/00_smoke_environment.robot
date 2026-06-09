*** Settings ***
Documentation    Smoke: API + portal login page carregam sem erro.
Resource           ../resources/portal_keywords.robot
Suite Setup        Abrir Navegador Portal
Suite Teardown     Fechar Navegador Portal

*** Test Cases ***
API Health Deve Responder OK
    [Tags]    smoke    api
    Verificar API Disponivel

Pagina Login Deve Carregar
    [Tags]    smoke    login
    Ir Para    /login
    Wait For Elements State    ${LOC_LOGIN_EMAIL}    visible
    Wait For Elements State    ${LOC_LOGIN_PASSWORD}    visible
    Wait For Elements State    ${LOC_LOGIN_TENANT}    visible
    Pagina Deve Conter Texto    Entrar
    Pagina Deve Conter Texto    E-mail corporativo

Rota Protegida Redireciona Para Login
    [Tags]    smoke    auth
    Ir Para    /dashboard
    Wait For Elements State    ${LOC_LOGIN_EMAIL}    visible    timeout=15s

Portal Cliente Acesso Exige Tenant Na URL
    [Tags]    smoke    cliente-portal
    Ir Para    /acesso
    Pagina Deve Conter Texto    Portal do cliente
    Pagina Deve Conter Texto    URL incompleta
