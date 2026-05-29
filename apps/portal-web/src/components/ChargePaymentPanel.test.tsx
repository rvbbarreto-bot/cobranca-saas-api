import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const openPortalChargeBoletoPdf = vi.fn();

vi.mock("../lib/charge-payment-ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/charge-payment-ui")>();
  return {
    ...actual,
    openPortalChargeBoletoPdf: (...args: unknown[]) => openPortalChargeBoletoPdf(...args)
  };
});

import { ChargePaymentPanel } from "./ChargePaymentPanel";

const boletoPayment = {
  type: "boleto" as const,
  boleto_url: "https://bank.example/boleto",
  boleto_pdf_url: "/v1/portal/cobrancas/charge-id/boleto.pdf",
  boleto_barcode: "123",
  pix_qrcode_base64: null,
  pix_emv: null,
  pix_link: null,
  expires_at: null
};

describe("ChargePaymentPanel", () => {
  it("mostra PDF proxy Inter sem link externo duplicado", () => {
    render(<ChargePaymentPanel payment={boletoPayment} chargeStatus="pendente_pagamento" />);
    expect(screen.queryByRole("link", { name: "Abrir boleto" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /abrir pdf do boleto/i })).toBeInTheDocument();
  });

  it("exibe mensagem amigavel quando falha ao abrir PDF proxy", async () => {
    openPortalChargeBoletoPdf.mockRejectedValueOnce(
      new Error("PDF do boleto indisponivel para esta cobranca.")
    );

    render(<ChargePaymentPanel payment={boletoPayment} chargeStatus="pendente_pagamento" />);
    fireEvent.click(screen.getByRole("button", { name: /abrir pdf do boleto/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/indisponivel/i);
    });
  });
});
