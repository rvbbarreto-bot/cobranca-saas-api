import type { NextFunction, Request, Response } from "express";
import crypto from "node:crypto";

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-correlation-id");
  const correlationId = incoming?.trim() || crypto.randomUUID();
  req.correlationId = correlationId;
  res.setHeader("x-correlation-id", correlationId);
  next();
}
