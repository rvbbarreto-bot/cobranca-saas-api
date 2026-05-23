import { z } from "zod";
import {
  getPortalChargeRules,
  isDueDateAllowed,
  sanitizeChargeReference,
  type PortalChargeRules
} from "./gateway-charge-rules";

export function buildCobrancaFormSchema(rules: PortalChargeRules) {
  return z
    .object({
      reference: z.string().trim().min(1, "Referencia / descricao obrigatoria"),
      amount: z.coerce.number(),
      due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida"),
      portal_cliente_id: z.preprocess(
        (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
        z.string().uuid("Selecione um cliente valido").optional()
      )
    })
    .superRefine((data, ctx) => {
      const ref = sanitizeChargeReference(data.reference, rules);
      if (ref.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Referencia / descricao obrigatoria",
          path: ["reference"]
        });
      }
      if (data.reference.trim().length > rules.referenceMaxLength) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Maximo ${rules.referenceMaxLength} caracteres (${rules.displayName})`,
          path: ["reference"]
        });
      }
      if (data.amount < rules.amountMin) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Valor minimo: R$ ${rules.amountMin.toFixed(2).replace(".", ",")}`,
          path: ["amount"]
        });
      }
      if (data.amount > rules.amountMax) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Valor acima do limite permitido",
          path: ["amount"]
        });
      }
      if (!isDueDateAllowed(data.due_date, rules)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: rules.minDueOffsetDays
            ? `Vencimento invalido para ${rules.displayName} (data passada ou abaixo do minimo).`
            : "Nao e permitido vencimento em data passada.",
          path: ["due_date"]
        });
      }
      if (rules.requiresPayer && !data.portal_cliente_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${rules.displayName} exige selecionar um cliente (pagador).`,
          path: ["portal_cliente_id"]
        });
      }
    });
}

export type CobrancaFormValues = z.infer<ReturnType<typeof buildCobrancaFormSchema>>;

export function normalizeCobrancaPayload(
  values: CobrancaFormValues,
  rules: PortalChargeRules
): {
  reference: string;
  amount: number;
  due_date: string;
  portal_cliente_id?: string;
} {
  return {
    reference: sanitizeChargeReference(values.reference, rules),
    amount: Math.round(values.amount * 100) / 100,
    due_date: values.due_date,
    ...(values.portal_cliente_id ? { portal_cliente_id: values.portal_cliente_id } : {})
  };
}

export { getPortalChargeRules };
