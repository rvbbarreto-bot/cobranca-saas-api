import { Queue } from "bullmq";
import { redisConnection } from "./redis-connection";
import {
  QUEUE_CERTIFICATE_EXPIRY,
  QUEUE_FISCAL_CAPTURE,
  QUEUE_FISCAL_INGEST_VALIDATE,
  QUEUE_SERPRO_EMIT_DAS,
  QUEUE_SERPRO_RECIBO,
  QUEUE_SERPRO_TRANSMIT
} from "./queues";

export const FISCAL_MONITORED_QUEUES = [
  QUEUE_FISCAL_CAPTURE,
  QUEUE_FISCAL_INGEST_VALIDATE,
  QUEUE_SERPRO_TRANSMIT,
  QUEUE_SERPRO_RECIBO,
  QUEUE_SERPRO_EMIT_DAS,
  QUEUE_CERTIFICATE_EXPIRY
] as const;

export type FiscalMonitoredQueueName = (typeof FISCAL_MONITORED_QUEUES)[number];

const fiscalQueueCache = new Map<string, Queue>();

function getFiscalQueue(name: FiscalMonitoredQueueName): Queue {
  let q = fiscalQueueCache.get(name);
  if (!q) {
    q = new Queue(name, { connection: redisConnection });
    fiscalQueueCache.set(name, q);
  }
  return q;
}

export async function getFiscalQueueCounts(
  queueName: FiscalMonitoredQueueName
): Promise<Record<string, number>> {
  const q = getFiscalQueue(queueName);
  const counts = await q.getJobCounts(
    "waiting",
    "active",
    "completed",
    "failed",
    "delayed",
    "paused"
  );
  return counts as Record<string, number>;
}

export async function getAllFiscalQueueSnapshots(): Promise<
  Array<{ name: FiscalMonitoredQueueName; counts: Record<string, number> }>
> {
  return Promise.all(
    FISCAL_MONITORED_QUEUES.map(async (name) => ({
      name,
      counts: await getFiscalQueueCounts(name)
    }))
  );
}

/** Soma waiting + delayed + active — profundidade operacional das filas fiscais. */
export function sumFiscalQueueDepth(counts: Record<string, number>): number {
  return (counts.waiting ?? 0) + (counts.delayed ?? 0) + (counts.active ?? 0);
}

export function sumFiscalQueueDepthFromSnapshots(
  snapshots: Array<{ counts: Record<string, number> }>
): number {
  return snapshots.reduce((acc, s) => acc + sumFiscalQueueDepth(s.counts), 0);
}
