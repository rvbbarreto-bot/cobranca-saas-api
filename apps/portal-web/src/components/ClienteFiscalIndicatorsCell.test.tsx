import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ClienteFiscalIndicatorsCell, ClienteNovaApuracaoLink } from "./ClienteFiscalIndicatorsCell";
import { buildClienteFiscalIndicators } from "../lib/cliente-fiscal-indicators";
import type { CertificadoDigitalRow, ProcessamentoFiscalRow, ProcuracaoRow } from "../lib/api";

const indicators = buildClienteFiscalIndicators({
  certificado: {
    id: "cert1",
    portal_cliente_id: "c1",
    label: "A1",
    valid_from: "2026-01-01",
    valid_until: "2027-01-01",
    ativo: true,
    created_at: "",
    updated_at: ""
  } satisfies CertificadoDigitalRow,
  procuracao: {
    id: "p1",
    portal_cliente_id: "c1",
    tipo: "ecac",
    procurador_documento: "123",
    validade_inicio: "2026-01-01",
    validade_fim: "2027-01-01",
    ativa: true,
    metadata: { serpro_situacao: "valida" },
    created_at: "",
    updated_at: ""
  } satisfies ProcuracaoRow,
  latestProcessamento: {
    id: "proc-1",
    portal_cliente_id: "c1",
    fiscal_ingest_id: null,
    competencia: "2026-05",
    tipo: "PGDASD",
    status: "CONCLUIDO",
    valor_apurado: null,
    protocolo_serpro: null,
    recibo_disponivel: false,
    guia_fiscal_id: null,
    erro_codigo: null,
    created_at: "",
    updated_at: ""
  } satisfies ProcessamentoFiscalRow
});

describe("ClienteFiscalIndicatorsCell", () => {
  it("renderiza três indicadores e link do processamento", () => {
    render(
      <MemoryRouter>
        <ClienteFiscalIndicatorsCell clienteId="c1" indicators={indicators} />
      </MemoryRouter>
    );
    expect(screen.getByTestId("cliente-fiscal-c1")).toBeInTheDocument();
    expect(screen.getByText("Proc. OK")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Concluído/i })).toHaveAttribute(
      "href",
      "/processamentos-fiscais/proc-1"
    );
  });

  it("Nova apuração aponta para importar com clienteId", () => {
    render(
      <MemoryRouter>
        <ClienteNovaApuracaoLink clienteId="c1" />
      </MemoryRouter>
    );
    expect(screen.getByTestId("nova-apuracao-c1")).toHaveAttribute(
      "href",
      "/processamentos-fiscais/importar?clienteId=c1"
    );
  });
});
