import { Queue } from "bullmq";
import { redisConnection } from "./redis-connection";

/**
 * Nomes das filas BullMQ (v5 nao aceita ':' — use hifen).
 * Producer (queues.paymentEmission) e consumer (payment-emission.worker) DEVEM usar a mesma constante.
 */
export const QUEUE_PAYMENT_EMISSION = "charges-emission";
export const QUEUE_WEBHOOK_PROCESS = "inbox-process";
export const QUEUE_CHARGE_SYNC = "charges-sync";
export const QUEUE_NOTIFICATION_SEND = "notifications-send";
export const QUEUE_NFSE_EMIT = "nfse-emit";

export const queues = {
  paymentEmission: new Queue(QUEUE_PAYMENT_EMISSION, { connection: redisConnection }),
  webhookProcess: new Queue(QUEUE_WEBHOOK_PROCESS, { connection: redisConnection }),
  chargeSync: new Queue(QUEUE_CHARGE_SYNC, { connection: redisConnection }),
  notificationSend: new Queue(QUEUE_NOTIFICATION_SEND, { connection: redisConnection }),
  nfseEmit: new Queue(QUEUE_NFSE_EMIT, { connection: redisConnection })
};

export const JOB_OPTS = {
  emission: {
    attempts: 3,
    backoff: { type: "exponential" as const, delay: 30_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 }
  },
  notification: {
    attempts: 3,
    backoff: { type: "exponential" as const, delay: 120_000 }
  },
  nfse: {
    attempts: 5,
    backoff: { type: "exponential" as const, delay: 60_000 }
  },
  sync: { attempts: 1 }
} as const;

/** @deprecated use JOB_OPTS.emission */
export const EMISSION_JOB_OPTS = JOB_OPTS.emission;
/** @deprecated use JOB_OPTS.notification */
export const NOTIFICATION_JOB_OPTS = JOB_OPTS.notification;
/** @deprecated use JOB_OPTS.nfse */
export const NFSE_JOB_OPTS = JOB_OPTS.nfse;
/** @deprecated use JOB_OPTS.sync */
export const SYNC_JOB_OPTS = JOB_OPTS.sync;

export function getPaymentEmissionQueue(): Queue {
  return queues.paymentEmission;
}

export function getWebhookProcessQueue(): Queue {
  return queues.webhookProcess;
}

export function getChargeSyncQueue(): Queue {
  return queues.chargeSync;
}

export function getNotificationSendQueue(): Queue {
  return queues.notificationSend;
}

export function getNfseEmitQueue(): Queue {
  return queues.nfseEmit;
}
