import type { Pool } from "pg";
import { signPlatformMasterToken } from "../../identity-access/application/jwt-service";
import { verifyPortalPassword } from "../../portal-read/application/portal-password";

export type PlatformMasterLoginResult = {
  accessToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    fullName: string | null;
  };
};

export async function loginPlatformMaster(
  pool: Pool,
  email: string,
  password: string
): Promise<PlatformMasterLoginResult | "invalid_credentials" | "password_not_set"> {
  const q = await pool.query<{
    id: string;
    email: string;
    full_name: string | null;
    password_hash: string | null;
    is_platform_master: boolean;
  }>(
    `SELECT id::text AS id, email, full_name, password_hash, is_platform_master
     FROM portal.app_user
     WHERE lower(email) = lower($1)
     LIMIT 1`,
    [email.trim()]
  );

  const row = q.rows[0];
  if (!row?.is_platform_master) {
    return "invalid_credentials";
  }
  if (!row.password_hash) {
    return "password_not_set";
  }

  const ok = await verifyPortalPassword(password, row.password_hash);
  if (!ok) {
    return "invalid_credentials";
  }

  const expiresIn = 8 * 60 * 60;
  const accessToken = signPlatformMasterToken(row.id, { expiresIn: `${expiresIn}s` });

  return {
    accessToken,
    expiresIn,
    user: {
      id: row.id,
      email: row.email,
      fullName: row.full_name
    }
  };
}
