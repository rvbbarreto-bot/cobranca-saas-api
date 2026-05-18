import { Queue } from "bullmq";
import { redisConnection } from "./redis-connection";

/**
 * Nomes das filas BullMQ. Producer e consumer DEVEM importar estas constantes.
 */
export const QUEUE_PAYMENT_EMISSION = "charges:emission";
export const QUEUE_WEBHOOK_PROCESS = "inbox:process";
export const QUEUE_CHARGE_SYNC = "charges:sync";
export const QUEUE_NOTIFICATION_SEND = "notifications:send";
export const QUEUE_NFSE_EMIT = "nfse:emit";

export type JobQueues = {
  paymentEmission: Queue;
  webhookProcess: Queue;
  chargeSync: Queue;
  notificationSend: Queue;
  nfseEmit: Queue;
};

let queuesCache: JobQueues | null = null;

function createQueues(): JobQueues {
  return {
    paymentEmission: new Queue(QUEUE_PAYMENT_EMISSION, { connection: redisConnection }),
    webhookProcess: new Queue(QUEUE_WEBHOOK_PROCESS, { connection: redisConnection }),
    chargeSync: new Queue(QUEUE_CHARGE_SYNC, { connection: redisConnection }),
    notificationSend: new Queue(QUEUE_NOTIFICATION_SEND, { connection: redisConnection }),
    nfseEmit: new Queue(QUEUE_NFSE_EMIT, { connection: redisConnection })
  };
}

/** Instancia filas BullMQ sob demanda (evita ECONNREFUSED em testes com jobs desligados). */
export function getQueues(): JobQueues {
  if (!queuesCache) {
    queuesCache = createQueues();
  }
  return queuesCache;
}

/** @deprecated Prefer getQueues(); mantido para imports legados em workers. */
export const queues: JobQueues = new Proxy({} as JobQueues, {
  get(_target, prop: keyof JobQueues) {
    return getQueues()[prop];
  }
});

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
  return getQueues().paymentEmission;
}

export function getWebhookProcessQueue(): Queue {
  return getQueues().webhookProcess;
}

export function getChargeSyncQueue(): Queue {
  return getQueues().chargeSync;
}

export function getNotificationSendQueue(): Queue {
  return getQueues().notificationSend;
}

export function getNfseEmitQueue(): Queue {
  return getQueues().nfseEmit;
}
