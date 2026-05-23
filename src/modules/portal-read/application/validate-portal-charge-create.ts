import type { PoolClient } from "pg";
import { assertPortalClienteHasEmissionAddress } from "./portal-cliente-emission-address";
import {
  getPortalChargeRules,
  isDueDateAllowed,
  sanitizeChargeReference,
  type PortalChargeRules
} from "./portal-charge-rules";

export type PortalChargeValidationIssue = { path: string; message: string };

export type PortalChargeCreateFields = {
  reference: string;
  amount: number;
  due_date: string;
  portal_cliente_id?: string;
};

async function loadGatewayProvider(client: PoolClient, automacaoTenantId: string): Promise<string> {
  const r = await client.query<Record<string, unknown>>(
    `SELECT gateway_provider FROM escritorio_config WHERE tenant_id = $1 LIMIT 1`,
    [automacaoTenantId]
  );
  const row = r.rows[0];
  return row ? String(row.gateway_provider || "asaas") : "asaas";
}

export async function resolvePortalChargeRules(
  client: PoolClient,
  automacaoTenantId: string
): Promise<PortalChargeRules> {
  const provider = await loadGatewayProvider(client, automacaoTenantId);
  return getPortalChargeRules(provider);
}

export function validatePortalChargeFields(
  data: PortalChargeCreateFields,
  rules: PortalChargeRules
): PortalChargeValidationIssue[] {
  const issues: PortalChargeValidationIssue[] = [];

  const ref = sanitizeChargeReference(data.reference, rules);
  if (ref.length < 1) {
    issues.push({ path: "reference", message: "Referencia / descricao obrigatoria." });
  } else if (data.reference.trim().length > rules.referenceMaxLength) {
    issues.push({
      path: "reference",
      message: `Referencia limitada a ${rules.referenceMaxLength} caracteres para ${rules.displayName}.`
    });
  }

  if (data.amount < rules.amountMin) {
    issues.push({ path: "amount", message: `Valor minimo: R$ ${rules.amountMin.toFixed(2).replace(".", ",")}.` });
  }
  if (data.amount > rules.amountMax) {
    issues.push({ path: "amount", message: `Valor maximo: R$ ${rules.amountMax.toLocaleString("pt-BR")}.` });
  }

  if (!isDueDateAllowed(data.due_date, rules)) {
    const hint =
      rules.minDueOffsetDays === 0
        ? "Informe hoje ou uma data futura."
        : rules.minDueBusinessDays
          ? `Vencimento minimo: D+${rules.minDueOffsetDays} (dia util) para ${rules.displayName}.`
          : `Vencimento minimo: D+${rules.minDueOffsetDays} para ${rules.displayName}.`;
    issues.push({ path: "due_date", message: `Data de vencimento invalida. ${hint}` });
  }

  if (rules.requiresPayer && !data.portal_cliente_id?.trim()) {
    issues.push({
      path: "portal_cliente_id",
      message: `${rules.displayName} exige um cliente (pagador) com CPF/CNPJ cadastrado.`
    });
  }

  return issues;
}

export async function assertPortalChargeCreateAllowed(
  client: PoolClient,
  automacaoTenantId: string,
  data: PortalChargeCreateFields
): Promise<{ rules: PortalChargeRules; reference: string }> {
  const rules = await resolvePortalChargeRules(client, automacaoTenantId);
  const issues = validatePortalChargeFields(data, rules);
  if (issues.length > 0) {
    const err = new Error("PORTAL_CHARGE_VALIDATION") as Error & {
      issues: PortalChargeValidationIssue[];
    };
    err.issues = issues;
    throw err;
  }

  if (rules.requiresPayerAddress && data.portal_cliente_id?.trim()) {
    await assertPortalClienteHasEmissionAddress(
      client,
      automacaoTenantId,
      data.portal_cliente_id.trim(),
      rules.displayName
    );
  }

  return { rules, reference: sanitizeChargeReference(data.reference, rules) };
}
