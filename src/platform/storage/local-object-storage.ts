import fs from "node:fs/promises";
import path from "node:path";
import type { ObjectStorage, PutObjectInput, PutObjectResult } from "./object-storage";

/** Armazenamento local para dev/testes (sem S3). */
export class LocalObjectStorage implements ObjectStorage {
  constructor(private readonly baseDir: string) {}

  private resolvePath(key: string): string {
    const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
    if (normalized.includes("..")) {
      throw new Error("Chave de objeto invalida.");
    }
    return path.join(this.baseDir, normalized);
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const filePath = this.resolvePath(input.key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, input.body);
    const base = (process.env.FISCAL_PDF_PUBLIC_BASE_URL ?? "file://local").replace(/\/$/, "");
    return { key: input.key, url: `${base}/${input.key}` };
  }

  async getPresignedGetUrl(key: string): Promise<string> {
    const base = (process.env.FISCAL_PDF_PUBLIC_BASE_URL ?? "file://local").replace(/\/$/, "");
    return `${base}/${key}`;
  }
}
