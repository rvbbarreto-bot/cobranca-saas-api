import { Router } from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { asyncHandler } from "../../../../platform/http/async-handler";
import { certificateValidateRateLimit } from "../../../../platform/http/middleware/rate-limit.middleware";
import { getPublicTenantIdForAutomacao } from "../../infrastructure/billing-tenant-link-repository";
import { validateAndStoreCertificateUpload } from "../../../../platform/certificate-validation/validate-certificate-upload";
import { PEM_MAX_BYTES } from "../../../../platform/certificate-validation/pem-parse-utils";
import { pemFailure } from "../../../../platform/certificate-validation/pem-error-catalog";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PEM_MAX_BYTES, files: 2, fields: 0 }
});

function isEscritorioAdmin(req: Request): boolean {
  return req.portalMembership?.role === "admin_escritorio";
}

async function resolvePublicTenant(req: Request, res: Response): Promise<string | null> {
  const automacaoTenantId = req.tenantContext?.tenantId;
  if (!automacaoTenantId) {
    res.status(500).json({ error_code: "NET-001", message: "Tenant portal ausente." });
    return null;
  }
  const publicTenantId = await getPublicTenantIdForAutomacao(automacaoTenantId);
  if (!publicTenantId) {
    res.status(409).json({
      error_code: "NET-001",
      message: "Configure portal.billing_tenant_link."
    });
    return null;
  }
  return publicTenantId;
}

export function createCertificateValidationRouter(): Router {
  const router = Router();

  router.post(
    "/validate",
    certificateValidateRateLimit,
    (req, res, next) => {
      upload.fields([
        { name: "certificate", maxCount: 1 },
        { name: "private_key", maxCount: 1 }
      ])(req, res, (err: unknown) => {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            const failure = pemFailure("ERR-004", {}, "certificate");
            res.status(422).json({
              error_code: failure.error_code,
              message: failure.message,
              field: failure.field
            });
            return;
          }
          res.status(422).json({
            error_code: "ERR-001",
            message: pemFailure("ERR-001").message
          });
          return;
        }
        if (err) {
          next(err);
          return;
        }
        next();
      });
    },
    asyncHandler(async (req, res) => {
      if (!isEscritorioAdmin(req)) {
        res.status(403).json({
          error_code: "NET-001",
          message: "Apenas admin_escritorio pode validar certificados."
        });
        return;
      }

      const tenantId = await resolvePublicTenant(req, res);
      if (!tenantId) return;

      const userId = req.authContext?.userId;
      if (!userId) {
        res.status(401).json({ error_code: "NET-001", message: "Sessão inválida." });
        return;
      }

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const certFile = files?.certificate?.[0];
      const keyFile = files?.private_key?.[0];

      if (!certFile || !keyFile) {
        const missingField = !certFile ? "certificate" : "private_key";
        const failure = pemFailure("ERR-001", {}, missingField);
        res.status(422).json({
          error_code: failure.error_code,
          message: failure.message,
          field: failure.field
        });
        return;
      }

      const result = await validateAndStoreCertificateUpload({
        tenantId,
        userId,
        certificateBuffer: certFile.buffer,
        certificateFilename: certFile.originalname,
        privateKeyBuffer: keyFile.buffer,
        privateKeyFilename: keyFile.originalname
      });

      if ("error_code" in result) {
        const status = result.error_code === "NET-001" ? 500 : 422;
        res.status(status).json({
          error_code: result.error_code,
          message: result.message,
          ...(result.field ? { field: result.field } : {})
        });
        return;
      }

      res.status(200).json({
        certificate_id: result.certificate_id,
        subject_cn: result.subject_cn,
        not_after: result.not_after,
        days_remaining: result.days_remaining,
        warnings: result.warnings,
        info: result.info
      });
    })
  );

  return router;
}
