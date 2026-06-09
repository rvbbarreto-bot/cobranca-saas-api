import { describe, expect, it } from "vitest";
import { competenciaSchema, guiaFiscalPersistSchema, listGuiasFiscaisQuerySchema } from "../../src/modules/fiscal-guias/domain/schemas/guia-fiscal.schema";
import { parseFiscalCaptureInboxPayload } from "../../src/modules/fiscal-guias/domain/schemas/fiscal-capture-inbox.schema";
import { parsePostCertificadoDigitalBody } from "../../src/modules/fiscal-guias/domain/schemas/certificado-digital.schema";
import { parsePostProcuracaoBody } from "../../src/modules/fiscal-guias/domain/schemas/procuracao.schema";
import { parsePostGuiaPagamentoBody } from "../../src/modules/fiscal-guias/domain/schemas/guia-pagamento.schema";
import { parseFiscalGuiaReconciliationInboxPayload } from "../../src/modules/fiscal-guias/domain/schemas/fiscal-guia-reconciliation.schema";

describe("competenciaSchema", () => {
  it("aceita YYYY-MM valido", () => {
    expect(competenciaSchema.parse("2026-04")).toBe("2026-04");
  });

  it("rejeita mes invalido", () => {
    expect(() => competenciaSchema.parse("2026-13")).toThrow();
  });
});

describe("parseFiscalCaptureInboxPayload", () => {
  it("parseia payload inbox minimo DAS", () => {
    const r = parseFiscalCaptureInboxPayload({
      event_type: "fiscal.capture.requested",
      portal_cliente_id: "550e8400-e29b-41d4-a716-446655440000",
      tipo_guia: "DAS",
      competencia: "2026-04",
      idempotency_key: "t1:cliente:2026-04:DAS"
    });
    expect(r.ok).toBe(true);
  });

  it("parseia payload inbox DARF com codigo_receita e periodo_apuracao", () => {
    const r = parseFiscalCaptureInboxPayload({
      event_type: "fiscal.capture.requested",
      portal_cliente_id: "550e8400-e29b-41d4-a716-446655440000",
      tipo_guia: "DARF",
      competencia: "2026-06",
      codigo_receita: "0561",
      periodo_apuracao: "2026-06-30",
      idempotency_key: "t1:cliente:2026-06:DARF"
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.codigo_receita).toBe("0561");
      expect(r.value.periodo_apuracao).toBe("2026-06-30");
    }
  });

  it("rejeita DARF sem codigo_receita", () => {
    const r = parseFiscalCaptureInboxPayload({
      event_type: "fiscal.capture.requested",
      portal_cliente_id: "550e8400-e29b-41d4-a716-446655440000",
      tipo_guia: "DARF",
      competencia: "2026-06",
      periodo_apuracao: "2026-06-30",
      idempotency_key: "t1:cliente:2026-06:DARF"
    });
    expect(r.ok).toBe(false);
  });
});

describe("parsePostCertificadoDigitalBody", () => {
  const pemCert = "-----BEGIN CERTIFICATE-----\n" + "A".repeat(120);
  const pemKey = "-----BEGIN PRIVATE KEY-----\n" + "B".repeat(120);

  it("valida PEM minimo", () => {
    const r = parsePostCertificadoDigitalBody({
      portal_cliente_id: "550e8400-e29b-41d4-a716-446655440000",
      label: "Matriz SP",
      valid_from: "2026-01-01",
      valid_until: "2027-01-01",
      certificado_pem: pemCert,
      chave_privada_pem: pemKey
    });
    expect(r.ok).toBe(true);
  });
});

describe("parsePostProcuracaoBody", () => {
  it("aceita CNPJ procurador", () => {
    const r = parsePostProcuracaoBody({
      portal_cliente_id: "550e8400-e29b-41d4-a716-446655440000",
      procurador_documento: "12.345.678/0001-90",
      validade_inicio: "2026-01-01",
      validade_fim: "2027-01-01"
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.procurador_documento).toHaveLength(14);
    }
  });
});

describe("listGuiasFiscaisQuerySchema", () => {
  it("aceita filtros tipo_guia e competencia", () => {
    const r = listGuiasFiscaisQuerySchema.safeParse({
      limit: 25,
      tipo_guia: "DARF",
      competencia: "2026-06"
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.tipo_guia).toBe("DARF");
      expect(r.data.competencia).toBe("2026-06");
    }
  });
});

describe("guiaFiscalPersistSchema", () => {
  it("exige idempotency_key", () => {
    const r = guiaFiscalPersistSchema.safeParse({
      portal_cliente_id: "550e8400-e29b-41d4-a716-446655440000",
      tipo_guia: "DAS",
      competencia: "2026-04",
      valor_principal: 150.5,
      idempotency_key: "key-min-8-ch"
    });
    expect(r.success).toBe(true);
  });
});

describe("parsePostGuiaPagamentoBody", () => {
  it("aceita pagamento manual minimo", () => {
    const r = parsePostGuiaPagamentoBody({
      valor_pago: 250.5,
      data_pagamento: "2026-05-15"
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.meio).toBe("manual");
    }
  });

  it("rejeita data invalida", () => {
    const r = parsePostGuiaPagamentoBody({
      valor_pago: 100,
      data_pagamento: "15-05-2026"
    });
    expect(r.ok).toBe(false);
  });
});

describe("parseFiscalGuiaReconciliationInboxPayload", () => {
  it("aceita conciliacao por linha_digitavel", () => {
    const r = parseFiscalGuiaReconciliationInboxPayload({
      event_type: "fiscal.guia.reconciliation.requested",
      idempotency_key: "rec-linha-1",
      valor_pago: 250,
      data_pagamento: "2026-06-20",
      linha_digitavel: "34191790010104351004791020150008884410026000"
    });
    expect(r.ok).toBe(true);
  });

  it("rejeita payload sem guia_fiscal_id nem linha_digitavel", () => {
    const r = parseFiscalGuiaReconciliationInboxPayload({
      event_type: "fiscal.guia.reconciliation.requested",
      idempotency_key: "rec-1",
      valor_pago: 250,
      data_pagamento: "2026-06-20"
    });
    expect(r.ok).toBe(false);
  });
});
