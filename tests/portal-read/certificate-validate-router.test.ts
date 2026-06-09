import express from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import { generateKeyPairSync } from "node:crypto";
import { fileURLToPath } from "node:url";
import { signAccessToken } from "../../src/modules/identity-access/application/jwt-service";
import { createCertificateValidationRouter } from "../../src/modules/portal-read/interfaces/http/certificate-validation-router";

const { publicTenantId } = vi.hoisted(() => ({
  publicTenantId: "00000000-0000-4000-8000-000000000099"
}));

vi.mock("../../src/modules/portal-read/infrastructure/billing-tenant-link-repository", () => ({
  getPublicTenantIdForAutomacao: vi.fn().mockResolvedValue(publicTenantId)
}));

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");
const certBuffer = fs.readFileSync(path.join(fixturesDir, "test-mtls.crt"));
const keyBuffer = fs.readFileSync(path.join(fixturesDir, "test-mtls.key"));
const wrongKeyBuffer = Buffer.from(
  generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({
    type: "pkcs8",
    format: "pem"
  })
);

function buildApp(role: "admin_escritorio" | "operador" = "admin_escritorio") {
  const app = express();
  app.use((req, _res, next) => {
    req.tenantContext = { tenantId: "tenant-automacao-cert" };
    process.env.JWT_SECRET = "certificate-router-test-secret";
    const token = signAccessToken({
      sub: "user-cert",
      tid: "tenant-automacao-cert",
      roles: ["owner"]
    });
    req.headers.authorization = `Bearer ${token}`;
    req.authContext = {
      userId: "user-cert",
      tenantId: "tenant-automacao-cert",
      roles: ["owner"]
    };
    req.portalMembership = { role, cpfCnpjCliente: null };
    next();
  });
  app.use("/v1/portal/certificates", createCertificateValidationRouter());
  return app;
}

describe("POST /v1/portal/certificates/validate", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "certificate-router-test-secret";
  });

  it("retorna 200 com certificate_id para par válido (CA-01)", async () => {
    const res = await request(buildApp())
      .post("/v1/portal/certificates/validate")
      .attach("certificate", certBuffer, "cert.crt")
      .attach("private_key", keyBuffer, "key.key")
      .expect(200);

    expect(res.body.certificate_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(res.body.subject_cn).toBe("local-test");
    expect(JSON.stringify(res.body)).not.toMatch(/BEGIN PRIVATE KEY/);
  });

  it("retorna ERR-007 para par inválido (CA-06)", async () => {
    const res = await request(buildApp())
      .post("/v1/portal/certificates/validate")
      .attach("certificate", certBuffer, "cert.crt")
      .attach("private_key", wrongKeyBuffer, "wrong.key")
      .expect(422);

    expect(res.body.error_code).toBe("ERR-007");
  });

  it("nega operador (403)", async () => {
    await request(buildApp("operador"))
      .post("/v1/portal/certificates/validate")
      .attach("certificate", certBuffer, "cert.crt")
      .attach("private_key", keyBuffer, "key.key")
      .expect(403);
  });
});
