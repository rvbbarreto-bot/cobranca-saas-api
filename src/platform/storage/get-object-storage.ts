import path from "node:path";
import type { ObjectStorage } from "./object-storage";
import { LocalObjectStorage } from "./local-object-storage";
import { S3ObjectStorage } from "./s3-object-storage";

let cached: ObjectStorage | null = null;

export function isS3ObjectStorageConfigured(): boolean {
  return Boolean(process.env.S3_BUCKET?.trim() && process.env.S3_REGION?.trim());
}

export function getObjectStorage(): ObjectStorage {
  if (cached) {
    return cached;
  }

  const mode = process.env.FISCAL_PDF_STORAGE?.trim().toLowerCase();
  if (mode === "local" || !isS3ObjectStorageConfigured()) {
    const baseDir =
      process.env.FISCAL_PDF_LOCAL_DIR?.trim() ||
      path.join(process.cwd(), "data", "fiscal-pdfs");
    cached = new LocalObjectStorage(baseDir);
    return cached;
  }

  cached = new S3ObjectStorage({
    bucket: process.env.S3_BUCKET!.trim(),
    region: process.env.S3_REGION!.trim(),
    endpoint: process.env.S3_ENDPOINT?.trim(),
    accessKeyId: process.env.S3_ACCESS_KEY_ID?.trim(),
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY?.trim(),
    publicBaseUrl: process.env.FISCAL_PDF_PUBLIC_BASE_URL?.trim()
  });
  return cached;
}

/** Reseta cache (testes). */
export function resetObjectStorageCache(): void {
  cached = null;
}
