import { Queue } from "bullmq";
import { redisConnection } from "./redis-connection";

/**
 * Nomes das filas BullMQ. Producer e consumer DEVEM importar estas constantes.
 */
/** BullMQ nao permite ':' no nome da fila (Redis key). */
export const QUEUE_PAYMENT_EMISSION = "charges-emission";
export const QUEUE_WEBHOOK_PROCESS = "inbox-process";
export const QUEUE_CHARGE_SYNC = "charges-sync";
export const QUEUE_NOTIFICATION_SEND = "notifications-send";

export type JobQueues = {
  paymentEmission: Queue;
  webhookProcess: Queue;
  chargeSync: Queue;
  notificationSend: Queue;
};

let queuesCache: JobQueues | null = null;

function createQueues(): JobQueues {
  return {
    paymentEmission: new Queue(QUEUE_PAYMENT_EMISSION, { connection: redisConnection }),
    webhookProcess: new Queue(QUEUE_WEBHOOK_PROCESS, { connection: redisConnection }),
    chargeSync: new Queue(QUEUE_CHARGE_SYNC, { connection: redisConnection }),
    notificationSend: new Queue(QUEUE_NOTIFICATION_SEND, { connection: redisConnection })
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

/** Backoff exponencial com teto ~8 min (Sprint K). */
const EMISSION_BACKOFF = {
  type: "exponential" as const,
  delay: 30_000
};

const WEBHOOK_BACKOFF = {
  type: "exponential" as const,
  delay: 10_000
};

export const JOB_OPTS = {
  /** emitir-boleto — 5 tentativas, backoff 30s→~8min */
  emission: {
    attempts: 5,
    backoff: EMISSION_BACKOFF,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 }
  },
  /** processar-webhook inbox */
  webhook: {
    attempts: 8,
    backoff: WEBHOOK_BACKOFF,
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 }
  },
  /** enviar-notificacao */
  notification: {
    attempts: 4,
    backoff: { type: "fixed" as const, delay: 120_000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 }
  },
  sync: { attempts: 1 }
} as const;

/** @deprecated use JOB_OPTS.emission */
export const EMISSION_JOB_OPTS = JOB_OPTS.emission;
/** @deprecated use JOB_OPTS.notification */
export const NOTIFICATION_JOB_OPTS = JOB_OPTS.notification;
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
