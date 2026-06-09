import type {
  ReceitaCaptureResult,
  ReceitaDasCaptureInput,
  ReceitaDarfCaptureInput,
  ReceitaFiscalGateway
} from "../../domain/receita-gateway.interface";

function vencimentoFromCompetencia(competencia: string): string {
  const [y, m] = competencia.split("-").map(Number);
  if (!y || !m) return "2030-12-20";
  const lastDay = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(Math.min(20, lastDay)).padStart(2, "0")}`;
}

function periodoApuracaoFromCompetencia(competencia: string): string {
  const [y, m] = competencia.split("-").map(Number);
  if (!y || !m) return "2030-12-31";
  const lastDay = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

function buildMockCapture(kind: "DAS" | "DARF", input: { cnpj: string; competencia: string }): ReceitaCaptureResult {
  const cnpj = input.cnpj.replace(/\D/g, "");
  const baseValor = kind === "DARF" ? 320 : 150;
  const valor = baseValor + (Number(cnpj.slice(-2) || "0") % 50);
  const prefix = kind === "DARF" ? "856" : "858";
  return {
    valorPrincipal: valor,
    valorMulta: 0,
    valorJuros: 0,
    dataVencimento: vencimentoFromCompetencia(input.competencia),
    linhaDigitavel: `${prefix}00000000${String(Math.round(valor * 100)).padStart(10, "0")}12340201234567890123456789012345`,
    pixCopiaCola: `00020126580014br.gov.bcb.pix0136mock-${kind.toLowerCase()}`,
    pdfBytes: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "utf8"),
    complianceStatus: "aprovado"
  };
}

/** Gateway in-process para CI/homolog sem HTTP Receita Exeq. */
export class MockReceitaFiscalGateway implements ReceitaFiscalGateway {
  async captureDas(input: ReceitaDasCaptureInput): Promise<ReceitaCaptureResult> {
    void input.certPem;
    void input.keyPem;
    return buildMockCapture("DAS", input);
  }

  async captureDarf(input: ReceitaDarfCaptureInput): Promise<ReceitaCaptureResult> {
    void input.certPem;
    void input.keyPem;
    void input.codigoReceita;
    void input.periodoApuracao;
    return buildMockCapture("DARF", input);
  }
}

export { periodoApuracaoFromCompetencia, vencimentoFromCompetencia };
