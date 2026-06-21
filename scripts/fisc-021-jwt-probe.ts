/**

 * Probe auth SERPRO — SAPI mTLS (jwt_token) e, se habilitado, ENVIOXMLASSINADO81.

 */

import "dotenv/config";

import { writeFileSync, mkdirSync } from "node:fs";

import { join } from "node:path";

import { X509Certificate } from "node:crypto";

import { closePool, getPool } from "../src/platform/persistence/pool";

import { getOrganizationByAutomacaoTenantId } from "../src/modules/exeq-platform/infrastructure/organization-repository";

import {

  decryptSerproConsumerKey,

  decryptSerproConsumerSecret,

  getSerproConfigByOrganizationId

} from "../src/modules/fiscal-guias/infrastructure/serpro-config-repository";

import { getActiveCertificadoForCliente } from "../src/modules/fiscal-guias/infrastructure/certificado-digital-repository";

import { serproBaseUrl } from "../src/modules/serpro-integra-contador/infrastructure/serpro-request-builder";

import { getSerproSapiTokens } from "../src/modules/serpro-integra-contador/infrastructure/serpro-sapi-auth";

import { obtainSerproProcuradorToken } from "../src/modules/serpro-integra-contador/infrastructure/serpro-jwt-token-service";

import { parseIcpBrasilCertIdentity } from "../src/modules/serpro-integra-contador/infrastructure/serpro-cert-identity";

import { isSerproProcuracaoRequired } from "../src/platform/config/fiscal-serpro-procuracao";

import { resolveSerproRuntimeForOrganization } from "../src/modules/fiscal-guias/application/resolve-serpro-runtime";



const TENANT_ID = "8";

const PORTAL_CLIENTE_ID = "64219e1e-8488-4d9a-8d9f-b3a902835d1d";



function certSubject(pem: string): string {

  try {

    const x = new X509Certificate(pem);

    return x.subject;

  } catch {

    return "parse_failed";

  }

}



async function main(): Promise<void> {

  const pool = getPool();

  const org = await getOrganizationByAutomacaoTenantId(pool, TENANT_ID);

  if (!org) throw new Error("org not found");



  const serproConfig = await getSerproConfigByOrganizationId(pool, org.id);

  if (!serproConfig) throw new Error("serpro config missing");



  const cert = await getActiveCertificadoForCliente(TENANT_ID, PORTAL_CLIENTE_ID);

  if (!cert) throw new Error("cert missing");



  const consumerKey = decryptSerproConsumerKey(serproConfig)!;

  const consumerSecret = decryptSerproConsumerSecret(serproConfig)!;

  const baseUrl = serproBaseUrl(serproConfig.ambiente);

  const identity = parseIcpBrasilCertIdentity(cert.decrypted.certificadoPem);

  const subject = certSubject(cert.decrypted.certificadoPem);



  console.log("CERT_SUBJECT:", subject);

  console.log("CERT_IDENTITY:", identity);

  console.log("CONTRATANTE:", serproConfig.contratanteCnpj);

  console.log("REQUIRE_PROCURACAO:", isSerproProcuracaoRequired());



  const evidence: Record<string, unknown> = { subject, identity, contratante: serproConfig.contratanteCnpj };



  try {

    const sapi = await getSerproSapiTokens({

      cacheKey: `probe-sapi:${Date.now()}`,

      consumerKey,

      consumerSecret,

      certificadoPem: cert.decrypted.certificadoPem,

      chavePrivadaPem: cert.decrypted.chavePrivadaPem

    });

    console.log("\nSAPI_OK access_token len=", sapi.accessToken.length, "jwt_token len=", sapi.jwtToken.length);

    evidence.sapi = { ok: true, accessTokenLen: sapi.accessToken.length, jwtTokenLen: sapi.jwtToken.length };

  } catch (e: unknown) {

    const msg = e instanceof Error ? e.message : String(e);

    console.log("\nSAPI_ERROR:", msg);

    evidence.sapi = { ok: false, error: msg };

  }



  if (isSerproProcuracaoRequired()) {

    try {

      const sapi = await getSerproSapiTokens({

        cacheKey: `probe-sapi-proc:${Date.now()}`,

        consumerKey,

        consumerSecret,

        certificadoPem: cert.decrypted.certificadoPem,

        chavePrivadaPem: cert.decrypted.chavePrivadaPem

      });

      const token = await obtainSerproProcuradorToken({

        cacheKey: `probe-proc:${Date.now()}`,

        baseUrl,

        accessToken: sapi.accessToken,

        jwtToken: sapi.jwtToken,

        contratanteCnpj: serproConfig.contratanteCnpj,

        contratanteNome: org.name,

        contribuinteCnpj: serproConfig.contratanteCnpj,

        autorDocumento: identity.documento,

        autorNome: identity.nome,

        autorTipo: identity.documentoTipo,

        certificadoPem: cert.decrypted.certificadoPem,

        chavePrivadaPem: cert.decrypted.chavePrivadaPem,

        certificadoValidUntil: cert.valid_until

      });

      console.log("\nPROCURADOR_TOKEN_OK len=", token.length);

      evidence.procuradorToken = { ok: true, len: token.length };

    } catch (e: unknown) {

      const msg = e instanceof Error ? e.message : String(e);

      console.log("\nPROCURADOR_TOKEN_ERROR:", msg);

      evidence.procuradorToken = { ok: false, error: msg };

    }

  } else {

    console.log("\nPROCURADOR_TOKEN: skipped (FISCAL_SERPRO_REQUIRE_PROCURACAO=false)");

    evidence.procuradorToken = { skipped: true };

  }



  try {

    const runtime = await resolveSerproRuntimeForOrganization({

      organizationId: org.id,

      automacaoTenantId: TENANT_ID,

      portalClienteId: PORTAL_CLIENTE_ID,

      contribuinteCnpj: serproConfig.contratanteCnpj

    });

    console.log("\nRESOLVE_RUNTIME_OK useMock=", runtime.useMock, "jwt=", !!runtime.auth.jwtToken);

    evidence.resolveRuntime = {

      ok: true,

      useMock: runtime.useMock,

      hasJwt: !!runtime.auth.jwtToken,

      hasProcurador: !!runtime.auth.procuradorToken,

      autorPedido: runtime.autorPedidoDocumento

    };

  } catch (e: unknown) {

    const msg = e instanceof Error ? e.message : String(e);

    console.log("\nRESOLVE_RUNTIME_ERROR:", msg);

    evidence.resolveRuntime = { ok: false, error: msg };

  }



  const dir = join(process.cwd(), "docs", "evidencias", "fisc-021");

  mkdirSync(dir, { recursive: true });

  const file = join(dir, `fisc-021-jwt-probe-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);

  writeFileSync(file, JSON.stringify(evidence, null, 2), "utf8");

  console.log("\nEvidencia:", file);

  await closePool();

}



main().catch(async (e) => {

  console.error(e);

  await closePool().catch(() => undefined);

  process.exit(1);

});


