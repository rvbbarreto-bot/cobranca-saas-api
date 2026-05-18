import jwt from "jsonwebtoken";
import type { UserRole } from "../../../shared/types/request-context";

export type AccessTokenClaims = {
  sub: string;
  tid: string;
  roles: UserRole[];
};

const DEFAULT_EXPIRATION = "15m";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error("JWT_SECRET nao configurado");
  }
  return secret;
}

export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(claims, getJwtSecret(), {
    expiresIn: DEFAULT_EXPIRATION
  });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const decoded = jwt.verify(token, getJwtSecret());

  if (!decoded || typeof decoded !== "object") {
    throw new Error("Token JWT invalido");
  }

  const sub = typeof decoded.sub === "string" ? decoded.sub : "";
  const tid = typeof decoded.tid === "string" ? decoded.tid : "";
  const roles = Array.isArray(decoded.roles) ? decoded.roles.filter((r) => typeof r === "string") : [];

  if (!sub || !tid) {
    throw new Error("Claims obrigatorias ausentes no JWT");
  }

  return {
    sub,
    tid,
    roles: roles as UserRole[]
  };
}
