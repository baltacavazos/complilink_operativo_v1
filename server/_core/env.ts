export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  ownerBackupEmail: process.env.OWNER_BACKUP_EMAIL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  /** @deprecated Manus Forge — not used for Railway storage. Prefer S3_* / STORAGE_* below. */
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  /** @deprecated Manus Forge — not used for Railway storage. */
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  /**
   * Own storage (Railway S3-compatible). Official: S3_* / STORAGE_*.
   * Also accepts Railway inject (BUCKET/ACCESS_KEY_ID/…) and AWS_* presets.
   */
  s3Bucket:
    process.env.S3_BUCKET?.trim() ||
    process.env.STORAGE_BUCKET?.trim() ||
    process.env.BUCKET?.trim() ||
    process.env.AWS_S3_BUCKET_NAME?.trim() ||
    process.env.AWS_BUCKET?.trim() ||
    "",
  s3AccessKeyId:
    process.env.S3_ACCESS_KEY_ID?.trim() ||
    process.env.STORAGE_ACCESS_KEY_ID?.trim() ||
    process.env.ACCESS_KEY_ID?.trim() ||
    process.env.AWS_ACCESS_KEY_ID?.trim() ||
    "",
  s3SecretAccessKey:
    process.env.S3_SECRET_ACCESS_KEY?.trim() ||
    process.env.STORAGE_SECRET_ACCESS_KEY?.trim() ||
    process.env.SECRET_ACCESS_KEY?.trim() ||
    process.env.AWS_SECRET_ACCESS_KEY?.trim() ||
    "",
  s3Endpoint:
    process.env.S3_ENDPOINT?.trim() ||
    process.env.STORAGE_ENDPOINT?.trim() ||
    process.env.ENDPOINT?.trim() ||
    process.env.AWS_ENDPOINT_URL?.trim() ||
    process.env.AWS_S3_ENDPOINT?.trim() ||
    "",
  s3Region:
    process.env.S3_REGION?.trim() ||
    process.env.STORAGE_REGION?.trim() ||
    process.env.REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    process.env.AWS_DEFAULT_REGION?.trim() ||
    "auto",
  /** Optional public/base URL; download path uses presigned URLs when unset. */
  s3PublicBaseUrl:
    process.env.S3_PUBLIC_URL?.trim() ||
    process.env.STORAGE_PUBLIC_BASE_URL?.trim() ||
    "",
  auditapatronEngineWebhookUrl: process.env.AUDITAPATRON_ENGINE_WEBHOOK_URL ?? "",
  auditapatronEngineHmacSecret: process.env.AUDITAPATRON_ENGINE_HMAC_SECRET ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripePublishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
};
