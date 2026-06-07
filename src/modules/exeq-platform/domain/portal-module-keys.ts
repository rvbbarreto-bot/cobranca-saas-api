/** Módulos contratáveis / habilitáveis por escritório no portal. */
export const PORTAL_MODULE_KEYS = [
  "cobranca",
  "clientes",
  "notas_fiscais",
  "fiscal_guias",
  "relatorios"
] as const;

export type PortalModuleKey = (typeof PORTAL_MODULE_KEYS)[number];

export type PortalModuleFlags = Record<PortalModuleKey, boolean>;

export const PORTAL_MODULE_LABELS: Record<PortalModuleKey, string> = {
  cobranca: "Boletos / Cobrança",
  clientes: "Clientes",
  notas_fiscais: "Notas fiscais",
  fiscal_guias: "Guias fiscais (DAS/DARF)",
  relatorios: "Relatórios / CSV"
};

export const DEFAULT_PORTAL_MODULES: PortalModuleFlags = {
  cobranca: true,
  clientes: true,
  notas_fiscais: true,
  fiscal_guias: false,
  relatorios: true
};

export function parsePortalModuleKey(value: string): PortalModuleKey | null {
  return (PORTAL_MODULE_KEYS as readonly string[]).includes(value)
    ? (value as PortalModuleKey)
    : null;
}

export function normalizePortalModuleFlags(
  input: Partial<PortalModuleFlags> | undefined
): PortalModuleFlags {
  const out = { ...DEFAULT_PORTAL_MODULES };
  if (!input) {
    return out;
  }
  for (const key of PORTAL_MODULE_KEYS) {
    if (typeof input[key] === "boolean") {
      out[key] = input[key];
    }
  }
  return out;
}
