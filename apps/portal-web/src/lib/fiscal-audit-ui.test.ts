import { describe, expect, it } from "vitest";
import {
  buildFiscalAuditListQuery,
  fiscalAuditActionLabel,
  fiscalAuditResourceSummary,
  formatFiscalAuditDateTime
} from "./fiscal-audit-ui";

describe("fiscal-audit-ui (EXEQ-FISC-080)", () => {
  it("traduz ações conhecidas", () => {
    expect(fiscalAuditActionLabel("download_pdf")).toBe("Download PDF");
    expect(fiscalAuditActionLabel("procuracao_validada_serpro")).toMatch(/Procuração/i);
  });

  it("monta query com filtros", () => {
    const q = buildFiscalAuditListQuery({
      from: "2026-06-01",
      to: "2026-06-08",
      action: "upload_certificado",
      userId: "admin"
    });
    expect(q.from).toBe("2026-06-01");
    expect(q.action).toBe("upload_certificado");
    expect(q.user_id).toBe("admin");
    expect(q.limit).toBe("50");
  });

  it("formata data/hora pt-BR", () => {
    const s = formatFiscalAuditDateTime("2026-06-01T15:30:00.000Z");
    expect(s).toMatch(/2026/);
  });

  it("resume recurso truncado", () => {
    expect(
      fiscalAuditResourceSummary({
        resource_type: "guia_fiscal",
        resource_id: "550e8400-e29b-41d4-a716-446655440000"
      })
    ).toMatch(/guia_fiscal/);
  });

  it("traduz ação desconhecida substituindo underscores", () => {
    expect(fiscalAuditActionLabel("custom_event_type")).toBe("custom event type");
  });

  it("devolve ISO quando data inválida", () => {
    expect(formatFiscalAuditDateTime("not-a-date")).toBe("not-a-date");
  });

  it("inclui cursor na query quando informado", () => {
    const q = buildFiscalAuditListQuery({ from: "", to: "", action: "", userId: "" }, "abc123");
    expect(q.cursor).toBe("abc123");
  });
});
