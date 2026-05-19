import type { Pool } from "pg";
import { listPlans } from "../infrastructure/plans-repository";

export async function listPlansUseCase(pool: Pool) {
  const rows = await listPlans(pool);
  return rows.map((p) => ({
    id: p.id,
    nome: p.nome,
    slug: p.slug,
    max_clientes: p.max_clientes,
    max_cobrancas_mes: p.max_cobrancas_mes,
    preco_mensal: Number(p.preco_mensal),
    features: p.features
  }));
}
