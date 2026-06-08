import { describe, expect, it } from "vitest";
import {
  buildPatchSerproConfigBody,
  isSerproIntegrationConfigured,
  validateSerproConfigForm
} from "./serpro-config-ui";
import type { SerproConfigRow } from "./api";

const VALID_CNPJ = "11222333000181";

const configured: SerproConfigRow = {
  organization_id: "org-1",
  ambiente: "demo",
  contratante_cnpj: "11.***.***/****-81",
  serpro_enabled: true,
  consumer_key_configured: true,
  consumer_secret_configured: true,
  updated_at: "2026-06-01T12:00:00.000Z"
};

describe("serpro-config-ui", () => {
  it("detecta integração configurada", () => {
    expect(isSerproIntegrationConfigured(configured)).toBe(true);
    expect(isSerproIntegrationConfigured({ ...configured, serpro_enabled: false })).toBe(false);
  });

  it("valida CNPJ contratante", () => {
    const err = validateSerproConfigForm(
      {
        ambiente: "demo",
        contratanteCnpj: "123",
        consumerKey: "",
        consumerSecret: "",
        serproEnabled: false
      },
      null
    );
    expect(err).toMatch(/CNPJ/i);
  });

  it("exige credenciais ao ativar conexão", () => {
    const err = validateSerproConfigForm(
      {
        ambiente: "demo",
        contratanteCnpj: VALID_CNPJ,
        consumerKey: "",
        consumerSecret: "",
        serproEnabled: true
      },
      null
    );
    expect(err).toMatch(/consumer/i);
  });

  it("monta PATCH omitindo credenciais vazias quando já configuradas", () => {
    const body = buildPatchSerproConfigBody(
      {
        ambiente: "prod",
        contratanteCnpj: VALID_CNPJ,
        consumerKey: "",
        consumerSecret: "",
        serproEnabled: true
      },
      configured
    );
    expect(body.ambiente).toBe("prod");
    expect(body.contratante_cnpj).toBe(VALID_CNPJ);
    expect(body.consumer_key).toBeUndefined();
    expect(body.consumer_secret).toBeUndefined();
  });
});
