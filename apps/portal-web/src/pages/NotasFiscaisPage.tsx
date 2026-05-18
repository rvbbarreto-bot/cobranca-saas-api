import { useQuery } from "@tanstack/react-query";
import { fetchNotasFiscais } from "../lib/api";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function fmtMoney(v: string | null | undefined): string {
  if (v == null || v === "") {
    return "—";
  }
  const n = Number(v);
  if (Number.isNaN(n)) {
    return v;
  }
  return money.format(n);
}

export function NotasFiscaisPage(): JSX.Element {
  const q = useQuery({ queryKey: ["notasFiscais"], queryFn: () => fetchNotasFiscais() });

  return (
    <div className="shell-page">
      <h2 className="shell-page__title">Notas fiscais</h2>
      <p className="muted">Dados de `GET /v1/portal/notas-fiscais` (somente leitura).</p>

      {q.isLoading ? <p className="muted">Carregando…</p> : null}
      {q.isError ? <div className="banner-err">{q.error instanceof Error ? q.error.message : "Erro ao carregar"}</div> : null}

      {q.data && !q.isLoading ? (
        <div className="table-wrap">
          {q.data.count === 0 ? (
            <p className="muted padded">Nenhuma nota fiscal encontrada para este escritório.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Tomador</th>
                  <th>Documento</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>NFSe</th>
                  <th>Emissão</th>
                </tr>
              </thead>
              <tbody>
                {q.data.data.map((row, idx) => (
                  <tr key={`${String(row.numero_nfse)}-${idx}`}>
                    <td>{row.nome_tomador ?? "—"}</td>
                    <td>{row.cpf_cnpj_tomador ?? "—"}</td>
                    <td>{fmtMoney(row.valor_servicos as string | undefined)}</td>
                    <td>
                      <span className="badge">{row.status_emissao ?? "—"}</span>
                    </td>
                    <td>{row.numero_nfse ?? "—"}</td>
                    <td>{row.data_emissao ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="muted small">Total: {q.data.count}</p>
        </div>
      ) : null}
    </div>
  );
}
