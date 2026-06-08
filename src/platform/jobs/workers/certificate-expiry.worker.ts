import { Worker } from "bullmq";
import { isFiscalGuiasEnabled } from "../../config/fiscal-guias-enabled";
import { redisConnection } from "../redis-connection";
import { QUEUE_CERTIFICATE_EXPIRY } from "../queues";
import { processCertificateVaultExpiryJob } from "../../../modules/fiscal-guias/application/certificate-vault-expiry-job";
import { attachWorkerDlqHandler } from "../dlq/handle-job-final-failure";

export function registerCertificateExpiryWorker(): Worker | null {
  if (!isFiscalGuiasEnabled()) return null;
  const worker = new Worker(QUEUE_CERTIFICATE_EXPIRY, async () => {
    await processCertificateVaultExpiryJob();
  }, {
    connection: redisConnection,
    concurrency: 1
  });
  attachWorkerDlqHandler(worker, QUEUE_CERTIFICATE_EXPIRY);
  return worker;
}
