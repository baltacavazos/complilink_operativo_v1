// Railway S3-compatible object storage (private bucket).
// Does not use Manus Forge / BUILT_IN_FORGE_*.

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { ENV } from "./_core/env";

const PRESIGN_EXPIRES_SECONDS = 60 * 60; // 1 hour

type S3StorageConfig = {
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  region: string;
};

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function getS3StorageConfig(): S3StorageConfig {
  const bucket = ENV.s3Bucket;
  const accessKeyId = ENV.s3AccessKeyId;
  const secretAccessKey = ENV.s3SecretAccessKey;
  const endpoint = ENV.s3Endpoint;
  const region = ENV.s3Region || "auto";

  const missing: string[] = [];
  if (!bucket) missing.push("BUCKET (o AWS_S3_BUCKET_NAME)");
  if (!accessKeyId) missing.push("ACCESS_KEY_ID (o AWS_ACCESS_KEY_ID)");
  if (!secretAccessKey) missing.push("SECRET_ACCESS_KEY (o AWS_SECRET_ACCESS_KEY)");
  if (!endpoint) missing.push("ENDPOINT (o AWS_ENDPOINT_URL)");

  if (missing.length > 0) {
    throw new Error(
      `Storage S3 incompleto. Configura en Railway: ${missing.join(", ")}.`,
    );
  }

  return {
    bucket,
    accessKeyId,
    secretAccessKey,
    endpoint: endpoint.replace(/\/+$/, ""),
    region,
  };
}

function createS3Client(config: S3StorageConfig): S3Client {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // Railway storage is S3-compatible; path-style is safest across clients.
    forcePathStyle: true,
  });
}

function toBody(data: Buffer | Uint8Array | string): Buffer | Uint8Array | string {
  return data;
}

async function presignedGetUrl(client: S3Client, bucket: string, key: string): Promise<string> {
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: PRESIGN_EXPIRES_SECONDS },
  );
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const config = getS3StorageConfig();
  const client = createS3Client(config);
  const key = normalizeKey(relKey);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: toBody(data),
      ContentType: contentType,
    }),
  );

  const url = await presignedGetUrl(client, config.bucket, key);
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const config = getS3StorageConfig();
  const client = createS3Client(config);
  const key = normalizeKey(relKey);
  const url = await presignedGetUrl(client, config.bucket, key);
  return { key, url };
}

/** Exported for unit tests — resolves env without touching the network. */
export function __resolveS3StorageConfigForTests() {
  return getS3StorageConfig();
}
