import express, { type Request, type Response } from "express";
import { asyncHandler } from "../async-handler";
import { authJwtMiddleware } from "../middleware/auth-jwt-middleware";
import { requireRoles } from "../middleware/rbac-middleware";
import {
  getDlqQueueCounts,
  getFailedJobs,
  getPrimaryQueueCounts,
  MONITORED_QUEUES,
  reprocessDlqJob
} from "../../jobs/dlq/dlq-service";
import { dlqQueueName } from "../../jobs/dlq/dlq-types";
import type { MonitoredQueueName } from "../../jobs/dlq/dlq-service";
import { computeSliSnapshots } from "../../observability/sli-metrics";
import { isJobsEnabled } from "../../jobs/redis-connection";

export function createAdminQueuesRouter(): express.Router {
  const router = express.Router();

  router.use(authJwtMiddleware);
  router.use(requireRoles("owner"));

  router.get(
    "/queues/status",
    asyncHandler(async (_req: Request, res: Response) => {
      if (!isJobsEnabled()) {
        res.json({
          jobsEnabled: false,
          queues: [],
          message: "BullMQ desabilitado (NODE_ENV=test ou ENABLE_BULLMQ_WORKERS=false)."
        });
        return;
      }

      const queues = await Promise.all(
        MONITORED_QUEUES.map(async (name) => {
          const counts = await getPrimaryQueueCounts(name as MonitoredQueueName);
          const dlqName = dlqQueueName(name);
          let dlqCounts: Record<string, number> = {};
          try {
            dlqCounts = await getDlqQueueCounts(name as MonitoredQueueName);
          } catch {
            dlqCounts = {};
          }
          return { name, counts, dlq: { name: dlqName, counts: dlqCounts } };
        })
      );

      const slis = await computeSliSnapshots();

      res.json({
        jobsEnabled: true,
        queues,
        slis,
        generatedAt: new Date().toISOString()
      });
    })
  );

  router.get(
    "/queues/dlq/:queueName",
    asyncHandler(async (req: Request, res: Response) => {
      const queueName = String(req.params.queueName ?? "").trim();
      if (!MONITORED_QUEUES.includes(queueName as (typeof MONITORED_QUEUES)[number])) {
        res.status(400).json({
          error: "invalid_queue",
          message: `Fila invalida. Use: ${MONITORED_QUEUES.join(", ")}`
        });
        return;
      }
      const limit = Math.min(Number(req.query.limit ?? 50), 200);
      const jobs = await getFailedJobs(queueName, limit);
      res.json({ queue: queueName, dlq: dlqQueueName(queueName), count: jobs.length, jobs });
    })
  );

  router.post(
    "/queues/dlq/:queueName/reprocess",
    asyncHandler(async (req: Request, res: Response) => {
      const queueName = String(req.params.queueName ?? "").trim();
      const jobId = String(req.body?.jobId ?? "").trim();
      if (!jobId) {
        res.status(400).json({ error: "validation_error", message: "jobId obrigatorio." });
        return;
      }
      if (!MONITORED_QUEUES.includes(queueName as (typeof MONITORED_QUEUES)[number])) {
        res.status(400).json({ error: "invalid_queue", message: "Fila invalida." });
        return;
      }
      const newJobId = await reprocessDlqJob(queueName, jobId);
      res.json({ ok: true, queue: queueName, dlqJobId: jobId, newJobId });
    })
  );

  router.get(
    "/metrics/sli",
    asyncHandler(async (_req: Request, res: Response) => {
      const slis = await computeSliSnapshots();
      res.json({
        generatedAt: new Date().toISOString(),
        slis
      });
    })
  );

  return router;
}
