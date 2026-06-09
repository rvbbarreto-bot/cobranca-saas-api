# Pacote PEM Inter — QA (somente máquina local)

O pacote com **certificado e chave privada** para homologação do gateway Banco Inter **não é versionado** (contém segredo).

## Gerar / atualizar

Na raiz do repositório, com os arquivos do Inter em `C:\Projeto\Inter_API-Chave_e_Certificado`:

```powershell
npx tsx scripts/generate-qa-inter-pem-bundle.ts
```

Outro diretório de origem:

```powershell
$env:INTER_PEM_SOURCE_DIR="C:\caminho\Inter_API-Chave_e_Certificado"
npx tsx scripts/generate-qa-inter-pem-bundle.ts
```

## Onde fica

| Artefato | Caminho |
|----------|---------|
| Certificado PEM | `data/qa-inter-credentials/certificate.pem` |
| Chave privada PEM | `data/qa-inter-credentials/private_key.pem` |
| Instruções QA | `data/qa-inter-credentials/QA_PACOTE_INTER.md` |
| Metadados (sem segredos) | `data/qa-inter-credentials/manifest.json` |

## Roteiro de teste

Ver [QA_HOMOLOG_INTER_GATEWAY_PORTAL.md](./QA_HOMOLOG_INTER_GATEWAY_PORTAL.md).

**Client ID** e **Client Secret** continuam com o PO (Portal Developers Inter) — não entram no pacote PEM.
