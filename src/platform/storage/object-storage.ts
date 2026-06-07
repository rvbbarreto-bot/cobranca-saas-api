export type PutObjectInput = {
  key: string;
  body: Buffer;
  contentType?: string;
};

export type PutObjectResult = {
  key: string;
  url: string;
};

export interface ObjectStorage {
  putObject(input: PutObjectInput): Promise<PutObjectResult>;
  getPresignedGetUrl(key: string, expiresInSeconds?: number): Promise<string>;
}
