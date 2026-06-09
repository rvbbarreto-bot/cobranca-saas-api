import { randomUUID } from "node:crypto";
import { encryptAes256Gcm } from "../crypto/symmetric-encryption.js";
import { decrypt } from "../crypto/decrypt.js";
import { connectRedis } from "../persistence/redis.js";
import type { CertificateIntegrationPayload } from "./pem-deep-validation.js";

const TTL_SECONDS = 30 * 60;
const KEY_PREFIX = "cert_upload:";

type StoredUpload = {
  tenantId: string;
  userId: string;
  payload: CertificateIntegrationPayload;
};

const memoryStore = new Map<string, { expiresAt: number; ciphertext: string; iv: string }>();

function redisKey(tenantId: string, certificateId: string): string {
  return `${KEY_PREFIX}${tenantId}:${certificateId}`;
}

export async function saveCertificateUpload(
  tenantId: string,
  userId: string,
  payload: CertificateIntegrationPayload
): Promise<string> {
  const certificateId = randomUUID();
  const record: StoredUpload = { tenantId, userId, payload: { ...payload, certificate_id: certificateId } };
  const { ciphertext, iv } = encryptAes256Gcm(JSON.stringify(record));

  const redis = await connectRedis();
  if (redis) {
    await redis.set(redisKey(tenantId, certificateId), JSON.stringify({ ciphertext, iv }), {
      EX: TTL_SECONDS
    });
    return certificateId;
  }

  memoryStore.set(`${tenantId}:${certificateId}`, {
    expiresAt: Date.now() + TTL_SECONDS * 1000,
    ciphertext,
    iv
  });
  return certificateId;
}

export async function resolveCertificateUpload(
  tenantId: string,
  certificateId: string
): Promise<CertificateIntegrationPayload | null> {
  const redis = await connectRedis();
  if (redis) {
    const raw = await redis.get(redisKey(tenantId, certificateId));
    if (!raw) {
      return null;
    }
    try {
      const { ciphertext, iv } = JSON.parse(raw) as { ciphertext: string; iv: string };
      const record = JSON.parse(decrypt(ciphertext, iv)) as StoredUpload;
      if (record.tenantId !== tenantId) {
        return null;
      }
      return record.payload;
    } catch {
      return null;
    }
  }

  const entry = memoryStore.get(`${tenantId}:${certificateId}`);
  if (!entry || entry.expiresAt < Date.now()) {
    memoryStore.delete(`${tenantId}:${certificateId}`);
    return null;
  }
  try {
    const record = JSON.parse(decrypt(entry.ciphertext, entry.iv)) as StoredUpload;
    if (record.tenantId !== tenantId) {
      return null;
    }
    return record.payload;
  } catch {
    return null;
  }
}

export function clearCertificateUploadMemoryStore(): void {
  memoryStore.clear();
}
