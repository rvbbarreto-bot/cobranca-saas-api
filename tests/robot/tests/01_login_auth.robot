*** Settings ***
Documentation    Autenticação escritório: login válido, inválido, logout e campos obrigatórios.
Resource           ../resources/portal_keywords.robot
Suite Setup        Abrir Navegador Portal
Suite Teardown     Fechar Navegador Portal
Test Setup         Preparar Sessao Limpa

*** Test Cases ***
Login Admin Com Credenciais Seed
    [Tags]    auth    admin    critical
    Login Escritorio
    Pagina Deve Ter Titulo    Dashboard do escritório
    Pagina Deve Conter Texto    admin_escritorio

Login Campos Obrigatorios Vazios
    [Tags]    auth    validation
    Submeter Formulario Login Vazio
    Validar Erros Login Obrigatorios

Login Senha Invalida Exibe Erro
    [Tags]    auth    negative
    Ir Para    /login
    Fill Text    ${LOC_LOGIN_EMAIL}    ${PORTAL_ADMIN_EMAIL}
    Fill Text    ${LOC_LOGIN_PASSWORD}    senha-errada-robot
    Fill Text    ${LOC_LOGIN_TENANT}    ${PORTAL_TENANT}
    Click    ${LOC_LOGIN_SUBMIT}
    Wait For Elements State    css=.banner-err    visible    timeout=15s

Logout Retorna Para Login
    [Tags]    auth    admin
    Login Escritorio
    Logout Escritorio
    Wait For Elements State    ${LOC_LOGIN_SUBMIT}    visible

Login Operador Redireciona Dashboard
    [Tags]    auth    operador
    Login Escritorio    email=${PORTAL_OPERADOR_EMAIL}    password=${PORTAL_OPERADOR_PASSWORD}
    Pagina Deve Ter Titulo    Dashboard do escritório
    Pagina Deve Conter Texto    operador
