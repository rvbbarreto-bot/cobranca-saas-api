import type { ChargeRow, ClienteRow } from "./api";
import { isCompleteClienteEmissionAddress } from "./cliente-emission-address";

export type ClienteListStatusPill = "ativo" | "cobranca" | "atencao" | "programado";

export type ClienteListStatus = {
  statusPill: ClienteListStatusPill;
  statusLabel: string;
  /** Cobrança em erro_emissao com cadastro pronto para nova tentativa no banco. */
  reprocessChargeId: string | null;
};

/**
 * Status operacional do cliente na lista (não é campo persistido no banco).
 *
 * Regra de negócio (Sprint O):
 * - "Atenção" = há cobrança recente em erro_emissao e o cadastro ainda impede emissão
 *   (ex.: endereço incompleto quando o gateway exige pagador com endereço).
 * - "Reemitir" = erro_emissao, mas endereço completo — ação é na cobrança, não no cadastro.
 * - Coluna "Último boleto" continua mostrando "Falha DD/MM" como histórico.
 */
export function resolveClienteListStatus(input: {
  cliente: Pick<ClienteRow, "endereco">;
  topCharge?: Pick<ChargeRow, "id" | "canonicalStatus">;
  gatewayRequiresPayerAddress: boolean;
}): ClienteListStatus {
  const top = input.topCharge;
  if (!top) {
    return { statusPill: "ativo", statusLabel: "Ativo", reprocessChargeId: null };
  }

  const st = top.canonicalStatus;
  if (st === "vencida") {
    return { statusPill: "cobranca", statusLabel: "Cobrança", reprocessChargeId: null };
  }
  if (st === "rascunho") {
    return { statusPill: "programado", statusLabel: "Programado", reprocessChargeId: null };
  }
  if (st === "cancelada") {
    return { statusPill: "ativo", statusLabel: "Ativo", reprocessChargeId: null };
  }
  if (st === "erro_emissao") {
    const addressOk = isCompleteClienteEmissionAddress(input.cliente.endereco);
    if (input.gatewayRequiresPayerAddress && addressOk) {
      return {
        statusPill: "programado",
        statusLabel: "Reemitir",
        reprocessChargeId: top.id
      };
    }
    return { statusPill: "atencao", statusLabel: "Atenção", reprocessChargeId: null };
  }

  return { statusPill: "ativo", statusLabel: "Ativo", reprocessChargeId: null };
}
