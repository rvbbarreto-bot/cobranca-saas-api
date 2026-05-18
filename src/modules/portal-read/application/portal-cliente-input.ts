import { isValidBrTaxIdDigits } from "./br-cpf-cnpj";

export type PortalClienteCreateInput = {
  documento: string;
  nome: string;
  email: string | null;
  whatsappOptIn: boolean;
};

/** Atualização parcial (PATCH): não altera documento nesta versão. */
export type PortalClientePatchInput = {
  nome?: string;
  email?: string | null;
  whatsappOptIn?: boolean;
};

export type PortalClienteValidationIssue = { path: string; message: string };

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidBrDocumentoDigits(digits: string): boolean {
  if (digits.length === 11 || digits.length === 14) {
    return /^\d+$/.test(digits);
  }
  return false;
}

function isPlausibleEmail(value: string): boolean {
  const v = value.trim();
  if (v.length < 3 || v.length > 254) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function parsePortalClienteCreateBody(body: unknown): {
  ok: true;
  value: PortalClienteCreateInput;
} | { ok: false; issues: PortalClienteValidationIssue[] } {
  const issues: PortalClienteValidationIssue[] = [];

  if (!body || typeof body !== "object") {
    return { ok: false, issues: [{ path: "body", message: "JSON objeto obrigatorio." }] };
  }

  const b = body as Record<string, unknown>;

  const rawDoc = typeof b.documento === "string" ? onlyDigits(b.documento) : "";
  if (!isValidBrDocumentoDigits(rawDoc)) {
    issues.push({
      path: "documento",
      message: "Informe CPF (11 digitos) ou CNPJ (14 digitos), com ou sem formatacao."
    });
  } else if (!isValidBrTaxIdDigits(rawDoc)) {
    issues.push({
      path: "documento",
      message: "CPF ou CNPJ invalido (digitos verificadores)."
    });
  }

  const nomeRaw = typeof b.nome === "string" ? b.nome.trim() : "";
  if (nomeRaw.length < 1 || nomeRaw.length > 300) {
    issues.push({ path: "nome", message: "Nome obrigatorio (1 a 300 caracteres)." });
  }

  let email: string | null = null;
  if (b.email !== undefined && b.email !== null) {
    if (typeof b.email !== "string") {
      issues.push({ path: "email", message: "Email deve ser texto." });
    } else {
      const e = b.email.trim();
      if (e.length > 0) {
        if (!isPlausibleEmail(e)) {
          issues.push({ path: "email", message: "Email invalido." });
        } else {
          email = e;
        }
      }
    }
  }

  let whatsappOptIn = false;
  if (b.whatsapp_opt_in !== undefined && b.whatsapp_opt_in !== null) {
    if (typeof b.whatsapp_opt_in === "boolean") {
      whatsappOptIn = b.whatsapp_opt_in;
    } else {
      issues.push({ path: "whatsapp_opt_in", message: "whatsapp_opt_in deve ser boolean." });
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    value: {
      documento: rawDoc,
      nome: nomeRaw,
      email,
      whatsappOptIn
    }
  };
}

export function parsePortalClientePatchBody(body: unknown): {
  ok: true;
  value: PortalClientePatchInput;
} | { ok: false; issues: PortalClienteValidationIssue[] } {
  const issues: PortalClienteValidationIssue[] = [];

  if (!body || typeof body !== "object") {
    return { ok: false, issues: [{ path: "body", message: "JSON objeto obrigatorio." }] };
  }

  const b = body as Record<string, unknown>;
  const patch: PortalClientePatchInput = {};

  if (b.nome !== undefined) {
    if (typeof b.nome !== "string") {
      issues.push({ path: "nome", message: "nome deve ser texto." });
    } else {
      const nomeRaw = b.nome.trim();
      if (nomeRaw.length < 1 || nomeRaw.length > 300) {
        issues.push({ path: "nome", message: "Nome deve ter 1 a 300 caracteres." });
      } else {
        patch.nome = nomeRaw;
      }
    }
  }

  if (b.email !== undefined) {
    if (b.email === null) {
      patch.email = null;
    } else if (typeof b.email !== "string") {
      issues.push({ path: "email", message: "Email deve ser texto ou null." });
    } else {
      const e = b.email.trim();
      if (e.length === 0) {
        patch.email = null;
      } else if (!isPlausibleEmail(e)) {
        issues.push({ path: "email", message: "Email invalido." });
      } else {
        patch.email = e;
      }
    }
  }

  if (b.whatsapp_opt_in !== undefined && b.whatsapp_opt_in !== null) {
    if (typeof b.whatsapp_opt_in !== "boolean") {
      issues.push({ path: "whatsapp_opt_in", message: "whatsapp_opt_in deve ser boolean." });
    } else {
      patch.whatsappOptIn = b.whatsapp_opt_in;
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  if (patch.nome === undefined && patch.email === undefined && patch.whatsappOptIn === undefined) {
    return {
      ok: false,
      issues: [{ path: "body", message: "Informe ao menos um campo: nome, email ou whatsapp_opt_in." }]
    };
  }

  return { ok: true, value: patch };
}
