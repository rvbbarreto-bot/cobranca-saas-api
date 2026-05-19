import type { Request } from "express";

export type AuditRequestContext = {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
};

export function auditContextFromRequest(req: Request): AuditRequestContext {
  const forwarded = req.header("x-forwarded-for");
  const ip =
    (typeof forwarded === "string" && forwarded.split(",")[0]?.trim()) ||
    req.ip ||
    undefined;
  const ua = req.header("user-agent");
  return {
    userId: req.authContext?.userId,
    ipAddress: ip,
    userAgent: typeof ua === "string" ? ua : undefined
  };
}
