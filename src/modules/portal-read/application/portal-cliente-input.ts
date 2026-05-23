import { isValidBrTaxIdDigits } from "./br-cpf-cnpj";

export type PortalClienteCreateInput = {
  documento: string;
  nome: string;
  email: string;
  telefone: string | null;
  whatsappOptIn: boolean;
};

/** Atualização parcial (PATCH): não altera documento nesta versão. */
export type PortalClientePatchInput = {
  nome?: string;
  email?: string | null;
  telefone?: string | null;
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

const PARTY_NAME = /^[\p{L}\p{N} ,.'\-]+$/u;

function isValidPartyName(name: string): boolean {
  const t = name.trim();
  return t.length >= 1 && t.length <= 100 && PARTY_NAME.test(t);
}

function isPlausibleEmail(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (v.length < 3 || v.length > 254) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function parseTelefoneField(
  b: Record<string, unknown>,
  whatsappOptIn: boolean,
  issues: PortalClienteValidationIssue[]
): string | null {
  if (b.telefone === undefined || b.telefone === null) {
    if (whatsappOptIn) {
      issues.push({
        path: "telefone",
        message: "Telefone obrigatorio quando whatsapp_opt_in for true."
      });
    }
    return null;
  }
  if (typeof b.telefone !== "string") {
    issues.push({ path: "telefone", message: "telefone deve ser texto." });
    return null;
  }
  const digits = onlyDigits(b.telefone);
  if (digits.length === 0) {
    if (whatsappOptIn) {
      issues.push({
        path: "telefone",
        message: "Telefone obrigatorio quando whatsapp_opt_in for true."
      });
    }
    return null;
  }
  if (digits.length !== 10 && digits.length !== 11) {
    issues.push({
      path: "telefone",
      message: "Telefone invalido: informe DDD + numero (10 ou 11 digitos)."
    });
    return null;
  }
  return digits;
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
  if (!isValidPartyName(nomeRaw)) {
    issues.push({
      path: "nome",
      message: "Nome obrigatorio (1 a 100 caracteres; caracteres permitidos: letras, numeros, , . - ')."
    });
  }

  let email = "";
  if (typeof b.email !== "string" || b.email.trim().length === 0) {
    issues.push({ path: "email", message: "E-mail obrigatorio para envio de cobrancas." });
  } else {
    const e = b.email.trim().toLowerCase();
    if (!isPlausibleEmail(e)) {
      issues.push({ path: "email", message: "Email invalido." });
    } else {
      email = e;
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

  const telefone = parseTelefoneField(b, whatsappOptIn, issues);

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    value: {
      documento: rawDoc,
      nome: nomeRaw,
      email,
      telefone,
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
      if (!isValidPartyName(nomeRaw)) {
        issues.push({
          path: "nome",
          message: "Nome deve ter 1 a 100 caracteres (caracteres permitidos: letras, numeros, , . - ')."
        });
      } else {
        patch.nome = nomeRaw;
      }
    }
  }

  if (b.email !== undefined) {
    if (b.email === null) {
      issues.push({ path: "email", message: "E-mail nao pode ser removido." });
    } else if (typeof b.email !== "string") {
      issues.push({ path: "email", message: "Email deve ser texto." });
    } else {
      const e = b.email.trim().toLowerCase();
      if (e.length === 0) {
        issues.push({ path: "email", message: "E-mail obrigatorio." });
      } else if (!isPlausibleEmail(e)) {
        issues.push({ path: "email", message: "Email invalido." });
      } else {
        patch.email = e;
      }
    }
  }

  const optInProvided = b.whatsapp_opt_in !== undefined && b.whatsapp_opt_in !== null;
  let nextOptIn: boolean | undefined;
  if (optInProvided) {
    if (typeof b.whatsapp_opt_in === "boolean") {
      nextOptIn = b.whatsapp_opt_in;
      patch.whatsappOptIn = b.whatsapp_opt_in;
    } else {
      issues.push({ path: "whatsapp_opt_in", message: "whatsapp_opt_in deve ser boolean." });
    }
  }

  if (b.telefone !== undefined) {
    if (b.telefone === null) {
      patch.telefone = null;
    } else if (typeof b.telefone !== "string") {
      issues.push({ path: "telefone", message: "telefone deve ser texto ou null." });
    } else {
      const digits = onlyDigits(b.telefone);
      if (digits.length === 0) {
        patch.telefone = null;
      } else if (digits.length !== 10 && digits.length !== 11) {
        issues.push({
          path: "telefone",
          message: "Telefone invalido: informe DDD + numero (10 ou 11 digitos)."
        });
      } else {
        patch.telefone = digits;
      }
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  if (
    patch.nome === undefined &&
    patch.email === undefined &&
    patch.telefone === undefined &&
    patch.whatsappOptIn === undefined
  ) {
    return {
      ok: false,
      issues: [{ path: "body", message: "Informe ao menos um campo: nome, email, telefone ou whatsapp_opt_in." }]
    };
  }

  if (nextOptIn === true && patch.telefone === undefined) {
    return {
      ok: false,
      issues: [
        {
          path: "telefone",
          message: "Informe telefone ao ativar whatsapp_opt_in ou envie telefone no mesmo PATCH."
        }
      ]
    };
  }

  if (nextOptIn === true && patch.telefone === null) {
    return {
      ok: false,
      issues: [{ path: "telefone", message: "Telefone obrigatorio quando whatsapp_opt_in for true." }]
    };
  }

  return { ok: true, value: patch };
}
