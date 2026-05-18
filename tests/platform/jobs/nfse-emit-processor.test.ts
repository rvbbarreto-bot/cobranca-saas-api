import { describe, expect, it, vi, beforeEach } from "vitest";
import { UnrecoverableError } from "bullmq";

const { enqueueMock } = vi.hoisted(() => ({
  enqueueMock: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../../../src/platform/jobs/enqueue-notification", () => ({
  enqueueNotificationJob: enqueueMock
}));

vi.mock("../../../src/platform/crypto/decrypt", () => ({
  decrypt: () => "focus-token-test"
}));

import { NfseError } from "../../../src/modules/nfse/domain/nfse-error";
import { processNfseEmit } from "../../../src/platform/jobs/application/nfse-emit-processor";

const tenantId = "00000000-0000-4000-8000-000000000001";
const chargeId = "11111111-1111-4111-8111-111111111111";

type State = {
  nfseStatus: string | null;
  chargeStatus: string;
  focusConfigured: boolean;
};

function mockClient(state: State) {
  return {
    query: vi.fn(async (sql: string) => {
      const q = sql.replace(/\s+/g, " ").trim().toLowerCase();
      if (q.includes("from nfse_emissions") && q.startsWith("select status")) {
        return { rows: state.nfseStatus ? [{ status: state.nfseStatus }] : [] };
      }
      if (q.includes("from charges c") && q.includes("portal.cliente")) {
        if (state.chargeStatus !== "paga") return { rows: [] };
        return {
          rows: [
            {
              charge_id: chargeId,
              tenant_id: tenantId,
              amount: "150.00",
              reference: "REF-1",
              canonical_status: "paga",
              cliente_nome: "Ana",
              cliente_documento: "12345678901",
              cliente_email: "ana@teste.com",
              cliente_telefone: "11999999999",
              cnpj_emissor: "12345678000199",
              inscricao_municipal: "123",
              regime_tributario: "simples",
              codigo_municipio: "3550308",
              aliquota_iss: "2",
              focus_nfe_token_encrypted: state.focusConfigured ? "enc" : null,
              encryption_iv: state.focusConfigured ? "iv" : null
            }
          ]
        };
      }
      if (q.startsWith("insert into nfse_emissions") || q.startsWith("update nfse_emissions")) {
        return { rowCount: 1 };
      }
      if (q.startsWith("insert into audit_log")) {
        return { rowCount: 1 };
      }
      return { rows: [] };
    })
  };
}

describe("processNfseEmit", () => {
  beforeEach(() => {
    enqueueMock.mockClear();
  });

  it("emite NFS-e → status autorizado e notificação enfileirada", async () => {
    const state: State = { nfseStatus: null, chargeStatus: "paga", focusConfigured: true };
    const emit = vi.fn().mockResolvedValue({
      numeroNfse: "99",
      codigoVerificacao: "X",
      pdfUrl: "https://pdf",
      xmlUrl: "https://xml",
      emitidoEm: new Date()
    });

    await processNfseEmit(
      { chargeId, tenantId },
      {
        withTenant: async (_t, fn) => fn(mockClient(state) as never),
        createAdapter: () => ({ emitir: emit }) as never
      }
    );

    expect(emit).toHaveBeenCalled();
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "nfse_emitida" }),
      expect.objectContaining({ jobId: `nfse-notif-${chargeId}` })
    );
  });

  it("NFS-e já autorizada → early return", async () => {
    const state: State = { nfseStatus: "autorizado", chargeStatus: "paga", focusConfigured: true };
    const emit = vi.fn();

    await processNfseEmit(
      { chargeId, tenantId },
      {
        withTenant: async (_t, fn) => fn(mockClient(state) as never),
        createAdapter: () => ({ emitir: emit }) as never
      }
    );

    expect(emit).not.toHaveBeenCalled();
  });

  it("Focus 422 unrecoverable → UnrecoverableError", async () => {
    const state: State = { nfseStatus: null, chargeStatus: "paga", focusConfigured: true };
    const emit = vi
      .fn()
      .mockRejectedValue(new NfseError("invalid", "FOCUS_VALIDATION", 422, true));

    await expect(
      processNfseEmit(
        { chargeId, tenantId },
        {
          withTenant: async (_t, fn) => fn(mockClient(state) as never),
          createAdapter: () => ({ emitir: emit }) as never
        }
      )
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it("cobrança não paga → UnrecoverableError", async () => {
    const state: State = { nfseStatus: null, chargeStatus: "emitida", focusConfigured: true };

    await expect(
      processNfseEmit(
        { chargeId, tenantId },
        {
          withTenant: async (_t, fn) => fn(mockClient(state) as never),
          createAdapter: () => ({ emitir: emit }) as never
        }
      )
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });
});
