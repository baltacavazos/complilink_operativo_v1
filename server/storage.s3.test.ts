import { afterEach, describe, expect, it, vi } from "vitest";

describe("S3 storage env resolution", () => {
  const keys = [
    "BUCKET",
    "ACCESS_KEY_ID",
    "SECRET_ACCESS_KEY",
    "ENDPOINT",
    "REGION",
    "AWS_S3_BUCKET_NAME",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_ENDPOINT_URL",
    "AWS_REGION",
    "BUILT_IN_FORGE_API_URL",
    "BUILT_IN_FORGE_API_KEY",
  ] as const;

  afterEach(() => {
    for (const key of keys) {
      delete process.env[key];
    }
    vi.resetModules();
  });

  it("resuelve vars Railway primarias (BUCKET/ACCESS_KEY_ID/...)", async () => {
    process.env.BUCKET = "auditapatron-docs-xyz";
    process.env.ACCESS_KEY_ID = "AKIATEST";
    process.env.SECRET_ACCESS_KEY = "secret";
    process.env.ENDPOINT = "https://storage.railway.app";
    process.env.REGION = "auto";

    const { __resolveS3StorageConfigForTests } = await import("./storage");
    const cfg = __resolveS3StorageConfigForTests();
    expect(cfg.bucket).toBe("auditapatron-docs-xyz");
    expect(cfg.accessKeyId).toBe("AKIATEST");
    expect(cfg.endpoint).toBe("https://storage.railway.app");
    expect(cfg.region).toBe("auto");
  });

  it("acepta alias AWS_*", async () => {
    process.env.AWS_S3_BUCKET_NAME = "aws-bucket";
    process.env.AWS_ACCESS_KEY_ID = "aws-key";
    process.env.AWS_SECRET_ACCESS_KEY = "aws-secret";
    process.env.AWS_ENDPOINT_URL = "https://storage.railway.app/";
    process.env.AWS_REGION = "iad";

    const { __resolveS3StorageConfigForTests } = await import("./storage");
    const cfg = __resolveS3StorageConfigForTests();
    expect(cfg.bucket).toBe("aws-bucket");
    expect(cfg.accessKeyId).toBe("aws-key");
    expect(cfg.endpoint).toBe("https://storage.railway.app");
    expect(cfg.region).toBe("iad");
  });

  it("falla claro si faltan vars (no usa Forge)", async () => {
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.example";
    process.env.BUILT_IN_FORGE_API_KEY = "forge-key";

    const { __resolveS3StorageConfigForTests } = await import("./storage");
    expect(() => __resolveS3StorageConfigForTests()).toThrow(/Storage S3 incompleto/i);
    try {
      __resolveS3StorageConfigForTests();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toMatch(/BUCKET/);
      expect(message).not.toMatch(/BUILT_IN_FORGE/);
    }
  });
});
