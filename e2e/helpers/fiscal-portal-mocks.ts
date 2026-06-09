import type { Page, Route } from "@playwright/test";
import { FISCAL_E2E_CNPJ } from "./fiscal-portal";

type MockState = {
  ingestId: string;
  processamentoId: string;
  guiaId: string;
  competencia: string;
  ingestPolls: number;
  procPolls: number;
};

function json(route: Route, status: number, body: unknown): Promise<void> {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body)
  });
}

function pathAfterFiscal(pathname: string): string {
  const idx = pathname.indexOf("/v1/portal/fiscal/");
  return idx >= 0 ? pathname.slice(idx + "/v1/portal/fiscal/".length) : pathname;
}

/**
 * Stub do pipeline fiscal portal — ingest → processamento → stepper → PDF.
 * Usado quando E2E_FISCAL_MOCK=1 (default do npm run e2e:fiscal-portal).
 */
export async function installFiscalPortalMocks(
  page: Page,
  opts?: { competencia?: string }
): Promise<MockState> {
  const state: MockState = {
    ingestId: "11111111-1111-4111-8111-111111111111",
    processamentoId: "22222222-2222-4222-8222-222222222222",
    guiaId: "33333333-3333-4333-8333-333333333333",
    competencia: opts?.competencia ?? "2025-06",
    ingestPolls: 0,
    procPolls: 0
  };

  await page.route("**/v1/portal/fiscal/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const sub = pathAfterFiscal(url.pathname);
    const method = req.method();

    if (method === "POST" && sub === "ingest/csv") {
      await json(route, 202, {
        ingest: {
          id: state.ingestId,
          status: "VALIDANDO",
          source_type: "csv",
          original_filename: "pgdasd-mock.csv",
          row_count: 0,
          valid_count: 0,
          error_count: 0,
          validation_errors: [],
          canonical_rows: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      });
      return;
    }

    if (method === "GET" && sub === `ingest/${state.ingestId}`) {
      state.ingestPolls += 1;
      const validated = state.ingestPolls >= 2;
      await json(route, 200, {
        ingest: {
          id: state.ingestId,
          status: validated ? "VALIDADO" : "VALIDANDO",
          source_type: "csv",
          original_filename: "pgdasd-mock.csv",
          row_count: 1,
          valid_count: validated ? 1 : 0,
          error_count: 0,
          validation_errors: [],
          canonical_rows: validated
            ? [
                {
                  cnpj: FISCAL_E2E_CNPJ,
                  competencia: state.competencia,
                  receita_bruta_mes: 85000,
                  valor_total_das: 2050,
                  portal_cliente_id: "44444444-4444-4444-8444-444444444444"
                }
              ]
            : [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      });
      return;
    }

    if (method === "POST" && sub === "processamentos") {
      await json(route, 201, {
        processamentos: [
          {
            id: state.processamentoId,
            portal_cliente_id: "44444444-4444-4444-8444-444444444444",
            fiscal_ingest_id: state.ingestId,
            competencia: state.competencia,
            tipo: "PGDASD_APURACAO",
            status: "VALIDADO",
            valor_apurado: "2050.00",
            protocolo_serpro: null,
            recibo_disponivel: false,
            guia_fiscal_id: null,
            erro_codigo: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]
      });
      return;
    }

    if (method === "GET" && sub === "processamentos") {
      await json(route, 200, { processamentos: [] });
      return;
    }

    if (method === "GET" && sub === `processamentos/${state.processamentoId}`) {
      state.procPolls += 1;
      const phase = Math.min(state.procPolls, 4);
      let status = "VALIDADO";
      let protocolo: string | null = null;
      let recibo = false;
      let guia: string | null = null;

      if (phase >= 2) {
        status = "TRANSMITIDA";
        protocolo = `MOCK-DECL-${FISCAL_E2E_CNPJ}`;
      }
      if (phase >= 3) {
        status = "RECIBO_OK";
        recibo = true;
      }
      if (phase >= 4) {
        status = "CONCLUIDO";
        recibo = true;
        guia = state.guiaId;
      }

      await json(route, 200, {
        processamento: {
          id: state.processamentoId,
          portal_cliente_id: "44444444-4444-4444-8444-444444444444",
          fiscal_ingest_id: state.ingestId,
          competencia: state.competencia,
          tipo: "PGDASD_APURACAO",
          status,
          valor_apurado: "2050.00",
          protocolo_serpro: protocolo,
          recibo_disponivel: recibo,
          guia_fiscal_id: guia,
          erro_codigo: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        eventos: [
          { evento: "transmissao_iniciada", created_at: new Date().toISOString() },
          ...(phase >= 2
            ? [{ evento: "transmissao_concluida", created_at: new Date().toISOString() }]
            : []),
          ...(phase >= 4 ? [{ evento: "das_concluido", created_at: new Date().toISOString() }] : [])
        ]
      });
      return;
    }

    if (method === "GET" && sub === `processamentos/${state.processamentoId}/recibo/url`) {
      await json(route, 200, {
        pdf_url: "https://example.com/mock-recibo.pdf",
        expires_in_seconds: 3600
      });
      return;
    }

    if (method === "GET" && sub === `guias/${state.guiaId}`) {
      await json(route, 200, {
        guia: {
          id: state.guiaId,
          portal_cliente_id: "44444444-4444-4444-8444-444444444444",
          tipo_guia: "DAS",
          competencia: state.competencia,
          data_vencimento: "2026-07-20",
          valor_principal: 2050,
          valor_multa: 0,
          valor_juros: 0,
          valor_total: 2050,
          linha_digitavel: null,
          pix_copia_cola: null,
          status: "DISPONIVEL",
          compliance_status: "aprovado",
          compliance_motivo: null,
          pdf_url: null,
          versao_atual: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      });
      return;
    }

    if (method === "GET" && sub === `guias/${state.guiaId}/pdf-url`) {
      await json(route, 200, {
        pdf_url: "https://example.com/mock-das.pdf",
        expires_in_seconds: 3600
      });
      return;
    }

    await route.continue();
  });

  return state;
}
