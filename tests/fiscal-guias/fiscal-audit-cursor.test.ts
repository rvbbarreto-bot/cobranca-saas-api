import { describe, expect, it } from "vitest";
import {
  fiscalAuditCursorFromRow,
  parseFiscalAuditListCursor,
  type FiscalAuditLogRow
} from "../../src/modules/fiscal-guias/infrastructure/fiscal-audit-repository";

const sampleRow: FiscalAuditLogRow = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  tenantId: "t1",
  userId: "u1",
  action: "download_pdf",
  resourceType: "guia_fiscal",
  resourceId: "g1",
  oldValue: null,
  newValue: null,
  ipAddress: null,
  userAgent: null,
  createdAt: new Date("2026-06-01T12:00:00.000Z")
};

describe("fiscal-audit-repository cursor", () => {
  it("serializa e parseia cursor base64url", () => {
    const cursor = fiscalAuditCursorFromRow(sampleRow);
    const parsed = parseFiscalAuditListCursor(cursor);
    expect(parsed).toEqual({
      ca: "2026-06-01T12:00:00.000Z",
      id: sampleRow.id
    });
  });

  it("rejeita cursor inválido", () => {
    expect(parseFiscalAuditListCursor("not-valid")).toBe("invalid");
    expect(parseFiscalAuditListCursor(undefined)).toBeNull();
  });
});
