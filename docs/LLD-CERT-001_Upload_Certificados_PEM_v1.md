
  
DOCUMENTO DE REQUISITOS TÉCNICOS – BAIXO NÍVEL

Upload e Conversão de Certificados PEM com Validação Automática

Módulo: Configuração de Integração  |  Versão: 1.0

Campo	Valor
Projeto	Plataforma de Integrações – Módulo Certificados
Artefato	LLD-CERT-001
Versão	1.0 – para revisão da fábrica
Status	🟡  Em aprovação
Autor(es)	Time Sênior de Produto & Engenharia
Data	25/06/2026
Sprint alvo	A definir pelo PO
Estimativa total	13 – 18 story points

CONFIDENCIAL – USO INTERNO
 
  1.  OBJETIVO E ESCOPO  

1.1  Problema atual

Atualmente o usuário informa o conteúdo de certificados PEM (Certificado e Chave Privada) colando-os manualmente em campos de texto livre. Isso provoca:

•	Erros silenciosos de cópia (truncagem, caracteres de espaço extras, quebras de linha incorretas).
•	Ausência de validação estrutural antes do envio.
•	Impossibilidade de verificar se o par certificado/chave é correspondente.
•	Dificuldade de auditar qual certificado está em uso em cada integração.

1.2  Objetivo desta entrega

Substituir os dois campos de texto livre por componentes de upload de arquivo (.pem / .crt / .key / .cer) com:

•	Validação automática em duas camadas – frontend (formato) e backend (criptografia).
•	Conversão automática para o formato consumível pela integração – Base64 DER, JSON com campos separados.
•	Feedback visual detalhado – mensagem de sucesso ou erro legível por humanos.

1.3  Fora do escopo (out of scope)

