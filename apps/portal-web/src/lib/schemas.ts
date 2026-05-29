import { z } from "zod";
import { isValidBrTaxIdDigits, onlyDigits } from "./br-tax-id";
import { buildCobrancaFormSchema, getPortalChargeRules } from "./cobranca-form";
import { isValidPartyName } from "./format-br";

export const loginFormSchema = z.object({
  email: z.string().trim().email("E-mail invalido"),
  tenant_id: z.string().trim().min(1, "Tenant obrigatorio"),
  password: z.string().min(1, "Senha obrigatoria")
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;

export const clienteTipoSchema = z.enum(["PF", "PJ"], {
  errorMap: () => ({ message: "Selecione Pessoa Fisica ou Pessoa Juridica" })
});

function refineClienteContact(
  data: { tipo: "PF" | "PJ"; documento: string; nome: string; email: string; telefone?: string; whatsapp_opt_in: boolean },
  ctx: z.RefinementCtx
): void {
  const docDigits = onlyDigits(data.documento);
  const expectedLen = data.tipo === "PF" ? 11 : 14;
  if (docDigits.length !== expectedLen) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: data.tipo === "PF" ? "CPF deve ter 11 digitos." : "CNPJ deve ter 14 digitos.",
      path: ["documento"]
    });
  } else if (!isValidBrTaxIdDigits(docDigits)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "CPF ou CNPJ invalido (digitos verificadores).",
      path: ["documento"]
    });
  }

  if (!isValidPartyName(data.nome)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Nome com 1 a 100 caracteres; use apenas letras, numeros, espacos e , . - '",
      path: ["nome"]
    });
  }

  const phoneDigits = onlyDigits(data.telefone ?? "");
  if (data.whatsapp_opt_in) {
    if (phoneDigits.length !== 10 && phoneDigits.length !== 11) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe WhatsApp com DDD (10 ou 11 digitos) quando o opt-in estiver marcado.",
        path: ["telefone"]
      });
    }
  } else if (phoneDigits.length > 0 && phoneDigits.length !== 10 && phoneDigits.length !== 11) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Telefone invalido: use DDD + numero (10 ou 11 digitos).",
      path: ["telefone"]
    });
  }
}

export const clienteFormSchema = z
  .object({
    tipo: clienteTipoSchema,
    documento: z.string().min(1, "Documento obrigatorio"),
    nome: z.string().trim().min(1, "Nome obrigatorio").max(100),
    email: z.string().trim().email("E-mail invalido").max(254, "E-mail muito longo (max. 254)"),
    telefone: z.string().optional(),
    whatsapp_opt_in: z.boolean()
  })
  .superRefine(refineClienteContact);

export type ClienteFormValues = z.infer<typeof clienteFormSchema>;

/** Edição de cliente (PATCH) — sem alterar documento. */
export const clienteEditFormSchema = z
  .object({
    nome: z.string().trim().min(1, "Nome obrigatorio").max(100),
    email: z.string().trim().email("E-mail invalido").max(254),
    telefone: z.string().optional(),
    whatsapp_opt_in: z.boolean()
  })
  .superRefine((data, ctx) => {
    if (!isValidPartyName(data.nome)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Nome com 1 a 100 caracteres; use apenas letras, numeros, espacos e , . - '",
        path: ["nome"]
      });
    }
    const phoneDigits = onlyDigits(data.telefone ?? "");
    if (data.whatsapp_opt_in) {
      if (phoneDigits.length !== 10 && phoneDigits.length !== 11) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe WhatsApp com DDD quando o opt-in estiver marcado.",
          path: ["telefone"]
        });
      }
    } else if (phoneDigits.length > 0 && phoneDigits.length !== 10 && phoneDigits.length !== 11) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Telefone invalido: use DDD + numero (10 ou 11 digitos).",
        path: ["telefone"]
      });
    }
  });

export type ClienteEditFormValues = z.infer<typeof clienteEditFormSchema>;

/** Formulário de nova cobrança — regras padrão Asaas (testes legados). */
export const cobrancaFormSchema = buildCobrancaFormSchema(getPortalChargeRules("asaas"));

export type CobrancaFormValues = z.infer<typeof cobrancaFormSchema>;

/** Edição de cobrança (PATCH) — valor e vencimento. */
export const cobrancaEditFormSchema = z.object({
  amount: z.coerce.number().positive("Valor deve ser maior que zero"),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD")
});

export type CobrancaEditFormValues = z.infer<typeof cobrancaEditFormSchema>;

export type ClienteEnderecoPayload = {
  cep: string;
  logradouro: string;
  numero?: string | null;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  uf: string;
};

export function normalizeClientePayload(
  values: ClienteFormValues,
  endereco?: ClienteEnderecoPayload | null
): {
  documento: string;
  nome: string;
  email: string;
  telefone: string | null;
  whatsapp_opt_in: boolean;
  endereco?: ClienteEnderecoPayload | null;
} {
  const phoneDigits = onlyDigits(values.telefone ?? "");
  return {
    documento: onlyDigits(values.documento),
    nome: values.nome.trim(),
    email: values.email.trim().toLowerCase(),
    telefone: phoneDigits.length > 0 ? phoneDigits : null,
    whatsapp_opt_in: values.whatsapp_opt_in,
    ...(endereco !== undefined ? { endereco } : {})
  };
}

export function normalizeClienteEditPayload(
  values: ClienteEditFormValues,
  endereco?: ClienteEnderecoPayload | null
): {
  nome: string;
  email: string;
  telefone: string | null;
  whatsapp_opt_in: boolean;
  endereco?: ClienteEnderecoPayload | null;
} {
  const phoneDigits = onlyDigits(values.telefone ?? "");
  return {
    nome: values.nome.trim(),
    email: values.email.trim().toLowerCase(),
    telefone: phoneDigits.length > 0 ? phoneDigits : null,
    whatsapp_opt_in: values.whatsapp_opt_in,
    ...(endereco !== undefined ? { endereco } : {})
  };
}
