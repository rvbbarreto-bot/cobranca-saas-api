import { describe, expect, it } from "vitest";
import {
  certificadoExpiryBadgeLabel,
  certificadoExpiryTone,
  certificadoVigenciaLabel,
  formatFiscalConfigDate,
  formatProcuradorDocumento,
  procuracaoTipoLabel,
  procuracaoVigenciaLabel,
  serproSituacaoSemaphoreClass,
  serproSituacaoTone
} from "./fiscal-config-ui";

describe("fiscal-config-ui", () => {
  it("formata datas ISO", () => {
    expect(formatFiscalConfigDate("2026-05-30")).toMatch(/30\/05\/2026/);
  });

  it("rotula tipo de procuracao", () => {
    expect(procuracaoTipoLabel("ecac")).toBe("e-CAC");
  });

  it("formata CPF do procurador", () => {
    expect(formatProcuradorDocumento("12345678901")).toBe("123.456.789-01");
  });

  it("badge expiração certificado — perigo", () => {
    expect(certificadoExpiryBadgeLabel({ days_left: 5 })).toMatch(/5d/);
    expect(certificadoExpiryTone({ days_left: 5 })).toBe("danger");
  });

  it("semáforo SERPRO verde/amarelo/vermelho", () => {
    expect(serproSituacaoTone("valida")).toBe("green");
    expect(serproSituacaoTone("nao_validada")).toBe("yellow");
    expect(serproSituacaoTone("expirada")).toBe("red");
    expect(serproSituacaoSemaphoreClass("green")).toContain("green");
  });

  it("monta vigencia de certificado", () => {
    expect(
      certificadoVigenciaLabel({
        id: "1",
        portal_cliente_id: "2",
        label: "A1",
        valid_from: "2026-01-01",
        valid_until: "2027-01-01",
        ativo: true,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z"
      })
    ).toContain("2026");
  });

  it("monta vigencia de procuracao", () => {
    expect(
      procuracaoVigenciaLabel({
        id: "1",
        portal_cliente_id: "2",
        tipo: "ecac",
        procurador_documento: "12345678901",
        validade_inicio: "2026-01-01",
        validade_fim: "2027-01-01",
        ativa: true,
        metadata: {},
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z"
      })
    ).toContain("2027");
  });
});
