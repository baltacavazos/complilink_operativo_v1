import { createHash, timingSafeEqual } from "node:crypto";

import { ENV } from "./_core/env";

export function readCurrentEngineHmacSecret() {
  return ENV.auditapatronEngineHmacSecret ?? "";
}

export function readPreviousEngineHmacSecret() {
  const value = (ENV as { auditapatronEngineHmacSecretPrevious?: string }).auditapatronEngineHmacSecretPrevious;
  return typeof value === "string" ? value.trim() : "";
}

/** Secrets accepted on inbound bridge checks. Empty values are ignored. */
export function engineHmacSecretsForValidation() {
  const current = readCurrentEngineHmacSecret().trim();
  const previous = readPreviousEngineHmacSecret();
  const secrets: string[] = [];
  if (current) secrets.push(current);
  if (previous && previous !== current) secrets.push(previous);
  return secrets;
}

export function timingSafeEqualSecret(left: string, right: string) {
  const leftDigest = createHash("sha256").update(left, "utf8").digest();
  const rightDigest = createHash("sha256").update(right, "utf8").digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

/** Compares the candidate to every secret. Does not stop at the first match. */
export function matchesAnySecret(candidate: string, secrets: readonly string[]) {
  const usable = secrets.filter((secret) => secret.length > 0);
  if (!candidate || usable.length === 0) return false;
  let matched = false;
  for (const secret of usable) {
    const equal = timingSafeEqualSecret(candidate, secret);
    matched = equal || matched;
  }
  return matched;
}
