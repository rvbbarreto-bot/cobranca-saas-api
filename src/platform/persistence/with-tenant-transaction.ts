import type { PoolClient } from "pg";
import { getPool } from "./pool";
import { setTenantSession } from "./pg-tenant-session";

export type TenantTransactionResult<T> = T;

export async function withTenantTransaction<T>(
  tenantIdUuid: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setTenantSession(client, tenantIdUuid);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
