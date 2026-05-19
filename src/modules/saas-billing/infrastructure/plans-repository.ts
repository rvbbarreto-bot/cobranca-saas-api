import type { Pool, PoolClient } from "pg";

export type PlanRow = {
  id: string;
  nome: string;
  slug: string;
  max_clientes: number;
  max_cobrancas_mes: number;
  preco_mensal: string;
  features: Record<string, unknown>;
};

type Db = Pool | PoolClient;

export async function listPlans(db: Db): Promise<PlanRow[]> {
  const q = await db.query<PlanRow>(
    `SELECT id::text AS id, nome, slug, max_clientes, max_cobrancas_mes,
            preco_mensal::text AS preco_mensal, features
     FROM planos
     ORDER BY preco_mensal ASC`
  );
  return q.rows;
}

export async function findPlanBySlug(db: Db, slug: string): Promise<PlanRow | null> {
  const q = await db.query<PlanRow>(
    `SELECT id::text AS id, nome, slug, max_clientes, max_cobrancas_mes,
            preco_mensal::text AS preco_mensal, features
     FROM planos
     WHERE slug = $1
     LIMIT 1`,
    [slug]
  );
  return q.rows[0] ?? null;
}
