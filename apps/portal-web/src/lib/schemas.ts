import { z } from "zod";

export const loginFormSchema = z.object({
  email: z.string().trim().email("E-mail invalido"),
  tenant_id: z.string().trim().min(1, "Tenant obrigatorio"),
  password: z.string().min(1, "Senha obrigatoria")
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;

function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

export const clienteFormSchema = z
  .object({
    documento: z.string().min(1, "Documento obrigatorio"),
    nome: z.string().trim().min(1, "Nome obrigatorio").max(300),
    email: z.string().trim().optional(),
    whatsapp_opt_in: z.boolean()
  })
  .superRefine((data, ctx) => {
    const d = onlyDigits(data.documento);
    if (d.length !== 11 && d.length !== 14) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe CPF (11 digitos) ou CNPJ (14), com ou sem formatacao.",
        path: ["documento"]
      });
    }
    const em = data.email?.trim() ?? "";
    if (em.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "E-mail invalido", path: ["email"] });
    }
  });

export type ClienteFormValues = z.infer<typeof clienteFormSchema>;

/** Edição de cliente (PATCH) — sem alterar documento. */
export const clienteEditFormSchema = z
  .object({
    nome: z.string().trim().min(1, "Nome obrigatorio").max(300),
    email: z.string().trim().optional(),
    whatsapp_opt_in: z.boolean()
  })
  .superRefine((data, ctx) => {
    const em = data.email?.trim() ?? "";
    if (em.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "E-mail invalido", path: ["email"] });
    }
  });

export type ClienteEditFormValues = z.infer<typeof clienteEditFormSchema>;

/** Formulário de nova cobrança (portal → `POST /v1/portal/cobrancas`). */
export const cobrancaFormSchema = z.object({
  reference: z.string().trim().min(1, "Referência obrigatória").max(128),
  amount: z.coerce.number().positive("Valor deve ser maior que zero"),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD"),
  portal_cliente_id: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().uuid("Selecione um cliente valido").optional()
  )
});

export type CobrancaFormValues = z.infer<typeof cobrancaFormSchema>;

export function normalizeClientePayload(values: ClienteFormValues): {
  documento: string;
  nome: string;
  email: string | null;
  whatsapp_opt_in: boolean;
} {
  const em = values.email?.trim() ?? "";
  return {
    documento: onlyDigits(values.documento),
    nome: values.nome.trim(),
    email: em.length > 0 ? em : null,
    whatsapp_opt_in: values.whatsapp_opt_in
  };
}