•	Descriptografar chave privada protegida por senha (PKCS#8 encrypted).
•	Suporte a certificados com cadeia completa (chain / bundle) – backlog futuro.
•	Renovação automática de certificados (integração com CA externa).
•	Revogação / OCSP / CRL – fora do escopo desta entrega.

  2.  GLOSSÁRIO  

Termo	Definição
PEM	Privacy Enhanced Mail – formato de codificação Base64 delimitado por -----BEGIN...-----  / -----END...-----.
DER	Distinguished Encoding Rules – formato binário (ASN.1) equivalente ao PEM sem os delimitadores.
PKCS#8	Padrão para armazenamento de chave privada. Suporta RSA, EC e DSA.
X.509	Padrão de certificado digital que define o formato de certificados de chave pública.
Módulo RSA	Componente matemático público da chave RSA. Certificado e chave privada compartilham o mesmo módulo quando formam um par válido.
notBefore / notAfter	Campos X.509 que definem a janela de validade do certificado.
multipart/form-data	Tipo de conteúdo HTTP utilizado para envio de arquivos em formulários web.
Base64 DER	Representação Base64 (sem newlines / sem cabeçalhos PEM) do conteúdo DER binário.
CN	Common Name – campo do Subject do certificado que identifica o domínio ou entidade.
Fábrica	Time de desenvolvimento terceirizado que irá implementar este documento.
 
  3.  REQUISITOS FUNCIONAIS  

ID	Prioridade	Nome	Descrição	Notas
RF-01	MUST	Upload de arquivo	Substituir os campos de texto do Certificado PEM e da Chave Privada PEM por componentes de upload de arquivo.	Aceitar extensões: .pem, .crt, .key, .cer
RF-02	MUST	Nome e status	Exibir nome do arquivo selecionado e ícone de status: aguardando / validando / sucesso / erro.	Sempre visível após seleção
RF-03	MUST	Validação automática	Executar validação ao concluir o upload. Exibir mensagem de sucesso ou erro com código e descrição legível.	Ver Seção 4
RF-04	MUST	Bloqueio de submit	Bloquear o botão de salvar/submeter enquanto validação estiver pendente ou com erro.	Estado disabled no botão
RF-05	MUST	Conversão para integração	Após validação bem-sucedida, converter o certificado e a chave para o formato JSON descrito na Seção 6.	Ver Seção 6
RF-06	SHOULD	Drag-and-drop	Suportar arrastar e soltar arquivo na drop-zone além do clique.	File API + dragover event
RF-07	SHOULD	Trocar arquivo	Permitir substituir arquivo já enviado sem recarregar a página (botão 'Trocar arquivo').	Reset do estado de validação
RF-08	SHOULD	Preview PEM	Exibir as primeiras e últimas linhas do arquivo (header/footer PEM) para confirmação visual.	Opcional ao clicar em 'Ver detalhes'
RF-09	COULD	Aviso de expiração	Exibir banner de aviso se o certificado vencer em menos de 30 dias.	Não bloqueia o submit
RF-10	OUT	Chave com senha	Suporte a chave privada protegida por passphrase (PKCS#8 encrypted).	Fora do escopo

Legenda de prioridade: MUST = obrigatório para o lançamento  |  SHOULD = fortemente recomendado  |  COULD = desejável  |  OUT = fora do escopo.
 
  4.  REGRAS DE VALIDAÇÃO – BAIXO NÍVEL  

4.1  Tabela de regras

ID	Camada	Regra	Descrição
RV-01	Frontend	Formato PEM – cabeçalho/rodapé obrigatórios	O arquivo deve conter pelo menos um bloco PEM válido delimitado por -----BEGIN <TYPE>----- e -----END <TYPE>-----, onde <TYPE> pode ser CERTIFICATE, PRIVATE KEY, RSA PRIVATE KEY ou EC PRIVATE KEY.
RV-02	Frontend	Tipo correto no campo correto	O campo 'Certificado PEM' aceita apenas blocos CERTIFICATE. O campo 'Chave Privada PEM' aceita apenas PRIVATE KEY (qualquer variante). Rejeitar se tipo errado for detectado no campo errado.
RV-03	Frontend	Base64 válido – corpo do PEM	O conteúdo entre os delimitadores deve ser decodificável como Base64. Verificar ausência de caracteres fora do alfabeto Base64 (A-Z, a-z, 0-9, +, /, =). Cada linha deve ter no máximo 64 caracteres (RFC 7468).
RV-04	Frontend	Tamanho máximo do arquivo	Cada arquivo de certificado ou chave privada não deve exceder 64 KB. Certificados válidos raramente excedem 8 KB; o limite de 64 KB previne abusos sem impactar casos legítimos.
RV-05	Backend	Validade temporal do certificado	Ler os campos notBefore e notAfter do certificado X.509. (a) Se notAfter < now: erro, bloquear submit. (b) Se (notAfter - now) < 30 dias: aviso amarelo, não bloquear. (c) Se notBefore > now: erro, certificado ainda não vigente.
RV-06	Backend	Correspondência par certificado/chave	Extrair o módulo público da chave privada e do certificado. Comparar os dois valores. Se divergirem, os arquivos não formam um par válido. Executar apenas quando ambos os arquivos forem enviados com sucesso.
RV-07	Backend	Algoritmo de assinatura suportado	Verificar se o algoritmo de assinatura do certificado é suportado pela integração. Suportados: SHA-256 com RSA (2048+ bits), SHA-384/SHA-512 com RSA, ECDSA P-256/P-384/P-521. Rejeitar: SHA-1, MD5, RSA < 2048 bits.
RV-08	Backend	Arquivo não vazio / não corrompido	Verificar se o arquivo binário resultante do decode Base64 pode ser parseado como estrutura ASN.1 válida. Rejeitar arquivos que gerem exceção no parse DER.

4.2  Catálogo de mensagens

Todas as mensagens exibidas ao usuário devem seguir o catálogo abaixo. Placeholders em {chaves} são substituídos dinamicamente.

Código	Tipo	Mensagem exibida ao usuário	Ação sugerida
ERR-001	ERRO	O arquivo não está no formato PEM. Verifique se contém os delimitadores -----BEGIN...----- / -----END...-----.	Selecionar arquivo correto
ERR-002	ERRO	Tipo de arquivo incorreto para este campo. Campos de certificado e chave privada são separados.	Verificar qual campo usar
ERR-003	ERRO	O arquivo contém caracteres inválidos ou linhas muito longas. Pode estar corrompido.	Re-exportar o certificado
ERR-004	ERRO	Arquivo excede 64 KB. Verifique se o arquivo está correto.	Verificar arquivo
ERR-005	ERRO	Certificado expirado em {data}. Não é possível usar um certificado vencido.	Renovar certificado
ERR-006	ERRO	Certificado ainda não vigente. Início da validade: {data}.	Verificar datas
ERR-007	ERRO	A chave privada não corresponde ao certificado enviado. Os arquivos devem fazer parte do mesmo par.	Verificar par de arquivos
ERR-008	ERRO	Algoritmo de assinatura não suportado ({alg}). Use SHA-256 ou superior com RSA ≥ 2048 bits.	Gerar novo certificado
ERR-009	ERRO	Não foi possível ler o certificado. O arquivo pode estar corrompido.	Re-exportar o certificado
WARN-001	AVISO	O certificado expira em {n} dias ({data}). Recomendamos renová-lo em breve.	Planejar renovação
INFO-001	SUCESSO	Certificado válido. Expira em {data} · CN: {cn} · Emitido por: {issuer}.	Nenhuma
INFO-002	SUCESSO	Par certificado/chave validado com sucesso.	Nenhuma
NET-001	ERRO	Não foi possível validar o certificado. Verifique sua conexão e tente novamente.	Botão 'Tentar novamente'
 
  5.  FLUXO DE INTERAÇÃO – PASSO A PASSO  

#	Etapa	Descrição	Regra / Comportamento	Responsável
1	Seleção do arquivo	Usuário clica na drop-zone ou arrasta o arquivo.	Sistema filtra por extensão: .pem .crt .key .cer. Extensão inválida → rejeitar imediatamente, não enviar ao backend.	Frontend
2	Validação local (RV-01 a RV-04)	Sistema valida formato, tipo, Base64 e tamanho no browser, sem chamada de rede.	Se qualquer regra falhar → exibir mensagem do catálogo (Seção 4.2) + drop-zone em estado ERRO. Não prosseguir ao backend.	Frontend
3	Upload ao backend	Se validação local OK → POST /api/v1/certificates/validate (multipart/form-data).	Drop-zone muda para estado LOADING (spinner). Submit bloqueado.	Frontend → Backend
4	Validação profunda (RV-05 a RV-08)	Backend executa parse ASN.1/DER, verifica validade temporal, algoritmo e par cert/chave.	Timeout: 10 segundos. Em caso de timeout → NET-001.	Backend
5	Conversão para formato de integração	Se validação OK → backend converte certificado e chave para JSON conforme Seção 6.	Chave privada NÃO é retornada ao frontend em texto claro. Ver Seção 7 (Segurança).	Backend
6a	Resposta: sucesso	Backend retorna HTTP 200 com payload JSON (ver Seção 6).	Drop-zone → estado SUCCESS. Exibir INFO-001 + INFO-002. Submit liberado.	Backend → Frontend
6b	Resposta: erro	Backend retorna HTTP 422 com { error_code, message }.	Drop-zone → estado ERRO. Exibir mensagem do catálogo. Submit bloqueado. Botão 'Trocar arquivo' visível.	Backend → Frontend
7	Armazenamento (somente IDs)	Frontend envia apenas o certificate_id retornado pelo backend no formulário principal.	O conteúdo do certificado nunca trafega no formulário HTML de submissão.	Frontend
 
  6.  CONVERSÃO E FORMATO DE INTEGRAÇÃO  

6.1  Contexto

A integração consome o par certificado/chave em formato JSON estruturado — não o arquivo PEM bruto. O backend é responsável por toda conversão. O frontend nunca realiza conversão.

6.2  Algoritmo de conversão (backend)

Passo 1 – Ler o arquivo PEM recebido via multipart.
Passo 2 – Decodificar o corpo Base64 para bytes binários DER.
Passo 3 – Parsear a estrutura ASN.1/DER do certificado (biblioteca nativa da linguagem ou OpenSSL).
Passo 4 – Executar todas as validações das Seções 4 (RV-05 a RV-08).
Passo 5 – Se OK, gerar o payload JSON descrito em 6.3.
Passo 6 – Armazenar o payload de forma segura (vault / secrets manager) e retornar apenas o certificate_id ao frontend.

6.3  Payload JSON – formato de saída

O objeto abaixo é o formato esperado pela integração e deve ser armazenado associado ao certificate_id:

{
  "certificate_id":   "cert_abc123",              // UUID gerado pelo backend
  "certificate_der":  "MIICpDCCA...",             // Base64 do DER do certificado (sem newlines)
  "private_key_der":  "MIIEvAIBAD...",            // Base64 do DER da chave privada (sem newlines)
  "subject_cn":       "empresa.com.br",           // CN do Subject
  "issuer_cn":        "Let's Encrypt Authority X3",
  "serial":           "03:a1:b2:...",             // Número de série hexadecimal
  "not_before":       "2024-10-01T00:00:00Z",     // ISO 8601 UTC
  "not_after":        "2027-04-02T23:59:59Z",     // ISO 8601 UTC
  "key_algorithm":    "RSA",                      // RSA | EC | DSA
  "key_size":         2048,                       // bits (RSA) ou curva (EC)
  "signature_alg":    "SHA256withRSA",
  "fingerprint_sha1": "AB:CD:EF:...",             // Apenas para exibição / auditoria
  "fingerprint_sha256":"12:34:56:...",
  "created_at":       "2026-06-25T10:30:00Z"      // Timestamp de upload
}

6.4  Endpoint de validação e conversão

POST /api/v1/certificates/validate
Content-Type: multipart/form-data

Campos:
  certificate  (file, obrigatório) – arquivo PEM do certificado
  private_key  (file, obrigatório) – arquivo PEM da chave privada

── Resposta 200 OK (sucesso) ────────────────────────────
{
  "certificate_id": "cert_abc123",
  "subject_cn":     "empresa.com.br",
  "not_after":      "2027-04-02T23:59:59Z",
  "days_remaining": 646,
  "warnings":       []                // ou ["WARN-001"]
}

── Resposta 422 Unprocessable Entity (erro de validação) ─
{
  "error_code": "ERR-007",
  "message":    "A chave privada não corresponde ao certificado.",
  "field":      "private_key"         // qual campo causou o erro
}

── Resposta 500 (erro interno) ──────────────────────────
{
  "error_code": "NET-001",
  "message":    "Erro interno ao processar o certificado. Tente novamente."
}

6.5  Bibliotecas recomendadas

Camada	Linguagem	Biblioteca	Uso
Frontend	JavaScript / TS	node-forge (browser build)	Parse PEM, decode Base64, validações locais (RV-01 a RV-04)
Frontend	JavaScript / TS	Web Crypto API (nativa)	Alternativa sem dependência externa para verificações de formato
Backend	Node.js	node:crypto + tls	Parse X.509, verificação de par, extração de metadados
Backend	Java	Bouncy Castle / java.security	Parse ASN.1, verificação de algoritmo e par
Backend	Python	cryptography (PyCA)	Parse X.509, validação completa, conversão DER
Backend	C# / .NET	System.Security.Cryptography	Parse X.509 nativo, suporte completo
 
  7.  REQUISITOS DE SEGURANÇA  

Os controles abaixo são MANDATÓRIOS. O time de fábrica deve confirmar implementação de cada item antes da entrega.

ID	Controle	Descrição	Criticidade
SEG-01	Chave privada nunca em log	A chave privada NÃO deve aparecer em nenhum log de aplicação, log de acesso HTTP, ou trace de APM. Usar mascaramento no nível de middleware.	CRÍTICO
SEG-02	Chave privada processada em memória	O backend deve processar o arquivo em memória e descartá-lo após a validação/conversão. Nunca persistir o arquivo PEM bruto em disco.	CRÍTICO
SEG-03	Armazenamento em vault	O campo private_key_der do payload JSON deve ser armazenado em secrets manager (ex.: HashiCorp Vault, AWS Secrets Manager, Azure Key Vault). Nunca em banco de dados relacional sem criptografia adicional.	CRÍTICO
SEG-04	Revisão de segurança obrigatória	Antes do deploy em produção, o código que trata a chave privada deve passar por revisão de segurança por profissional habilitado (SAST + revisão manual).	ALTO
SEG-05	Timeout e rate limiting	O endpoint POST /api/v1/certificates/validate deve ter timeout de 10s e rate limit de 10 req/min por usuário autenticado para evitar abuso.	MÉDIO
SEG-06	Transmissão apenas via HTTPS	O upload nunca deve ocorrer em HTTP puro. TLS 1.2 mínimo, TLS 1.3 preferencial.	CRÍTICO
SEG-07	certificate_id como referência	O frontend e o formulário principal trafegam apenas o certificate_id (UUID opaco). O conteúdo do certificado nunca retorna ao browser após a conversão.	ALTO
 
  8.  ESTIMATIVA DE DESENVOLVIMENTO  

ID	Área	Tarefa	Perfil	Mín.	Máx.	Notas
FE-01	Frontend	Componente de upload com drag-and-drop (reutilizável para 2 campos)	1 Sênior	2 pt	3 pt	Incluir estados idle/loading/success/error
FE-02	Frontend	Validação local PEM (RV-01 a RV-04) com node-forge	1 Pleno	1 pt	2 pt	Testes unitários incluso
FE-03	Frontend	Integração com endpoint backend + tratamento de respostas	1 Pleno	1 pt	2 pt	Todos os códigos de erro do catálogo
BE-01	Backend	Endpoint POST /api/v1/certificates/validate	1 Sênior	2 pt	3 pt	Parse ASN.1, todas as validações
BE-02	Backend	Verificação de par cert/chave (RV-06) – módulo público RSA/EC	1 Sênior	2 pt	3 pt	Depende de biblioteca da stack
BE-03	Backend	Conversão para JSON de integração (Seção 6)	1 Pleno	1 pt	2 pt	Geração de certificate_id, persistência em vault
BE-04	Backend	Segurança: mascaramento de log + rate limiting (SEG-01/05)	1 Sênior	1 pt	2 pt	Revisão obrigatória
QA-01	QA	Testes unitários + integração + casos de borda	1 QA	3 pt	3 pt	Cenários positivos, negativos e edge cases
TOTAL ESTIMADO	11 pt	20 pt	Sugerido: 2 sprints

Escala Fibonacci. Estimativa baseada em time com senioridade mista. Não inclui: code review, deploy, documentação de API (± 2 pts adicionais). Story points referentes ao time da fábrica; estimativa de revisão interna não inclusa.
 
  9.  CRITÉRIOS DE ACEITE  

ID	Camada	Critério
CA-01	FE	Upload de .pem válido exibe estado de sucesso com CN e data de expiração.
CA-02	FE	Upload de .pdf ou .txt é rejeitado imediatamente com mensagem ERR-001.
CA-03	FE	Arquivo > 64 KB é rejeitado com mensagem ERR-004.
CA-04	BE	Certificado expirado retorna ERR-005 e bloqueia o submit.
CA-05	BE	Certificado com validade < 30 dias retorna WARN-001 e NÃO bloqueia o submit.
CA-06	BE	Chave privada que não corresponde ao certificado retorna ERR-007.
CA-07	BE	Algoritmo SHA-1 retorna ERR-008.
CA-08	BE	Payload JSON de integração contém todos os campos descritos na Seção 6.3.
CA-09	SEG	Nenhuma linha de log contém o conteúdo da chave privada (verificação manual + SAST).
CA-10	SEG	O certificate_id é um UUID único. O conteúdo nunca trafega no formulário de submissão.
CA-11	FE	Drag-and-drop funciona nos dois campos (testado em Chrome, Firefox e Safari).
CA-ERR-01	FE/BE	Falha de rede exibe NET-001 com botão 'Tentar novamente'. Não bloqueia permanentemente.
 
  10.  DEPENDÊNCIAS, RISCOS E MITIGAÇÕES  

ID	Nível	Risco	Descrição	Mitigação
RSK-01	ALTO	Chave privada em log de framework	Frameworks web podem logar o body completo do multipart em modo debug. Verificar configuração de log antes do deploy em produção.	Configurar filtro de log para o endpoint /certificates antes do primeiro deploy.
RSK-02	MÉDIO	Suporte a drag-and-drop no Safari iOS	File API tem suporte parcial em Safari iOS < 16.	Implementar fallback de clique para selecionar arquivo. Testar em dispositivos reais.
RSK-03	MÉDIO	Certificados com cadeia (chain / bundle)	Arquivos PEM com múltiplos blocos encadeados (leaf + intermediário + root) podem confundir o parser.	Escopo: apenas o leaf certificate. Rejeitar arquivo com mais de 1 bloco CERTIFICATE com mensagem orientativa.
RSK-04	BAIXO	Variação na renderização de mensagens de erro	A fábrica pode adotar traduções ligeiramente diferentes das mensagens.	O catálogo da Seção 4.2 é normativo. Desvios requerem aprovação do PO.
RSK-05	BAIXO	Stack do backend não definida	A biblioteca de parse PEM/ASN.1 varia por linguagem.	A Seção 6.5 lista alternativas para Node.js, Java, Python e .NET. Confirmar stack antes do sprint.
 
  11.  CHECKLIST DE ENTREGA – FÁBRICA  

Todos os itens abaixo devem ser confirmados pela fábrica antes da entrega para homologação. Itens não concluídos devem ser sinalizados com justificativa.

1.	[ ]  Componente de upload implementado com drag-and-drop e os 4 estados visuais (idle / loading / success / error).
2.	[ ]  Validações locais RF-01 a RF-04 implementadas no frontend (RV-01 a RV-04).
3.	[ ]  Endpoint POST /api/v1/certificates/validate implementado e documentado em OpenAPI/Swagger.
4.	[ ]  Validações profundas RV-05 a RV-08 implementadas no backend.
5.	[ ]  Conversão para payload JSON (Seção 6.3) implementada e testada.
6.	[ ]  Mascaramento de log da chave privada implementado (SEG-01).
7.	[ ]  Chave privada não persistida em disco nem em banco sem criptografia (SEG-02 / SEG-03).
8.	[ ]  Revisão de segurança concluída e evidência entregue ao PO (SEG-04).
9.	[ ]  Rate limiting configurado no endpoint (SEG-05).
10.	[ ]  Todos os critérios de aceite da Seção 9 passando em ambiente de staging.
11.	[ ]  Testes unitários com cobertura mínima de 80% nas funções de validação.
12.	[ ]  Documentação de API (Swagger/OpenAPI) atualizada com o novo endpoint.
13.	[ ]  Variáveis de ambiente e configurações de vault documentadas no README do projeto.
