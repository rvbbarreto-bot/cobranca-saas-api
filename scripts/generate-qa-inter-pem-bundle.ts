/**
 * Gera pacote local para QA homologar gateway Inter no portal.
 * Uso: npx tsx scripts/generate-qa-inter-pem-bundle.ts
 * Origem default: C:\Projeto\Inter_API-Chave_e_Certificado
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  sanitizePemPaste,
  validateMtlsPemPair
} from "../src/platform/payment-gateway/mtls-credential-validation.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultSource = "C:\\Projeto\\Inter_API-Chave_e_Certificado";
const sourceDir = process.env.INTER_PEM_SOURCE_DIR?.trim() || defaultSource;
const outDir = path.join(repoRoot, "data", "qa-inter-credentials");

function readSource(name: string): string {
  const p = path.join(sourceDir, name);
  if (!fs.existsSync(p)) {
    throw new Error(`Arquivo nao encontrado: ${p}`);
  }
  return fs.readFileSync(p, "utf8");
}

function main(): void {
  const certRaw = readSource("Inter API_Certificado.crt");
  const keyRaw = readSource("Inter API_Chave.key");
  const certificatePem = sanitizePemPaste(certRaw);
  const privateKeyPem = sanitizePemPaste(keyRaw);

  const check = validateMtlsPemPair(certificatePem, privateKeyPem);
  if (!check.ok) {
    throw new Error(check.message);
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "certificate.pem"), `${certificatePem}\n`, "utf8");
  fs.writeFileSync(path.join(outDir, "private_key.pem"), `${privateKeyPem}\n`, "utf8");

  const generatedAt = new Date().toISOString();
  const readme = `# Pacote QA — Gateway Banco Inter (mTLS)

**Gerado em:** ${generatedAt}  
**Autorização:** PO (homologação local)  
**Origem:** \`${sourceDir}\`

> **NUNCA commitar** esta pasta. Contém chave privada. Compartilhar apenas por canal seguro (1Password / Teams privado).

## Validação

- Par certificado + chave: **OK** (validado pela API antes de gravar)
- Titular (CN): **EXEQ TECNOLOGIA LTDA**
- Emissor: API Intermediário Certificate Authority

## Arquivos nesta pasta

| Arquivo | Uso no portal |
|---------|----------------|
| \`certificate.pem\` | Campo **Certificado PEM** |
| \`private_key.pem\` | Campo **Chave privada PEM** |

## Campos que o PO deve fornecer separadamente

| Campo | Onde obter |
|-------|------------|
| **Client ID** | Portal [developers.inter.co](https://developers.inter.co/) → aplicação sandbox |
| **Client Secret** | Mesma aplicação (canal seguro) |

Sem \`client_id\` e \`client_secret\` a gravação pode funcionar, mas OAuth/emissão de boleto falha.

## Passo a passo — Portal

1. Abrir http://localhost:5173/login  
2. Login: \`admin@teste.local\` | tenant \`escritorio-demo\` | senha \`TesteDev!2026\`  
3. **Configurações** → **Gateway e integrações** → **Editar**  
4. Gateway: **Banco Inter**  
5. Colar conteúdo de \`certificate.pem\` (Ctrl+A no arquivo → Ctrl+C → campo Certificado PEM)  
6. Colar conteúdo de \`private_key.pem\` no campo Chave privada PEM  
7. Informar Client ID e Client Secret  
8. **Guardar configurações** → modo leitura com \`***\` e gateway **Banco Inter** selecionado  

## Copiar no PowerShell (opcional)

\`\`\`powershell
cd "${outDir.replace(/\\/g, "\\\\")}"
Get-Content .\\certificate.pem | Set-Clipboard   # depois cole no Certificado PEM
Get-Content .\\private_key.pem | Set-Clipboard   # depois cole na Chave privada
\`\`\`

## Ambiente

- API: http://localhost:3333/health/ready  
- Roteiro completo: \`docs/QA_HOMOLOG_INTER_GATEWAY_PORTAL.md\`

## Regenerar este pacote

\`\`\`powershell
npx tsx scripts/generate-qa-inter-pem-bundle.ts
# ou outro caminho:
$env:INTER_PEM_SOURCE_DIR="D:\\caminho\\Inter_API-Chave_e_Certificado"
npx tsx scripts/generate-qa-inter-pem-bundle.ts
\`\`\`
`;

  fs.writeFileSync(path.join(outDir, "QA_PACOTE_INTER.md"), readme, "utf8");

  const manifest = {
    generated_at: generatedAt,
    source_dir: sourceDir,
    pair_valid: true,
    certificate_cn: "EXEQ TECNOLOGIA LTDA",
    files: {
      certificate_pem: "certificate.pem",
      private_key_pem: "private_key.pem"
    },
    portal: {
      url: "http://localhost:5173/configuracoes",
      gateway: "inter",
      login: {
        email: "admin@teste.local",
        tenant_id: "escritorio-demo",
        password: "TesteDev!2026"
      },
      client_id: "<preencher com PO — Portal Inter>",
      client_secret: "<preencher com PO — Portal Inter>"
    }
  };
  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );

  console.info("[generate-qa-inter-pem-bundle] OK:", outDir);
  console.info("  - certificate.pem");
  console.info("  - private_key.pem");
  console.info("  - QA_PACOTE_INTER.md");
  console.info("  - manifest.json");
}

main();
