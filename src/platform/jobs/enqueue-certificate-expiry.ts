import { isFiscalGuiasEnabled } from "../config/fiscal-guias-enabled";
import { isJobsEnabled } from "./redis-connection";
import { getQueues, QUEUE_CERTIFICATE_EXPIRY } from "./queues";
import { processCertificateVaultExpiryJob } from "../../modules/fiscal-guias/application/certificate-vault-expiry-job";

export async function enqueueCertificateExpiryJob(): Promise<void> {
  if (!isFiscalGuiasEnabled()) return;
  if (!isJobsEnabled()) {
    await processCertificateVaultExpiryJob();
    return;
  }
  await getQueues().certificateExpiry.add("refresh", {});
}

export { QUEUE_CERTIFICATE_EXPIRY };
